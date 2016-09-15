/* global Log, Module, moment, config, MM */
/* Magic Mirror
 * Module: MMM-ModuleScheduler
 *
 * By Ian Perrin http://ianperrin.com
 * MIT Licensed.
 */
Module.register("MMM-ModuleScheduler",{
	// Module config defaults.
	defaults: {
		schedulerClass: 'scheduler',
		transitionInterval: 1000
	},

	// Define start sequence.
	start: function() {
		Log.info("Starting module: " + this.name);
		this.sendSocketNotification('SET_CONFIG', this.config);
	},
	
	notificationReceived: function(notification, payload, sender) {
	    var self = this;
		if (notification === 'DOM_OBJECTS_CREATED') {
			// Reset
			self.sendSocketNotification('REMOVE_ALL_SCHEDULES');
			
			// Create schedules
			MM.getModules().exceptModule(this).withClass(this.config.schedulerClass).enumerate(function(module) {
				Log.log(self.name + ' wants to schedule the display of ' + module.name );
				if (typeof module.config.module_schedule === 'object') {
            		self.sendSocketNotification('CREATE_MODULE_SCHEDULE', {name: module.name, id: module.identifier, schedule: module.config.module_schedule});
				} else {
				    Log.error( module.name + ' is configured to be scheduled, but the module_schedule option is undefined' );
				}
			});
		}
	},

	socketNotificationReceived: function(notification, payload) {
	    var self = this;
	    
		if (notification === 'SHOW_MODULE') {
		    var identifier = payload;
        	Log.log(self.name + ' received notification to show ' + identifier );
			MM.getModules().exceptModule(this).withClass(this.config.schedulerClass).enumerate(function(module) {
			    if (module.identifier === identifier){
        			Log.log(self.name + ' is showing ' + module.name  + ' (' + module.identifier + ')' );
        			module.show(self.config.transitionInterval, function() {
            			Log.log(self.name + ' has shown ' + module.name + ' (' + module.identifier + ')');
                    });
        			return true;
			    }
			});
		}

		if (notification === 'HIDE_MODULE') {
		    var identifier = payload;
        	Log.log(self.name + ' received notification to hide ' + identifier );
			MM.getModules().exceptModule(this).withClass(this.config.schedulerClass).enumerate(function(module) {
			    if (module.identifier === identifier){
        			Log.log(self.name + ' is hiding ' + module.name  + ' (' + module.identifier + ')' );
        			module.hide(self.config.transitionInterval, function() {
            			Log.log(self.name + ' has hidden ' + module.name + ' (' + module.identifier + ')');
                    });
        			return true;
			    }
			});
		}

	}	
});
