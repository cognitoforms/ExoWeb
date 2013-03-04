/// <reference path="Errors.js" />

var activityCallbacks = [];

function registerActivity(label, callback, thisPtr) {
	if (label == null) throw new ArgumentNullError("label");
	if (typeof(label) !== "string") throw new ArgumentTypeError("label", "string", label);
	if (callback == null) throw new ArgumentNullError("callback");
	if (typeof(callback) !== "function") throw new ArgumentTypeError("callback", "function", callback);

	var item = { label: label, callback: callback };

	if (thisPtr) {
		callback.thisPtr = thisPtr;
	}

	activityCallbacks.push(item);
}

exports.registerActivity = registerActivity;

function isBusy(/* logBusyLabel */) {
	var busy = false;
	var logBusyLabel = arguments[0];

	getBusyItems(function (item) {
		busy = true;

			if (logBusyLabel) {
				console.log("Item \"" + item.label + "\" is busy.");
			return false;
			}
			else {
				return true;
			}
	});

	return busy;
}

exports.isBusy = isBusy;

function getBusyItems(onBusyItemFound) {
	var busyItems = [];

	for (var i = 0, len = activityCallbacks.length; i < len; i++) {
		var item = activityCallbacks[i];

		if (item.callback.call(item.thisPtr || this) === true) {
			busyItems.push(item);

			if (onBusyItemFound && onBusyItemFound(item) === true)
				return busyItems;
		}
	}

	return busyItems;
}

exports.getBusyItems = getBusyItems;