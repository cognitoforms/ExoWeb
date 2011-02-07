var listProviderFn = function listProvider(ownerType, ownerId, paths, onSuccess, onFailure) {
	throw "List provider has not been implemented.  Call ExoWeb.Mapper.setListProvider(fn);";
};

function listProvider(ownerType, ownerId, listProp, otherProps, onSuccess, onFailure, thisPtr) {
	var scopeQueries;

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
		scopeQueries = context.server.getScopeQueries();
	}

	if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
		thisPtr = onFailure;
		onFailure = null;
	}

	var batch = ExoWeb.Batch.suspendCurrent("listProvider");

	var listPath = (ownerId == "static" ? ownerType : "this") + "." + listProp;
	var paths = [listPath];

	// prepend list prop to beginning of each other prop
	if (otherProps.length > 0) {
		Array.forEach(otherProps, function(p) {
			paths.push(p.startsWith("this.") ? listPath + "." + p.substring(5) : p);
		});
	}

	listProviderFn.call(this, ownerType, ownerId == "static" ? null : ownerId, paths, scopeQueries,
		function listProviderSuccess() {
			ExoWeb.Batch.resume(batch);
			if (onSuccess) onSuccess.apply(thisPtr || this, arguments);
		},
		function listProviderFailure() {
			ExoWeb.Batch.resume(batch);
			if (onFailure) onFailure.apply(thisPtr || this, arguments);
		});
}

ExoWeb.Mapper.setListProvider = function setListProvider(fn) {
	listProviderFn = fn;
};
