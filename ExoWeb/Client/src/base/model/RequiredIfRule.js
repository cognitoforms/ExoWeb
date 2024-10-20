function RequiredIfRule(rootType, options) {
	/// <summary>Creates a rule that conditionally validates whether a property has a value.</summary>
	/// <param name="rootType" type="Type">The model type the rule is for.</param>
	/// <param name="options" type="Object">
	///		The options for the rule, including:
	///			property:			the property being validated (either a Property instance or string property name)
	///			isRequired:			a predicate function indicating whether the property should be required
	///			compareSource:		the source property to compare to (either a Property or PropertyChain instance or a string property path)
	///			compareOperator:	the relational comparison operator to use (one of "Equal", "NotEqual", "GreaterThan", "GreaterThanEqual", "LessThan" or "LessThanEqual")
	///			compareValue:		the optional value to compare to
	///			name:				the optional unique name of the type of validation rule
	///			conditionType:		the optional condition type to use, which will be automatically created if not specified
	///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
	///			message:			the message to show the user when the validation fails
	///		    onInit:				true to indicate the rule should run when an instance of the root type is initialized, otherwise false
	///		    onInitNew:			true to indicate the rule should run when a new instance of the root type is initialized, otherwise false
	///		    onInitExisting:		true to indicate the rule should run when an existing instance of the root type is initialized, otherwise false
	///		    onChangeOf:			an array of property paths (strings, Property or PropertyChain instances) that drive when the rule should execute due to property changes
	///			requiredValue:		the optional required value
	/// </param>
	/// <returns type="RequiredIfRule">The new required if rule.</returns>

	options.name = options.name || "RequiredIf";

	// ensure changes to the compare source triggers rule execution
	if (!options.onChangeOf && options.compareSource) {
		options.onChangeOf = [options.compareSource];
	}

	// predicate-based rule
	if (options.isRequired || options.fn) {
		Object.defineProperty(this, "isRequired", { value: options.isRequired || options.fn, writable: true });
		options.fn = null;
		options.message = options.message || Resource.get("required");
	}

		// comparison-based rule
	else {
		Object.defineProperty(this, "comparePath", { value: options.compareSource });
		Object.defineProperty(this, "compareOperator", {
			value: options.compareOperator || (options.compareValue !== undefined && options.compareValue !== null ? "Equal" : "NotEqual"),
			writable: true
		});
		Object.defineProperty(this, "compareValue", { value: options.compareValue, writable: true });
	}

	if (options.requiredValue)
		Object.defineProperty(this, "requiredValue", { value: options.requiredValue });

	// call the base type constructor
	ValidatedPropertyRule.apply(this, [rootType, options]);
}

// setup the inheritance chain
RequiredIfRule.prototype = new ValidatedPropertyRule();
RequiredIfRule.prototype.constructor = RequiredIfRule;

// extend the base type
RequiredIfRule.mixin({

	// determines whether the property should be considered required
	isRequired: function RequiredIfRule$required(obj) {
		var sourceValue = this.compareSource.value(obj);
		return CompareRule.compare(sourceValue, this.compareOperator, this.compareValue, false);
	},

	// calculates the appropriate message based on the comparison operator and data type
	message: function () {
		var message;
		var isDate = this.compareSource.get_jstype() === Date;
		if (this.compareValue === undefined || this.compareValue === null) {
			message = Resource.get(this.compareOperator === "Equal" ? "required-if-not-exists" : "required-if-exists");
		}
		else if (this.compareOperator === "Equal") {
			message = Resource.get("required-if-equal");
		}
		else if (this.compareOperator === "NotEqual") {
			message = Resource.get("required-if-not-equal");
		}
		else if (this.compareOperator === "GreaterThan") {
			message = Resource.get(isDate ? "required-if-after" : "required-if-greater-than");
		}
		else if (this.compareOperator === "GreaterThanEqual") {
			message = Resource.get(isDate ? "required-if-on-or-after" : "required-if-greater-than-or-equal");
		}
		else if (this.compareOperator === "LessThan") {
			message = Resource.get(isDate ? "required-if-before" : "required-if-less-than");
		}
		else if (this.compareOperator === "LessThanEqual") {
			message = Resource.get(isDate ? "required-if-on-or-before" : "required-if-less-than-or-equal");
		}
		else {
			throw new Error("Invalid comparison operator for compare rule.");
		}

		message = message.replace("{compareSource}", this.compareSource.get_label())
			.replace("{compareValue}", this.compareSource.format(this.compareValue));

		return message.replace('{property}', this.getPropertyLabel(obj));
	},

	// returns false if the property is valid, true if invalid, or undefined if unknown
	assert: function RequiredIfRule$assert(obj) {
		var isReq;

		// convert string functions into compiled functions on first execution
		if (this.isRequired.constructor === String) {
			this.isRequired = this.rootType.compileExpression(this.isRequired);
		}

		if (this.hasOwnProperty("isRequired")) {
			try {
				isReq = this.isRequired.call(obj);
			}
			catch (e) {
				isReq = false;
			}
		}
			// otherwise, allow "this" to be the current rule to support subclasses that override assert
		else
			isReq = this.isRequired(obj);

		if (this.requiredValue)
			return isReq && this.property.value(obj) !== this.requiredValue;
		else
			return isReq && !RequiredRule.hasValue(this.property.value(obj));
	},

	// perform addition initialization of the rule when it is registered
	onRegister: function () {

		// call the base method
		ValidatedPropertyRule.prototype.onRegister.call(this);

		// perform addition registration for required if rules with a compare source
		if (this.comparePath) {

			// get the compare source, which is already a rule predicate and should immediately resolve
			Object.defineProperty(this, "compareSource", { value: Model.property(this.comparePath, this.rootType) });

			// flip the equality rules for boolean data types
			if (this.compareSource.get_jstype() === Boolean && this.compareOperator == "NotEqual" && (this.compareValue === undefined || this.compareValue === null)) {
				this.compareOperator = "Equal";
				this.compareValue = true;
			}
		}
	}
});

// Expose the rule publicly
Rule.requiredIf = RequiredIfRule;
exports.RequiredIfRule = RequiredIfRule;