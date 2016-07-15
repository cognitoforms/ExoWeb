/*global exports, context, Batch */

var roundtripProviderFn = function roundtripProviderFn() {
	"use strict";
	throw new Error("Roundtrip provider has not been implemented. Call ExoWeb.Mapper.setRoundtripProvider(fn);");
};

function roundtripProvider(root, paths, changes, onSuccess, onFailure, thisPtr) {
	"use strict";

	var scopeQueries, maxKnownId, batch;
	
	// ensure correct value of "scopeQueries" argument
	if (onSuccess !== undefined && onSuccess !== null && !(onSuccess instanceof Function)) {
		// scopeQueries is included in call, so shift arguments
		scopeQueries = onSuccess;
		onSuccess = onFailure;
		onFailure = thisPtr;
		thisPtr = arguments.length > 4 ? arguments[4] : null;
	}
	else {
		// scopeQueries is NOT included in call, so insert default value into args array
		scopeQueries = context.server._scopeQueries; //ignore jslint
	}

	if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
		thisPtr = onFailure;
		onFailure = null;
	}

	batch = Batch.suspendCurrent("roundtripProvider");

	maxKnownId = context.server._maxServerIdNumber;

	roundtripProviderFn(root, paths, changes, scopeQueries, maxKnownId,
		function () {
			Batch.resume(batch);
			if (onSuccess) {
				onSuccess.apply(thisPtr || this, arguments);
			}
		},
		function () {
			Batch.resume(batch);
			if (onFailure) {
				onFailure.apply(thisPtr || this, arguments);
			}
		});
}

exports.setRoundtripProvider = function setRoundtripProvider(fn) {
	"use strict";
	roundtripProviderFn = fn;
};

exports.roundtripProvider = roundtripProvider; // IGNORE
