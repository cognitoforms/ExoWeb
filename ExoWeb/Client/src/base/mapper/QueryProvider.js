/*global exports, context, Batch */

var queryProviderFn = function queryProviderFn() {
	"use strict";
	throw new Error("Query provider has not been implemented. Call ExoWeb.Mapper.setQueryProvider(fn);");
};

function queryProvider(queries, changes, onSuccess, onFailure, thisPtr) {
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

	batch = Batch.suspendCurrent("queryProvider");

	maxKnownId = context.server._maxServerIdNumber;

	queryProviderFn(queries, changes, scopeQueries, maxKnownId,
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

exports.setQueryProvider = function setQueryProvider(fn) {
	"use strict";
	queryProviderFn = fn;
};

exports.queryProvider = queryProvider; // IGNORE
