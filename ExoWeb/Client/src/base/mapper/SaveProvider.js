var saveProviderFn = function saveProviderFn(root, changes, onSuccess, onFailure) {
	throw "Save provider has not been implemented.  Call ExoWeb.Mapper.setSaveProvider(fn);";
};
function saveProvider(root, changes, onSuccess, onFailure) {
	var batch = ExoWeb.Batch.suspendCurrent("saveProvider");
	saveProviderFn.call(this, root, changes,
		function saveProviderSuccess() {
			ExoWeb.Batch.resume(batch);
			if (onSuccess) onSuccess.apply(this, arguments);
		},
		function saveProviderFailure() {
			ExoWeb.Batch.resume(batch);
			if (onFailure) onFailure.apply(this, arguments);
		});
}
ExoWeb.Mapper.setSaveProvider = function setSaveProvider(fn) {
	saveProviderFn = fn;
};
