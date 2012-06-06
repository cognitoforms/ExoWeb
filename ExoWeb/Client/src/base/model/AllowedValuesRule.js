function AllowedValuesRule(rootType, options) {
	/// <summary>Creates a rule that validates whether a selected value or values is in a list of allowed values.</summary>
	/// <param name="rootType" type="Type">The model type the rule is for.</param>
	/// <param name="options" type="Object">
	///		The options for the rule, including:
	///			property:		the property being validated (either a Property instance or string property name)
	///			source:			the source property for the allowed values (either a Property or PropertyChain instance or a string property path)
	///			name:			the optional unique name of the rule
	///			conditionType:	the optional condition type to use, which will be automatically created if not specified
	///			category:		ConditionType.Error || ConditionType.Warning, defaults to ConditionType.Error if not specified
	///			message:		the message to show the user when the validation fails
	/// </param>
	/// <returns type="AllowedValuesRule">The new allowed values rule.</returns>

	// ensure the rule name is specified
	options.name = options.name || "AllowedValues";

	// ensure the error message is specified
	options.message = options.message || Resource.get("allowed-values");

	// ensure changes to the allowed values triggers rule execution
	options.onChangeOf = [options.source];

	// define properties for the rule
	if (options.source instanceof Property || options.source instanceof PropertyChain) {
		Object.defineProperty(this, "sourcePath", { value: options.source.get_path() });
		Object.defineProperty(this, "source", { value: options.source });
	}
	else {
		Object.defineProperty(this, "sourcePath", { value: options.source });
	}

	// call the base type constructor
	ValidatedPropertyRule.apply(this, [rootType, options]);

	// never run allowed values rules during initialization of existing instances
	options.onInitExisting = false;
}

// setup the inheritance chain
AllowedValuesRule.prototype = new ValidatedPropertyRule();
AllowedValuesRule.prototype.constructor = AllowedValuesRule;

// extend the base type
AllowedValuesRule.mixin({
	onRegister: function AllowedValuesRule$onRegister() {

		// get the allowed values source, if only the path was specified
		if (!this.source) {
			Object.defineProperty(this, "source", { value: Model.property(this.sourcePath, this.rootType) });
		}

		// call the base method
		ValidatedPropertyRule.prototype.onRegister.call(this);
	},
	isValid: function AllowedValuesRule$isValid(obj, prop, value) {

		// return true if no value is currently selected
		if (value === undefined || value === null) {
			return true;
		}

		// get the list of allowed values of the property for the given object
		var allowed = this.values(obj);

		// return undefined if the set of allowed values cannot be determined
		if (allowed === undefined || !LazyLoader.isLoaded(allowed)) {
			return;
		}

		// ensure that the value or list of values is in the allowed values list (single and multi-select)				
		if (value instanceof Array) {
			return value.every(function (item) { return Array.contains(allowed, item); });
		}
		else {
			return Array.contains(allowed, value);
		}
	},
	values: function AllowedValuesRule$values(obj, exitEarly) {
		if (!this.source) {
			ExoWeb.trace.logWarning("rule", "AllowedValues rule on type \"{0}\" has not been initialized.", [this.prop.get_containingType().get_fullName()]);
			return;
		}
		if (this.source && (this.source.get_isStatic() || this.source instanceof Property || this.source.lastTarget(obj, exitEarly))) {

			// get the allowed values from the property chain
			var values = this.source.value(obj);

			// ignore if allowed values list is undefined (non-existent or unloaded type) or has not been loaded
			return values;
		}
	},
	toString: function AllowedValuesRule$toString() {
		return $format("{0}.{1} allowed values = {2}", [this.property.get_containingType().get_fullName(), this.property.get_name(), this._sourcePath]);
	}
});

// expose the rule publicly
Rule.allowedValues = AllowedValuesRule;
exports.AllowedValuesRule = AllowedValuesRule;
