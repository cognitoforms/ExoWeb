function CalculatedPropertyRule(mtype, options, ctype) {
	var prop = this.prop = mtype.property(options.property, true);

	this.isAsync = options.isAsync; 
	this.calculateFn = options.fn;

	if (options.basedOn) {
		var signal = new Signal("calculated property dependencies");
		var inputs = [];

		// setup loading of each property path that the calculation is based on
		Array.forEach(options.basedOn, function (p, i) {
			var dependsOnChange;
			var dependsOnInit = true;

			// if the event was specified then parse it
			var parts = p.split(" of ");
			if (parts.length >= 2) {
				var events = parts[0].split(",");
				dependsOnInit = (events.indexOf("init") >= 0);
				dependsOnChange = (events.indexOf("change") >= 0);
			}

			var path = (parts.length >= 2) ? parts[1] : p;
			Model.property(path, mtype, true, signal.pending(function(chain) {
				var input = new RuleInput(chain);

				if (!input.property) {
					ExoWeb.trace.throwAndLog("model", "Calculated property {0}.{1} is based on an invalid property: {2}", [mtype.get_fullName(), prop._name, p]);
				}

				input.set_dependsOnInit(dependsOnInit);
				if (dependsOnChange !== undefined) {
					input.set_dependsOnChange(dependsOnChange);
				}

				inputs.push(input);
			}));
		});

		// wait until all property information is available to initialize the calculation
		signal.waitForAll(function () {
			ExoWeb.Batch.whenDone(function () {
				register.call(this, inputs);
			}, this);
		}, this);
	}
	else {
		var inferredInputs = Rule.inferInputs(mtype, options.fn);
		inferredInputs.forEach(function (input) {
			input.set_dependsOnInit(true);
		});
		register.call(this, inferredInputs);
	}

	function register(inputs) {
		// calculated property should always be initialized when first accessed
		var input = new RuleInput(this.prop);
		input.set_dependsOnGet(true);
		input.set_dependsOnChange(false);
		input.set_isTarget(true);
		inputs.push(input);

		Rule.register(this, inputs, options.isAsync, mtype, function () {
			// Static check to determine if running when registered makes sense for this calculation based on its inputs.
			if (this.canExecute(null, null, true)) {
				// Execute for existing instances if their initialization state allows it.
				mtype.known().forEach(function (obj) {
					if (this.canExecute(obj, null, true)) {
						try {
							this._isExecuting = true;
							//ExoWeb.trace.log("rule", "executing rule '{0}' when initialized", [rule]);
							this.execute(obj);
						}
						catch (err) {
							ExoWeb.trace.throwAndLog("rules", "Error running rule '{0}': {1}", [this, err]);
						}
						finally {
							this._isExecuting = false;
						}
					}
				}, this);
			}
		}, this);
	}
}

CalculatedPropertyRule.mixin({
	canExecute: function(sender, args, retroactive) {
		// If there is no event, check if the calculation is based on some initialization, then defer to the default
		// input check. This is done so that rules that are based on property changes alone do not fire when created,
		// but calculations that are based on property initialization are allowed to fire if possible.
		return ((!!args && !!args.property) || (!!retroactive && this.inputs.filter(function (input) { return input.get_dependsOnInit(); }).length > 0)) &&
			// If no sender exists then this is a static check that is only dependent on the rule's inputs
			// and not the initialization state of any particular object. If no event is firing (property
			// argument is undefined) then the property argument will be the property that the rule is
			// attached to, which should have no effect on the outcome.
			(!sender || Rule.canExecute(this, sender, args || { property: this.prop }));
	},
	execute: function Property$calculated$execute(obj, callback) {
		var signal = new Signal("calculated rule");
		var prop = this.prop;

		if (prop._isList) {
			// Initialize list if needed.  A calculated list property cannot depend on initialization 
			// of a server-based list property since initialization is done when the object is constructed 
			// and before data is available.  If it depends only on the change of the server-based list 
			// property then initialization will not happen until the property value is requested.
			if (!prop.isInited(obj)) {
				prop.init(obj, []);
			}

			// re-calculate the list values
			var newList;
			if (this.isAsync) {
				this.calculateFn.call(obj, signal.pending(function (result) {
					newList = result;
				}));
			}
			else {
				newList = this.calculateFn.apply(obj);
			}

			signal.waitForAll(function () {
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
				curList.clear();
				curList.addRange(newList);
				curList.endUpdate();

				if (callback) {
					callback(obj);
				}
			}, null, !this.isAsync);
		}
		else {
			var newValue;
			if (this.isAsync) {
				this.calculateFn.call(obj, signal.pending(function (result) {
					newValue = result;
				}));
			}
			else {
				newValue = this.calculateFn.apply(obj);
			}

			signal.waitForAll(function () {
				prop.value(obj, newValue, { calculated: true });

				if (callback) {
					callback(obj);
				}
			}, null, !this.isAsync);
		}
	},
	toString: function () {
		return "calculation of " + this.prop._name;
	}
});

exports.CalculatedPropertyRule = CalculatedPropertyRule;
