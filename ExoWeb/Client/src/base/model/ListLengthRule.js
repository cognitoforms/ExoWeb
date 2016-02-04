function ListLengthRule(rootType, options) {
	/// <summary>Creates a rule that validates a list property contains a specific range of items.</summary>
	/// <param name="rootType" type="Type">The model type the rule is for.</param>
	/// <param name="options" type="Object">
	///		The options for the rule, including:
	///			property:			the property being validated (either a Property instance or string property name)
	///			min:				the minimum valid value of the property
	///			max:				the maximum valid value of the property
	///			minFn:				a function returning the minimum valid value of the property
	///			maxFn:				a function returning the maximum valid value of the property
	///			name:				the optional unique name of the type of validation rule
	///			conditionType:		the optional condition type to use, which will be automatically created if not specified
	///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
	///			message:			the message to show the user when the validation fails
	///		    onChangeOf:			an array of property paths (strings, Property or PropertyChain instances) that drive when the rule should execute due to property changes
	/// </param>
	/// <returns type="ListLengthRule">The new list length rule.</returns>

	// ensure the rule name is specified
	options.name = options.name || "ListLength";

	// call the base type constructor
	RangeRule.apply(this, [rootType, options]);
}

// setup the inheritance chain
ListLengthRule.prototype = new RangeRule();
ListLengthRule.prototype.constructor = ListLengthRule;

// extend the base type
ListLengthRule.mixin({

	// returns true if the property is valid, otherwise false
	isValid: function ListLengthRule$isValid(obj, prop, val) {

		var range = this.range(obj);

		return val === null || val === undefined || ((!range.min || val.length >= range.min) && (!range.max || val.length <= range.max));
	},

	message: function ListLengthRule$message(obj, prop, val) {

		var range = this.range(obj);

		// ensure the error message is specified
		var message =
			(range.min && range.max ? Resource.get("listlength-between").replace("{min}", this.property.format(range.min)).replace("{max}", this.property.format(range.max)) : 
					range.min ?
						Resource.get("listlength-at-least").replace("{min}", this.property.format(range.min)) : // at least ordinal
						Resource.get("listlength-at-most").replace("{max}", this.property.format(range.max))); // at most ordinal

		return message.replace('{property}', this.property.get_label());
	}
});

// Expose the rule publicly
Rule.listLength = ListLengthRule;
exports.ListLengthRule = ListLengthRule;