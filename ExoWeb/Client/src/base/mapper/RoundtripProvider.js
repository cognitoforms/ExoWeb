var roundtripProviderFn = function roundtripProviderFn(changes, onSuccess, onFailure) {
	throw "Roundtrip provider has not been implemented.  Call ExoWeb.Mapper.setRoundtripProvider(fn);";
};

function roundtripProvider(changes, onSuccess, onFailure, thisPtr) {
	if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
		thisPtr = onFailure;
		onFailure = null;
	}

	var batch = ExoWeb.Batch.suspendCurrent("roundtripProvider");
	roundtripProviderFn.call(this, changes,
		function roundtripProviderSucess() {
			ExoWeb.Batch.resume(batch);
			if (onSuccess) onSuccess.apply(thisPtr || this, arguments);
		},
		function roundtripProviderFailure() {
			ExoWeb.Batch.resume(batch);
			if (onFailure) onFailure.apply(thisPtr || this, arguments);
		});
}

ExoWeb.Mapper.setRoundtripProvider = function setRoundtripProvider(fn) {
	roundtripProviderFn = fn;
};
