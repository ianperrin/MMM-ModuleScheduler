# MMM-ModuleScheduler
A MagicMirror helper module to schedule when other modules should be shown or hidden.

![Example Scheduling](.github/example.gif)

## Installation

In your terminal, go to your MagicMirror's Module folder:
````
cd ~/MagicMirror/modules
````

Clone this repository:
````
git clone https://github.com/ianperrin/MMM-ModuleScheduler.git
````

Go to the modules folder:
````
cd MMM-ModuleScheduler
````

Install the dependencies:
````
npm install
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
**Note:**
For more complex scheduling, multiple `from`and `to` expressions can be passed to the `module_schedule` option using an array, e.g. 
````javascript
			// DISPLAY BETWEEN 09:30 ON SATURDAYS AND 22:30 ON SUNDAYS, 
			//THEN AGAIN BETWEEN 20:00 AND 23:00 ON TUESDAYS AND WEDNESDAYS 
			module_schedule: [{from: '30 9 * * SAT', to: '30 22 * * SUN'}, 
							  {from: '0 20 * * 2-3', to: '0 23 * * 2-3'}]
````

## Updating

To update the module to the latest version, use your terminal to go to your MMM-ModuleScheduler module folder and type the following command:

````
git pull
```` 

If you haven't changed the modules, this should work without any problems. 
Type `git status` to see your changes, if there are any, you can reset them with `git reset --hard`. After that, git pull should be possible.
