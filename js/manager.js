'use strict';

module.exports = function (oAppData) {
	var
		App = require('%PathToCoreWebclientModule%/js/App.js'),
		ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
		
		sModuleName = 'tasks'
	;

	let tasksViewInstance = null;

	const getTasksViewInstance = () => {
		if(!tasksViewInstance) {
			tasksViewInstance = require('modules/%ModuleName%/js/views/MainView.js');
		}
		return tasksViewInstance;
	}
	
	if (App.isUserNormalOrTenant() && ModulesManager.isModuleEnabled('CalendarWebclient'))
	{
		var
			TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
			HeaderItemView = null
		;

		return {
			/**
			 * Returns list of functions that are return module screens.
			 * 
			 * @returns {Object}
			 */
			start: function () {
				App.broadcastEvent('RegisterNewItemElement', {
					'title': TextUtils.i18n('%MODULENAME%/ACTION_CREATE_TASK'),
					'handler': () => {
						window.location.hash = sModuleName
						const tasksViewInstance = getTasksViewInstance();
						if (tasksViewInstance.calendars.currentCal()) {
							tasksViewInstance.createTaskInCurrentCalendar();
						} else {
							const currentCalSubscribtion = tasksViewInstance.calendars.currentCal.subscribe(function () {
								tasksViewInstance.createTaskInCurrentCalendar();
								currentCalSubscribtion.dispose();
							});
						}
					},
					'hash': sModuleName,
					'className': 'item_tasks',
					'order': 5,
					'column': 1
				});
			},
			getScreens: function ()	{
                return { [sModuleName]: getTasksViewInstance };
			},
			
			/**
			 * Returns object of header item view of sales module.
			 * 
			 * @returns {Object}
			 */
			getHeaderItem: function () {
				if (HeaderItemView === null)
				{
					var CHeaderItemView = require('%PathToCoreWebclientModule%/js/views/CHeaderItemView.js');
					HeaderItemView = new CHeaderItemView(TextUtils.i18n('%MODULENAME%/ACTION_SHOW_TASKS'));
				}

				return {
					item: HeaderItemView,
					name: sModuleName
				};
			}
		};
	}
	
	return null;
};
