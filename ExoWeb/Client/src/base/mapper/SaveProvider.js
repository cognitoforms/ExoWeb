/*global exports, context, Batch */

var saveProviderFn = function saveProviderFn() {
	"use strict";
	throw new Error("Save provider has not been implemented. Call ExoWeb.Mapper.setSaveProvider(fn);");
};

function saveProvider(root, changes, onSuccess, onFailure, thisPtr) {
	"use strict";

	var scopeQueries, maxKnownId, batch;

	// ensure correct value of "scopeQueries" argument
	if (onSuccess !== undefined && onSuccess !== null && !(onSuccess instanceof Function)) {
		// scopeQueries is included in call, so shift arguments
		scopeQueries = onSuccess;
		onSuccess = onFailure;
		onFailure = thisPtr;
		thisPtr = arguments.length > 5 ? arguments[5] : null;
	}
	else {
		// scopeQueries is NOT included in call, so insert default value into args array
		scopeQueries = context.server._scopeQueries; //ignore jslint
	}

	if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
		thisPtr = onFailure;
		onFailure = null;
	}

	batch = Batch.suspendCurrent("saveProvider");

	maxKnownId = context.server._maxServerIdNumber;

	saveProviderFn(root, changes, scopeQueries, maxKnownId,
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

exports.setSaveProvider = function setSaveProvider(fn) {
	"use strict";
	saveProviderFn = fn;
};

exports.saveProvider = saveProvider; // IGNORE
