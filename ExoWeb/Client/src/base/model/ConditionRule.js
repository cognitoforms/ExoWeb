function ConditionRule(rootType, options) {
	/// <summary>Creates a rule that asserts a condition based on a predicate.</summary>
	/// <param name="rootType" type="Type">The model type the rule is for.</param>
	/// <param name="options" type="Object">
	///		The options for the rule, including:
	///			assert:				a predicate that returns true when the condition should be asserted
	///			name:				the optional unique name of the type of rule
	///			conditionType:		the optional condition type to use, which will be automatically created if not specified
	///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
	///			message:			the message to show the user when the validation fails
	///			properties:			an array of property paths the validation condition should be attached to when asserted, in addition to the target property
	///			sets:				the optional array of condition type sets to associate the condition with
	///			onInit:				true to indicate the rule should run when an instance of the root type is initialized, otherwise false
	///			onInitNew:			true to indicate the rule should run when a new instance of the root type is initialized, otherwise false
	///			onInitExisting:		true to indicate the rule should run when an existing instance of the root type is initialized, otherwise false
	///			onChangeOf:			an array of property paths (strings, Property or PropertyChain instances) that drive when the rule should execute due to property changes
	/// </param>
	/// <returns type="ConditionRule">The new condition rule.</returns>

	// exit immediately if called with no arguments
	if (arguments.length === 0) return;

	// ensure the rule name is specified
	options.name = options.name || "Condition";

	// store the condition predicate
	var assert = options.assert || options.fn;
	if (assert) {
		this.assert = assert;
	}

	// automatically run the condition rule during initialization of new instances
	if (!options.hasOwnProperty("onInitNew")) {
		options.onInitNew = true;
	}

	// coerce string to condition type
	var conditionType = options.conditionType;
	if (isString(conditionType)) {
		conditionType = ConditionType.get(conditionType);
	}

	// create a condition type if not passed in, defaulting to Error if a condition category was not specified
	Object.defineProperty(this, "conditionType", { 
		value: conditionType || Rule.ensureConditionType(options.name, rootType, options.category || ConditionType.Error, options.sets)
	});

	// automatically run the condition rule during initialization of existing instances if the condition type was defined on the client
	if (!options.hasOwnProperty("onInitExisting") && this.conditionType.origin !== "server") {
		options.onInitExisting = true;
	}

	// store the condition message and properties
	if (options.message) {
		Object.defineProperty(this, "message", { value: options.message, writable: true });
	}
	if (options.properties) {
		Object.defineProperty(this, "properties", { value: options.properties, writable: true });
	}

	// Call the base rule constructor
	Rule.apply(this, [rootType, options]);
}

// setup the inheritance chain
ConditionRule.prototype = new Rule();
ConditionRule.prototype.constructor = ConditionRule;

// implement the execute method
ConditionRule.mixin({

	// subclasses may override this function to return the set of properties to attach conditions to for this rule
	properties: function ConditionRule$properties() {
		return this.hasOwnProperty("properties") ? this.properties : [];
	},

	// subclasses may override this function to calculate an appropriate message for this rule during the registration process
	message: function ConditionRule$message() {
		return this.conditionType.message;
	},

	// subclasses may override this function to indicate whether the condition should be asserted
	assert: function ConditionRule$assert(obj) {
		throw new Error("ConditionRule.assert() must be passed into the constructor or overriden by subclasses.");
	},

	// asserts the condition and adds or removes it from the model if necessary
	execute: function ConditionRule$execute(obj, args) {

		var assert;

		// call assert the root object as "this" if the assertion function was overriden in the constructor
		if (this.hasOwnProperty("assert")) {

			// convert string functions into compiled functions on first execution
			if (this.assert.constructor === String) {
				this.assert = this.rootType.compileExpression(this.assert);
			}
			assert = this.assert.call(obj, obj, args);
		}

		// otherwise, allow "this" to be the current rule to support subclasses that override assert
		else {
			assert = this.assert(obj);
		}

		var message = this.message;
		if (message instanceof Function) {
			if (this.hasOwnProperty("message")) {
				// When message is overriden, use the root object as this
				message = message.bind(obj);
			}
			else {
				message = message.bind(this);
			}
		}

		// create or remove the condition if necessary
		if (assert !== undefined) {
			this.conditionType.when(assert, obj,
					this.properties instanceof Function ? this.properties(obj) : this.properties,
					message);
		}
	},
	
	// gets the string representation of the condition rule
	toString: function () {
		return this.message || this.conditionType.message;
	}
});

// expose the rule publicly
Rule.condition = ConditionRule;
exports.ConditionRule = ConditionRule;