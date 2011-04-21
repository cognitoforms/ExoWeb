var saveProviderFn = function saveProviderFn(root, changes, onSuccess, onFailure) {
	throw "Save provider has not been implemented.  Call ExoWeb.Mapper.setSaveProvider(fn);";
};

function saveProvider(root, changes, onSuccess, onFailure, thisPtr) {
	var scopeQueries;

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
		scopeQueries = context.server._scopeQueries;
	}

	if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
		thisPtr = onFailure;
		onFailure = null;
	}

	var batch = ExoWeb.Batch.suspendCurrent("saveProvider");
	saveProviderFn.call(this, root, changes, scopeQueries,
		function saveProviderSuccess() {
			ExoWeb.Batch.resume(batch);
			if (onSuccess) onSuccess.apply(thisPtr || this, arguments);
		},
		function saveProviderFailure() {
			ExoWeb.Batch.resume(batch);
			if (onFailure) onFailure.apply(thisPtr || this, arguments);
		});
}

ExoWeb.Mapper.setSaveProvider = function setSaveProvider(fn) {
	saveProviderFn = fn;
};
