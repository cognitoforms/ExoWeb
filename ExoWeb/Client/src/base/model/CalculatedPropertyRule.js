function CalculatedPropertyRule(rootType, options) {
	/// <summary>Creates a rule that calculates the value of a property in the model.</summary>
	/// <param name="rootType" type="Type">The model type the rule is for.</param>
	/// <param name="options" type="Object">
	///		The options for the rule, including:
	///			property:		the property being calculated (either a Property instance or string property name)
	///			calculate:		a function that returns the value to assign to the property, or undefined if the value cannot be calculated
	///			defaultIfError: the value to return if an error occurs, or undefined to cause an exception to be thrown
	///			name:			the optional unique name of the rule
	///		    onInit:			true to indicate the rule should run when an instance of the root type is initialized, otherwise false
	///		    onInitNew:		true to indicate the rule should run when a new instance of the root type is initialized, otherwise false
	///		    onInitExisting:	true to indicate the rule should run when an existing instance of the root type is initialized, otherwise false
	///		    onChangeOf:		an array of property paths (strings, Property or PropertyChain instances) that drive when the rule should execute due to property changes
	/// </param>
	/// <returns type="CalculatedPropertyRule">The new calculated property rule.</returns>

	// store the property being validated
	var prop = options.property instanceof Property ? options.property : rootType.property(options.property);
	Object.defineProperty(this, "property", { value: prop });

	Object.defineProperty(this, "useOptimalUpdates", { value: options.useOptimalUpdates !== false });

	// ensure the rule name is specified
	options.name = options.name || (rootType.get_fullName() + "." + prop.get_name() + ".Calculated");

	// store the calculation function
	Object.defineProperty(this, "calculate", { value: options.calculate || options.fn, writable: true });

	// store the calculation function
	Object.defineProperty(this, "defaultIfError", { value: options.hasOwnProperty("defaultIfError") ? options.defaultIfError : ExoWeb.config.calculationErrorDefault });

	// indicate that the rule is responsible for returning the value of the calculated property
	options.returns = [prop];

	// Call the base rule constructor 
	Rule.apply(this, [rootType, options]);
}

// setup the inheritance chain
CalculatedPropertyRule.prototype = new Rule();
CalculatedPropertyRule.prototype.constructor = CalculatedPropertyRule;

// extend the base type
CalculatedPropertyRule.mixin({
	execute: function CalculatedPropertyRule$execute(obj) {
		var prop = this.property;

		// convert string functions into compiled functions on first execution
		if (this.calculate.constructor === String) {
			this.calculate = this.rootType.compileExpression(this.calculate);
		}

		// calculate the new property value
		var newValue;
		if (this.defaultIfError === undefined)
			newValue = this.calculate.apply(obj, [obj]);
		else {
			try {
				newValue = this.calculate.apply(obj, [obj]);
			}
			catch (e) {
				newValue = this.defaultIfError;
			}
		}

		// exit immediately if the calculated result was undefined
		if (newValue === undefined) return;

		// modify list properties to match the calculated value instead of overwriting the property
		if (prop.get_isList()) {

			// re-calculate the list values
			var newList = newValue;

			// compare the new list to the old one to see if changes were made
			var curList = prop.value(obj);

			if (newList.length === curList.length) {
				var noChanges = true;

				for (var i = 0; i < newList.length; ++i) {
					if (newList[i] !== curList[i]) {
						noChanges = false;
						break;
					}
				}

				if (noChanges) {
					return;
				}
			}

			// update the current list so observers will receive the change events
			curList.beginUpdate();
			if (this.useOptimalUpdates)
				update(curList, newList);
			else {
				curList.clear();
				curList.addRange(newList);
			}
			curList.endUpdate();
		}

		// otherwise, just set the property to the new value
		else {
			prop.value(obj, newValue, { calculated: true });
		}
	},
	toString: function () {
		return "calculation of " + this.property._name;
	},
	// perform addition initialization of the rule when it is registered
	onRegister: function () {

		// register the rule with the target property
		registerPropertyRule(this.property, this);
	}
});

// expose the rule publicly
Rule.calculated = CalculatedPropertyRule;
exports.CalculatedPropertyRule = CalculatedPropertyRule;
