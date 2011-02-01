var objectProviderFn = function objectProviderFn(type, ids, paths, changes, onSuccess, onFailure) {
	throw "Object provider has not been implemented.  Call ExoWeb.Mapper.setObjectProvider(fn);";
};

function objectProvider(type, ids, paths, changes, onSuccess, onFailure, thisPtr) {
	if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
		thisPtr = onFailure;
		onFailure = null;
	}

	var batch = ExoWeb.Batch.suspendCurrent("objectProvider");
	objectProviderFn.call(this, type, ids, paths, changes,
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
