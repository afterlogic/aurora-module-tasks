'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js')
;

/**
 * @constructor
 */
function CTasksListItemModel()
{	
	this.id = '';
	this.calendarId	= '';
	this.shortText = ko.observable('');
	this.text = ko.observable('');
	this.text.subscribe(function(value){
			var aValues = value.split("\n");
			if (_.isArray(aValues) && aValues.length > 0)
			{
				this.shortText(aValues[0]);
			}
		},
		this
	);

	this.selected = ko.observable(false);
	this.checked = ko.observable(false);
	this.color = '';
	this.visible = ko.observable(true);
}

/**
 *
 * @param {Object} oData
 */
CTasksListItemModel.prototype.parse = function (oData)
{
	this.id =  Types.pString(oData.uid);
	this.calendarId = Types.pString(oData.calendarId);
	this.text(Types.pString(oData.subject));
    this.checked(!!oData.status);
};

module.exports = CTasksListItemModel;