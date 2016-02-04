function ValidatedPropertyRule(rootType, options) {
	/// <summary>Creates a rule that validates the value of a property in the model.</summary>
	/// <param name="rootType" type="Type">The model type the rule is for.</param>
	/// <param name="options" type="Object">
	///		The options for the rule, including:
	///			property:			the property being validated (either a Property instance or string property name)
	///			isValid:			function (obj, prop, val) { return true; } (a predicate that returns true when the property is valid)
	///			name:				the optional unique name of the type of validation rule
	///			conditionType:		the optional condition type to use, which will be automatically created if not specified
	///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
	///			message:			the message to show the user when the validation fails
	///			properties:			an array of property paths the validation condition should be attached to when asserted, in addition to the target property
	///			onInit:				true to indicate the rule should run when an instance of the root type is initialized, otherwise false
	///			onInitNew:			true to indicate the rule should run when a new instance of the root type is initialized, otherwise false
	///			onInitExisting:		true to indicate the rule should run when an existing instance of the root type is initialized, otherwise false
	///			onChangeOf:			an array of property paths (strings, Property or PropertyChain instances) that drive when the rule should execute due to property changes
	/// </param>
	/// <returns type="ValidatedPropertyRule">The new validated property rule.</returns>

	// exit immediately if called with no arguments
	if (arguments.length == 0) return;

	// ensure the rule name is specified
	options.name = options.name || "ValidatedProperty";

	// store the property being validated
	var prop = options.property instanceof Property ? options.property : rootType.property(options.property);
	Object.defineProperty(this, "property", { value: prop });

	// override the prototype isValid function if specified
	if (options.isValid instanceof Function) {
		this.isValid = options.isValid;
	}

	// ensure the properties and predicates to include the target property
	if (!options.properties) {
		options.properties = [prop.get_name()];
	}
	else if (options.properties.indexOf(prop.get_name()) < 0 && options.properties.indexOf(prop) < 0) {
		options.properties.push(prop.get_name());
	}
	if (!options.onChangeOf) {
		options.onChangeOf = [prop];
	}
	else if (options.onChangeOf.indexOf(prop.get_name()) < 0 && options.onChangeOf.indexOf(prop) < 0) {
		options.onChangeOf.push(prop);
	}

	// create a property specified condition type if not passed in, defaulting to Error if a condition category was not specified
	options.conditionType = options.conditionType || Rule.ensureConditionType(options.name, this.property, options.category || ConditionType.Error);

	// replace the property label token in the validation message if present
	if (options.message && typeof (options.message) !== "function") {
	    options.message = options.message.replace('{property}', prop.get_label());
	}

	// call the base rule constructor
	ConditionRule.apply(this, [rootType, options]);
}

// setup the inheritance chain
ValidatedPropertyRule.prototype = new ConditionRule();
ValidatedPropertyRule.prototype.constructor = ValidatedPropertyRule;

// extend the base type
ValidatedPropertyRule.mixin({

	// returns false if the property is valid, true if invalid, or undefined if unknown
	assert: function ValidatedPropertyRule$assert(obj) {

		var isValid = this.isValid(obj, this.property, this.property.value(obj));
		return isValid === undefined ? isValid : !isValid;
	},

	// perform addition initialization of the rule when it is registered
	onRegister: function () {

		// register the rule with the target property
		registerPropertyRule(this.property, this);
	}

});

// Expose the rule publicly
Rule.validated = ValidatedPropertyRule;
exports.ValidatedPropertyRule = ValidatedPropertyRule;