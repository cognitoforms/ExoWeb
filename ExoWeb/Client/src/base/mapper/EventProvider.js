var eventProviderFn = function eventProviderFn(eventType, instance, event, paths, changes, onSuccess, onFailure) {
	throw "Event provider has not been implemented.  Call ExoWeb.Mapper.setEventProvider(fn);";
};

function eventProvider(eventType, instance, event, paths, changes, onSuccess, onFailure) {
	var batch = ExoWeb.Batch.suspendCurrent("eventProvider");
	eventProviderFn.call(this, eventType, instance, event, paths, changes,
		function eventProviderSuccess() {
			ExoWeb.Batch.resume(batch);
			if (onSuccess) onSuccess.apply(this, arguments);
		},
		function eventProviderFailure() {
			ExoWeb.Batch.resume(batch);
			if (onFailure) onFailure.apply(this, arguments);
		});
}
ExoWeb.Mapper.setEventProvider = function setEventProvider(fn) {
	eventProviderFn = fn;
};
