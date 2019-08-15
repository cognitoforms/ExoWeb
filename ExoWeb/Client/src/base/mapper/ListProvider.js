/*global exports, context, Batch */

var listProviderFn = function listProvider() {
	"use strict";
	throw new Error("List provider has not been implemented. Call ExoWeb.Mapper.setListProvider(fn);");
};

function listProvider(ownerType, owner, listProp, paths, changes, onSuccess, onFailure, thisPtr) {
	"use strict";

	var scopeQueries, batch, listPath, pathsToLoad, ownerId;

	// ensure correct value of "scopeQueries" argument
	if (onSuccess !== undefined && onSuccess !== null && !(onSuccess instanceof Function)) {
		// scopeQueries is included in call, so shift arguments
		scopeQueries = onSuccess;
		onSuccess = onFailure;
		onFailure = thisPtr;
		thisPtr = arguments.length > 7 ? arguments[7] : null;
	}
	else {
		// scopeQueries is NOT included in call, so insert default value into args array
		scopeQueries = context.server._scopeQueries; //ignore jslint
	}

	if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
		thisPtr = onFailure;
		onFailure = null;
	}

	batch = Batch.suspendCurrent("listProvider");

	ownerId = owner === "static" ? null : owner;
	listPath = owner === "static" ? ownerType + "." + listProp : listProp;
	pathsToLoad = [listPath];

	// prepend list prop to beginning of each other prop
	if (paths && paths.length > 0) {
		Array.forEach(paths, function (p) {
			pathsToLoad.push(listPath + "." + p);
		});
	}

	listProviderFn(ownerType, ownerId, pathsToLoad, changes, scopeQueries,
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

exports.setListProvider = function setListProvider(fn) {
	"use strict";
	listProviderFn = fn;
};

exports.listProvider = listProvider; // IGNORE
