/// <reference path="../core/Observer.js" />
/// <reference path="../core/Utilities.js" />
/// <reference path="../core/Signal.js" />
/// <reference path="../core/EventScope.js" />
/// <reference path="../core/Warnings.js" />
/// <reference path="../model/Model.js" />
/// <reference path="../model/Type.js" />
/// <reference path="../model/Property.js" />
/// <reference path="../model/PropertyChain.js" />
/// <reference path="../model/PathTokens.js" />
/// <reference path="../model/RuleInvocationType.js" />
/// <reference path="../model/ConditionType.js" />

var customRuleIndex = 0;

function Rule(rootType, options) {
	/// <summary>Creates a rule that executes a delegate when specified model events occur.</summary>
	/// <param name="rootType" type="Type">The model type the rule is for.</param>
	/// <param name="options" type="Object">
	///		The options for the rule, including:
	///			name:				the optional unique name of the type of validation rule
	///			execute:			a function to execute when the rule is triggered
	///			onInit:				true to indicate the rule should run when an instance of the root type is initialized, otherwise false
	///			onInitNew:			true to indicate the rule should run when a new instance of the root type is initialized, otherwise false
	///			onInitExisting:		true to indicate the rule should run when an existing instance of the root type is initialized, otherwise false
	///			onChangeOf:			an array of property paths (strings, Property or PropertyChain instances) that drive when the rule should execute due to property changes
	///			returns:			an array of properties (string name or Property instance) that the rule is responsible to calculating the value of
	/// </param>
	/// <returns type="Rule">The new rule.</returns>

	// exit immediately if called with no arguments
	if (arguments.length === 0) {
		return;
	}

	// ensure a valid root type was provided
	if (!(rootType instanceof ExoWeb.Model.Type)) {
		if (rootType && rootType.meta) {
			rootType = rootType.meta;
		}
		else {
			throw new Error("A value root model type must be specified when constructing rules.");
		}
	}

	// store the initialization options for processing during registration
	if (options) {
		if (options instanceof Function) {
			this._options = {
				name: rootType.get_fullName() + ".Custom." + (++customRuleIndex),
				execute: function (obj) {
					// use the root object as this
					return options.apply(obj, arguments);
				}
			};
		}
		else {
			this._options = options;
			if (!this._options.name) {
				this._options.name = rootType.get_fullName() + ".Custom." + (++customRuleIndex);
			}
		}
	}
	else {
		this._options = {
			name: rootType.get_fullName() + ".Custom." + (++customRuleIndex)
		};
	}
	
	// explicitly override execute if specified
	if (this._options.execute instanceof Function) {
		this.execute = this._options.execute;
	}

	// define properties for the rule
	Object.defineProperty(this, "rootType", { value: rootType });
	Object.defineProperty(this, "name", { value: this._options.name });
	Object.defineProperty(this, "invocationTypes", { value: 0, writable: true });
	Object.defineProperty(this, "predicates", { value: [], writable: true });
	Object.defineProperty(this, "returnValues", { value: [], writable: true });
	Object.defineProperty(this, "isRegistered", { value: false, writable: true });

	// register the rule after loading has completed
	rootType.model.registerRule(this);
}

// base rule implementation
Rule.mixin({

	// indicates that the rule should run only for new instances when initialized
	onInitNew: function () {

		// ensure the rule has not already been registered
		if (!this._options) {
			//throw new Error("Rules cannot be configured once they have been registered: " + this.name);
			return this;
		}

		// configure the rule to run on init new
		this.invocationTypes |= RuleInvocationType.InitNew;
		return this;
	},

	// indicates that the rule should run only for existing instances when initialized
	onInitExisting: function () {

		// ensure the rule has not already been registered
		if (!this._options) {
			//throw new Error("Rules cannot be configured once they have been registered: " + this.name);
			return this;
		}

		// configure the rule to run on init existingh
		this.invocationTypes |= RuleInvocationType.InitExisting;
		return this;
	},

	// indicates that the rule should run for both new and existing instances when initialized
	onInit: function () {

		// ensure the rule has not already been registered
		if (!this._options) {
			//throw new Error("Rules cannot be configured once they have been registered: " + this.name);
			return this;
		}

		// configure the rule to run on both init new and init existing
		this.invocationTypes |= RuleInvocationType.InitNew | RuleInvocationType.InitExisting;
		return this;
	},

	// indicates that the rule should automatically run when one of the specified property paths changes
	// predicates:  an array of property paths (strings, Property or PropertyChain instances) that drive when the rule should execute due to property changes
	onChangeOf: function (predicates) {

		// ensure the rule has not already been registered
		if (!this._options) {
			//throw new Error("Rules cannot be configured once they have been registered: " + this.name);
			return this;
		}

		// allow change of predicates to be specified as a parameter array without []'s
		if (predicates && predicates.constructor === String) {
			predicates = Array.prototype.slice.call(arguments);
		}

		// add to the set of existing change predicates
		this.predicates = this.predicates.length > 0 ? this.predicates.concat(predicates) : predicates;

		// also configure the rule to run on property change unless it has already been configured to run on property get
		if ((this.invocationTypes & RuleInvocationType.PropertyGet) === 0) {
			this.invocationTypes |= RuleInvocationType.PropertyChanged;
		}
		return this;
	},

	// indicates that the rule is responsible for calculating and returning values of one or more properties on the root type
	// properties:	an array of properties (string name or Property instance) that the rule is responsible to calculating the value of
	returns: function (properties) {
		if (!this._options) {
			//throw new Error("Rules cannot be configured once they have been registered: " + this.name);
			return this;
		}
		// allow return properties to be specified as a parameter array without []'s
		if (properties && properties.constructor === String) {
			properties = Array.prototype.slice.call(arguments);
		}
		if (!properties) {
			throw new Error("Rule must specify at least 1 property for returns.");
		}

		// add to the set of existing return value properties
		this.returnValues = this.returnValues.length > 0 ? this.returnValues.concat(properties) : properties;

		// configure the rule to run on property get and not on property change
		this.invocationTypes |= RuleInvocationType.PropertyGet;
		this.invocationTypes &= ~RuleInvocationType.PropertyChanged;
		return this;
	},

	// registers the rule based on the configured invocation types, predicates, and return values
	register: function Rule$register() {

		// create a scope variable to reference the current rule when creating event handlers
		var rule = this;

		// track the rule with the root type
		this.rootType.rules.push(this);

		// create a function to process the rule's options
		var processOptions = function () {
			// configure the rule based on any specified options
			if (this._options) {
				if (this._options.onInit)
					this.onInit();
				if (this._options.onInitNew)
					this.onInitNew();
				if (this._options.onInitExisting)
					this.onInitExisting();
				if (this._options.onChangeOf)
					this.onChangeOf(this._options.onChangeOf);
				if (this._options.returns)
					this.returns(this._options.returns);

				// legacy support for basedOn option syntax
				if (this._options.basedOn) {
					this._options.basedOn.forEach(function (input) {
						var parts = input.split(" of ");
						if (parts.length >= 2) {
							if (parts[0].split(",").indexOf("change") >= 0) {
								this.onChangeOf([parts[1]]);
							}
						}
						else {
							this.onChangeOf(input);
						}
					}, this);
				}
			}

			// indicate that the rule should now be considered registered and cannot be reconfigured
			delete this._options;
		}

		// create a function to determine whether the rule can execute for the given arguments
		var canExecute = function(obj, args) {
			// ensure the rule target is a valid rule root type
			return obj instanceof rule.rootType.get_jstype();
		};

		// create a function to safely execute the rule
		var execute = function (obj, args) {
			// Ensure that the rule can be executed.
			if (!canExecute.call(this, obj, args)) return;

			EventScope$perform(function() {
				if (window.ExoWeb.config.detectRunawayRules) {
					if (currentEventScope.parent && currentEventScope.parent._exitEventVersion) {
						// Determine the maximum number nested calls to EventScope$perform
						// before considering a rule to be a "runaway" rule. 
						var maxNesting;
						if (typeof window.ExoWeb.config.nonExitingScopeNestingCount === "number") {
							maxNesting = window.ExoWeb.config.nonExitingScopeNestingCount - 1;
						} else {
							maxNesting = 99;
						}

						if (currentEventScope.parent._exitEventVersion > maxNesting) {
							logWarning("Aborting rule '" + rule.name + "'.");
							return;
						}
					}
				}

				rule.execute.call(rule, obj, args);
			});
		};

		// create function to perform rule registration once predicates and return values have been prepared
		var register = function () {

			// register for init new
			if (this.invocationTypes & RuleInvocationType.InitNew) {
				this.rootType.addInitNew(function (sender, args) {
					execute.call(this, sender, args);
				});
			}

			// register for init existing
			if (this.invocationTypes & RuleInvocationType.InitExisting) {
				this.rootType.addInitExisting(function (sender, args) {
					execute.call(this, sender, args);
				});
			}

			// register for property change
			if (this.invocationTypes & RuleInvocationType.PropertyChanged) {
				this.predicates.forEach(function (predicate) {
					predicate.addChanged(
						function (sender, args) {
							if (canExecute.call(this, sender, args) && !sender.meta.pendingInvocation(rule)) {
								sender.meta.pendingInvocation(rule, true);
								EventScope$onExit(function() {
									sender.meta.pendingInvocation(rule, false);
									execute.call(this, sender, args);
								});
								EventScope$onAbort(function() {
									sender.meta.pendingInvocation(rule, false);
								});
							}
						},
						null, // no object filter
						false, // subscribe for all time, not once
						true // tolerate nulls since rule execution logic will handle guard conditions
					);
				});
			}

			// register for property get
			if (this.invocationTypes & RuleInvocationType.PropertyGet && this.returnValues) {

				// register for property get events for each return value to calculate the property when accessed
				this.returnValues.forEach(function (returnValue) {
					returnValue.addGet(function (sender, args) {

						// run the rule to initialize the property if it is pending initialization
						if (canExecute.call(this, sender, args) && sender.meta.pendingInit(returnValue)) {
							sender.meta.pendingInit(returnValue, false);
							execute.call(this, sender, args);
						}
					});
				});

				// register for property change events for each predicate to invalidate the property value when inputs change
				this.predicates.forEach(function (predicate) {
					predicate.addChanged(
						function (sender, args) {

							// immediately execute the rule if there are explicit event subscriptions for the property
							if (rule.returnValues.some(function (returnValue) { return hasPropertyChangedSubscribers(returnValue, sender); })) {
								if (canExecute.call(this, sender, args) && !sender.meta.pendingInvocation(rule)) {
									sender.meta.pendingInvocation(rule, true);
									EventScope$onExit(function() {
										sender.meta.pendingInvocation(rule, false);
										execute.call(this, sender, args);
									});
									EventScope$onAbort(function() {
										sender.meta.pendingInvocation(rule, false);
									});
								}
							}

							// Otherwise, just mark the property as pending initialization and raise property change for UI subscribers
							else {
								rule.returnValues.forEach(function (returnValue) {
									sender.meta.pendingInit(returnValue, true);
								});
								// Defer change notification until the scope of work has completed
								EventScope$onExit(function () {
									rule.returnValues.forEach(function (returnValue) { 
										Observer.raisePropertyChanged(sender, returnValue.get_name());
									});
								}, this);
							}
						},
						null, // no object filter
						false, // subscribe for all time, not once
						true // tolerate nulls since rule execution logic will handle guard conditions
					);
				});
			}

			// allow rule subclasses to perform final initialization when registered
			if (this.onRegister instanceof Function) {
				this.onRegister();
			}

			// Mark the rule as successfully registered
			this.isRegistered = true;
		};

		// create a function to kick off the registration process
		var startRegister = function () {
			// process the rule options, this is only done once
			processOptions.call(this);

			// resolve return values, which should all be loaded since the root type is now definitely loaded
			if (this.returnValues) {
				this.returnValues.forEach(function (returnValue, i) {
					if (!(returnValue instanceof Property)) {
						this.returnValues[i] = this.rootType.property(returnValue);
					}
				}, this);
			}

			// resolve all predicates, because the rule cannot run until the dependent types have all been loaded
			if (this.predicates) {
				var signal;
				var predicates = [];

				// setup loading of each property path that the calculation is based on
				this.predicates.forEach(function (predicate, i) {

					// simply copy the predicate over if has already a valid property or property chain
					if (predicate instanceof Property || predicate instanceof PropertyChain) {
						predicates.push(predicate);
					}

					// parse string inputs, which may be paths containing nesting {} hierarchial syntax
					else if (predicate.constructor === String) {

						// create a signal if this is the first string-based input
						if (!signal) {
							signal = new Signal("prepare rule predicates");
						}

						// normalize the paths to accommodate {} hierarchial syntax
						PathTokens.normalizePaths([predicate]).forEach(function (path) {
							Model.property(path, this.rootType, false, signal.pending(function (chain) {
								// add the prepared property or property chain
								predicates.push(chain);
							}, this, true), this);
						}, this);
					}
				}, this);

				// wait until all property information is available to initialize the rule
				if (signal) {
					signal.waitForAll(function () {
						this.predicates = predicates;
						register.call(this);
					}, this, true);
				}

				// otherwise, just immediately proceed with rule registration
				else {
					this.predicates = predicates;
					register.call(this);
				}
			}
		};

		// Optionally perform async pre-registration logic, then kick off the registration process
		if (this.preRegister) {
			// Invoke the rule's pre-register logic if it exists
			if (this.preRegister(function () { startRegister.call(this); }, this) === false) {
				startRegister.call(this);
			}
		} else {
			startRegister.call(this);
		}
	}
});

// creates a condition type for the specified rule and type or property, of the specified category type (usually Error or Warning)
Rule.ensureConditionType = function Rule$ensureConditionType(ruleName, typeOrProp, category, sets) {
	var generatedCode =
		typeOrProp instanceof Property ? $format("{0}.{1}.{2}", [typeOrProp.get_containingType().get_fullName(), typeOrProp.get_name(), ruleName]) :
		typeOrProp instanceof Type ? $format("{0}.{1}", [typeOrProp.get_fullName(), ruleName]) : 
		ruleName;
	var counter = "";

	while (ConditionType.get(generatedCode + counter))
		counter++;

	// return a new client condition type of the specified category
	return new category(generatedCode + counter, $format("Generated condition type for {0} rule.", [ruleName]), null, "client");
};

// creates an error for the specified rule and type or property
Rule.ensureError = function Rule$ensureError(ruleName, typeOrProp, sets) {
	return Rule.ensureConditionType(ruleName, typeOrProp, ConditionType.Error, sets);
};

// creates an error for the specified rule and type or property
Rule.ensureWarning = function Rule$ensureWarning(ruleName, typeOrProp, sets) {
	return Rule.ensureConditionType(ruleName, typeOrProp, ConditionType.Warning, sets);
};

// publicly expose the rule
exports.Rule = Rule;
