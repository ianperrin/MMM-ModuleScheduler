/* Magic Mirror
 * Node Helper: MMM-ModuleScheduler - local sun events
 *
 * Lets a schedule's `from` / `to` / `schedule` be a sun event such as "sunset", "dusk+15"
 * or "dawn-1h" instead of a cron expression. Times are calculated locally with suncalc.
 *
 * At every recalculation (a cron expression, default daily at 00:05) the event's next
 * time is worked out and scheduled as a daily cron job at that time of day. Between
 * recalculations that time of day is used unchanged.
 *
 * MIT Licensed.
 */

const SunCalc = require("suncalc");
const CronJob = require("cron").CronJob;

const DEFAULT_RECALCULATE = "0 5 0 * * *"; // every day at 00:05:00
const EXPRESSION = /^([A-Za-z][A-Za-z0-9_]*)\s*(?:([+-])\s*(\d+(?:\.\d+)?)\s*(m|min|h)?)?$/;
const addedEvents = new Set(); // custom events already registered with suncalc (survives browser reloads)

/**
 * Names of every sun event suncalc can calculate (built-in + custom), read from its
 * table of events - no sun calculation is done.
 * @returns {string[]} event names
 */
function eventNames() {
	const names = ["solarNoon", "nadir"];
	for (const t of SunCalc.times) names.push(t[1], t[2]);
	return names;
}

/**
 * Parses "event", "event+N", "event-N" (minutes) or "event+Nh" (hours).
 * @param {string} expression the from/to value
 * @returns {object|null} { event, offsetMs } or null when it does not look like a sun expression
 */
function parse(expression) {
	if (typeof expression !== "string") return null;
	const m = expression.trim().match(EXPRESSION);
	if (!m) return null;
	const amount = m[3] ? Number(m[3]) * (m[4] === "h" ? 3600000 : 60000) : 0;
	return { event: m[1], offsetMs: m[2] === "-" ? -amount : amount };
}

/**
 * Reads the location and registers custom events. Called on INITIALISE_SCHEDULER.
 * The location comes only from this module's own `sun.lat` / `sun.lon` config.
 * @param {object} sunConfig the module's `sun` config (may be undefined)
 * @param {Function} log logger
 * @returns {object} settings: { lat, lon, recalculate } (lat/lon null when not set or invalid)
 */
function configure(sunConfig, log) {
	const cfg = sunConfig || {};
	const settings = { lat: null, lon: null, recalculate: cfg.recalculate || DEFAULT_RECALCULATE };

	const latOk = typeof cfg.lat === "number" && cfg.lat >= -90 && cfg.lat <= 90;
	const lonOk = typeof cfg.lon === "number" && cfg.lon >= -180 && cfg.lon <= 180;
	if (latOk && lonOk) {
		settings.lat = cfg.lat;
		settings.lon = cfg.lon;
	} else if (cfg.lat !== undefined || cfg.lon !== undefined) {
		console.error("MMM-ModuleScheduler: sun.lat must be a number from -90 to 90 and sun.lon a number from -180 to 180 (got " + cfg.lat + ", " + cfg.lon + ")");
	}

	for (const ev of cfg.events || []) {
		if (typeof ev.angle !== "number" || !ev.rise || !ev.set) {
			console.error("MMM-ModuleScheduler: custom sun event needs angle, rise and set: " + JSON.stringify(ev));
			continue;
		}
		const key = ev.angle + "|" + ev.rise + "|" + ev.set;
		if (!addedEvents.has(key)) {
			SunCalc.addTime(ev.angle, ev.rise, ev.set);
			addedEvents.add(key);
		}
	}

	if (settings.lat !== null) log("MMM-ModuleScheduler: sun events use " + settings.lat + ", " + settings.lon + " from sun.lat / sun.lon");
	return settings;
}

/**
 * The next time the parsed event (plus offset) happens after `now`.
 * @param {object} parsed result of parse()
 * @param {object} settings result of configure()
 * @param {Date} now reference time
 * @returns {Date|null} next occurrence, or null if the event doesn't happen in the next few days (polar day/night)
 */
function nextOccurrence(parsed, settings, now) {
	// Yesterday's event can only still be ahead when a positive offset pushes it past midnight (e.g. "sunset+8h")
	for (let dayOffset = parsed.offsetMs > 0 ? -1 : 0; dayOffset <= 3; dayOffset++) {
		const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 12, 0, 0); // local noon
		const t = SunCalc.getTimes(day, settings.lat, settings.lon)[parsed.event];
		if (!t || isNaN(t)) continue;
		const when = new Date(Math.round((t.getTime() + parsed.offsetMs) / 1000) * 1000);
		if (when > now) return when;
	}
	return null;
}

/**
 * Drop-in replacement for CronJob (start/stop/nextDate) that fires at a sun event.
 */
class SunCronJob {
	/**
	 * @param {object} opts job options
	 * @param {string} opts.expression the original from/to value, e.g. "dusk+15"
	 * @param {object} opts.parsed result of parse()
	 * @param {object} opts.settings result of configure()
	 * @param {string} [opts.recalculate] cron expression for recalculation (defaults to settings.recalculate)
	 * @param {Function} opts.onTick called (with this job as `this`) when the event happens
	 * @param {Function} opts.log logger
	 */
	constructor({ expression, parsed, settings, recalculate, onTick, log }) {
		this.expression = expression;
		this.parsed = parsed;
		this.settings = settings;
		this.recalculateTime = recalculate || settings.recalculate;
		this.onTick = onTick;
		this.log = log;
		this.eventJob = null;
		this.cronTime = null;
		// throws on an invalid recalculate expression -> caught by createCronJob
		this.recalcJob = new CronJob(this.recalculateTime, () => this.recalculate(), null, true);
		this.recalculate();
	}

	/**
	 * Works out the event's next time and (re)schedules the daily job at that time of day.
	 * @param {Date} now reference time (for tests)
	 */
	recalculate(now = new Date()) {
		const next = nextOccurrence(this.parsed, this.settings, now);
		if (!next) {
			console.warn('MMM-ModuleScheduler: "' + this.expression + '" does not happen in the next few days at this location' + (this.eventJob ? "; keeping " + this.cronTime : "; nothing scheduled"));
			return;
		}
		const cronTime = next.getSeconds() + " " + next.getMinutes() + " " + next.getHours() + " * * *";
		if (cronTime === this.cronTime) return; // unchanged since the last recalculation
		if (this.eventJob) this.eventJob.stop();
		const self = this;
		this.eventJob = new CronJob(
			cronTime,
			function () {
				self.onTick.call(self);
			},
			null,
			true
		);
		this.cronTime = cronTime;
		this.log('MMM-ModuleScheduler: "' + this.expression + '" set to ' + pad(next.getHours()) + ":" + pad(next.getMinutes()) + ":" + pad(next.getSeconds()) + " daily (next " + next.toString() + '), recalculated on "' + this.recalculateTime + '"');
	}

	nextDate() {
		return this.eventJob ? this.eventJob.nextDate() : NaN;
	}

	start() {
		this.recalcJob.start();
		if (this.eventJob) this.eventJob.start();
	}

	stop() {
		this.recalcJob.stop();
		if (this.eventJob) this.eventJob.stop();
	}
}

/**
 * @param {number} n number
 * @returns {string} two-digit string
 */
function pad(n) {
	return String(n).padStart(2, "0");
}

module.exports = { SunCronJob, parse, configure, nextOccurrence, eventNames, DEFAULT_RECALCULATE };
