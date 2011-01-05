var listProviderFn = function listProvider(ownerType, ownerId, paths, onSuccess, onFailure) {
	throw "List provider has not been implemented.  Call ExoWeb.Mapper.setListProvider(fn);";
};
function listProvider(ownerType, ownerId, listProp, otherProps, onSuccess, onFailure) {
	var batch = ExoWeb.Batch.suspendCurrent("listProvider");

	var listPath = (ownerId == "static" ? ownerType : "this") + "." + listProp;
	var paths = [listPath];

	// prepend list prop to beginning of each other prop
	if (otherProps.length > 0) {
		Array.forEach(otherProps, function(p) {
			paths.push(p.startsWith("this.") ? listPath + "." + p.substring(5) : p);
		});
	}

	listProviderFn.call(this, ownerType, ownerId == "static" ? null : ownerId, paths,
		function listProviderSuccess() {
			ExoWeb.Batch.resume(batch);
			if (onSuccess) onSuccess.apply(this, arguments);
		},
		function listProviderFailure() {
			ExoWeb.Batch.resume(batch);
			if (onFailure) onFailure.apply(this, arguments);
		});
}
ExoWeb.Mapper.setListProvider = function setListProvider(fn) {
	listProviderFn = fn;
};
