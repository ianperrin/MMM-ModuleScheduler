/* Magic Mirror
 * Module: MMM-ModuleScheduler
 *
 * By Ian Perrin http://ianperrin.com
 * MIT Licensed.
 */
Module.register("MMM-ModuleScheduler", {
	// Set the minimum MagicMirror module version for this module.
	requiresVersion: "2.0.0",
	// Module config defaults.
	defaults: {
		schedulerClass: "scheduler",
		animationSpeed: 1000,
		notification_schedule: false,
		global_schedule: false,
		debug: true,
		uselock: true
	},
	// Define start sequence.
	start: function () {
		Log.info("Starting module: " + this.name);
		this.sendSocketNotification("INITIALISE_SCHEDULER", this.config);
	},
	notificationReceived: function (notification, payload, sender) {
		if (sender) {
			return;
		}
		if (notification === "ALL_MODULES_STARTED" && this.config.notification_schedule) {
			// Create notification schedules
			this.sendSocketNotification("CREATE_NOTIFICATION_SCHEDULE", this.config.notification_schedule);
		}
		if (notification === "DOM_OBJECTS_CREATED") {
			// Create global schedules
			if (typeof this.config.global_schedule === "object") {
				this.sendSocketNotification("CREATE_GLOBAL_SCHEDULE", this.config.global_schedule);
			}
			// Create module schedules
			this.createModuleSchedules();
		}
	},
	socketNotificationReceived: function (notification, payload) {
		// module schedule
		if (notification === "SHOW_MODULE" || notification === "HIDE_MODULE" || notification === "DIM_MODULE") {
			Log.log(this.name + " received a " + notification + " notification for " + payload.target);
			this.executeModuleSchedule(payload, notification);
			return;
		}
		// global schedule
		if (notification === "SHOW_MODULES" || notification === "HIDE_MODULES" || notification === "DIM_MODULES") {
			Log.log(this.name + " received a " + notification + " notification for " + (payload.target ? payload.target : "all") + " modules");
			this.executeGlobalSchedule(payload, notification);
			return;
		}
		// notification schedule
		if (notification === "SEND_NOTIFICATION") {
			Log.log(this.name + " received a request to send a " + payload.target + " notification");
			this.sendNotification(payload.target, payload.payload);
			return;
		}
	},
	createModuleSchedules: function () {
		MM.getModules()
			.exceptModule(this)
			.withClass(this.config.schedulerClass)
			.enumerate((module) => {
				Log.log(this.name + " wants to schedule the display of " + module.name);
				if (typeof module.config.module_schedule === "object") {
					this.sendSocketNotification("CREATE_MODULE_SCHEDULE", { name: module.name, id: module.identifier, schedule: module.config.module_schedule });
				} else {
					Log.error(module.name + " is configured to be scheduled, but the module_schedule option is undefined");
				}
			});
	},
	executeModuleSchedule: function (module_schedule, action) {
		const module = MM.getModules()
			.exceptModule(this)
			.withClass(this.config.schedulerClass)
			.find((module) => module.identifier === module_schedule.target);
		const dimLevel = module_schedule.dimLevel ? module_schedule.dimLevel : "25";
		if (module) {
			this.setModuleDisplay(module, action, dimLevel);
		}
	},
	executeGlobalSchedule: function (global_schedule, action) {
		// Get all modules except this one
		let modules = MM.getModules().exceptModule(this);
		// Restrict to group of modules with specified class
		if (global_schedule.target) {
			modules = modules.withClass(global_schedule.target);
		}
		// Ignore specified modules
		if (global_schedule.ignoreModules) {
			Log.log(this.name + " is ignoring " + global_schedule.ignoreModules + " from the " + action + " notification for " + (global_schedule.target ? global_schedule.target : "all") + " modules");
			modules = modules.filter((module) => !global_schedule.ignoreModules.includes(module.name));
		}
		// Process the notification request
		action = action.replace("_MODULES", "_MODULE");
		const brightness = global_schedule.dimLevel ? global_schedule.dimLevel : "25";
		modules.forEach((module) => this.setModuleDisplay(module, action, brightness));
	},
	setModuleDisplay: function (module, action, brightness) {
		const options = this.config.uselock ? { lockString: this.identifier } : "";
		Log.log(this.name + " is processing the " + action + (action === "DIM_MODULE" ? " (" + brightness + "%)" : "") + " request for " + module.identifier);
		if (action === "SHOW_MODULE") {
			module.show(
				this.config.animationSpeed,
				() => {
					Log.log(this.name + " has shown " + module.identifier);
					this.setModuleBrightness(module.identifier, 100);
				},
				options
			);
			return true;
		}
		if (action === "HIDE_MODULE") {
			module.hide(this.config.animationSpeed, Log.log(this.name + " has hidden " + module.identifier), options);
			return true;
		}
		if (action === "DIM_MODULE") {
			this.setModuleBrightness(module.identifier, brightness);
			return true;
		}
		return false;
	},
	setModuleBrightness(moduleIdentifier, brightness = 100) {
		const moduleDiv = document.getElementById(moduleIdentifier);
		if (moduleDiv) {
			moduleDiv.style.filter = "brightness(" + brightness + "%)";
			Log.log(this.name + " has set the brightness of " + moduleIdentifier + " to " + brightness + "%");
		}
	}
});
