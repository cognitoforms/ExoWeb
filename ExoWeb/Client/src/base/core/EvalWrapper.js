// Helper class for interpreting expressions
function EvalWrapper(value) {
	this.value = value;
}

EvalWrapper.mixin({
	get: function EvalWrapper$get(member) {
		var propValue = getValue(this.value, member);

		if (propValue === undefined) {
			propValue = window[member];
		}

		if (propValue === undefined) {
			throw new TypeError(member + " is undefined");
		}

		return new EvalWrapper(propValue);
	}
});

ExoWeb.EvalWrapper = EvalWrapper;
