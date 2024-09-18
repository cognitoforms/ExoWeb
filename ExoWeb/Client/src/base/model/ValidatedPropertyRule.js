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

	// Replace the property label token in the validation message if present
	if (options.message) {
		var rule = this;
		var message = options.message;
		var hasTokens = Format.hasTokens(prop.get_label());
		
		if (typeof (message) === "function") {
			// Create a function to apply the format to the property label when generating the message
			options.message = function (obj) {
				var messageTemplate = message.apply(this, [obj]);
				return messageTemplate.replace("{property}", hasTokens ? rule.getPropertyLabelFormat().convert(this) : prop.get_label());
			};
		}
		else if (typeof (message) === "string" && hasTokens) {
			// Create a function to apply the format to the property label when generating the message
			options.message = function (obj) {
				return message.replace("{property}", rule.getPropertyLabelFormat().convert(this));
			};
		}
		else {
			var label = prop.get_label();
			// Escaped unescaped quotes
			if (label.indexOf("\"") >= 0) {
				var text = ""; var prev = "";
				label.split("").forEach(function (c) {
					if (c === "\"" && prev !== "\\")
						text += "\\" + c;
					else
						text += c;
					prev = c;
				});
				label = text;
			}
			options.message = message.replace('{property}', label);
		}
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
	},

	getPropertyLabelFormat: function () {
		// convert the property label into a model format
		if (!this._propertyLabelFormat)
			this._propertyLabelFormat = ExoWeb.Model.getFormat(this.rootType.get_jstype(), this.property.get_label());
		return this._propertyLabelFormat;
	},

	getPropertyLabel: function (obj) {
		if (Format.hasTokens(this.property.get_label())) {
			return this.getPropertyLabelFormat().convert(obj);
		} else {
			return this.property.get_label();
		}
	},

	preRegister: function (callback, thisPtr) {
		// Exit if the rule is no tin a valid state
		if (!this.rootType) {
			return false;
		}

		// Exit if the property label does not contain tokens
		if (!Format.hasTokens(this.property.get_label())) {
			return false;
		}

		var registerFormatPaths = function (formatPaths) {
			if (formatPaths.length <= 0)
				return;

			if (!this._options)
				this._options = {};

			if (!this._options.onChangeOf)
				this._options.onChangeOf = [];

			formatPaths.forEach(function (p) {
				this.rootType.getPaths(p).forEach(function(prop) {
					if (this._options.onChangeOf.indexOf(prop) < 0) {
						if (typeof this._options.onChangeOf === "string")
							this._options.onChangeOf = [this._options.onChangeOf];

						this._options.onChangeOf.push(prop);
					}
				}, this);
			}, this);
		};

		// Ensure tokens included in the format trigger rule execution
		if (callback && callback instanceof Function) {
			this.getPropertyLabelFormat().getPaths(function (formatPaths) {
				registerFormatPaths.call(this, formatPaths);
				callback.call(thisPtr || this);
			}, this);
		} else {
			var formatPaths = this.getPropertyLabelFormat().getPaths();
			registerFormatPaths.call(this, formatPaths);
			return true;
		}
	}
});

// Expose the rule publicly
Rule.validated = ValidatedPropertyRule;
exports.ValidatedPropertyRule = ValidatedPropertyRule;