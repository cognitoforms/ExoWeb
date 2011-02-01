var saveProviderFn = function saveProviderFn(root, changes, onSuccess, onFailure) {
	throw "Save provider has not been implemented.  Call ExoWeb.Mapper.setSaveProvider(fn);";
};

function saveProvider(root, changes, onSuccess, onFailure, thisPtr) {
	if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
		thisPtr = onFailure;
		onFailure = null;
	}

	var batch = ExoWeb.Batch.suspendCurrent("saveProvider");
	saveProviderFn.call(this, root, changes,
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
