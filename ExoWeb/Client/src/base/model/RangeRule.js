function RangeRule(rootType, options) {
	/// <summary>Creates a rule that validates a property value is within a specific range.</summary>
	/// <param name="rootType" type="Type">The model type the rule is for.</param>
	/// <param name="options" type="Object">
	///		The options for the rule, including:
	///			property:			the property being validated (either a Property instance or string property name)
	///			min:				the minimum valid value of the property
	///			max:				the maximum valid value of the property
	///			name:				the optional unique name of the type of validation rule
	///			conditionType:		the optional condition type to use, which will be automatically created if not specified
	///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
	///			message:			the message to show the user when the validation fails
	/// </param>
	/// <returns type="RangeRule">The new range rule.</returns>

	// ensure the rule name is specified
	options.name = options.name || "Range";

	// store the min and max lengths 
	if (options.min !== undefined && options.min !== null) {
		Object.defineProperty(this, "min", { value: options.min });
	}
	if (options.max !== undefined && options.max !== null) {
		Object.defineProperty(this, "max", { value: options.max });
	}

	// get the property being validated in order to determine the data type
	var property = options.property instanceof Property ? options.property : rootType.property(options.property);

	// ensure the error message is specified
	options.message = options.message ||
		(this.min !== undefined && this.max !== undefined ? Resource.get("range-between").replace("{min}", this.min).replace("{max}", this.max) : // between date or ordinal
			property.get_jstype() === Date ?
				this.min !== undefined ? 
					Resource.get("range-on-or-after").replace("{min}", this.min) : // on or after date
					Resource.get("range-on-or-before").replace("{max}", this.max) : // on or before date
				this.max !== undefined ? 
					Resource.get("range-at-least").replace("{min}", this.min) : // at least ordinal
					Resource.get("range-at-most").replace("{max}", this.max)); // at most ordinal

	// call the base type constructor
	ValidatedPropertyRule.apply(this, [rootType, options]);
}

// setup the inheritance chain
RangeRule.prototype = new ValidatedPropertyRule();
RangeRule.prototype.constructor = RangeRule;

// extend the base type
RangeRule.mixin({

	// returns true if the property is valid, otherwise false
	isValid: function RangeRule$isValid(obj, prop, val) {
		return val === null || val === undefined || ((this.min === undefined || val >= this.min) && (this.max === undefined || val <= this.max));
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
Rule.range = RangeRule;
exports.RangeRule = RangeRule;