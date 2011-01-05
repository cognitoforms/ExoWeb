var roundtripProviderFn = function roundtripProviderFn(changes, onSuccess, onFailure) {
	throw "Roundtrip provider has not been implemented.  Call ExoWeb.Mapper.setRoundtripProvider(fn);";
};
function roundtripProvider(changes, onSuccess, onFailure) {
	var batch = ExoWeb.Batch.suspendCurrent("roundtripProvider");
	roundtripProviderFn.call(this, changes,
		function roundtripProviderSucess() {
			ExoWeb.Batch.resume(batch);
			if (onSuccess) onSuccess.apply(this, arguments);
		},
		function roundtripProviderFailure() {
			ExoWeb.Batch.resume(batch);
			if (onFailure) onFailure.apply(this, arguments);
		});
}
ExoWeb.Mapper.setRoundtripProvider = function setRoundtripProvider(fn) {
	roundtripProviderFn = fn;
};
