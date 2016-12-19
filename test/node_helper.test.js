/*global require,exports */
var Module = require("../node_helper.js");
var helper = new Module();
helper.setName("MMM-ModuleScheduler");

// getOrMakeArray
exports.getOrMakeArray = function (test) {
    test.expect(3);
    test.ok(Array.isArray(helper.getOrMakeArray("dsg")), "should always return an array");
    test.ok(Array.isArray(helper.getOrMakeArray(["dsg"])), "should always return an array");
    test.ok(Array.isArray(helper.getOrMakeArray(["dsg", "sss"])), "should always return an array");
    test.done();
};

// isValidSchedule
exports.isValidSchedule = function (test) {
    test.expect(20);

    // Global schedules
    test.ok(helper.isValidSchedule({from: "0 5 * * *", to: "0 9 * * *"}, "global"), "expected true");
    test.ok(!helper.isValidSchedule({from: "0 5 * * *", hide: "0 9 * * *"}, "global"), "expected false");
    test.ok(!helper.isValidSchedule({show: "0 5 * * *", to: "0 9 * * *"}, "global"), "expected false");
    test.ok(!helper.isValidSchedule({show: "0 5 * * *", hide: "0 9 * * *"}, "global"), "expected false");
    test.ok(!helper.isValidSchedule({}, "global"), "expected false");

    // Group schedules
    test.ok(helper.isValidSchedule({from: "0 5 * * *", to: "0 9 * * *"}, "group"), "expected true");
    test.ok(!helper.isValidSchedule({from: "0 5 * * *", hide: "0 9 * * *"}, "group"), "expected false");
    test.ok(!helper.isValidSchedule({show: "0 5 * * *", to: "0 9 * * *"}, "group"), "expected false");
    test.ok(!helper.isValidSchedule({show: "0 5 * * *", hide: "0 9 * * *"}, "group"), "expected false");
    test.ok(!helper.isValidSchedule({}, "group"), "expected false");

    // Module schedules
    test.ok(helper.isValidSchedule({from: "0 5 * * *", to: "0 9 * * *"}, "module"), "expected true");
    test.ok(!helper.isValidSchedule({from: "0 5 * * *", hide: "0 9 * * *"}, "module"), "expected false");
    test.ok(!helper.isValidSchedule({show: "0 5 * * *", to: "0 9 * * *"}, "module"), "expected false");
    test.ok(!helper.isValidSchedule({show: "0 5 * * *", hide: "0 9 * * *"}, "module"), "expected false");
    test.ok(!helper.isValidSchedule({}, "module"), "expected false");

    // Notification schedules
    test.ok(helper.isValidSchedule({schedule: "0 5 * * *", notification: "TEST"}, "notification"), "expected true");
    test.ok(!helper.isValidSchedule({schedule: "0 5 * * *", id: "TEST"}, "notification"), "expected false");
    test.ok(!helper.isValidSchedule({from: "0 5 * * *", notification: "TEST"}, "notification"), "expected false");
    test.ok(!helper.isValidSchedule({from: "0 5 * * *", id: "TEST"}, "notification"), "expected false");
    test.ok(!helper.isValidSchedule({}, "notification"), "expected false");

    test.done();
};

// getRequiredPropertiesForType
exports.getRequiredPropertiesForType = function (test) {
    test.expect(4);
    test.deepEqual(helper.getRequiredPropertiesForType("global"), ["from", "to"], "Global schedules require from and to properties");
    test.deepEqual(helper.getRequiredPropertiesForType("group"), ["from", "to"], "Group schedules require from and to properties");
    test.deepEqual(helper.getRequiredPropertiesForType("module"), ["from", "to"], "Module schedules require from and to properties");
    test.deepEqual(helper.getRequiredPropertiesForType("notification"), ["schedule", "notification"], "Notification schedules require from and to properties");
    test.done();
};

// isValidAction
exports.isValidAction = function (test) {
    test.expect(5);
    test.ok(helper.isValidAction("show"), "expected true");
    test.ok(helper.isValidAction("hide"), "expected true");
    test.ok(helper.isValidAction("dim"), "expected true");
    test.ok(helper.isValidAction("send"), "expected true");
    test.ok(!helper.isValidAction("anything else"), "expected false");
    test.done();
};
