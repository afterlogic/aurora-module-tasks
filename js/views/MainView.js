'use strict';

var
	_ = require('underscore'),
	$ = require('jquery'),
	ko = require('knockout'),
	moment = require('moment'),
    
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	Utils = require('%PathToCoreWebclientModule%/js/utils/Common.js'),
	
	Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js'),
	Api = require('%PathToCoreWebclientModule%/js/Api.js'),
	CAbstractScreenView = require('%PathToCoreWebclientModule%/js/views/CAbstractScreenView.js'),
	CSelector = require('%PathToCoreWebclientModule%/js/CSelector.js'),
	CPageSwitcherView = require('%PathToCoreWebclientModule%/js/views/CPageSwitcherView.js'),
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),
	UserSettings = require('%PathToCoreWebclientModule%/js/Settings.js'),
	
	CCalendarListModel = require('modules/CalendarWebclient/js/models/CCalendarListModel.js'),
	CCalendarModel = require('modules/CalendarWebclient/js/models/CCalendarModel.js'),
	EditTaskPopup = require('modules/CalendarWebclient/js/popups/EditEventPopup.js'),
	EditEventRecurrencePopup = require('modules/CalendarWebclient/js/popups/EditEventRecurrencePopup.js')
;

require('jquery-ui/ui/widgets/datepicker');

/**
 * View that is used as screen of sales module.
 * 
 * @constructor
 */
function CMainView()
{
	this.sDateFormat = UserSettings.dateFormat();
	
	this.dateFormatMoment = Utils.getDateFormatForMoment(this.sDateFormat);
	
	
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
		_.bind(this.viewItem, this),
        this.executeRemove,
		_.bind(this.taskClickCallback, this)
	);
	
	this.searchClick = ko.observable(false);
	this.isSearch = ko.computed(function () {
		return this.searchInput() !== '' && this.searchClick();
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
	this.sTimeFormat = ko.computed(function () {
		return (UserSettings.timeFormat() === Enums.TimeFormat.F24) ? 'HH:mm' : 'hh:mm A';
	}, this);
	this.isEmptyList = ko.computed(function () {
		return 0 === this.tasksList().length;
	}, this);
	this.searchText = ko.observable('');
	this.showCompleted = ko.observable(false);
	this.actionCompletedText = ko.computed(function () {
		return this.showCompleted() ?  TextUtils.i18n('%MODULENAME%/ACTION_HIDE_COMPLETED') : TextUtils.i18n('%MODULENAME%/ACTION_SHOW_COMPLETED');
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
			null, 
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
			
			if (!oCalendar.isShared() && !oCalendar.subscribed())
			{
				aCalendarIds.push(oCalendar.id);
				oClientCalendar = this.calendars.getCalendarById(oCalendar.id);
				if (this.needsToReload || (oClientCalendar && oClientCalendar.sSyncToken) !== (oCalendar && oCalendar.sSyncToken))
				{
					oCalendar = this.calendars.parseAndAddCalendar(oCalendarData);
					if (oCalendar)
					{
						var calId = oCalendar.id;

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
			}
		}, this);
		
		this.calendars.expunge(aCalendarIds);

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
			'CalendarIds': aNewCalendarIds,
			'Completed': this.showCompleted(),
			'Search': this.searchInput()
		},
		this.onGetTasksResponse,
		this
	);
};

CMainView.prototype.prepareTask = function (oItem)
{
	var
		self = this,
		oCalendar = self.calendars.getCalendarById(oItem.calendarId)
	;
	
	oItem.visibleDate = ko.observable('');

	oItem.withDate = false;
	if (oItem.start && oItem.end)
	{
		oItem.withDate = true;
		oItem.start = moment(oItem.start);
		oItem.end = moment(oItem.end);

		var oMomentStart = oItem.start.clone();
		var oMomentEnd = oItem.end.clone();

		if (oMomentEnd && oItem.allDay)
		{
			oMomentEnd.subtract(1, 'days');
		}
		var isEvOneDay = oMomentEnd.diff(oMomentStart, 'days') === 0;
		var isEvOneTime = oMomentEnd.diff(oMomentStart, 'minutes') === 0;					

		var sStartDate = self.getDateWithoutYearIfMonthWord(oMomentStart.format(self.dateFormatMoment));
		var sEndDate = !isEvOneDay ? ' - ' + self.getDateWithoutYearIfMonthWord(oMomentEnd.format(self.dateFormatMoment)) : '';

		var sStartTime = !oItem.allDay ? ', ' + oMomentStart.format(this.sTimeFormat()) : '';
		var sEndTime = !oItem.allDay && !isEvOneTime ? 
			(isEvOneDay ? ' - ' : ', ')  + oMomentEnd.format(this.sTimeFormat()) : '';

		oItem.visibleDate = ko.observable(
			sStartDate +
			sStartTime +
			sEndDate +
			sEndTime
		);
	}

	if(oItem.excluded === undefined) {
		oItem.excluded = false;
	}

	if(oItem.rrule === undefined) {
		oItem.rrule = false;
	}

	oItem.selected = ko.observable(oItem.selected);
	oItem.checked = ko.observable(oItem.status);
	oItem.visible = ko.observable(oCalendar.active());
	oItem.color = oCalendar.color;
	oItem.checked.subscribe(function(newValue) {
		oItem.status = newValue;
		var
			/**
			 * @param {number} iResult
			 */
			fCallback = _.bind(function (iResult) {
				if (iResult !== Enums.CalendarEditRecurrenceEvent.None) {
					if (iResult === Enums.CalendarEditRecurrenceEvent.AllEvents && oItem.rrule) {
					  oItem.start = moment.unix(oItem.rrule.startBase)
					  oItem.end = moment.unix(oItem.rrule.endBase)
					}
					oItem.allEvents = iResult;
					self.updateTask(oItem);
				  } else {
					oItem.checked(!newValue);
				  }
			}, this)
		;

		if (oItem.rrule && oItem.rrule.until) {
			oItem.rrule.until = moment.unix(oItem.rrule.until).utc().hour(0).minute(0).second(0).unix();
		}

		var oCalendar = self.calendars.getCalendarById(oItem.calendarId)

		if (oItem.rrule && !oCalendar.subscribed()) {
			if (oItem.excluded) {
				oItem.allEvents = Enums.CalendarEditRecurrenceEvent.OnlyThisInstance;
				self.updateTask(oItem);
			} else {
				Popups.showPopup(EditEventRecurrencePopup, [fCallback])
			}
		} else {
			oItem.allEvents = Enums.CalendarEditRecurrenceEvent.AllEvents;
			self.updateTask(oItem);
		}
	});
	return oItem;	
};

CMainView.prototype.getTaskFromList = function (id)
{
	return _.find(this.tasksList(), function (oItem){
		return oItem.id === id;
	});
};

CMainView.prototype.onGetTasksResponse = function (oResponse)
{
	var 
		oResult = oResponse.Result,
		self = this;

	if (oResult)
	{
		var
			aNewCollection = Types.isNonEmptyArray(oResult) ? _.compact(_.map(oResult, function (oItem) {
				return self.prepareTask(oItem);
			})) : [];
			
		this.tasksList(aNewCollection);
		this.sortTasksList();
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
	if (this.searchInput() !== '')
	{
		this.searchText(
			TextUtils.i18n('%MODULENAME%/INFO_SEARCH_RESULT', {
				'SEARCH': this.searchInput()
			})
		);
	}
	else
	{
		this.searchText('');
	}
	
	this.searchClick(true);
	this.tasksList([]);
	this.getCalendars();
};

CMainView.prototype.onClearSearchClick = function ()
{
	// initiation empty search
	this.searchInput('');
	this.searchText('');
	this.searchClick(false);
	this.searchSubmit();
};

CMainView.prototype.createTaskInCurrentCalendar = function ()
{
	this.calendars.pickCurrentCalendar();
	this.createTaskToday(this.calendars.currentCal());
};

/**
 * @param {Object} oCalendar
 */
CMainView.prototype.createTaskToday = function (oCalendar)
{
	this.openTaskPopup(oCalendar, null, null, false);
};

/**
 * @param {Object} oCalendar
 * @param {Object} oStart
 * @param {Object} oEnd
 * @param {boolean} bAllDay
 */
CMainView.prototype.openTaskPopup = function (oCalendar, oStart, oEnd, bAllDay)
{
	if (oCalendar)
	{
		Popups.showPopup(EditTaskPopup, [{
			CallbackSave: _.bind(this.createTask, this),
			CallbackDelete: null,
			Calendars: this.calendars,
			SelectedCalendar: oCalendar ? oCalendar.id : 0,
			Start: oStart,
			End: oEnd,
			AllDay: bAllDay,            
			TimeFormat: this.sTimeFormat(),
			DateFormat: UserSettings.dateFormat(),
            Type: 'VTODO',
			IsTaskApp: true
		}]);
	}
};

/**
 * @param {Object} oEventData
 */
CMainView.prototype.getParamsFromEventData = function (oEventData)
{
	var
		rrule = null
	;
	if (oEventData.rrule) {
		rrule = {
		  byDays: oEventData.rrule.byDays,
		  count: oEventData.rrule.count,
		  end: Types.pInt(oEventData.rrule.end),
		  interval: Types.pInt(oEventData.rrule.interval),
		  period: Types.pInt(oEventData.rrule.period),
		  until: Types.pInt(oEventData.rrule.until),
		  weekNum: oEventData.rrule.weekNum,
		}
	  }

	return {
		id: oEventData.id,
		uid: oEventData.uid,
		calendarId: oEventData.calendarId,
		newCalendarId: oEventData.newCalendarId || oEventData.calendarId,
		subject: oEventData.subject,
		allDay: oEventData.allDay ? 1 : 0,
		location: oEventData.location,
		description: oEventData.description,
		alarms: oEventData.alarms ? JSON.stringify(oEventData.alarms) : '[]',
		attendees: oEventData.attendees ? JSON.stringify(oEventData.attendees) : '[]',
		owner: oEventData.owner,
		recurrenceId: oEventData.recurrenceId,
		excluded: oEventData.excluded,
		allEvents: oEventData.allEvents,
		modified: oEventData.modified ? 1 : 0,
		start: oEventData.withDate ? oEventData.start.local().toDate() : null,
		end: oEventData.withDate ? oEventData.end.local().toDate() : null,
		startTS: oEventData.withDate ? oEventData.start.unix() : null,
		endTS: oEventData.withDate ? (oEventData.end ? oEventData.end.unix() : oEventData.end.unix()) : null,
		rrule: rrule ? JSON.stringify(rrule) : null,
		type: oEventData.type,
		status: oEventData.status,
		withDate: oEventData.withDate
	};
};

/**
 * @param {Object} oEventData
 */
CMainView.prototype.createTask = function (oData)
{
	var aParameters = this.getParamsFromEventData(oData);

	aParameters.calendarId = oData.newCalendarId;
    Ajax.send(
		'Calendar',
		'CreateEvent', 
        aParameters,
        this.onCreateTaskResponse,
		this
	);	
};

CMainView.prototype.sortTasksList = function ()
{
	this.tasksList(this.tasksList().sort(function (left, right) {
		if (!left.withDate && !right.withDate) {
			if (left.lastModified === right.lastModified) {
				return 0;
			} else {
				return left.lastModified > right.lastModified ? -1 : 1
			}
		} else if(!left.withDate) {
			return -1;
		} else if (left.startTS !== null && right.startTS !== null) {
			if (left.startTS === right.startTS) 
			{
				return 0;
			}
			return (left.startTS > right.startTS) ? 1 : -1;
		}
	}));
}

CMainView.prototype.onCreateTaskResponse = function (oResponse)
{
	var oResult = oResponse.Result;

	if (oResult)
	{
		oResult.Events.forEach((event) => {
			var oTask = this.prepareTask(event);
			this.tasksList.push(oTask);
		  })

		this.sortTasksList();
	}
	else
	{
		Api.showErrorByCode(oResponse);
	}
};

/**
 * @param {Object} oData
 */
CMainView.prototype.taskClickCallback = function (oData)
{
	var
		/**
		 * @param {number} iResult
		 */
		fCallback = _.bind(function (iResult) {
			var oParams = {
					ID: oData.id,
					Uid: oData.uid,
					RecurrenceId: oData.recurrenceId,
					Calendars: this.calendars,
					SelectedCalendar: oData.calendarId,
					AllDay: oData.allDay,
					Location: oData.location,
					Description: oData.description,
					Subject: oData.subject,
					Alarms: oData.alarms,
					Attendees: oData.attendees,
					RRule: oData.rrule,
					Excluded: oData.excluded,
					Owner: oData.owner,
					Appointment: false,
					OwnerName: oData.ownerName,
					TimeFormat: this.sTimeFormat(),
					DateFormat: UserSettings.dateFormat(),
					AllEvents: iResult,
					CallbackSave: _.bind(this.updateTask, this),
					CallbackDelete: _.bind(this.executeRemove, this),
					Type: oData.type,
					Status: oData.status,
					IsTaskApp: true
				}
			;
			if (iResult !== Enums.CalendarEditRecurrenceEvent.None) {
				if (iResult === Enums.CalendarEditRecurrenceEvent.AllEvents && oData.rrule) {
				  oParams.Start = moment.unix(oData.rrule.startBase)
				  oParams.End = moment.unix(oData.rrule.endBase)
				} else {
				  if (oData.start) { 
					oParams.Start = oData.start.clone()
					oParams.Start = oParams.Start.local()
				  }
				  if (oData.end) {
					oParams.End = oData.end.clone()
					oParams.End = oParams.End.local()
				  }
				}
				Popups.showPopup(EditTaskPopup, [oParams])
			  }
		}, this)
	;
    var oCalendar = this.calendars.getCalendarById(oData.calendarId)
	if (oData.rrule && !oCalendar.subscribed()) {
		if (oData.excluded) {
			fCallback(Enums.CalendarEditRecurrenceEvent.OnlyThisInstance)
		} else {
			Popups.showPopup(EditEventRecurrencePopup, [fCallback])
		}
	} else {
		fCallback(Enums.CalendarEditRecurrenceEvent.AllEvents)
	}
};

/**
 * @param {Object} oTask
 */
CMainView.prototype.addTask = function (oTask) {
	if (oTask && !this.taskExists(oTask.id)) {
	  this.tasksList.push(this.prepareTask(oTask))
	}
  }
  
  /**
   * @param {string} sId
   */
  CMainView.prototype.getTask = function (sId) {
	return _.find(
	  this.tasksList(),
	  function (oTask) {
		return oTask.id === sId
	  },
	  this
	)
  }
  
  /**
   * @param {string} sId
   *
   * @return {boolean}
   */
  CMainView.prototype.taskExists = function (sId) {
	return !!this.getTask(sId)
  }

/**
 * @param {string} sId
 */
CMainView.prototype.removeTask = function (sId) {
	this.tasksList(
	  _.filter(
		this.tasksList(),
		function (oEvent) {
		  return oEvent.id !== sId
		},
		this
	  )
	)
  }

CMainView.prototype.removeTaskByUid = function (sUid, bSkipExcluded) {
	this.tasksList(
	  _.filter(
		this.tasksList(),
		function (oEvent) {
		  return oEvent.uid !== sUid || (bSkipExcluded && oEvent.excluded)
		},
		this
	  )
	)
  }

/**
 * @param {Object} oEventData
 */
CMainView.prototype.updateTask = function (oData)
{
    var aParameters = this.getParamsFromEventData(oData);

    Ajax.send(
		'Calendar',
		'UpdateEvent', 
        aParameters,
		this.onUpdateTaskResponse,
		this
	);	
};

CMainView.prototype.onUpdateTaskResponse = function (oResponse, oArguments)
{
	var 
		oResult = oResponse.Result,
		oParameters = oArguments.Parameters,
		oCalendar = this.calendars.getCalendarById(oParameters && oParameters.calendarId)
	;

	if (oResult) {
		var oTask = this.getTask(oParameters.id);

		if (
		  ((oTask && oTask.rrule) || oParameters.rrule) &&
		  oParameters.allEvents === Enums.CalendarEditRecurrenceEvent.AllEvents
		) {
		  this.removeTaskByUid(oParameters.uid, true);
		} else {
		  this.removeTask(oParameters.id);
		}
  
		_.each(
		  oResponse.Result.Events,
		  function (oData) {
			this.addTask(oData)
		  },
		  this
		);

		oTask = this.getTask(oParameters.id);
		if (oTask) {
			this.selector.itemSelected(oTask);
		}

		this.sortTasksList();
	} else {
		Api.showErrorByCode(oResponse);
	}
};

/**
 * @param {Object} oEventData
 */
CMainView.prototype.executeRemove = function (oData)
{
	Ajax.send(
		'Calendar',
		'DeleteEvent', 
		this.getParamsFromEventData(oData),
		this.onDeleteTaskResponse,
		this
	);	
};

CMainView.prototype.onDeleteTaskResponse = function (oResponse, oArguments)
{
	if (oResponse.Result)
	{
		var 
			oParameters = oArguments.Parameters
		;
		if (oParameters.allEvents === Enums.CalendarEditRecurrenceEvent.OnlyThisInstance) {
			this.removeTask(oParameters.id)
		  } else {
			this.removeTaskByUid(oParameters.uid)
		  }
	}
	else
	{
		Api.showErrorByCode(oResponse);
	}
};

/**
 * @param {string} sDate
 */
CMainView.prototype.getDateWithoutYearIfMonthWord = function (sDate)
{
	var
		aDate = sDate.split(' '),
		oNowMoment = moment(),
		oNowYear = oNowMoment.format('YYYY')
	;
	
	if (aDate.length === 3 && oNowYear === aDate[2])
	{
		return aDate[0] + ' ' + aDate[1];
	}
	return sDate;
};

CMainView.prototype.onShowCompletedClick = function ()
{
	this.showCompleted(!this.showCompleted());
	this.searchSubmit();
};

module.exports = new CMainView();
