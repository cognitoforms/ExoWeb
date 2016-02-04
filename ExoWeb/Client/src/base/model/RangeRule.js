function RangeRule(rootType, options) {
	/// <summary>Creates a rule that validates a property value is within a specific range.</summary>
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
	/// <returns type="RangeRule">The new range rule.</returns>

	// ensure the rule name is specified
	options.name = options.name || "Range";

	// get the property being validated in order to determine the data type
	var property = options.property instanceof Property ? options.property : rootType.property(options.property);

	// coerce date range constants
	if (options.min && property.get_jstype() === Date) {
		options.min = new Date(options.min);
	}
	if (options.max && property.get_jstype() === Date) {
		options.max = new Date(options.max);
	}

	// coerce null ranges to undefined
	if (options.min === null) {
		options.min = undefined;
	}
	if (options.max === null) {
		options.max = undefined;
	}

	// convert constant values into functions
	if (!options.minFn) {
		options.minFn = function() { return options.min; };
	}
	if (!options.maxFn) {
		options.maxFn = function() { return options.max; };
	}

	// Store the min and max functions
	Object.defineProperty(this, "min", { value: options.minFn, writable: true });
	Object.defineProperty(this, "max", { value: options.maxFn, writable: true });

	// call the base type constructor
	ValidatedPropertyRule.apply(this, [rootType, options]);
}

// setup the inheritance chain
RangeRule.prototype = new ValidatedPropertyRule();
RangeRule.prototype.constructor = RangeRule;

// extend the base type
RangeRule.mixin({

	// get the min and max range in effect for this rule for the specified instance
	range: function RangeRule$range(obj) {

		// convert string functions into compiled functions on first execution
		if (this.min && this.min.constructor === String) {
			this.min = this.rootType.compileExpression(this.min);
		}
		if (this.max && this.max.constructor === String) {
			this.max = this.rootType.compileExpression(this.max);
		}

		// determine the min and max values based on the current state of the instance
		var range = { };
		try { range.min = this.min.call(obj); }	catch (e) { }
		try { range.max = this.max.call(obj); }	catch (e) { }
		range.min = range.min == null ? undefined : range.min;
		range.max = range.max == null ? undefined : range.max;

		return range;
	},

	// returns true if the property is valid, otherwise false
	isValid: function RangeRule$isValid(obj, prop, val) { 

		var range = this.range(obj);

		return val === null || val === undefined || ((range.min === undefined || val >= range.min) && (range.max === undefined || val <= range.max));
	},

	message: function RangeRule$message(obj, prop, val) {

		var range = this.range(obj);

		// ensure the error message is specified
		var message =
			(range.min !== undefined && range.max !== undefined ? Resource.get("range-between").replace("{min}", this.property.format(range.min)).replace("{max}", this.property.format(range.max)) : // between date or ordinal
				this.property.get_jstype() === Date ?
					range.min !== undefined ?
						Resource.get("range-on-or-after").replace("{min}", this.property.format(range.min)) : // on or after date
						Resource.get("range-on-or-before").replace("{max}", this.property.format(range.max)) : // on or before date
					range.min !== undefined ?
						Resource.get("range-at-least").replace("{min}", this.property.format(range.min)) : // at least ordinal
						Resource.get("range-at-most").replace("{max}", this.property.format(range.max))); // at most ordinal

		return message.replace('{property}', this.property.get_label());
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