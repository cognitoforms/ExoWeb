var queryProviderFn = function queryProviderFn(queries, changes, onSuccess, onFailure) {
	throw "Query provider has not been implemented.  Call ExoWeb.Mapper.setQueryProvider(fn);";
};

function queryProvider(queries, changes, onSuccess, onFailure, thisPtr, thisPtr) {
	var scopeQueries;

	// ensure correct value of "scopeQueries" argument
	if (isFunction(onSuccess)) {
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

	if (isFunction(onFailure)) {
		thisPtr = onFailure;
		onFailure = null;
	}

	var batch = ExoWeb.Batch.suspendCurrent("queryProvider");
	queryProviderFn.call(this, queries, changes, scopeQueries,
		function queryProviderSuccess() {
			ExoWeb.Batch.resume(batch);
			if (onSuccess) {
				onSuccess.apply(thisPtr || this, arguments);
			}
		},
		function queryProviderFailure() {
			ExoWeb.Batch.resume(batch);
			if (onFailure) {
				onFailure.apply(thisPtr || this, arguments);
			}
		});
}

ExoWeb.Mapper.setQueryProvider = function setQueryProvider(fn) {
	queryProviderFn = fn;
};
