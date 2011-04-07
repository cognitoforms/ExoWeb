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
		if (ExoWeb.cacheHash && cachedType.cacheHash !== ExoWeb.cacheHash) {
			// the cached type definition is out of date, so remove it and continue
			ExoWeb.cache(type, null);
		}
		else {
			// the cached type definition is current, so use it and return early
			onSuccess.call(thisPtr || this, cachedType);
			return;
		}
	}

	typeProviderFn.call(this, type,
		function typeProviderSuccess() {
			ExoWeb.Batch.resume(batch);

			// add cache hash and cache type definition
			arguments[0].cacheHash = ExoWeb.cacheHash;
			ExoWeb.cache(type, arguments[0]);

			if (onSuccess) onSuccess.apply(thisPtr || this, arguments);
		},
		function typeProviderFailure() {
			ExoWeb.Batch.resume(batch);
			if (onFailure) onFailure.apply(thisPtr || this, arguments);
		});
}
ExoWeb.Mapper.setTypeProvider = function setTypeProvider(fn) {
	typeProviderFn = fn;
};
