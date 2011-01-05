var objectProviderFn = function objectProviderFn(type, ids, paths, changes, onSuccess, onFailure) {
	throw "Object provider has not been implemented.  Call ExoWeb.Mapper.setObjectProvider(fn);";
};

function objectProvider(type, ids, paths, changes, onSuccess, onFailure) {
	var batch = ExoWeb.Batch.suspendCurrent("objectProvider");
	objectProviderFn.call(this, type, ids, paths, changes,
		function objectProviderSuccess() {
			ExoWeb.Batch.resume(batch);
			if (onSuccess) onSuccess.apply(this, arguments);
		},
		function objectProviderFailure() {
			ExoWeb.Batch.resume(batch);
			if (onFailure) onFailure.apply(this, arguments);
		});
}
ExoWeb.Mapper.setObjectProvider = function setObjectProvider(fn) {
	objectProviderFn = fn;
};
