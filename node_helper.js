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
        var self = this;
        
        if (notification === "SET_CONFIG") {
            console.log(this.name + ' is setting the config');
            this.config = payload;
            return true;
        }
        
        if (notification === "REMOVE_ALL_SCHEDULES") {
            console.log(this.name + ' is removing all schedules');
            this.stopAllCronJobs();
        }

        if (notification === "CREATE_MODULE_SCHEDULE") {
            module = payload;
            if (!module.schedule.hasOwnProperty('from') || !module.schedule.hasOwnProperty('from')) {
                console.log(this.name + ' cannot schedule the module ' + module.name + ' - check module_schedule');
                return false;
            }

            console.log(this.name + ' is scheduling the module ' + module.name );

            var showJob = this.createCronJobForModule(module, 'show');
            if (!showJob) {
                return false;
            }
            var hideJob = this.createCronJobForModule(module, 'hide');
            if (!hideJob) {
                showJob.stop();
                return false;
            }

            this.cronJobs.push({module: module, showJob: showJob, hideJob: hideJob});
            
            var now = new Date();
            if (showJob.nextDate().toDate() > now && hideJob.nextDate().toDate() > showJob.nextDate().toDate()) {
                console.log(this.name + ' is hiding ' + module.name);
                this.sendSocketNotification('HIDE_MODULE', module.id);
            }
            console.log(this.name + ' has scheduled ' + module.name);
            console.log(this.name + ' will next show ' + module.name + ' at ' + showJob.nextDate().toDate());
            console.log(this.name + ' will next hide ' + module.name + ' at ' + hideJob.nextDate().toDate());

            return true;
            
        }
    },
    
    stopAllCronJobs: function() {
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

    createCronJobForModule: function(module, type) {
        var self = this;
        var moduleCronTime = (type === 'show' ? module.schedule.from : module.schedule.to );
        
        if(type !== 'show' && type !== 'hide') {
            console.log(self.name + ' requires show/hide for type, not ' + type);
            return false;
        }
        
        try {
            var job = new CronJob({
                cronTime: moduleCronTime, 
                onTick: function() {
                    console.log(self.name + ' needs to ' + type + ' ' + module.name);
                    self.sendSocketNotification(type.toUpperCase() + '_MODULE', module.id);
                    console.log(self.name + ' will next ' + type + ' ' + module.name + ' at ' + this.nextDate().toDate());
                }, 
                onComplete: function() {
                    console.log(self.name + ' has completed the ' + type + ' job' + ' for ' + module.id);
                }, 
                start: true
            });
            return job;
        } catch(ex) {
            console.log(this.name + ' could not schedule ' + module.name + ' - invalid ' + type + ' expression: ' + moduleCronTime);
        }
    }
});
