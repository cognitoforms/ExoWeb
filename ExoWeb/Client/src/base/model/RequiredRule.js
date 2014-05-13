function RequiredRule(rootType, options) {
	/// <summary>Creates a rule that validates that a property has a value.</summary>
	/// <param name="rootType" type="Type">The model type the rule is for.</param>
	/// <param name="options" type="Object">
	///		The options for the rule, including:
	///			property:			the property being validated (either a Property instance or string property name)
	///			name:				the optional unique name of the type of validation rule
	///			conditionType:		the optional condition type to use, which will be automatically created if not specified
	///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
	///			message:			the message to show the user when the validation fails
	///			requiredValue:		the optional required value
	/// </param>
	/// <returns type="RequiredRule">The new required rule.</returns>

	// ensure the rule name is specified
	options.name = options.name || "Required";

	// ensure the error message is specified
	options.message = options.message || Resource.get("required");

	if (options.requiredValue)
		Object.defineProperty(this, "requiredValue", { value: options.requiredValue });

	// call the base type constructor
	ValidatedPropertyRule.apply(this, [rootType, options]);
}

// setup the inheritance chain
RequiredRule.prototype = new ValidatedPropertyRule();
RequiredRule.prototype.constructor = RequiredRule;

// define a global function that determines if a value exists
RequiredRule.hasValue = function RequiredRule$hasValue(val) {
	return val !== undefined && val !== null && (val.constructor !== String || val.trim() !== "") && (!(val instanceof Array) || val.length > 0);
};

// extend the base type
RequiredRule.mixin({

	// returns true if the property is valid, otherwise false
	isValid: function RequiredRule$isValid(obj, prop, val) {
		if (this.requiredValue)
			return val === this.requiredValue;
		else
			return RequiredRule.hasValue(val);
	},

	// get the string representation of the rule
	toString: function () {
		return $format("{0}.{1} is required", [this.property.get_containingType().get_fullName(), this.property.get_name()]);
	}
});

// Expose the rule publicly
Rule.required = RequiredRule;
exports.RequiredRule = RequiredRule;