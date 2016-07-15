/*global exports, context, Batch */

var eventProviderFn = function eventProviderFn() {
	"use strict";
	throw new Error("Event provider has not been implemented. Call ExoWeb.Mapper.setEventProvider(fn);");
};

function eventProvider(eventType, eventInstance, event, paths, changes, onSuccess, onFailure, thisPtr) {
	"use strict";

	var scopeQueries, maxKnownId, batch;

	// ensure correct value of "scopeQueries" argument
	if (onSuccess !== undefined && onSuccess !== null && !(onSuccess instanceof Function)) {
		// scopeQueries is included in call, so shift arguments
		scopeQueries = onSuccess;
		onSuccess = onFailure;
		onFailure = thisPtr;
		thisPtr = arguments.length > 8 ? arguments[8] : null;
	}
	else {
		// scopeQueries is NOT included in call, so insert default value into args array
		scopeQueries = context.server._scopeQueries; //ignore jslint
	}

	if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
		thisPtr = onFailure;
		onFailure = null;
	}

	batch = Batch.suspendCurrent("eventProvider");

	maxKnownId = context.server._maxServerIdNumber;

	eventProviderFn(eventType, eventInstance, event, paths, changes, scopeQueries, maxKnownId,
		function () {
			Batch.resume(batch);
			if (onSuccess) {
				onSuccess.apply(thisPtr || null, arguments);
			}
		},
		function () {
			Batch.resume(batch);
			if (onFailure) {
				onFailure.apply(thisPtr || null, arguments);
			}
		});
}

exports.setEventProvider = function setEventProvider(fn) {
	"use strict";
	eventProviderFn = fn;
};

exports.eventProvider = eventProvider; // IGNORE
