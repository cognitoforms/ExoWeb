var typeProviderFn = function typeProviderFn(type, onSuccess, onFailure) {
	throw "Type provider has not been implemented.  Call ExoWeb.Mapper.setTypeProvider(fn);";
};

function typeProvider(type, onSuccess, onFailure) {
	var batch = ExoWeb.Batch.suspendCurrent("typeProvider");
	var cachedType = ExoWeb.cache(type);
	if (cachedType)
		onSuccess(cachedType);
	else
		typeProviderFn.call(this, type,
			function typeProviderSuccess() {
				ExoWeb.Batch.resume(batch);
				ExoWeb.cache(type, arguments[0]);
				if (onSuccess) onSuccess.apply(this, arguments);
			},
			function typeProviderFailure() {
				ExoWeb.Batch.resume(batch);
				if (onFailure) onFailure.apply(this, arguments);
			});
}
ExoWeb.Mapper.setTypeProvider = function setTypeProvider(fn) {
	typeProviderFn = fn;
};
