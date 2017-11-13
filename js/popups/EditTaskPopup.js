'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	App = require('%PathToCoreWebclientModule%/js/App.js'),
	
	CAbstractPopup = require('%PathToCoreWebclientModule%/js/popups/CAbstractPopup.js')
;

/**
 * @constructor
 */
function CEditTaskPopup()
{
	CAbstractPopup.call(this);
	
	this.modified = false;
	this.isPublic = App.isPublic();
	this.isEditable = ko.observable(false);
	this.isEditableReminders = ko.observable(false);
	this.selectedCalendarIsShared = ko.observable(false);
	this.selectedCalendarIsEditable = ko.observable(false);

	this.callbackSave = null;
	this.callbackDelete = null;
	this.timeFormatMoment = 'HH:mm';
	this.dateFormatMoment = 'MM/DD/YYYY';
	this.dateFormatDatePicker = 'mm/dd/yy';
	this.ampmTimeFormat = ko.observable(false);

	this.calendarId = ko.observable(null);
	this.id = ko.observable(null);
	this.uid = ko.observable(null);

	this.subject = ko.observable('').extend({'disableLinebreaks': true});
	this.description = ko.observable('');

	this.calendars = null;

	this.calendarsList = ko.observableArray([]);
	this.calendarColor = ko.observable('');
	this.selectedCalendarId = ko.observable('');
	this.selectedCalendarName = ko.observable('');
	this.selectedCalendarId.subscribe(function (sValue) {
		if (sValue)
		{
			var oCalendar = this.calendars.getCalendarById(sValue);
			
			this.selectedCalendarName(oCalendar.name());
			this.selectedCalendarIsShared(oCalendar.isShared());
			this.selectedCalendarIsEditable(oCalendar.isEditable());
//			this.changeCalendarColor(sValue);
		}
	}, this);
	
	this.subjectFocus = ko.observable(false);
	this.descriptionFocus = ko.observable(false);
	
	this.autosizeTrigger = ko.observable(true);
};

_.extendOwn(CEditTaskPopup.prototype, CAbstractPopup.prototype);

CEditTaskPopup.prototype.PopupTemplate = '%ModuleName%_EditTaskPopup';

/**
 * @param {Object} oParameters
 */
CEditTaskPopup.prototype.onOpen = function (oParameters)
{
	this.callbackSave = oParameters.CallbackSave;
	this.callbackDelete = oParameters.CallbackDelete;
	this.calendars = oParameters.Calendars;
	this.selectedCalendarId(oParameters.SelectedCalendar);
	
	this.autosizeTrigger.notifySubscribers(true);
};

CEditTaskPopup.prototype.onSaveClick = function ()
{
	if (this.callbackSave)
	{
		this.callbackSave(
				{
					'CalendarId': this.selectedCalendarId(),
					'Subject': this.subject()
				}
				
		);
	}

	this.closePopup();
};

CEditTaskPopup.prototype.onDeleteClick = function ()
{
	if (this.callbackDelete)
	{
		this.callbackDelete();
	}

	this.closePopup();
};


module.exports = new CEditTaskPopup();
