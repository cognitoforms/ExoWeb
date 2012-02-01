function FormatError(message, invalidValue) {
	this._message = message;
	this._invalidValue = invalidValue;
}

var formatConditionType = new ConditionType("FormatError", "Error", "The value is not properly formatted.", []);

FormatError.mixin({
	createCondition: function FormatError$createCondition(origin, prop) {
		return new Condition(formatConditionType,
			$format(this.get_message(), prop.get_label()),
			[prop],
			origin);
	},
	get_message: function FormateError$get_message() {
		return this._message;
	},
	get_invalidValue: function FormateError$get_invalidValue() {
		return this._invalidValue;
	},
	toString: function FormateError$toString() {
		return this._invalidValue;
	}
});

ExoWeb.Model.FormatError = FormatError;
