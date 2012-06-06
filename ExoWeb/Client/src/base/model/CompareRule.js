function CompareRule(rootType, options) {
	/// <summary>Creates a rule that validates a property by comparing it to another property.</summary>
	/// <param name="rootType" type="Type">The model type the rule is for.</param>
	/// <param name="options" type="Object">
	///		The options for the rule, including:
	///			property:			the property being validated (either a Property instance or string property name)
	///			compareSource:		the source property to compare to (either a Property or PropertyChain instance or a string property path)
	///			compareOperator:	the relational comparison operator to use (one of "Equal", "NotEqual", "GreaterThan", "GreaterThanEqual", "LessThan" or "LessThanEqual")
	///			name:				the optional unique name of the type of validation rule
	///			conditionType:		the optional condition type to use, which will be automatically created if not specified
	///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
	///			message:			the message to show the user when the validation fails
	/// </param>
	/// <returns type="CompareRule">The new compare rule.</returns>

	options.name = options.name || "Compare";
	
	// ensure changes to the compare source triggers rule execution
	options.onChangeOf = [options.compareSource];

	// define properties for the rule
	Object.defineProperty(this, "compareOperator", { value: options.compareOperator });
	if (options.source instanceof Property || options.compareSource instanceof PropertyChain) {
		Object.defineProperty(this, "comparePath", { value: options.compareSource.get_path() });
		Object.defineProperty(this, "compareSource", { value: options.compareSource });
	}
	else {
		Object.defineProperty(this, "comparePath", { value: options.compareSource });
	}

	// call the base type constructor
	ValidatedPropertyRule.apply(this, [rootType, options]);
}

// compares the source value to a comparison value using the specified operator
CompareRule.compare = function CompareRule$compare(sourceValue, compareOp, compareValue, defaultValue) {
	if (compareValue === undefined || compareValue === null) {
		switch (compareOp) {
			case "Equal": return !RequiredRule.hasValue(sourceValue);
			case "NotEqual": return RequiredRule.hasValue(sourceValue);
		}
	}

	if (sourceValue !== undefined && sourceValue !== null && compareValue !== undefined && compareValue !== null) {
		switch (compareOp) {
			case "Equal": return sourceValue == compareValue;
			case "NotEqual": return sourceValue != compareValue;
			case "GreaterThan": return sourceValue > compareValue;
			case "GreaterThanEqual": return sourceValue >= compareValue;
			case "LessThan": return sourceValue < compareValue;
			case "LessThanEqual": return sourceValue <= compareValue;
		}
		// Equality by default.
		return sourceValue == compareValue;
	}

	return defaultValue;
};

// setup the inheritance chain
CompareRule.prototype = new ValidatedPropertyRule();
CompareRule.prototype.constructor = CompareRule;

// extend the base type
CompareRule.mixin({

	// return true of the comparison is valid, otherwise false
	isValid: function Compare$isValid(obj, prop, value) {
		var compareValue = this.compareSource.value(obj);
		return CompareRule.compare(value, this.compareOperator, compareValue, true);
	},

	// calculates the appropriate message based on the comparison operator and data type
	message: function () {
		var message;
		var isDate = this.compareSource.get_jstype() === Date;
		if (this.compareOperator === "Equal") {
			message = Resource.get("compare-equal");
		}
		else if (this.compareOperator === "NotEqual") {
			message = Resource.get("compare-not-equal");
		}
		else if (this.compareOperator === "GreaterThan") {
			message = Resource.get(isDate ? "compare-after" : "compare-greater-than");
		}
		else if (this.compareOperator === "GreaterThanEqual") {
			message = Resource.get(isDate ? "compare-on-or-after" : "compare-greater-than-or-equal");
		}
		else if (this.compareOperator === "LessThan") {
			message = Resource.get(isDate ? "compare-before" : "compare-less-than");
		}
		else if (this.compareOperator === "LessThanEqual") {
			message = Resource.get(isDate ? "compare-on-or-before" : "compare-less-than-or-equal");
		}
		else {
			ExoWeb.trace.throwAndLog(["rule"], "Invalid comparison operator for compare rule.");
		}
		message = message
			.replace('{property}', this.property.get_label())
			.replace("{compareSource}", this.compareSource.get_label());
		return message;
	},

	// perform addition initialization of the rule when it is registered
	onRegister: function () {

		// get the compare source, if only the path was specified
		if (!this.compareSource) {
			Object.defineProperty(this, "compareSource", { value: Model.property(this.comparePath, this.rootType) });
		}

		// call the base method
		ValidatedPropertyRule.prototype.onRegister.call(this);
	}
});

// expose the rule publicly
Rule.compare = CompareRule;
exports.CompareRule = CompareRule;
