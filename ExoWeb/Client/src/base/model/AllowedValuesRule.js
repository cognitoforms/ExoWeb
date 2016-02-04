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

	// define properties for the rule
	if (options.source instanceof Property || options.source instanceof PropertyChain) {
		Object.defineProperty(this, "sourcePath", { value: options.source.get_path() });
		Object.defineProperty(this, "source", { value: options.source });
		options.onChangeOf = [options.source];
	}
	else if (options.source instanceof Function || options.fn) {
		Object.defineProperty(this, "sourceFn", { value: options.source || options.fn, writable: true });
		options.fn = null;
	}
	else {
		Object.defineProperty(this, "sourcePath", { value: options.source });
		options.onChangeOf = [options.source];
	}

	if (options.ignoreValidation) {
	    Object.defineProperty(this, "ignoreValidation", { value: options.ignoreValidation });
	}

	// create a property specified condition type if not passed in, defaulting to Error if a condition category was not specified
	options.conditionType = options.conditionType || Rule.ensureConditionType(options.name, this.property, options.category || ConditionType.Error);

	// never run allowed values rules during initialization of existing instances
	if (!options.hasOwnProperty("onInitExisting") && options.conditionType.origin === "server") {
		options.onInitExisting = false;
	}

	// call the base type constructor
	ValidatedPropertyRule.apply(this, [rootType, options]);
}

// setup the inheritance chain
AllowedValuesRule.prototype = new ValidatedPropertyRule();
AllowedValuesRule.prototype.constructor = AllowedValuesRule;

// extend the base type
AllowedValuesRule.mixin({
	onRegister: function AllowedValuesRule$onRegister() {

		// get the allowed values source, if only the path was specified
		if (!this.source && !this.sourceFn) {
			Object.defineProperty(this, "source", { value: Model.property(this.sourcePath, this.rootType) });
		}

		// call the base method
		ValidatedPropertyRule.prototype.onRegister.call(this);
	},
	isValid: function AllowedValuesRule$isValid(obj, prop, value) {

	    //gives the ability to create a drop down of available options
        //but does not need validatin (combo box)
	    if (this.ignoreValidation) {
	        return true;
	    }

		// return true if no value is currently selected
		if (!value) {
			return true;
		}

		// get the list of allowed values of the property for the given object
		var allowed = this.values(obj);

		// return undefined if the set of allowed values cannot be determined
		if (!LazyLoader.isLoaded(allowed)) {
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

	// Subscribes to changes to the allow value predicates, indicating that the allowed values have changed
	addChanged: function AllowedValuesRule$addChanged(handler, obj, once) {
		for (var p = 0; p < this.predicates.length; p++) {
			var predicate = this.predicates[p];
			if (predicate !== this.property)
				predicate.addChanged(handler, obj, once);
		}
	},

	// Unsubscribes from changes to the allow value predicates
	removeChanged: function AllowedValuesRule$removeChanged(handler, obj, once) {
		for (var p = 0; p < this.predicates.length; p++) {
			var predicate = this.predicates[p];
			if (predicate !== this.property)
				predicate.removeChanged(handler, obj, once);
		}
	},

	values: function AllowedValuesRule$values(obj, exitEarly) {
		if (!this.source && !this.sourceFn) {
			logWarning("AllowedValues rule on type \"" + this.prop.get_containingType().get_fullName() + "\" has not been initialized.");
			return;
		}

		// Function-based allowed values
		if (this.sourceFn) {

			// convert string functions into compiled functions on first execution
			if (this.sourceFn.constructor === String) {
				this.sourceFn = this.rootType.compileExpression(this.sourceFn);
			}

			return this.sourceFn.call(obj, obj);
		}

		// Property path-based allowed values
		else {
			// For non-static properties, verify that a final target exists and
			// if not return an appropriate null or undefined value instead.
			if (!this.source.get_isStatic()) {
				// Get the value of the last target for the source property (chain).
				var lastTarget = this.source.lastTarget(obj, exitEarly);

				// Use the last target to distinguish between the absence of data and
				// data that has not been loaded, if a final value cannot be obtained.
				if (lastTarget === undefined) {
					// Undefined signifies unloaded data
					return undefined;
				}
				else if (lastTarget === null) {
					// Null signifies the absensce of a value
					return null;
				}
			}

			// Return the value of the source for the given object
			return this.source.value(obj);
		}
	},
	toString: function AllowedValuesRule$toString() {
		return $format("{0}.{1} allowed values = {2}", [this.property.get_containingType().get_fullName(), this.property.get_name(), this._sourcePath]);
	}
});

// expose the rule publicly
Rule.allowedValues = AllowedValuesRule;
exports.AllowedValuesRule = AllowedValuesRule;
