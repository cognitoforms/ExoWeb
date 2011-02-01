var queryProviderFn = function queryProviderFn(queries, changes, onSuccess, onFailure) {
	throw "Query provider has not been implemented.  Call ExoWeb.Mapper.setQueryProvider(fn);";
};

function queryProvider(queries, changes, onSuccess, onFailure, thisPtr, thisPtr) {
	if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
		thisPtr = onFailure;
		onFailure = null;
	}

	var batch = ExoWeb.Batch.suspendCurrent("queryProvider");
	queryProviderFn.call(this, queries, changes,
		function queryProviderSuccess() {
			ExoWeb.Batch.resume(batch);
			if (onSuccess) onSuccess.apply(thisPtr || this, arguments);
		},
		function queryProviderFailure() {
			ExoWeb.Batch.resume(batch);
			if (onFailure) onFailure.apply(thisPtr || this, arguments);
		});
}

ExoWeb.Mapper.setQueryProvider = function setQueryProvider(fn) {
	queryProviderFn = fn;
};
