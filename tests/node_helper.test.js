const expect = require("chai").expect;
const moduleAlias = require("module-alias");
moduleAlias.addAliases({ node_helper: "../../js/node_helper.js", logger: "../js/logger.js" });
var Module = require("../node_helper.js");
var helper = new Module();
helper.setName("MMM-ModuleScheduler");

describe("Functions in node_helper.js", function () {
	describe("getOrMakeArray", function () {
		it(`for a string should return an array`, function () {
			expect(helper.getOrMakeArray("dsg")).to.eql(["dsg"]);
		});
		it(`for an array should return an array`, function () {
			expect(helper.getOrMakeArray(["dsg"])).to.eql(["dsg"]);
		});
		it(`for a multiple value array should return an array`, function () {
			expect(helper.getOrMakeArray(["dsg", "sss"])).to.eql(["dsg", "sss"]);
		});
	});
	describe("isValidSchedule", function () {
		["global", "group", "module"].forEach((scheduleType) => {
			const validSchedules = {
				"from-to": { from: "0 5 * * *", to: "0 9 * * *" }
			};
			describe(`for '${scheduleType}' valid schedules`, function () {
				Object.keys(validSchedules).forEach((schedule) => {
					it(`for '${schedule}' should return true`, function () {
						expect(helper.isValidSchedule(validSchedules[schedule], scheduleType)).to.be.true;
					});
				});
			});
		});
		["notification"].forEach((scheduleType) => {
			const validSchedules = {
				"from-to": { schedule: "0 5 * * *", notification: "TEST" }
			};
			describe(`for '${scheduleType}' valid schedules`, function () {
				Object.keys(validSchedules).forEach((schedule) => {
					it(`for '${schedule}' should return true`, function () {
						expect(helper.isValidSchedule(validSchedules[schedule], scheduleType)).to.be.true;
					});
				});
			});
		});
		const invalidSchedules = {
			"from-hide": { from: "0 5 * * *", hide: "0 9 * * *" },
			"show-to": { show: "0 5 * * *", to: "0 9 * * *" },
			"show-hide": { show: "0 5 * * *", hide: "0 9 * * *" },
			"schedule-id": { schedule: "0 5 * * *", id: "TEST" },
			"from-notification": { from: "0 5 * * *", notification: "TEST" },
			"from-id": { from: "0 5 * * *", id: "TEST" },
			empty: {}
		};
		["global", "group", "module", "notification"].forEach((scheduleType) => {
			describe(`for '${scheduleType}' invalid schedules`, function () {
				Object.keys(invalidSchedules).forEach((schedule) => {
					it(`for '${schedule}' should return false`, function () {
						expect(helper.isValidSchedule(invalidSchedules[schedule], scheduleType)).to.be.false;
					});
				});
			});
		});
	});
	describe("getRequiredPropertiesForType", function () {
		const scheduleTypeProps = {
			global: ["from", "to"],
			group: ["from", "to"],
			module: ["from", "to"],
			notification: ["schedule", "notification"]
		};
		Object.keys(scheduleTypeProps).forEach((scheduleTypeProp) => {
			it(`for '${scheduleTypeProp}' should return '${scheduleTypeProps[scheduleTypeProp]}'`, function () {
				expect(helper.getRequiredPropertiesForType(scheduleTypeProp)).to.eql(scheduleTypeProps[scheduleTypeProp]);
			});
		});
	});
	describe("isValidAction", function () {
		const actions = {
			show: true,
			hide: true,
			dim: true,
			send: true,
			"anything else": false
		};
		Object.keys(actions).forEach((action) => {
			it(`for '${action}' should return '${actions[action]}'`, function () {
				expect(helper.isValidAction(action)).to.eql(actions[action]);
			});
		});
	});
});
