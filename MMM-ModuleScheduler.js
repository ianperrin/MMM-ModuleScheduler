/* global Log, Module, MM */
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
		animationSpeed: 1000
	},

	// Define start sequence.
	start: function() {
		Log.info("Starting module: " + this.name);
		this.sendSocketNotification('INITIALISE_SCHEDULER', this.config);
	},
	
	notificationReceived: function(notification, payload, sender) {
		var self = this;
		if (notification === 'ALL_MODULES_STARTED') {
			// Create notification schedules
			if (this.config.notification_schedule) {
				this.sendSocketNotification('CREATE_NOTIFICATION_SCHEDULE', this.config.notification_schedule);
			}
			return;
		}
		if (notification === 'DOM_OBJECTS_CREATED') {
			// Create module schedules
			MM.getModules().exceptModule(this).withClass(this.config.schedulerClass).enumerate(function(module) {
				Log.log(self.name + ' wants to schedule the display of ' + module.name );
				if (typeof module.config.module_schedule === 'object') {
					self.sendSocketNotification('CREATE_MODULE_SCHEDULE', {name: module.name, id: module.identifier, schedule: module.config.module_schedule});
				} else {
					Log.error( module.name + ' is configured to be scheduled, but the module_schedule option is undefined' );
				}
			});
			return;
		}
		
	},

	socketNotificationReceived: function(notification, payload) {
		if (notification === 'SHOW_MODULE' || notification === 'HIDE_MODULE' || notification === 'DIM_MODULE') {
			Log.log(this.name + ' received a ' + notification + ' notification for ' + payload.identifier );
			this.setModuleDisplay(payload.identifier, notification, (payload.dimLevel ? payload.dimLevel : '25'));
			return;
		}
		if (notification === 'SEND_NOTIFICATION') {
			Log.log(this.name + ' received a request to send ' + payload + ' notification' );
			this.sendNotification(payload.notification, payload.payload);
			return;
		}
	},
	
	setModuleDisplay: function(identifier, action, brightness){
		var self = this;
		MM.getModules().exceptModule(this).withClass(this.config.schedulerClass).enumerate(function(module) {
			if (module.identifier === identifier){
				
				Log.log(self.name + ' processing the ' + action + ' request for ' + identifier );
				var moduleDiv = document.getElementById(identifier);
				
				if (action === 'SHOW_MODULE') {
					moduleDiv.style.filter = 'brightness(100%)';
					module.show(self.config.animationSpeed, function() {
						Log.log(self.name + ' has shown ' + identifier );
					});
					return true;
				}
				
				if (action === 'HIDE_MODULE') {
					module.hide(self.config.animationSpeed, function() {
						Log.log(self.name + ' has hidden ' + identifier );
					});
					return true;
				}
				
				if (action === 'DIM_MODULE') {
					moduleDiv.style.filter = 'brightness(' + brightness + '%)';
					Log.log(self.name + ' has dimmed ' + identifier + ' to ' + brightness + '%' );
					return true;
				}
				
			}
			return false;
		});		
	}
});

