/* global module, require */
/* jshint node: true, esversion: 6 */
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
const JOB_ACTION_SEND = "send";

module.exports = NodeHelper.create({
    scheduledJobs: [],

    // Override start method.
    start: function() {
        console.log("Starting node helper for: " + this.name);
    },

    // Override socketNotificationReceived method.
    socketNotificationReceived: function(notification, payload) {
        this.log(this.name + " received " + notification);

        if (notification === "INITIALISE_SCHEDULER") {
            this.log(this.name + " is setting the config");
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
        this.log(this.name + " is removing all scheduled jobs");
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
            this.log(this.name + " could not stop cronJob");
        }
    },

    createScheduleForNotifications: function(notification_schedule){
        var notificationSchedules = this.getOrMakeArray(notification_schedule);

        for (var i = 0; i < notificationSchedules.length; i++) {
            var notificationSchedule = notificationSchedules[i];

            // Validate Schedule Definition
            if (!this.isValidSchedule(notificationSchedule, SCHEDULE_TYPE_NOTIFICATION)) { break; }

            // Create cronJobs
            this.log(this.name + " is scheduling " + notificationSchedule.notification + " using \"" + notificationSchedule.schedule);
            var notificationJob = this.createCronJob(SCHEDULE_TYPE_NOTIFICATION, notificationSchedule.schedule, JOB_ACTION_SEND, {target: notificationSchedule.notification, payload: notificationSchedule.payload});
            if (!notificationJob) {
                break;
            }

            // Store scheduledJobs
            this.scheduledJobs.push({notificationJob: notificationJob});

            this.log(this.name + " has scheduled " + notificationSchedule.notification);
            this.log(this.name + " will next send " + notificationSchedule.notification + " at " + notificationJob.nextDate().toDate());

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
            this.log(this.name + " is scheduling " + module.name + " using \"" + moduleSchedule.from + "\" and \"" + moduleSchedule.to + "\" with dim level " + moduleSchedule.dimLevel);
            var showJob = this.createCronJob(SCHEDULE_TYPE_MODULE, moduleSchedule.from, JOB_ACTION_SHOW, {target: module.id});

            if (!showJob) {
                break;
            }
            var hideJobAction = (moduleSchedule.dimLevel ? JOB_ACTION_DIM : JOB_ACTION_HIDE);
            var hideJob = this.createCronJob(SCHEDULE_TYPE_MODULE, moduleSchedule.to, hideJobAction, {target: module.id, dimLevel: moduleSchedule.dimLevel});
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
                    this.log(this.name + " is dimming " + module.name);
                    this.sendSocketNotification("DIM_MODULE", {target: module.id, dimLevel: nextDimLevel});
                } else {
                    this.log(this.name + " is hiding " + module.name);
                    this.sendSocketNotification("HIDE_MODULE", {target: module.id});
                }
            }
            this.log(this.name + " has scheduled " + module.name);
            this.log(this.name + " will next show " + module.name + " at " + nextShowDate);
            this.log(this.name + " will next " + (nextDimLevel ? JOB_ACTION_DIM : JOB_ACTION_HIDE) + " " + module.name + " at " + nextHideDate);
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
            this.log(this.name + " is creating a global schedule for " + groupOrAll + " modules using \"" + globalSchedule.from + "\" and \"" + globalSchedule.to + "\" with dim level " + globalSchedule.dimLevel);
            var showJob = this.createCronJob(SCHEDULE_TYPE_GLOBAL, globalSchedule.from, JOB_ACTION_SHOW, {target: globalSchedule.groupClass, ignoreModules: globalSchedule.ignoreModules});
            if (!showJob) {
                break;
            }
            var hideJobAction = (globalSchedule.dimLevel ? JOB_ACTION_DIM : JOB_ACTION_HIDE);
            var hideJob = this.createCronJob(SCHEDULE_TYPE_GLOBAL, globalSchedule.to, hideJobAction, {dimLevel: globalSchedule.dimLevel, target: globalSchedule.groupClass, ignoreModules: globalSchedule.ignoreModules});
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
                    this.log(this.name + " is dimming " + groupOrAll + " modules");
                    this.sendSocketNotification("DIM_MODULES", {dimLevel: globalSchedule.dimLevel, target: globalSchedule.groupClass, ignoreModules: globalSchedule.ignoreModules});
                } else {
                    this.log(this.name + " is hiding " + groupOrAll + " modules");
                    this.sendSocketNotification("HIDE_MODULES", {target: globalSchedule.groupClass, ignoreModules: globalSchedule.ignoreModules});
                }
            }
            this.log(this.name + " has created the global schedule for " + groupOrAll + " modules");
            this.log(this.name + " will next show " + groupOrAll + " modules at " + nextShowDate);
            this.log(this.name + " will next " + (globalSchedule.dimLevel ? JOB_ACTION_DIM : JOB_ACTION_HIDE) + " " + groupOrAll + " modules at " + nextHideDate);
        }
    },

    /**
     * Returns a CronJob object that has been scheduled to trigger the
     * specified action based on the supplied cronTime and options
     *
     * @param  type     the type of schedule to be created (either global, module or notification)
     * @param  cronTime a cron expression which determines when the job will fire
     * @param  action   the action which should be performed (either show, hide, dim or send)
     * @param  options  an object containing the options for the job (e.g. target, dimLevel, ignoreModules)
     * @return      the scheduled cron job
     * @see         CronJob
     */
    createCronJob: function(type, cronTime, action, options) {
        var self = this;

        // Validate Action
        if (!this.isValidAction(action)) { return false; }

        // Build notification
        var notification = action.toUpperCase();
        notification += (type === SCHEDULE_TYPE_NOTIFICATION ? "_NOTIFICATION" : "_MODULE");
        notification += (type === SCHEDULE_TYPE_GLOBAL ? "S" : "");

        try {
            var job = new CronJob({
                cronTime: cronTime,
                onTick: function() {
                    self.log(self.name + " is sending " + notification + " to " + options.target);
                    self.sendSocketNotification(notification, options);
                    self.log(self.name + " will next send " + notification + " to " + options.target + " at " + this.nextDate().toDate() + " based on \"" + cronTime + "\"");
                },
                onComplete: function() {
                    self.log(self.name + " has completed the " + action + " job for " + options.target + " based on \"" + cronTime + "\"");
                },
                start: true
            });
            return job;
        } catch(ex) {
            this.log(this.name + " could not create " + type + " schedule - check " + action + " expression: \"" + cronTime + "\"");
        }

    },

    /**
     * Returns either the original array or a new array holding the supplied value
     *
     * @param  arrayOrString     either an existing array or value to be used to create the new array
     * @return      an array
     * @see         Array
     */
    getOrMakeArray: function(arrayOrString) {
        if (Array.isArray(arrayOrString)) {
            return arrayOrString;
        } else {
            return [arrayOrString];
        }
    },

    /**
     * Validates a schedule definition by determining whether it has the required
     * properties defined
     *
     * @param  schedule_definition  The schedule definition to be validated
     * @param  type                 the type of schedule to be created (either global, module or notification)
     * @return      true or false
     */
    isValidSchedule: function(schedule_definition, type) {
        var requiredProperties = this.getRequiredPropertiesForType(type);
        if(!requiredProperties) {
            this.log(this.name + " cannot validate required properties for `" + type + "_schedule`");
            return false;
        }
        for(var i = 0; i < requiredProperties.length; i++) {
            var prop = requiredProperties[i];
            if (!Object.prototype.hasOwnProperty.call(schedule_definition, prop)) {
                this.log(this.name + " cannot create schedule. Missing `" + prop + "` in `" + type + "_schedule`: " + JSON.stringify(schedule_definition) );
                return false;
            }
        }
        return true;
    },

    /**
     * Determine whether a string is a valid action
     *
     * @param  action  The string to be validated
     * @return      true or false
     */
    isValidAction: function(action) {
        if(action !== JOB_ACTION_SHOW && action !== JOB_ACTION_HIDE && action !== JOB_ACTION_DIM && action !== JOB_ACTION_SEND) {
            this.log(this.name + " cannot create schedule. Expected show/hide/dim/send, not " + action);
            return false;
        }
        return true;
    },

    /**
     * Gets an array of names for the properties required by the given schedule type
     *
     * @param  type  The scheduled type for which properties are required
     * @return      An Array of property names
     */
    getRequiredPropertiesForType: function(type) {
        if (type === SCHEDULE_TYPE_MODULE || type === SCHEDULE_TYPE_GLOBAL || type === SCHEDULE_TYPE_GROUP) {
            return ["from", "to"];
        } else if (type === SCHEDULE_TYPE_NOTIFICATION) {
            return ["schedule", "notification"];
        } else {
            return false;
        }
    },
    
    /**
     * Outputs a message to the console/log when debugging is enabled
     *
     * @param  msg  A string containing the message to be output 
     */
    log: function(msg) {
        if (this.config && this.config.debug) {
            console.log(msg);
        }
    }
});