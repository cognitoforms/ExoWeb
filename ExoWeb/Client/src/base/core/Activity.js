var activityCallbacks = [];

function registerActivity(callback, thisPtr) {
	if (callback === undefined || callback === null) {
		ExoWeb.trace.throwAndLog("activity", "Activity callback cannot be null or undefined.");
	}

	if (!(callback instanceof Function)) {
		ExoWeb.trace.throwAndLog("activity", "Activity callback must be a function.");
	}

	var item = { callback: callback };

	if (thisPtr) {
		callback.thisPtr = thisPtr;
	}

	activityCallbacks.push(item);
}

ExoWeb.registerActivity = registerActivity;

function isBusy() {
	for (var i = 0, len = activityCallbacks.length; i < len; i++) {
		var item = activityCallbacks[i];

		if (item.callback.call(item.thisPtr || this) === true) {
			return true;
		}
	}

	return false;
}

ExoWeb.isBusy = isBusy;
