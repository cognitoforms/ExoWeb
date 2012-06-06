function FormatError(message, invalidValue) {
	Object.defineProperty(this, "message", { value: message });
	Object.defineProperty(this, "invalidValue", { value: invalidValue });
}

var formatConditionType = new ConditionType.Error("FormatError", "The value is not properly formatted.", []);

FormatError.mixin({
	createCondition: function FormatError$createCondition(target, prop) {
		return new Condition(formatConditionType,
			$format(this.message, prop.get_label()),
			target,
			[prop.get_name()],
			"client");
	},
	toString: function FormateError$toString() {
		return this._invalidValue;
	}
});

ExoWeb.Model.FormatError = FormatError;
