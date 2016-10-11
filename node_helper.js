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
    cronJobs: [],

    // Override start method.
    start: function() {
        console.log("Starting node helper for: " + this.name);
    },

    // Override socketNotificationReceived method.
    socketNotificationReceived: function(notification, payload) {
        console.log(this.name + ' received ' + notification);

        if (notification === "SET_CONFIG") {
            console.log(this.name + ' is setting the config');
            this.config = payload;
            return true;
        }
        
        if (notification === "REMOVE_ALL_SCHEDULES") {
            this.stopAllCronJobs();
            return true;
        }

        if (notification === "CREATE_MODULE_SCHEDULE") {
            this.createScheduleForModule(payload);
            return true;
            
        }
    },
    
    stopAllCronJobs: function() {
        console.log(this.name + ' is removing all schedules');
        for (var i = 0; i < this.cronJobs.length; i++) {
            var cronJob = this.cronJobs[i];
            if( typeof cronJob.showJob === 'object') {
                this.stopCronJob(cronJob.showJob);
            }
            if( typeof cronJob.hideJob === 'object') {
                this.stopCronJob(cronJob.hideJob);
            }
        }
        this.cronJobs.length = 0;
    },
    
    stopCronJob: function(cronJob){
        try {
            cronJob.stop();
        } catch(ex) {
            console.log(this.name + ' could not stop cronJob');
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
            console.log(module.id + ' schedule ' + i);
            var moduleSchedule = moduleSchedules[i];

            if (!moduleSchedule.hasOwnProperty('from') || !moduleSchedule.hasOwnProperty('to')) {
                console.log(this.name + ' cannot schedule' + module.name + ' - check module_schedule');
                break;
            }
    
            // Create cronnJobs
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
    
            // Store cronJobs
            this.cronJobs.push({module: module, schedule: moduleSchedule, showJob: showJob, hideJob: hideJob});
            
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
    }
});

