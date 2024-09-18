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
	
	if (options.message) {
		// Evaluate the message as a localizable resource
		if (Resource.get(options.message))
			options.message = Resource.get(options.message);
	} else if (options.messageFn) {
		// Store the message function if specified
		Object.defineProperty(this, "messageFn", { value: options.messageFn, writable: true });
	} else {
		// Set a default error message is one is not specified
		options.message = Resource.get("validation");
	}
	
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

	message: function (obj) {
		var message = "";
		var prop = this.property;
		var hasTokens = Format.hasTokens(prop.get_label());

		if (this.messageFn) {
			// convert string functions into compiled functions on first execution
			if (this.messageFn.constructor === String) {
				this.messageFn = this.rootType.compileExpression(this.messageFn);
			}

			// Invoke the function bound to the entity, and also pass the entity as the argument
			// This is consitent with how rule 'message' option that is an own property is called in this manner (see: ConditionRule.js)
			message = this.messageFn.apply(obj, [obj]);

			// Convert a non-string message into a string
			if (message != null && typeof message !== "string") {
				logWarning("Converting message of type '" + (typeof message) + "' for rule '" + this.name + "' to a string.");
				message = message.toString();
			}
		} else {
			// Fall back to the default validation message
			message = Resource.get("validation");
		}

		// Replace the {property} token with the property label (or evaluated label format)
		message = message.replace("{property}", hasTokens ? this.getPropertyLabelFormat().convert(obj) : prop.get_label());

		return message;
	},

	// returns true if the property is valid, otherwise false
	isValid: function ValidationRule$isValid(obj, prop, val) {		
		// convert string functions into compiled functions on first execution
		if (this.isError.constructor === String) {
			this.isError = this.rootType.compileExpression(this.isError);
		}

		try {
			if (!this.isError.apply(obj, [obj])) {
				// The 'isError' function returned false, so consider the object to be valid
				return true;
			} else {
				var message = this.message;
				if (message instanceof Function) {
					if (this.hasOwnProperty("message")) {
						// When message is overriden, use the root object as this (see: ConditionRule.js)
						message = message.bind(obj);
					}
					else {
						message = message.bind(this);
					}

					// Invoke the message function to ensure that it will produce a value
					message = message(obj);
				}

				// If there is no message, then consider the object to be valid
				return !message;
			}
		}
		catch (e) {
			// If 'isError' or 'messageFn' throws an error, then consider the object to be valid
			logWarning(e);
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