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
	this._rules = [];

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
		Array.forEach(this._containingType.known(), function (obj) {
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
	rule: function (type, onlyTargets) {
		if (!type || !(type instanceof Function)) {
			ExoWeb.trace.throwAndLog("rule", "{0} is not a valid rule type.", [type ? type : (type === undefined ? "undefined" : "null")]);
		}

		var rule = first(this._rules, function (rule) {
			if (rule.value instanceof type)
				if (!onlyTargets || rule.isTarget === true)
					return true;
		});

		return rule ? rule.value : null;
	},
	isDefinedBy: function Property$isDefinedBy(mtype) {
		return this._containingType === mtype || mtype.isSubclassOf(this._containingType);
	},
	_registerRule: function Property$_addRule(rule, isTarget) {
		this._rules.push({ value: rule, isTarget: isTarget });

		// Raise events if registered.
		var handler = this._getEventHandler("ruleRegistered");
		if (handler)
			handler(rule, { property: this, isTarget: isTarget });
	},
	addRuleRegistered: function Property$addChanged(handler, obj, once) {
		this._addEvent("ruleRegistered", handler, obj ? equals(obj) : null, once);
		return this;
	},
	rules: function (targetsThis) {
		return this._rules
			.filter(function (rule) {
				return (!targetsThis && targetsThis !== false) || // no filter
					(targetsThis === true && rule.isTarget === true) || // only targets
					(targetsThis === false && rule.isTarget === false); // only non-targets
			}).map(function (rule) {
				return rule.value;
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
		if (!this._format) {
			if (this._jstype.meta instanceof ExoWeb.Model.Type)
				this._format = this._jstype.meta.get_format(); // Default to type-level formats for entity types
			else
				this._format = getFormat(this._jstype, "G"); // Default to general format for non-entity type
		}
		return this._format;
	},
	set_format: function Property$set_format(value) {
		this._format = getFormat(this._jstype, value);
	},
	format: function (val) {
		return this.get_format() ? this.get_format().convert(val) : val;
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
		if (handler)
			handler(obj, { property: this, value: obj[this._fieldName], isInited: obj.hasOwnProperty(this._fieldName) });

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

		if (!this.canSetValue(obj, val)) {
			ExoWeb.trace.throwAndLog(["model", "entity"], "Cannot set {0}={1}. A value of type {2} was expected", [this._name, val === undefined ? "<undefined>" : val, this._jstype.getName()]);
		}

		var old = obj[this._fieldName];

		// compare values so that this check is accurate for primitives
		var oldValue = (old === undefined || old === null) ? old : old.valueOf();
		var newValue = (val === undefined || val === null) ? val : val.valueOf();

		// Do nothing if the new value is the same as the old value. Account for NaN numbers, which are
		// not equivalent (even to themselves). Although isNaN returns true for non-Number values, we won't
		// get this far for Number properties unless the value is actually of type Number (a number or NaN).
		if (oldValue !== newValue && !(this._jstype === Number && isNaN(oldValue) && isNaN(newValue))) {
			var wasInited = this.isInited(obj);

			obj[this._fieldName] = val;

			// NOTE: property change should be broadcast before rules are run so that if 
			// any rule causes a roundtrip to the server these changes will be available
			this._containingType.get_model().notifyAfterPropertySet(obj, this, val, old, wasInited);

			var handler = this._getEventHandler("changed");
			if (handler)
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
			if (this.isInited(target))
				this._setter(target, val, false, args);
			else
				this.init(target, val);
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
		if (handler)
			handler(target, { property: this, newValue: val, oldValue: undefined, wasInited: false });

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
			f = function (target, property, value, isInited) {
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
	// Adds a rule to the property that will update its value based on a calculation.
	calculated: function (options, conditionType) {
		new CalculatedPropertyRule(options.rootType ? options.rootType.meta : this._containingType, {
			property: this._name,
			basedOn: options.basedOn,
			fn: options.fn,
			isAsync: options.isAsync
		}, conditionType);

		return this;
	},
	ifExists: function (path) {
		Model.property(path, this._containingType, true, function (chain) {
			this.calculated({
				basedOn: [path],
				fn: function () {
					return !isNullOrUndefined(chain.value(this));
				}
			});
		}, this);

		return this;
	},
	alias: function (path, eventName) {
		Model.property(path, this._containingType, true, function (chain) {
			this.calculated({
				basedOn: [(eventName ? eventName + " of " : "") + path],
				fn: function () {
					return chain.value(this);
				}
			});
		}, this);

		return this;
	},
	rootedPath: function Property$rootedPath(type) {
		if (this.isDefinedBy(type)) {
			return (this._isStatic ? this._containingType.get_fullName() : "this") + "." + this._name;
		}
	},
	label: function (label) {
		this._label = label;
		return this;
	},
	required: function (conditionType) {
		new ExoWeb.Model.Rule.required(this._containingType, { property: this._name }, conditionType);
		return this;
	},
	allowedValues: function (source, conditionType) {
		new ExoWeb.Model.Rule.allowedValues(this._containingType, { property: this._name, source: source }, conditionType);
		return this;
	},
	compare: function (operator, source, conditionType) {
		new ExoWeb.Model.Rule.compare(this._containingType, { property: this._name, compareOperator: operator, compareSource: source }, conditionType);
		return this;
	},
	range: function (min, max, conditionType) {
		new ExoWeb.Model.Rule.range(this._containingType, { property: this._name, min: min, max: max }, conditionType);
		return this;
	},
	requiredIf: function (source, operator, value, conditionType) {
		if (typeof (source) === "string") {
			new ExoWeb.Model.Rule.requiredIf(this._containingType, { property: this._name, compareSource: source, compareOperator: operator, compareValue: value }, conditionType);
		}
		else {
			new ExoWeb.Model.Rule.requiredIfExpressions(this._containingType, { property: this._name, fn: source.fn, dependsOn: source.dependsOn }, conditionType);
		}
		return this;
	},
	requiredIfExpressions: function (options, conditionType) {
		new ExoWeb.Model.Rule.requiredIfExpressions(this._containingType, { property: this._name, fn: options.fn, dependsOn: options.dependsOn }, conditionType);
		return this;
	},
	errorIfExpressions: function (options, conditionType) {
		new ExoWeb.Model.Rule.errorIfExpressions(this._containingType, { property: this._name, fn: options.fn, dependsOn: options.dependsOn, errorMessage: options.errorMessage, isWarning: options.isWarning }, conditionType);
		return this;
	},
	stringLength: function (min, max, conditionType) {
		new ExoWeb.Model.Rule.stringLength(this._containingType, { property: this._name, min: min, max: max }, conditionType);
		return this;
	},
	stringFormat: function (description, expression, reformat, conditionType) {
		new ExoWeb.Model.Rule.stringFormat(this._containingType, { property: this._name, description: description, expression: expression, reformat: reformat }, conditionType);
		return this;
	},
	listLength: function (options, conditionType) {
		new ExoWeb.Model.Rule.listLength(this._containingType, { property: this._name, staticLength: options.staticLength, compareSource: options.compareSource, compareOperator: options.compareOperator }, conditionType);
		return this;
	}
});
Property.mixin(ExoWeb.Functor.eventing);
ExoWeb.Model.Property = Property;
Property.registerClass("ExoWeb.Model.Property");
