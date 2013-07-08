/*global exports, context, Batch */

var objectProviderFn = function objectProviderFn() {
	"use strict";
	throw new Error("Object provider has not been implemented. Call ExoWeb.Mapper.setObjectProvider(fn);");
};

function objectProvider(type, ids, paths, inScope, changes, onSuccess, onFailure, thisPtr) {
	"use strict";

	var scopeQueries, batch;

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

	batch = Batch.suspendCurrent("objectProvider");

	objectProviderFn(type, ids, paths, inScope, changes, scopeQueries,
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

exports.setObjectProvider = function setObjectProvider(fn) {
	"use strict";
	objectProviderFn = fn;
};

exports.objectProvider = objectProvider; // IGNORE
