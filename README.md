# MMM-ModuleScheduler
A MagicMirror helper module to schedule when other modules should be shown or hidden.

**Please note that this module is work in progress and has not yet been fully tested, so please do use with care.**

## Installation

In your terminal, go to your MagicMirror's Module folder:
````
cd ~/MagicMirror/modules
````

Clone this repository:
````
git clone https://github.com/ianperrin/MMM-ModuleScheduler.git
````

Add the module to the modules array in the `config/config.js` file:
````javascript
    {
        module: 'MMM-ModuleScheduler'
    },
````
Modify the configuration for the modules you wish to control the display of using the scheduler, e.g. 
````javascript
		{
			module: 'calendar',
			header: 'US Holidays',
			position: 'top_left',
			classes: 'scheduler',
			config: {
			  // DISPLAY THE CALENDAR BETWEEN 09:00 and 18:00 ON WEDNESDAYS
				module_schedule: {from: '0 9 * * 3', to: '0 18 * * 3' },
				calendars: [
					{
						symbol: 'calendar-check-o ',
						url: 'webcal://www.calendarlabs.com/templates/ical/US-Holidays.ics'
					}
				]
			}
		},
````

## Updating

To update the module to the latest version, use your terminal to go to your MMM-ModuleScheduler module folder and type the following command:

````
git pull
```` 

If you haven't changed the modules, this should work without any problems. 
Type `git status` to see your changes, if there are any, you can reset them with `git reset --hard`. After that, git pull should be possible.

