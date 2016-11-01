/* global module, require */
/* Magic Mirror
 * Node Helper: MMM-ModuleScheduler
 *
 * By Ian Perrin http://ianperrin.com
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
var CronJob = require("cron").CronJob;

// MODULE CONSTANTS
const SCHEDULE_TYPE_GLOBAL = "global";
const SCHEDULE_TYPE_GROUP = "group";
const SCHEDULE_TYPE_MODULE = "module";
const SCHEDULE_TYPE_NOTIFICATION = "notification";
const JOB_ACTION_SHOW = "show";
const JOB_ACTION_HIDE = "hide";
const JOB_ACTION_DIM = "dim";

module.exports = NodeHelper.create({
    scheduledJobs: [],

    // Override start method.
    start: function() {
        console.log("Starting node helper for: " + this.name);
    },

    // Override socketNotificationReceived method.
    socketNotificationReceived: function(notification, payload) {
        console.log(this.name + " received " + notification);

        if (notification === "INITIALISE_SCHEDULER") {
            console.log(this.name + " is setting the config");
            this.config = payload;
            this.removeScheduledJobs();
            return true;
        }
        if (notification === "CREATE_NOTIFICATION_SCHEDULE") {
            this.createScheduleForNotifications(payload);
            return true;
        }
        if (notification === "CREATE_GLOBAL_SCHEDULE") {
            this.createGlobalSchedules(payload);
            return true;
        }
        if (notification === "CREATE_MODULE_SCHEDULE") {
            this.createScheduleForModule(payload);
            return true;
        }
    },

    removeScheduledJobs: function() {
        console.log(this.name + " is removing all scheduled jobs");
        for (var i = 0; i < this.scheduledJobs.length; i++) {
            var scheduledJob = this.scheduledJobs[i];
            if( typeof scheduledJob.showJob === "object") {
                this.stopCronJob(scheduledJob.showJob);
            }
            if( typeof scheduledJob.hideJob === "object") {
                this.stopCronJob(scheduledJob.hideJob);
            }
            if( typeof scheduledJob.notificationJob === "object") {
                this.stopCronJob(scheduledJob.notificationJob);
            }
        }
        this.scheduledJobs.length = 0;
    },

    stopCronJob: function(cronJob){
        try {
            cronJob.stop();
        } catch(ex) {
            console.log(this.name + " could not stop cronJob");
        }
    },

    createScheduleForNotifications: function(notification_schedule){
        var notificationSchedules = this.getOrMakeArray(notification_schedule);

        for (var i = 0; i < notificationSchedules.length; i++) {
            var notificationSchedule = notificationSchedules[i];

            // Validate Schedule Definition
            if (!this.isValidSchedule(notificationSchedule, SCHEDULE_TYPE_NOTIFICATION)) { break; }

            // Create cronJobs
            console.log(this.name + " is scheduling " + notificationSchedule.notification + " using \"" + notificationSchedule.schedule);
            var notificationJob = this.createCronJobForNotification(notificationSchedule.notification, notificationSchedule.schedule, notificationSchedule.payload);
            if (!notificationJob) {
                break;
            }

            // Store scheduledJobs
            this.scheduledJobs.push({notificationJob: notificationJob});

            console.log(this.name + " has scheduled " + notificationSchedule.notification);
            console.log(this.name + " will next send " + notificationSchedule.notification + " at " + notificationJob.nextDate().toDate());

        }
    },

    createCronJobForNotification: function(notificationId, notificationCronTime, notificationPayload) {
        var self = this;

        try {
            var job = new CronJob({
                cronTime: notificationCronTime,
                onTick: function() {
                    console.log(self.name + " is sending " + notificationId + " notification");
                    if (notificationPayload) {
                        self.sendSocketNotification("SEND_NOTIFICATION", {notification: notificationId, payload: notificationPayload});
                    } else {
                        self.sendSocketNotification("SEND_NOTIFICATION", notificationId);
                    }
                    console.log(self.name + " will next send " + notificationId + " notification at " + this.nextDate().toDate() + " using \"" + notificationCronTime + "\"");
                },
                onComplete: function() {
                    console.log(self.name + " has completed the send " + notificationId + " notification job using \"" + notificationCronTime + "\"");
                },
                start: true
            });
            return job;
        } catch(ex) {
            console.log(this.name + " could not schedule " + notificationId + " notification - check expression: \"" + notificationCronTime + "\"");
        }
    },

    createScheduleForModule: function(module){
        var moduleSchedules = this.getOrMakeArray(module.schedule);
        var nextShowDate, nextHideDate, nextDimLevel;

        for (var i = 0; i < moduleSchedules.length; i++) {
            var moduleSchedule = moduleSchedules[i];

            // Validate Schedule Definition
            if (!this.isValidSchedule(moduleSchedule, SCHEDULE_TYPE_MODULE)) { break; }

            // Create cronJobs
            console.log(this.name + " is scheduling " + module.name + " using \"" + moduleSchedule.from + "\" and \"" + moduleSchedule.to + "\" with dim level " + moduleSchedule.dimLevel);
            var showJob = this.createCronJobForModule(module, moduleSchedule.from, JOB_ACTION_SHOW);
            if (!showJob) {
                break;
            }
            var hideJobAction = (moduleSchedule.dimLevel ? JOB_ACTION_DIM : JOB_ACTION_HIDE);
            var hideJob = this.createCronJobForModule(module, moduleSchedule.to, hideJobAction, moduleSchedule.dimLevel);
            if (!hideJob) {
                showJob.stop();
                break;
            }

            // Store scheduledJobs
            this.scheduledJobs.push({module: module, schedule: moduleSchedule, showJob: showJob, hideJob: hideJob});

            // Store next dates
            if (i === 0 || showJob.nextDate().toDate() < nextShowDate ) {
                nextShowDate = showJob.nextDate().toDate();
            }
            if (i === 0 || hideJob.nextDate().toDate() < nextShowDate ) {
                nextHideDate = hideJob.nextDate().toDate();
                nextDimLevel = moduleSchedule.dimLevel;
            }
        }

        if (nextHideDate && nextShowDate)
        {
            var now = new Date();
            if (nextShowDate > now && nextHideDate > nextShowDate) {
                if (nextDimLevel > 0) {
                    console.log(this.name + " is dimming " + module.name);
                    this.sendSocketNotification("DIM_MODULE", {identifier: module.id, dimLevel: nextDimLevel});
                } else {
                    console.log(this.name + " is hiding " + module.name);
                    this.sendSocketNotification("HIDE_MODULE", {identifier: module.id});
                }
            }
            console.log(this.name + " has scheduled " + module.name);
            console.log(this.name + " will next show " + module.name + " at " + nextShowDate);
            console.log(this.name + " will next " + (nextDimLevel ? JOB_ACTION_DIM : JOB_ACTION_HIDE) + " " + module.name + " at " + nextHideDate);
        }
    },

    createCronJobForModule: function(module, moduleCronTime, action, level) {
        var self = this;

        // Validate Action
        if (!this.isValidAction(action)) { return false; }

        try {
            var job = new CronJob({
                cronTime: moduleCronTime,
                onTick: function() {
                    console.log(self.name + " is sending notification to " + action + " " + module.name);
                    self.sendSocketNotification(action.toUpperCase() + "_MODULE", {identifier: module.id, dimLevel: level});
                    console.log(self.name + " will next " + action + " " + module.name + " at " + this.nextDate().toDate() + " using \"" + moduleCronTime + "\"");
                },
                onComplete: function() {
                    console.log(self.name + " has completed the " + action + " job for " + module.id + " using \"" + moduleCronTime + "\"");
                },
                start: true
            });
            return job;
        } catch(ex) {
            console.log(this.name + " could not schedule " + module.name + " - check " + action + " expression: \"" + moduleCronTime + "\"");
        }
    },

    createGlobalSchedules: function(global_schedule){
        var globalSchedules = this.getOrMakeArray(global_schedule);

        for (var i = 0; i < globalSchedules.length; i++) {
            var globalSchedule = globalSchedules[i];
            var groupOrAll = (globalSchedule.groupClass ? globalSchedule.groupClass : "all");

            // Validate Schedule Definition
            if (!this.isValidSchedule(globalSchedule, SCHEDULE_TYPE_GLOBAL)) { break; }

            // Create cronJobs
            console.log(this.name + " is creating a global schedule for " + groupOrAll + " modules using \"" + globalSchedule.from + "\" and \"" + globalSchedule.to + "\" with dim level " + globalSchedule.dimLevel);
            var showJob = this.createGlobalCronJob(globalSchedule.from, JOB_ACTION_SHOW, null, globalSchedule.groupClass, globalSchedule.ignoreModules);
            if (!showJob) {
                break;
            }
            var hideJobAction = (globalSchedule.dimLevel ? JOB_ACTION_DIM : JOB_ACTION_HIDE);
            var hideJob = this.createGlobalCronJob(globalSchedule.to, hideJobAction, globalSchedule.dimLevel, globalSchedule.groupClass, globalSchedule.ignoreModules);
            if (!hideJob) {
                showJob.stop();
                break;
            }

            // Store scheduledJobs
            this.scheduledJobs.push({schedule: globalSchedule, showJob: showJob, hideJob: hideJob});

            // Check next dates
            var nextShowDate = showJob.nextDate().toDate();
            var nextHideDate = hideJob.nextDate().toDate();
            var now = new Date();
            if (nextShowDate > now && nextHideDate > nextShowDate) {
                if (globalSchedule.dimLevel > 0) {
                    console.log(this.name + " is dimming " + groupOrAll + " modules");
                    this.sendSocketNotification("DIM_MODULES", {dimLevel: globalSchedule.dimLevel, "groupClass": globalSchedule.groupClass, ignoreModules: globalSchedule.ignoreModules});
                } else {
                    console.log(this.name + " is hiding " + groupOrAll + " modules");
                    this.sendSocketNotification("HIDE_MODULES", {"groupClass": globalSchedule.groupClass, ignoreModules: globalSchedule.ignoreModules});
                }
            }
            console.log(this.name + " has created the global schedule for " + groupOrAll + " modules");
            console.log(this.name + " will next show " + groupOrAll + " modules at " + nextShowDate);
            console.log(this.name + " will next " + (globalSchedule.dimLevel ? JOB_ACTION_DIM : JOB_ACTION_HIDE) + " " + groupOrAll + " modules at " + nextHideDate);
        }
    },

    createGlobalCronJob: function(globalCronTime, action, level, groupClass, ignoreModules) {
        var self = this;

        // Validate Action
        if (!this.isValidAction(action)) { return false; }

        try {
            var job = new CronJob({
                cronTime: globalCronTime,
                onTick: function() {
                    console.log(self.name + " is sending notification to " + action + " " + (groupClass ? groupClass : "all") + " modules");
                    self.sendSocketNotification(action.toUpperCase() + "_MODULES", {dimLevel: level, groupClass: groupClass, ignoreModules: ignoreModules} );
                    console.log(self.name + " will next " + action + " " + (groupClass ? groupClass : "all") + " modules at " + this.nextDate().toDate() + " using \"" + globalCronTime + "\"");
                },
                onComplete: function() {
                    console.log(self.name + " has completed the " + action + " job for " + (groupClass ? groupClass : "all") + " modules using \"" + globalCronTime + "\"");
                },
                start: true
            });
            return job;
        } catch(ex) {
            console.log(this.name + " could not create global schedule - check " + action + " expression: \"" + globalCronTime + "\"");
        }
    },

    // Helper functions
    getOrMakeArray: function(arrayOrString) {
        if (Array.isArray(arrayOrString)) {
            return arrayOrString;
        } else {
            return [arrayOrString];
        }
    },

    isValidSchedule: function(schedule_definition, type) {
        var requiredProperties = this.getRequiredPropertiesForType(type);
        if(!requiredProperties) {
            console.log(this.name + " cannot validate required properties for `" + type + "_schedule`");
            return false;
        }
        for(var i = 0; i < requiredProperties.length; i++) {
            var prop = requiredProperties[i];
            if (!Object.prototype.hasOwnProperty.call(schedule_definition, prop)) {
                console.log(this.name + " cannot create schedule. Missing `" + prop + "` in `" + type + "_schedule`: " + JSON.stringify(schedule_definition) );
                return false;
            }
        }
        return true;
    },

    isValidAction: function(action) {
        if(action !== JOB_ACTION_SHOW && action !== JOB_ACTION_HIDE && action !== JOB_ACTION_DIM) {
            console.log(this.name + " cannot create schedule. Expected show/hide/dim, not " + action);
            return false;
        }
        return true;
    },

    getRequiredPropertiesForType: function(type) {
        if (type === SCHEDULE_TYPE_MODULE || type === SCHEDULE_TYPE_GLOBAL || type === SCHEDULE_TYPE_GROUP) {
            return ["from", "to"];
        } else if (type === SCHEDULE_TYPE_NOTIFICATION) {
            return ["schedule", "notification"];
        } else {
            return false;
        }
    }
});