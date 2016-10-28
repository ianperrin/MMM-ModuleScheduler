/* global module, require */
/* Magic Mirror
 * Node Helper: MMM-ModuleScheduler
 *
 * By Ian Perrin http://ianperrin.com
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
var CronJob = require("cron").CronJob;

module.exports = NodeHelper.create({
    scheduledJobs: [],

    // Override start method.
    start: function() {
        console.log("Starting node helper for: " + this.name);
    },

    // Override socketNotificationReceived method.
    socketNotificationReceived: function(notification, payload) {
        console.log(this.name + ' received ' + notification);

        if (notification === "INITIALISE_SCHEDULER") {
            console.log(this.name + ' is setting the config');
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
        console.log(this.name + ' is removing all scheduled jobs');
        for (var i = 0; i < this.scheduledJobs.length; i++) {
            var scheduledJob = this.scheduledJobs[i];
            if( typeof scheduledJob.showJob === 'object') {
                this.stopCronJob(scheduledJob.showJob);
            }
            if( typeof scheduledJob.hideJob === 'object') {
                this.stopCronJob(scheduledJob.hideJob);
            }
            if( typeof scheduledJob.notificationJob === 'object') {
                this.stopCronJob(scheduledJob.notificationJob);
            }
        }
        this.scheduledJobs.length = 0;
    },
    
    stopCronJob: function(cronJob){
        try {
            cronJob.stop();
        } catch(ex) {
            console.log(this.name + ' could not stop cronJob');
        }  
    },

    createScheduleForNotifications: function(notification_schedule){
        var notificationSchedules = [];

        if (Array.isArray(notification_schedule)) {
            notificationSchedules = notification_schedule;
        } else {
            notificationSchedules.push(notification_schedule);
        }

        for (var i = 0; i < notificationSchedules.length; i++) {
            var notificationSchedule = notificationSchedules[i];

            if (!notificationSchedule.hasOwnProperty('schedule') || !notificationSchedule.hasOwnProperty('notification')) {
                console.log(this.name + ' cannot schedule ' + notificationSchedule + ' - check notification_schedule');
                break;
            }
    
            // Create cronJobs
            console.log(this.name + ' is scheduling ' + notificationSchedule.notification + ' using \'' + notificationSchedule.schedule);
            var notificationJob = this.createCronJobForNotification(notificationSchedule.notification, notificationSchedule.schedule, notificationSchedule.payload);
            if (!notificationJob) {
                break;
            }
            
            // Store scheduledJobs
            this.scheduledJobs.push({notificationJob: notificationJob});
            
            console.log(this.name + ' has scheduled ' + notificationSchedule.notification);
            console.log(this.name + ' will next send ' + notificationSchedule.notification + ' at ' + notificationJob.nextDate().toDate());

        }

    },

    createCronJobForNotification: function(notificationId, notificationCronTime, notificationPayload) {
        var self = this;

        try {
            var job = new CronJob({
                cronTime: notificationCronTime, 
                onTick: function() {
                    console.log(self.name + ' is sending ' + notificationId + ' notification');
                    if (notificationPayload) {
                        self.sendSocketNotification('SEND_NOTIFICATION', {notification: notificationId, payload: notificationPayload});
                    } else {
                        self.sendSocketNotification('SEND_NOTIFICATION', notificationId);
                    }
                    console.log(self.name + ' will next send ' + notificationId + ' notification at ' + this.nextDate().toDate() + ' using \'' + notificationCronTime + '\'');
                }, 
                onComplete: function() {
                    console.log(self.name + ' has completed the send ' + notificationId + ' notification job using \'' + notificationCronTime + '\'');
                }, 
                start: true
            });
            return job;
        } catch(ex) {
            console.log(this.name + ' could not schedule ' + notificationId + ' notification - check expression: \'' + notificationCronTime + '\'');
        }
    },

    createScheduleForModule: function(module){
        var moduleSchedules = [];
        var nextShowDate, nextHideDate, nextDimLevel;

        if (Array.isArray(module.schedule)) {
            moduleSchedules = module.schedule;
        } else {
            moduleSchedules.push(module.schedule);
        }
        
        for (var i = 0; i < moduleSchedules.length; i++) {
            var moduleSchedule = moduleSchedules[i];

            if (!moduleSchedule.hasOwnProperty('from') || !moduleSchedule.hasOwnProperty('to')) {
                console.log(this.name + ' cannot schedule' + module.name + ' - check module_schedule');
                break;
            }
    
            // Create cronJobs
            console.log(this.name + ' is scheduling ' + module.name + ' using \'' + moduleSchedule.from + '\' and \'' + moduleSchedule.to + '\' with dim level ' + moduleSchedule.dimLevel);
            var showJob = this.createCronJobForModule(module, moduleSchedule.from, 'show');
            if (!showJob) {
                break;
            }
            var hideJob = this.createCronJobForModule(module, moduleSchedule.to, (moduleSchedule.dimLevel ? 'dim' : 'hide'), moduleSchedule.dimLevel);
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
                    console.log(this.name + ' is dimming ' + module.name);
                    this.sendSocketNotification('DIM_MODULE', {identifier: module.id, dimLevel: nextDimLevel});
                } else {
                    console.log(this.name + ' is hiding ' + module.name);
                    this.sendSocketNotification('HIDE_MODULE', {identifier: module.id});
                }
            }
            console.log(this.name + ' has scheduled ' + module.name);
            console.log(this.name + ' will next show ' + module.name + ' at ' + nextShowDate);
            console.log(this.name + ' will next ' + (nextDimLevel ? 'dim' : 'hide') + ' ' + module.name + ' at ' + nextHideDate);
        }        
    },

    createCronJobForModule: function(module, moduleCronTime, action, level) {
        var self = this;

        if(action !== 'show' && action !== 'hide' && action !== 'dim') {
            console.log(self.name + ' requires show/hide/dim for type, not ' + action);
            return false;
        }
        
        try {
            var job = new CronJob({
                cronTime: moduleCronTime, 
                onTick: function() {
                    console.log(self.name + ' is sending notification to ' + action + ' ' + module.name);
                    self.sendSocketNotification(action.toUpperCase() + '_MODULE', {identifier: module.id, dimLevel: level});
                    console.log(self.name + ' will next ' + action + ' ' + module.name + ' at ' + this.nextDate().toDate() + ' using \'' + moduleCronTime + '\'');
                }, 
                onComplete: function() {
                    console.log(self.name + ' has completed the ' + action + ' job for ' + module.id + ' using \'' + moduleCronTime + '\'');
                }, 
                start: true
            });
            return job;
        } catch(ex) {
            console.log(this.name + ' could not schedule ' + module.name + ' - check ' + action + ' expression: \'' + moduleCronTime + '\'');
        }
    },

    createGlobalSchedules: function(global_schedule){
        var globalSchedules = [];
        var nextShowDate, nextHideDate, nextDimLevel, nextGroupClass;

        if (Array.isArray(global_schedule)) {
            globalSchedules = global_schedule;
        } else {
            globalSchedules.push(global_schedule);
        }
        
        for (var i = 0; i < globalSchedules.length; i++) {
            var globalSchedule = globalSchedules[i];

            if (!globalSchedule.hasOwnProperty('from') || !globalSchedule.hasOwnProperty('to')) {
                console.log(this.name + ' cannot create schedule for ' + JSON.stringify(globalSchedule) + ' - check global_schedule');
                break;
            }
    
            // Create cronJobs
            console.log(this.name + ' is creating a global schedule using \'' + globalSchedule.from + '\' and \'' + globalSchedule.to + '\' with dim level ' + globalSchedule.dimLevel);
            var showJob = this.createGlobalCronJob(globalSchedule.from, 'show', null, globalSchedule.groupClass);
            if (!showJob) {
                break;
            }
            var hideJob = this.createGlobalCronJob(globalSchedule.to, (globalSchedule.dimLevel ? 'dim' : 'hide'), globalSchedule.dimLevel, globalSchedule.groupClass);
            if (!hideJob) {
                showJob.stop();
                break;
            }
    
            // Store scheduledJobs
            this.scheduledJobs.push({schedule: globalSchedule, showJob: showJob, hideJob: hideJob});
            
            // Store next dates
            if (i === 0 || showJob.nextDate().toDate() < nextShowDate ) {
                nextShowDate = showJob.nextDate().toDate();
            }
            if (i === 0 || hideJob.nextDate().toDate() < nextShowDate ) {
                nextHideDate = hideJob.nextDate().toDate();
                nextDimLevel = globalSchedule.dimLevel;
                nextGroupClass = globalSchedule.groupClass;
            }
        }
        
        if (nextHideDate && nextShowDate)
        {
            var now = new Date();
            var groupOrAll = (nextGroupClass ? nextGroupClass : 'all');
            if (nextShowDate > now && nextHideDate > nextShowDate) {
                if (nextDimLevel > 0) {
                    console.log(this.name + ' is dimming ' + groupOrAll + ' modules');
                    this.sendSocketNotification('DIM_MODULES', {dimLevel: nextDimLevel, "groupClass": nextGroupClass});
                } else {
                    console.log(this.name + ' is hiding ' + groupOrAll + ' modules');
                    this.sendSocketNotification('HIDE_MODULES', {"groupClass": nextGroupClass});
                }
            }
            console.log(this.name + ' has created global schedules');
            console.log(this.name + ' will next show ' + groupOrAll + ' modules at ' + nextShowDate);
            console.log(this.name + ' will next ' + (nextDimLevel ? 'dim' : 'hide') + ' ' + groupOrAll + ' modules at ' + nextHideDate);
        }        
    },

    createGlobalCronJob: function(globalCronTime, action, level, groupClass) {
        var self = this;

        if(action !== 'show' && action !== 'hide' && action !== 'dim') {
            console.log(self.name + ' requires show/hide/dim for type, not ' + action);
            return false;
        }
        
        try {
            var job = new CronJob({
                cronTime: globalCronTime, 
                onTick: function() {
                    console.log(self.name + ' is sending notification to ' + action + ' ' + (groupClass ? groupClass : 'all') + ' modules');
                    self.sendSocketNotification(action.toUpperCase() + '_MODULES', {dimLevel: level, "groupClass": groupClass} );
                    console.log(self.name + ' will next ' + action + ' ' + (groupClass ? groupClass : 'all') + ' modules at ' + this.nextDate().toDate() + ' using \'' + globalCronTime + '\'');
                }, 
                onComplete: function() {
                    console.log(self.name + ' has completed the ' + action + ' job for ' + (groupClass ? groupClass : 'all') + ' modules using \'' + globalCronTime + '\'');
                }, 
                start: true
            });
            return job;
        } catch(ex) {
            console.log(this.name + ' could not create global schedule - check ' + action + ' expression: \'' + globalCronTime + '\'');
        }
    }
});