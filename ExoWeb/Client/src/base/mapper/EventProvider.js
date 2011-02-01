var eventProviderFn = function eventProviderFn(eventType, instance, event, paths, changes, onSuccess, onFailure) {
	throw "Event provider has not been implemented.  Call ExoWeb.Mapper.setEventProvider(fn);";
};

function eventProvider(eventType, instance, event, paths, changes, onSuccess, onFailure, thisPtr) {
	if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
		thisPtr = onFailure;
		onFailure = null;
	}

	var batch = ExoWeb.Batch.suspendCurrent("eventProvider");
	eventProviderFn.call(this, eventType, instance, event, paths, changes,
		function eventProviderSuccess() {
			ExoWeb.Batch.resume(batch);
			if (onSuccess) onSuccess.apply(thisPtr || this, arguments);
		},
		function eventProviderFailure() {
			ExoWeb.Batch.resume(batch);
			if (onFailure) onFailure.apply(thisPtr || this, arguments);
		});
}

ExoWeb.Mapper.setEventProvider = function setEventProvider(fn) {
	eventProviderFn = fn;
};
