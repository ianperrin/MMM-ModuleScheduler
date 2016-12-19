/* global Log, Module, MM */
/* Magic Mirror
 * Module: MMM-ModuleScheduler
 *
 * By Ian Perrin http://ianperrin.com
 * MIT Licensed.
 */
Module.register("MMM-ModuleScheduler",{

    // Set the minimum MagicMirror module version for this module.
    requiresVersion: "2.0.0",

    // Module config defaults.
    defaults: {
        schedulerClass: "scheduler",
        animationSpeed: 1000,
        notification_schedule: false,
        global_schedule: false,
        debug: true,
    },

    // Define start sequence.
    start: function() {
        Log.info("Starting module: " + this.name);
        this.sendSocketNotification("INITIALISE_SCHEDULER", this.config);
    },

    notificationReceived: function(notification, payload, sender) {
        var self = this;
        if (sender === undefined && notification === "ALL_MODULES_STARTED") {
            // Create notification schedules
            if (this.config.notification_schedule) {
                this.sendSocketNotification("CREATE_NOTIFICATION_SCHEDULE", this.config.notification_schedule);
            }
            return;
        }
        if (sender === undefined && notification === "DOM_OBJECTS_CREATED") {
            // Create global schedules
            if (typeof this.config.global_schedule === "object") {
                this.sendSocketNotification("CREATE_GLOBAL_SCHEDULE", this.config.global_schedule);
            }
            // Create module schedules
            MM.getModules().exceptModule(this).withClass(this.config.schedulerClass).enumerate(function(module) {
                Log.log(self.name + " wants to schedule the display of " + module.name );
                if (typeof module.config.module_schedule === "object") {
                    self.sendSocketNotification("CREATE_MODULE_SCHEDULE", {name: module.name, id: module.identifier, schedule: module.config.module_schedule});
                } else {
                    Log.error( module.name + " is configured to be scheduled, but the module_schedule option is undefined" );
                }
            });
            return;
        }
    },

    socketNotificationReceived: function(notification, payload) {
        var self = this;
        if (notification === "SHOW_MODULE" || notification === "HIDE_MODULE" || notification === "DIM_MODULE") {
            Log.log(this.name + " received a " + notification + " notification for " + payload.target );
            MM.getModules().exceptModule(this).withClass(this.config.schedulerClass).enumerate(function(module) {
                if (payload.target === module.identifier){
                    self.setModuleDisplay(module, notification, (payload.dimLevel ? payload.dimLevel : "25"));
                    return;
                }
            });
        }
        if (notification === "SHOW_MODULES" || notification === "HIDE_MODULES" || notification === "DIM_MODULES") {
            Log.log(this.name + " received a " + notification + " notification for " + (payload.target ? payload.target : "all")  + " modules");
            // Get all modules except this one
            var modules = MM.getModules().exceptModule(this);
            // Restrict to group of modules with specified class
            if (payload.target) {
                modules = modules.withClass(payload.target);
            }
            // Ignore specified modules
            if (payload.ignoreModules) {
                modules = modules.filter(function (module) {
                    if (payload.ignoreModules.indexOf(module.name) === -1) {
                        return true;
                    }
                    Log.log(self.name + " is ignoring " + module.name + " from the " + notification + " notification for " + (payload.target ? payload.target : "all")  + " modules");
                    return false;
                });
            }
            // Process the notification request
            var action = notification.replace("_MODULES", "_MODULE");
            var brightness = (payload.dimLevel ? payload.dimLevel : "25");
            for (var i = 0; i < modules.length; i++) {
                this.setModuleDisplay(modules[i], action, brightness);
            }
            return;
        }
        if (notification === "SEND_NOTIFICATION") {
            Log.log(this.name + " received a request to send a " + payload.target + " notification" );
            this.sendNotification(payload.target, payload.payload);
            return;
        }
    },

    setModuleDisplay: function(module, action, brightness){
        var self = this;
        var options = {lockString: this.identifier};
        Log.log(this.name + " is processing the " + action + (action === "DIM_MODULE" ? " (" + brightness + "%)" : "") + " request for " + module.identifier );

        var moduleDiv = document.getElementById(module.identifier);

        if (action === "SHOW_MODULE") {
            module.show(self.config.animationSpeed, function() {
                moduleDiv.style.filter = "brightness(100%)";
                Log.log(self.name + " has shown " + module.identifier );
            }, options);
            return true;
        }

        if (action === "HIDE_MODULE") {
            module.hide(self.config.animationSpeed, function() {
                Log.log(self.name + " has hidden " + module.identifier );
            }, options);
            return true;
        }

        if (action === "DIM_MODULE") {
            if (moduleDiv) {
                moduleDiv.style.filter = "brightness(" + brightness + "%)";
                Log.log(self.name + " has dimmed " + module.identifier + " to " + brightness + "%" );
                return true;
            }
        }
        return false;
    }
});
