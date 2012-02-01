var objectProviderFn = function objectProviderFn(type, ids, paths, inScope, changes, onSuccess, onFailure) {
	throw new Error("Object provider has not been implemented.  Call ExoWeb.Mapper.setObjectProvider(fn);");
};

function objectProvider(type, ids, paths, inScope, changes, onSuccess, onFailure, thisPtr) {
	var scopeQueries;

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
		scopeQueries = context.server._scopeQueries;
	}

	if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
		thisPtr = onFailure;
		onFailure = null;
	}

	var batch = ExoWeb.Batch.suspendCurrent("objectProvider");
	objectProviderFn.call(this, type, ids, paths, inScope, changes, scopeQueries,
		function objectProviderSuccess() {
			ExoWeb.Batch.resume(batch);
			if (onSuccess) onSuccess.apply(thisPtr || this, arguments);
		},
		function objectProviderFailure() {
			ExoWeb.Batch.resume(batch);
			if (onFailure) onFailure.apply(thisPtr || this, arguments);
		});
}
ExoWeb.Mapper.setObjectProvider = function setObjectProvider(fn) {
	objectProviderFn = fn;
};
