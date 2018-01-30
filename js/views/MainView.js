'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Utils = require('%PathToCoreWebclientModule%/js/utils/Common.js'),
	Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js'),
	CSelector = require('%PathToCoreWebclientModule%/js/CSelector.js'),
	CAbstractScreenView = require('%PathToCoreWebclientModule%/js/views/CAbstractScreenView.js'),
	CTasksListItemModel = require('modules/%ModuleName%/js/models/CTasksListItemModel.js'),
	CPageSwitcherView = require('%PathToCoreWebclientModule%/js/views/CPageSwitcherView.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),
	
	CCalendarListModel = require('modules/CalendarWebclient/js/models/CCalendarListModel.js'),
	CCalendarModel = require('modules/CalendarWebclient/js/models/CCalendarModel.js'),
	EditTaskPopup = require('modules/%ModuleName%/js/popups/EditTaskPopup.js')
;

/**
 * View that is used as screen of sales module.
 * 
 * @constructor
 */
function CMainView()
{
	this.saveCommand = Utils.createCommand(this, this.executeSave);	
	this.removeCommand = Utils.createCommand(this, this.executeRemove);	
	this.calendars = new CCalendarListModel({
		onCalendarCollectionChange: function () {},
		onCalendarActiveChange: function () {}
	});

	CAbstractScreenView.call(this, '%ModuleName%');
	this.iItemsPerPage = 20;
	/**
	 * Text for displaying in browser title when sales screen is shown.
	 */
	this.browserTitle = ko.observable(TextUtils.i18n('%MODULENAME%/HEADING_BROWSER_TAB'));
	this.tasksList = ko.observableArray([]);
	this.hiddenTasksList = ko.observableArray([]);
	this.selectedItem = ko.observable(null);
	this.isSearchFocused = ko.observable(false);
	this.searchInput = ko.observable('');
	
	this.selector = new CSelector(
		this.tasksList,
		_.bind(this.viewItem, this)
	);
	
	this.isSearch = ko.computed(function () {
		return this.searchInput() !== '';
	}, this);
	
	this.pageSwitcherLocked = ko.observable(false);
	this.oPageSwitcher = new CPageSwitcherView(0, this.iItemsPerPage);
	this.oPageSwitcher.currentPage.subscribe(function (iCurrentpage) {
		this.currentPage(iCurrentpage);
		this.getTasks();
	}, this);
	this.currentPage = ko.observable(1);
	this.loadingList = ko.observable(false);
	this.preLoadingList = ko.observable(false);
	this.loadingList.subscribe(function (bLoading) {
		this.preLoadingList(bLoading);
	}, this);
	
}

_.extendOwn(CMainView.prototype, CAbstractScreenView.prototype);

CMainView.prototype.ViewTemplate = '%ModuleName%_MainView';
CMainView.prototype.ViewConstructorName = 'CMainView';


/**
 * Called every time when screen is shown.
 */
CMainView.prototype.onShow = function ()
{
	this.getCalendars();
};

CMainView.prototype.getCalendars = function ()
{
	this.loadingList(true);
	Ajax.send(
			'Calendar',
			'GetCalendars', 
			{
				'IsPublic': false
			}, 
			this.onGetCalendarsResponse, 
			this
	);
};

/**
 * @param {Object} oResponse
 * @param {Object} oParameters
 */
CMainView.prototype.onGetCalendarsResponse = function (oResponse, oParameters)
{
	var
		aCalendarIds = [],
		aNewCalendarIds = [],
		oCalendar = null,
		oClientCalendar = null,
		self = this
	;
	
	if (oResponse.Result)
	{
		_.each(oResponse.Result.Calendars, function (oCalendarData) {
			oCalendar = this.calendars.parseCalendar(oCalendarData);
			aCalendarIds.push(oCalendar.id);
			oClientCalendar = this.calendars.getCalendarById(oCalendar.id);
			if (this.needsToReload || (oClientCalendar && oClientCalendar.sSyncToken) !== (oCalendar && oCalendar.sSyncToken))
			{
				oCalendar = this.calendars.parseAndAddCalendar(oCalendarData);
				if (oCalendar)
				{
					var calId = oCalendar.id;
					console.log(oCalendar.control());
					
					oCalendar.active.subscribe(function (newValue) {
						_.each(self.tasksList(), function(oItem){
							if (oItem.calendarId === calId)
							{
								oItem.visible(newValue);
							}
						});
					}, oCalendar);
					oCalendar.davUrl(Types.pString(oResponse.Result.ServerUrl));
					aNewCalendarIds.push(oCalendar.id);
				}
			}
		}, this);

		this.getTasks(aCalendarIds);
	}
};

CMainView.prototype.getTasks = function (aNewCalendarIds)
{
	this.loadingList(true);
	Ajax.send(
		'Calendar',
		'GetTasks', 
		{
			'CalendarIds': aNewCalendarIds
		},
		this.onGetTasksResponse,
		this
	);
};

CMainView.prototype.onGetTasksResponse = function (oResponse)
{
	var 
		oResult = oResponse.Result,
		self = this;

	if (oResult)
	{
		var
			aNewCollection = Types.isNonEmptyArray(oResult) ? _.compact(_.map(oResult, function (oItemData) {
					var oItem = new CTasksListItemModel();
					oItem.parse(oItemData);
					var oCalendar = self.calendars.getCalendarById(oItem.calendarId);
					oItem.color = oCalendar.color;
					oItem.visible(oCalendar.active());
					oItem.checked.subscribe(function(newValue){
						self.updateTaskStatus(oItem);
					});
					return oItem;
				})) : [];
		this.tasksList(aNewCollection);
		this.loadingList(false);
	}
};

CMainView.prototype.viewItem = function (oItem)
{
	this.selectedItem(oItem);
};

CMainView.prototype.onBind = function ()
{
	this.selector.initOnApplyBindings(
		'.sales_sub_list .item',
		'.sales_sub_list .selected.item',
		'.sales_sub_list .selected.item',
		$('.sales_list', this.$viewDom),
		$('.sales_list_scroll.scroll-inner', this.$viewDom)
	);
};

CMainView.prototype.searchSubmit = function ()
{
	this.oPageSwitcher.currentPage(1);
	this.getTasks();
};

CMainView.prototype.onClearSearchClick = function ()
{
	// initiation empty search
	this.searchInput('');
	this.searchSubmit();
};

CMainView.prototype.createTaskInCurrentCalendar = function ()
{
	this.calendars.pickCurrentCalendar();
	this.openTaskPopup(this.calendars.currentCal());
};

/**
 * @param {Object} oCalendar
 * @param {Object} oStart
 * @param {Object} oEnd
 * @param {boolean} bAllDay
 */
CMainView.prototype.openTaskPopup = function (oCalendar)
{
	if (oCalendar)
	{
		Popups.showPopup(EditTaskPopup, [{
			CallbackSave: _.bind(this.createTask, this),
			CallbackDelete: null,
			Calendars: this.calendars,
			SelectedCalendar: oCalendar ? oCalendar.id : 0
		}]);
	}
};

/**
 * @param {Object} oEventData
 */
CMainView.prototype.createTask = function (oData)
{
	Ajax.send(
		'Calendar',
		'CreateTask', 
		{
			'CalendarId': oData.CalendarId,
			'Subject': oData.Subject
		},
		this.onCreateTaskResponse,
		this
	);	
};

CMainView.prototype.onCreateTaskResponse = function (oResponse)
{
	var oResult = oResponse.Result;

	if (oResult)
	{
		this.getCalendars();
	}
};

/**
 * @param {Object} oEventData
 */
CMainView.prototype.updateTask = function (oData)
{
	Ajax.send(
		'Calendar',
		'UpdateTask', 
		{
			'CalendarId': oData.calendarId,
			'TaskId': oData.id,
			'Subject': oData.text(),
			'Status': oData.checked()
		},
		this.onUpdateTaskResponse,
		this
	);	
};

CMainView.prototype.onUpdateTaskResponse = function (oResponse)
{
	console.log(oResponse);
};

/**
 * @param {Object} oEventData
 */
CMainView.prototype.executeRemove = function (oData)
{
	Ajax.send(
		'Calendar',
		'DeleteEvent', 
		{
			'calendarId': oData.calendarId,
			'uid': oData.id
		},
		this.onDeleteTaskResponse,
		this
	);	
	
};

CMainView.prototype.onDeleteTaskResponse = function (oResponse)
{
	var oResult = oResponse.Result;

	if (oResult)
	{
		this.getCalendars();
	}
};


/**
 * @param {Object} oEventData
 */
CMainView.prototype.updateTaskStatus = function (oEventData)
{
	this.updateTask(oEventData);
};

CMainView.prototype.executeSave = function (oData)
{
	Ajax.send(
		'Calendar',
		'UpdateTask', 
		{
			'CalendarId': oData.calendarId,
			'TaskId': oData.id,
			'Subject': oData.text(),
			'Status': oData.checked()
		},
		this.onUpdateTaskResponse,
		this
	);	
	
};

module.exports = new CMainView();