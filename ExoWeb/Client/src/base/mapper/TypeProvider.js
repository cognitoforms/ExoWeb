var typeProviderFn = function typeProviderFn(type, onSuccess, onFailure) {
	throw "Type provider has not been implemented.  Call ExoWeb.Mapper.setTypeProvider(fn);";
};

function typeProvider(type, onSuccess, onFailure, thisPtr) {
	if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
		thisPtr = onFailure;
		onFailure = null;
	}

	var batch = ExoWeb.Batch.suspendCurrent("typeProvider");
	var cachedType = ExoWeb.cache(type);
	if (cachedType) {
		onSuccess.call(thisPtr || this, cachedType);
	}
	else {
		typeProviderFn.call(this, type,
			function typeProviderSuccess() {
				ExoWeb.Batch.resume(batch);
				ExoWeb.cache(type, arguments[0]);
				if (onSuccess) onSuccess.apply(thisPtr || this, arguments);
			},
			function typeProviderFailure() {
				ExoWeb.Batch.resume(batch);
				if (onFailure) onFailure.apply(thisPtr || this, arguments);
			});
	}
}
ExoWeb.Mapper.setTypeProvider = function setTypeProvider(fn) {
	typeProviderFn = fn;
};
