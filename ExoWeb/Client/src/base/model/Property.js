//////////////////////////////////////////////////////////////////////////////////////
/// <remarks>
/// If the interface for this class is changed it should also be changed in
/// PropertyChain, since PropertyChain acts as an aggregation of properties 
/// that can be treated as a single property.
/// </remarks>
///////////////////////////////////////////////////////////////////////////////
function Property(containingType, name, jstype, isList, label, format, isStatic, index) {
	this._containingType = containingType;
	this._name = name;
	this._fieldName = "_" + name;
	this._jstype = jstype;
	this._label = label || ExoWeb.makeHumanReadable(name);
	this._format = format;
	this._isList = !!isList;
	this._isStatic = !!isStatic;
	this._index = index;

	if (containingType.get_originForNewProperties()) {
		this._origin = containingType.get_originForNewProperties();
	}
}

Property.mixin({
	defaultValue: function Property$defaultValue(value) {
		function getValue() {
			return value;
		}

		this._containingType._initNewProps.push({ property: this, valueFn: getValue });
		this._containingType._initExistingProps.push({ property: this, valueFn: getValue });

		// Initialize existing instances
		Array.forEach(this._containingType.known(), function(obj) {
			if (!this.isInited(obj)) {
				this.init(obj, value);
			}
		}, this);

		return this;
	},
	equals: function Property$equals(prop) {
		if (prop !== undefined && prop !== null) {
			if (prop instanceof Property) {
				return this === prop;
			}
			else if (prop instanceof PropertyChain) {
				var props = prop.all();
				return props.length === 1 && this.equals(props[0]);
			}
		}
	},
	rule: function Property$rule(type, onlyTargets) {
		if (!type || !(type instanceof Function)) {
			ExoWeb.trace.throwAndLog("rule", "{0} is not a valid rule type.", [type ? type : (type === undefined ? "undefined" : "null")]);
		}

		if (this._rules) {
			for (var i = 0; i < this._rules.length; i++) {
				var rule = this._rules[i];
				if (rule.value instanceof type) {
					if (!onlyTargets || rule.isTarget === true) {
						return rule.value;
					}
				}
			}
		}
		return null;
	},
	isDefinedBy: function Property$isDefinedBy(mtype) {
		return this._containingType === mtype || mtype.isSubclassOf(this._containingType);
	},
	_addRule: function Property$_addRule(rule, isTarget) {
		if (!this._rules) {
			this._rules = [{ value: rule, isTarget: isTarget}];
		}
		else {
			this._rules.push({ value: rule, isTarget: isTarget });
		}
	},
	get_rules: function Property$get_rules(onlyTargets) {
		return $transform(this._rules)
			.where(function(r) {
				return !onlyTargets || r.isTarget === true;
			}).map(function(r) {
				return r.value;
			});
	},
	toString: function Property$toString() {
		if (this._isStatic) {
			return this.get_path();
		}
		else {
			return $format("this<{0}>.{1}", [this.get_containingType(), this.get_name()]);
		}
	},
	get_containingType: function Property$get_containingType() {
		return this._containingType;
	},

	get_jstype: function Property$get_jstype() {
		return this._jstype;
	},
	get_index: function Property$get_index() {
		return this._index;
	},
	get_format: function Property$get_format() {
		return this._format;
	},
	get_origin: function Property$get_origin() {
		return this._origin ? this._origin : this._containingType.get_origin();
	},
	// <DEBUG>
	_assertType: function Property$_assertType(obj) {
		if (this._isStatic === true) {
			if (!ExoWeb.isType(obj.meta, Type)) {
				ExoWeb.trace.throwAndLog(["model", "entity"], "A model type was expected, found \"{0}\".", [ExoWeb.parseFunctionName(obj.constructor)]);
			}

			if (!this.isDefinedBy(obj.meta)) {
				ExoWeb.trace.throwAndLog(["model", "entity"], "Type {0} does not define static property {1}.{2}.", [
					obj.get_fullName(),
					this._containingType.get_fullName(),
					this.get_label()
				]);
			}
		}
		else {
			if (!ExoWeb.isType(obj, Entity)) {
				ExoWeb.trace.throwAndLog(["model", "entity"], "An entity was expected, found \"{0}\".", [ExoWeb.parseFunctionName(obj.constructor)]);
			}

			if (!this.isDefinedBy(obj.meta.type)) {
				ExoWeb.trace.throwAndLog(["model", "entity"], "Type {0} does not define non-static property {1}.{2}.", [
					obj.meta.type.get_fullName(),
					this._containingType.get_fullName(),
					this.get_label()
				]);
			}
		}
	},
	// </DEBUG>

	_getter: function Property$_getter(obj, skipTypeCheck) {
//				var key = this.get_containingType().get_fullName() + ":" + this._name + ":" + (obj ? obj.meta.id : "STATIC");
//				if(!window.entities[key]){
//					window.entities[key] = 1;
//				}
//				else {
//					++window.entities[key];
//				}

		// Generated setter added to entities can skip type validation since it is 
		// unlikely to be called on an invalid object.

		// <DEBUG>
//				if (!skipTypeCheck) {
//					if (obj === undefined || obj === null) {
//						ExoWeb.trace.throwAndLog(["model", "entity"], "Target object cannot be <{0}>.", [obj === undefined ? "undefined" : "null"]);
//					}

//					this._assertType(obj);
		// </DEBUG>

		var handler = this._getEventHandler("get");
		if(handler)
			handler(obj, { property: this, value: obj[this._fieldName], isInited: obj.hasOwnProperty(this._fieldName)});

		// <DEBUG>
//				if (this._name !== this._fieldName && obj.hasOwnProperty(this._name)) {
//					ExoWeb.trace.logWarning("model",
//						"Possible incorrect property usage:  property \"{0}\" is defined on object but field name should be \"{1}\", make sure you are using getters and setters.",
//						[this._name, this._fieldName]
//					);
//				}
		// </DEBUG>

		return obj[this._fieldName];
	},

	_setter: function Property$_setter(obj, val, skipTypeCheck, args) {
		// Generated setter added to entities can skip type validation since it is 
		// unlikely to be called on an invalid object.
		// <DEBUG>
//				if (!skipTypeCheck) {
//					if (obj === undefined || obj === null) {
//						ExoWeb.trace.throwAndLog(["model", "entity"], "Target object cannot be <{0}>.", [obj === undefined ? "undefined" : "null"]);
//					}

//					this._assertType(obj);
//				}
		// </DEBUG>

//		if (!this.canSetValue(obj, val)) {
//			ExoWeb.trace.throwAndLog(["model", "entity"], "Cannot set {0}={1}. A value of type {2} was expected", [this._name, val === undefined ? "<undefined>" : val, this._jstype.getName()]);
//		}

		var old = obj[this._fieldName];

		// compare values so that this check is accurate for primitives
		var oldValue = (old === undefined || old === null) ? old : old.valueOf();
		var newValue = (val === undefined || val === null) ? val : val.valueOf();

		if (oldValue !== newValue) {
			var wasInited = this.isInited(obj);

			obj[this._fieldName] = val;

			// NOTE: property change should be broadcast before rules are run so that if 
			// any rule causes a roundtrip to the server these changes will be available
			this._containingType.get_model().notifyAfterPropertySet(obj, this, val, old, wasInited);

			var handler = this._getEventHandler("changed");
			if(handler)
				handler(obj, $.extend({ property: this, newValue: val, oldValue: old, wasInited: wasInited }, args));

			Sys.Observer.raisePropertyChanged(obj, this._name);
		}
	},

	get_isEntityType: function Property$get_isEntityType() {
		return !!this.get_jstype().meta && !this._isList;
	},

	get_isEntityListType: function Property$get_isEntityListType() {
		return !!this.get_jstype().meta && this._isList;
	},

	get_isValueType: function Property$get_isValueType() {
		return !this.get_jstype().meta;
	},

	get_isList: function Property$get_isList() {
		return this._isList;
	},

	get_isStatic: function Property$get_isStatic() {
		return this._isStatic;
	},

	get_label: function Property$get_label() {
		return this._label;
	},

	get_name: function Property$get_name() {
		return this._name;
	},
	get_path: function Property$get_path() {
		return this._isStatic ? (this._containingType.get_fullName() + "." + this._name) : this._name;
	},
	canSetValue: function Property$canSetValue(obj, val) {
		// only allow values of the correct data type to be set in the model
		if (val === null || val === undefined) {
			return true;
		}

		if (val.constructor) {
			// for entities check base types as well
			if (val.constructor.meta) {
				for (var valType = val.constructor.meta; valType; valType = valType.baseType) {
					if (valType._jstype === this._jstype) {
						return true;
					}
				}

				return false;
			}
			else {
				return val.constructor === this._jstype;
			}
		}
		else {
			var valObjectType;

			switch (typeof (val)) {
				case "string": valObjectType = String; break;
				case "number": valObjectType = Number; break;
				case "boolean": valObjectType = Boolean; break;
			}

			return valObjectType === this._jstype;
		}
	},
	value: function Property$value(obj, val, args) {
		var target = (this._isStatic ? this._containingType.get_jstype() : obj);

		if (target === undefined || target === null) {
			ExoWeb.trace.throwAndLog(["model"],
				"Cannot {0} value for {1}static property \"{2}\" on type \"{3}\": target is null or undefined.",
				[(arguments.length > 1 ? "set" : "get"), (this._isStatic ? "" : "non-"), this.get_path(), this._containingType.get_fullName()]);
		}

		if (arguments.length > 1) {
			this._setter(target, val, false, args);
		}
		else {
			return this._getter(target);
		}
	},
	init: function Property$init(obj, val, force) {
		var target = (this._isStatic ? this._containingType.get_jstype() : obj);
		var curVal = target[this._fieldName];

		if (curVal !== undefined && !(force === undefined || force)) {
			return;
		}

//				if(!window.entities)
//					window.entities = {};

//				var key = this.get_containingType().get_fullName() + ":" + this._name + ":" + (obj ? obj.meta.id : "STATIC");
//				if(!window.entities[key]){
//					window.entities[key] = 0;
//				}

		target[this._fieldName] = val;

		if (val instanceof Array) {
			var _this = this;
			Sys.Observer.makeObservable(val);
			Sys.Observer.addCollectionChanged(val, function Property$collectionChanged(sender, args) {
				if (!LazyLoader.isLoaded(val)) {
					ExoWeb.trace.logWarning("model", "{0} list {1}.{2} was modified but it has not been loaded.", [
						_this._isStatic ? "Static" : "Non-static",
						_this._isStatic ? _this._containingType.get_fullName() : "this<" + _this._containingType.get_fullName() + ">",
						_this._name
					]);
				}

				// NOTE: property change should be broadcast before rules are run so that if 
				// any rule causes a roundtrip to the server these changes will be available
				_this._containingType.get_model().notifyListChanged(target, _this, args.get_changes());

				// NOTE: oldValue is not currently implemented for lists
				_this._raiseEvent("changed", [target, { property: _this, newValue: val, oldValue: undefined, changes: args.get_changes(), wasInited: true, collectionChanged: true}]);

				Sys.Observer.raisePropertyChanged(target, _this._name);
			});
		}
		var handler = this._getEventHandler("changed");
		if(handler)
			handler(target, { property: this, newValue: val, oldValue: undefined, wasInited: false});

		Sys.Observer.raisePropertyChanged(target, this._name);

		// Return the property to support method chaining
		return this;
	},
	isInited: function Property$isInited(obj) {
		var target = (this._isStatic ? this._containingType.get_jstype() : obj);
		return target.hasOwnProperty(this._fieldName);
	},

	// starts listening for get events on the property. Use obj argument to
	// optionally filter the events to a specific object
	addGet: function Property$addGet(handler, obj) {
		var f;

		if (obj) {
			f = function(target, property, value, isInited) {
				if (obj === target) {
					handler(target, property, value, isInited);
				}
			};
		}
		else {
			f = handler;
		}

		this._addEvent("get", f);

		// Return the property to support method chaining
		return this;
	},

	// starts listening for change events on the property. Use obj argument to
	// optionally filter the events to a specific object
	addChanged: function Property$addChanged(handler, obj, once) {
		this._addEvent("changed", handler, obj ? equals(obj) : null, once);

		// Return the property to support method chaining
		return this;
	},
	removeChanged: function Property$removeChanged(handler) {
		this._removeEvent("changed", handler);
	},
	_addCalculatedRule: function Property$_addCalculatedRule(calculateFn, isAsync, inputs) {
		// calculated property should always be initialized when first accessed
		var input = new RuleInput(this);
		input.set_dependsOnGet(true);
		input.set_dependsOnChange(false);
		input.set_isTarget(true);
		inputs.push(input);

		var rule = {
			prop: this,
			execute: function Property$calculated$execute(obj, callback) {
				var signal = new ExoWeb.Signal("calculated rule");
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
					if (isAsync) {
						calculateFn.call(obj, signal.pending(function(result) {
							newList = result;
						}));
					}
					else {
						newList = calculateFn.apply(obj);
					}

					signal.waitForAll(function() {
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
					}, null, !isAsync);
				}
				else {
					var newValue;
					if (isAsync) {
						calculateFn.call(obj, signal.pending(function(result) {
							newValue = result;
						}));
					}
					else {
						newValue = calculateFn.apply(obj);
					}

					signal.waitForAll(function() {
						prop.value(obj, newValue, { calculated: true });
						if (callback) {
							callback(obj);
						}
					}, null, !isAsync);
				}
			},
			toString: function() {
				return "calculation of " + this.prop._name;
			}
		};

		Rule.register(rule, inputs, isAsync, this.get_containingType(), function() { 

			if ($transform(rule.inputs).where(function(input) { return input.get_dependsOnInit(); }).length > 0) {
				// Execute for existing instances
				Array.forEach(this._containingType.known(), function(obj) {
					if (rule.inputs.every(function(input) { return !input.get_dependsOnInit() || input.property.isInited(obj); })) {
						try {
							rule._isExecuting = true;
//									ExoWeb.trace.log("rule", "executing rule '{0}' when initialized", [rule]);
							rule.execute.call(rule, obj);
						}
						catch (err) {
							ExoWeb.trace.throwAndLog("rules", "Error running rule '{0}': {1}", [rule, err]);
						}
						finally {
							rule._isExecuting = false;
						}
					}
				});
			}
		}, this);
	},
	// Adds a rule to the property that will update its value
	// based on a calculation.
	calculated: function Property$calculated(options) {
		var prop = this;
		var rootType = (options.rootType) ? options.rootType.meta : prop._containingType;

		if (options.basedOn) {
			this._readySignal = new ExoWeb.Signal("calculated property dependencies");
			var inputs = [];

			// setup loading of each property path that the calculation is based on
			Array.forEach(options.basedOn, function(p, i) {
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
				Model.property(path, rootType, true, prop._readySignal.pending(function Property$calculated$chainLoaded(chain) {
					var input = new RuleInput(chain);

					if (!input.property) {
						ExoWeb.trace.throwAndLog("model", "Calculated property {0}.{1} is based on an invalid property: {2}", [rootType.get_fullName(), prop._name, p]);
					}

					input.set_dependsOnInit(dependsOnInit);
					if (dependsOnChange !== undefined) {
						input.set_dependsOnChange(dependsOnChange);
					}

					inputs.push(input);
				}));
			});

			// wait until all property information is available to initialize the calculation
			this._readySignal.waitForAll(function() {
				ExoWeb.Batch.whenDone(function() {
					prop._addCalculatedRule(options.fn, options.isAsync, inputs);
				});
			});
		}
		else {
			var inferredInputs = Rule.inferInputs(rootType, options.fn);
			inferredInputs.forEach(function(input) {
				input.set_dependsOnInit(true);
			});
			prop._addCalculatedRule(options.fn, options.isAsync, inferredInputs);
		}

		return this;
	},
	rootedPath: function Property$rootedPath(type) {
		if (this.isDefinedBy(type)) {
			return (this._isStatic ? this._containingType.get_fullName() : "this") + "." + this._name;
		}
	},
	required: function(conditionType) {
		new ExoWeb.Model.Rule.required(this._containingType, { property: this._name }, conditionType);
		return this;
	},
	allowedValues: function(source, conditionType) {
		new ExoWeb.Model.Rule.allowedValues(this._containingType, {	property: this._name, source: source }, conditionType);
		return this;
	},
	compare: function(operator, source, conditionType) {
		new ExoWeb.Model.Rule.compare(this._containingType, { property: this._name, compareOperator: operator, compareSource: source }, conditionType);
		return this;
	},
	range: function(min, max, conditionType) {
		new ExoWeb.Model.Rule.range(this._containingType, {	property: this._name, min: min, max: max }, conditionType);
		return this;
	},
	requiredIf: function(source, operator, value, conditionType) {
		if(typeof(source) === "string") {
			new ExoWeb.Model.Rule.requiredIf(this._containingType, { property: this._name, compareSource: source, compareOperator: operator, compareValue: value }, conditionType);
		}
		else {
			new ExoWeb.Model.Rule.requiredIfExpressions(this._containingType, { property: this._name, fn: source.fn, dependsOn: source.dependsOn }, conditionType);
		}
		return this;
	},
	requiredIfExpressions: function(options, conditionType) {
		new ExoWeb.Model.Rule.requiredIfExpressions(this._containingType, { property: this._name, fn: options.fn, dependsOn: options.dependsOn }, conditionType);
		return this;
	},
	errorIfExpressions: function(options, conditionType) {
		new ExoWeb.Model.Rule.errorIfExpressions(this._containingType, { property: this._name, fn: options.fn, dependsOn: options.dependsOn, errorMessage: options.errorMessage, isWarning: options.isWarning }, conditionType);
		return this;
	},
	stringLength: function(min, max, conditionType) {
		new ExoWeb.Model.Rule.stringLength(this._containingType, {	property: this._name, min: min, max: max }, conditionType);
		return this;
	}
});
Property.mixin(ExoWeb.Functor.eventing);
ExoWeb.Model.Property = Property;
Property.registerClass("ExoWeb.Model.Property");
