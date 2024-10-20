function StringFormatRule(rootType, options) {
	/// <summary>Creates a rule that validates that a string property value is correctly formatted.</summary>
	/// <param name="rootType" type="Type">The model type the rule is for.</param>
	/// <param name="options" type="Object">
	///		The options for the rule, including:
	///			property:			the property being validated (either a Property instance or string property name)
	///			description:		the human readable description of the format, such as MM/DD/YYY
	///		    expression:			a regular expression string or RegExp instance that the property value must match
	///		    reformat:			and optional regular expression reformat string or reformat function that will be used to correct the value if it matches
	///			name:				the optional unique name of the type of validation rule
	///			conditionType:		the optional condition type to use, which will be automatically created if not specified
	///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
	///			message:			the message to show the user when the validation fails
	/// </param>
	/// <returns type="StringFormatRule">The new string format rule.</returns>

	// exit immediately if called with no arguments
	if (arguments.length == 0) return;

	// ensure the rule name is specified
	options.name = options.name || "StringFormat";


	// ensure the error message is specified
	if (Resource.get(options.message))
        options.message = Resource.get(options.message);
    else
        options.message = options.message || Resource.get("string-format").replace("{formatDescription}", options.description);

	// define properties for the rule
	Object.defineProperty(this, "description", { value: options.description });
	Object.defineProperty(this, "expression", { value: options.expression instanceof RegExp ? options.expression : RegExp(options.expression) });
	Object.defineProperty(this, "reformat", { value: options.reformat });

	// call the base type constructor
	ValidatedPropertyRule.apply(this, [rootType, options]);
}

// setup the inheritance chain
StringFormatRule.prototype = new ValidatedPropertyRule();
StringFormatRule.prototype.constructor = StringFormatRule;

// extend the base type
StringFormatRule.mixin({

	// returns true if the property is valid, otherwise false
	isValid: function StringFormatRule$isValid(obj, prop, val) {
		var isValid = true;
		if (val && val != "") {
			this.expression.lastIndex = 0;
			isValid = this.expression.test(val);
			if (isValid && this.reformat) {
				if (this.reformat instanceof Function) {
					val = this.reformat(val);
				}
				else {
					this.expression.lastIndex = 0;
					val = val.replace(this.expression, this.reformat);
				}
				prop.value(obj, val);
			}
		}
		return isValid;
	},

	// get the string representation of the rule
	toString: function () {
		return $format("{0}.{1} formatted as {2}",
			[this.get_property.get_containingType().get_fullName(),
			this.get_property().get_name(),
			this.description]);
	}
});

// Expose the rule publicly
Rule.stringFormat = StringFormatRule;
exports.StringFormatRule = StringFormatRule;
