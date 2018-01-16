function ValidationRule(rootType, options) {
	/// <summary>Creates a rule that performs custom validation for a property.</summary>
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
	options.name = options.name || "Validation";

	// ensure the error message is specified
	if (Resource.get(options.message))
        options.message = "\"" + Resource.get(options.message) + "\"";
    else
        options.message = options.message || Resource.get("validation");

	// predicate-based rule
	if (options.isError || options.fn) {
		Object.defineProperty(this, "isError", { value: options.isError || options.fn, writable: true });
	}

	// call the base type constructor
	ValidatedPropertyRule.apply(this, [rootType, options]);
}

// setup the inheritance chain
ValidationRule.prototype = new ValidatedPropertyRule();
ValidationRule.prototype.constructor = ValidationRule;

// extend the base type
ValidationRule.mixin({

	// returns true if the property is valid, otherwise false
	isValid: function ValidationRule$isValid(obj, prop, val) {

		// convert string functions into compiled functions on first execution
		if (this.isError.constructor === String) {
			this.isError = this.rootType.compileExpression(this.isError);
		}

		// convert string functions into compiled functions on first execution
		if (this.message.constructor === String) {
			var message = this.rootType.compileExpression(this.message);
			this.message = function (root) {
				try { return message.apply(root, [root]); } catch (e) { return ""; }
			};
		}

		try {
			return !this.isError.apply(obj, [obj]) || !this.message.apply(obj, [obj]);
		}
		catch (e) {
			return true;
		}
	},

	// get the string representation of the rule
	toString: function () {
		return $format("{0}.{1} is invalid", [this.property.get_containingType().get_fullName(), this.property.get_name()]);
	}
});

// Expose the rule publicly
Rule.validation = ValidationRule;
exports.ValidationRule = ValidationRule;