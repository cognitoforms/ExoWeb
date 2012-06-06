function StringLengthRule(rootType, options) {
	/// <summary>Creates a rule that validates that the length of a string property is within a specific range.</summary>
	/// <param name="rootType" type="Type">The model type the rule is for.</param>
	/// <param name="options" type="Object">
	///		The options for the rule, including:
	///			property:			the property being validated (either a Property instance or string property name)
	///			min:				the minimum length of the property
	///			max:				the maximum length of the property
	///			name:				the optional unique name of the type of validation rule
	///			conditionType:		the optional condition type to use, which will be automatically created if not specified
	///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
	///			message:			the message to show the user when the validation fails
	/// </param>
	/// <returns type="RangeRule">The new range rule.</returns>

	// ensure the rule name is specified
	options.name = options.name || "StringLength";

	// store the min and max lengths
	Object.defineProperty(this, "min", { value: options.min });
	Object.defineProperty(this, "max", { value: options.max });

	// ensure the error message is specified
	options.message = options.message ||
		(options.min && options.max ? Resource.get("string-length-between").replace("{min}", this.min).replace("{max}", this.max) :
		options.min ? Resource.get("string-length-at-least").replace("{min}", this.min) :
		Resource.get("string-length-at-most").replace("{max}", this.max));

	// call the base type constructor
	ValidatedPropertyRule.apply(this, [rootType, options]);
}

// setup the inheritance chain
StringLengthRule.prototype = new ValidatedPropertyRule();
StringLengthRule.prototype.constructor = StringLengthRule;

// extend the base type
StringLengthRule.mixin({

	// returns true if the property is valid, otherwise false
	isValid: function StringLengthRule$isValid(obj, prop, val) {
		return !val || val === "" || ((!this.min || val.length >= this.min) && (!this.max || val.length <= this.max));
	},

	// get the string representation of the rule
	toString: function () {
		return $format("{0}.{1} in range, min: {2}, max: {3}",
			[this.get_property().get_containingType().get_fullName(),
			this.get_property().get_name(),
			this.min ? "" : this.min,
			this.max ? "" : this.max]);
	}
});

// Expose the rule publicly
Rule.stringLength = StringLengthRule;
exports.StringLengthRule = StringLengthRule;
