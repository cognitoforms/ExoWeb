var activityCallbacks = [];

function registerActivity(label, callback, thisPtr) {
	if (label === undefined || label === null) {
		ExoWeb.trace.throwAndLog("activity", "Activity label cannot be null or undefined.");
	}

	if (label.constructor !== String) {
		ExoWeb.trace.throwAndLog("activity", "Activity label must be a string.");
	}

	if (callback === undefined || callback === null) {
		ExoWeb.trace.throwAndLog("activity", "Activity callback cannot be null or undefined.");
	}

	if (!(callback instanceof Function)) {
		ExoWeb.trace.throwAndLog("activity", "Activity callback must be a function.");
	}

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

	for (var i = 0, len = activityCallbacks.length; i < len; i++) {
		var item = activityCallbacks[i];

		if (item.callback.call(item.thisPtr || this) === true) {
			if (logBusyLabel) {
				busy = true;
				console.log("Item \"" + item.label + "\" is busy.");
			}
			else {
				return true;
			}
		}
	}

	return busy;
}

exports.isBusy = isBusy;
