//////////////////////////////////////////////////////////////////////////////////////
/// <remarks>
/// If the interface for this class is changed it should also be changed in
/// PropertyChain, since PropertyChain acts as an aggregation of properties 
/// that can be treated as a single property.
/// </remarks>
///////////////////////////////////////////////////////////////////////////////
function Property(containingType, name, jstype, isList, label, format, isStatic, isPersisted, index) {
	this._containingType = containingType;
	this._name = name;
	this._fieldName = "_" + name;
	this._jstype = jstype;
	this._label = label || makeHumanReadable(name);
	this._format = format;
	this._isList = !!isList;
	this._isStatic = !!isStatic;
	this._isPersisted = !!isPersisted;
	this._index = index;
	this._rules = [];
	this._defaultValue = 
		isList ? [] :
		jstype === Boolean ? false :
		jstype === Number ? 0 :
		null;

	if (containingType.get_originForNewProperties()) {
		this._origin = containingType.get_originForNewProperties();
	}

	if (this._origin === "client" && this._isPersisted) {
		ExoWeb.trace.logWarning("model",
			"Client-origin properties should not be marked as persisted: Type = {0}, Name = {1}",
			containingType.get_fullName(),
			name);
	}
}

// updates the property and message or conditionType options for property rules
function preparePropertyRuleOptions(property, options, error) {
	options.property = property;
	if (error && error.constructor === String) {
		options.message = error;
	}
	else if (error instanceof ConditionType) {
		options.conditionType = error;
	}
	return options;
}

// updates the property and message or conditionType options for property rules
function hasPropertyChangedSubscribers(property, obj) {
	handler = property._getEventHandler("changed");
	return handler && !handler.isEmpty([obj]);
}

// registers a rule with a specific property
function registerPropertyRule(property, rule) {
	property._rules.push(rule);

	// Raise events if registered.
	var handler = property._getEventHandler("ruleRegistered");
	if (handler)
		handler(rule, { property: property });
}

function Property$_init(obj, val, force) {
	var target = (this._isStatic ? this._containingType.get_jstype() : obj);
	var curVal = target[this._fieldName];

	if (curVal !== undefined && !(force === undefined || force)) {
		return;
	}

	target[this._fieldName] = val;

	if (val instanceof Array) {
		var _this = this;
		Observer.makeObservable(val);
		Observer.addCollectionChanged(val, function Property$collectionChanged(sender, args) {
			if (!LazyLoader.isLoaded(val)) {
				throw new ExoWeb.trace.logError("model", "{0} list {1}.{2} was modified but it has not been loaded.",
					_this._isStatic ? "Static" : "Non-static",
					_this._isStatic ? _this._containingType.get_fullName() : "this<" + _this._containingType.get_fullName() + ">",
					_this._name
				);
			}

			// NOTE: property change should be broadcast before rules are run so that if 
			// any rule causes a roundtrip to the server these changes will be available
			_this._containingType.model.notifyListChanged(target, _this, args.get_changes());

			// NOTE: oldValue is not currently implemented for lists
			_this._raiseEvent("changed", [target, { property: _this, newValue: val, oldValue: undefined, changes: args.get_changes(), collectionChanged: true}]);

			Observer.raisePropertyChanged(target, _this._name);
		});
	}

	Observer.raisePropertyChanged(target, this._name);

	// Return the property to support method chaining
	return this;
}

function Property$_ensureInited(obj) {
	// Determine if the property has been initialized with a value
	// and initialize the property if necessary
	if (!obj.hasOwnProperty(this._fieldName)) {

		// Initialize to the defined default value
		Property$_init.call(this, obj, this.get_defaultValue());

		// Mark the property as pending initialization
		obj.meta.pendingInit(this, true);
	}
}

function Property$_getter(obj) {
	// Ensure the entity is loaded before accessing property values
	if (LazyLoader.isLoaded(obj)) {
		// Ensure that the property has an initial (possibly default) value
		Property$_ensureInited.call(this, obj);

		// Raise get events
		// NOTE: get events may result in a change, so the value cannot be cached
		var handler = this._getEventHandler("get");
		if (handler)
			handler(obj, { property: this, value: obj[this._fieldName] });

		// Return the property value
		return obj[this._fieldName];
	}
}
exports.Property$_getter = Property$_getter; // IGNORE

function Property$_setter(obj, val, skipTypeCheck, additionalArgs) {
	// Ensure the entity is loaded before setting property values
	if (!LazyLoader.isLoaded(obj)) {
		throw new ExoWeb.trace.logError(["model", "entity"], "Cannot set property {0}={1} for ghosted instance {2}({3}).", this._name, val === undefined ? "<undefined>" : val, obj.meta.type.get_fullName(), obj.meta.id);
	}

	// Ensure that the property has an initial (possibly default) value
	Property$_ensureInited.call(this, obj);

	if (!this.canSetValue(obj, val)) {
		throw new ExoWeb.trace.logError(["model", "entity"], "Cannot set {0}={1} for instance {2}({3}). A value of type {4} was expected.", this._name, val === undefined ? "<undefined>" : val, obj.meta.type.get_fullName(), obj.meta.id, parseFunctionName(this._jstype));
	}

	var old = obj[this._fieldName];

	// compare values so that this check is accurate for primitives
	var oldValue = (old === undefined || old === null) ? old : old.valueOf();
	var newValue = (val === undefined || val === null) ? val : val.valueOf();

	// Do nothing if the new value is the same as the old value. Account for NaN numbers, which are
	// not equivalent (even to themselves). Although isNaN returns true for non-Number values, we won't
	// get this far for Number properties unless the value is actually of type Number (a number or NaN).
	if (oldValue !== newValue && !(this._jstype === Number && isNaN(oldValue) && isNaN(newValue))) {
		// Set the backing field value
		obj[this._fieldName] = val;

		// NOTE: property change should be broadcast before rules are run so that if 
		// any rule causes a roundtrip to the server these changes will be available
		this._containingType.model.notifyAfterPropertySet(obj, this, val, old);

		var handler = this._getEventHandler("changed");
		if (handler) {
			// Create the event argument object
			var args = { property: this, newValue: val, oldValue: old };

			// Assign custom event argument values
			if (additionalArgs) {
				for (var p in additionalArgs) {
					if (additionalArgs.hasOwnProperty(p)) {
						args[p] = additionalArgs[p];
					}
				}
			}

			handler(obj, args);
		}

		Observer.raisePropertyChanged(obj, this._name);
	}
}
exports.Property$_setter = Property$_setter; // IGNORE

Property.mixin({
	defaultValue: function Property$defaultValue(value) {
		this._defaultValue = value;
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
	rule: function (type) {
		if (!type || !(type instanceof Function)) {
			ExoWeb.trace.throwAndLog("rule", "{0} is not a valid rule type.", [type ? type : (type === undefined ? "undefined" : "null")]);
		}

		return first(this._rules, function (rule) {
			if (rule instanceof type) {
				return true;
			}
		});
	},
	rules: function (filter) {
		return filter && filter instanceof Function ? this._rules.filter(filter) : this._rules.slice();
	},	
	isDefinedBy: function Property$isDefinedBy(mtype) {
		return this._containingType === mtype || mtype.isSubclassOf(this._containingType);
	},
	addRuleRegistered: function Property$addRuleRegistered(handler, obj, once) {
		this._addEvent("ruleRegistered", handler, obj ? equals(obj) : null, once);
		return this;
	},
	removeRuleRegistered: function Property$removeRuleRegistered(handler, obj, once) {
		this._removeEvent("ruleRegistered", handler);
		return this;
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
	get_defaultValue: function Property$get_defaultValue() {
		// clone array and date defaults since they are mutable javascript types
		return this._defaultValue instanceof Array ? this._defaultValue.slice() :
			this._defaultValue instanceof Date ? new Date(+this._defaultValue) :
			this._defaultValue instanceof TimeSpan ? new TimeSpan(this._defaultValue.totalMilliseconds) :
			this._defaultValue;
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
					this.get_name()
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
					this.get_name()
				]);
			}
		}
	},
	// </DEBUG>

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

	get_isPersisted: function Property$get_isPersisted() {
		return this._isPersisted;
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
		// NOTE: only allow values of the correct data type to be set in the model

		if (val === undefined) {
			ExoWeb.trace.logWarning("model", "You should not set property values to undefined, use null instead: property = {0}.", this._name);
			return true;
		}

		if (val === null) {
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
			Property$_setter.call(this, target, val, false, args);
		}
		else {
			return Property$_getter.call(this, target);
		}
	},

	isInited: function Property$isInited(obj) {
		var target = (this._isStatic ? this._containingType.get_jstype() : obj);
		if (!target.hasOwnProperty(this._fieldName)) {
			// If the backing field has not been created, then property is not initialized
			return false;
		}
		if (this._isList) {
			var value = target[this._fieldName];
			if (!LazyLoader.isLoaded(value)) {
				// If the list is not-loaded, then the property is not initialized
				return false;
			}
		}
		return true;
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
	firstProperty: function Property$firstProperty() {
		return this;
	},
	lastProperty: function Property$lastProperty() {
		return this;
	},
	properties: function Property$properties() {
		return [this];
	},
	lastTarget: function Property$lastTarget(obj) {
		return obj;
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
			return this._isStatic ? this._containingType.get_fullName() + "." + this._name : this._name;
		}
	},
	label: function (label) {
		this._label = label;
		return this;
	},
	// Adds a rule to the property that will update its value based on a calculation.
	calculated: function (options) {
		options.property = this;
		new CalculatedPropertyRule(options.rootType ? options.rootType.meta : this._containingType, options);
		return this;
	},
	required: function (error) {
		var options = preparePropertyRuleOptions(this, {}, error);
		new ExoWeb.Model.Rule.required(this._containingType, options);
		return this;
	},
	allowedValues: function (source, error) {
		var options = preparePropertyRuleOptions(this, { source: source }, error);
		new ExoWeb.Model.Rule.allowedValues(this._containingType, options);
		return this;
	},
	compare: function (operator, source, error) {
		var options = preparePropertyRuleOptions(this, { compareOperator: operator, compareSource: source }, error);
		new ExoWeb.Model.Rule.compare(this._containingType, options);
		return this;
	},
	range: function (min, max, error) {
		var options = preparePropertyRuleOptions(this, { min: min, max: max }, error);
		new ExoWeb.Model.Rule.range(this._containingType, options);
		return this;
	},
	conditionIf: function (options, type) {
		var options = preparePropertyRuleOptions(this, options, type);
		new ExoWeb.Model.Rule.validated(this._containingType, options);
		return this;
	},
	errorIf: function (options, error) {
		return this.conditionIf(options, error);
	},
	warningIf: function (options, warning) {
		return this.conditionIf($.extend(options, { category: ConditionType.Warning }), warning);
	},
	requiredIf: function (source, operator, value, error) {
		if (source.constructor === String) {
			var options = preparePropertyRuleOptions(this, { compareSource: source, compareOperator: operator, compareValue: value }, error);
			new ExoWeb.Model.Rule.requiredIf(this._containingType, options);
		}
		else {
			var options = preparePropertyRuleOptions(this, source);
			new ExoWeb.Model.Rule.requiredIf(this._containingType, options);
		}
		return this;
	},
	stringLength: function (min, max, error) {
		var options = preparePropertyRuleOptions(this, { min: min, max: max }, error);
		new ExoWeb.Model.Rule.stringLength(this._containingType, options);
		return this;
	},
	stringFormat: function (description, expression, reformat, error) {
		var options = preparePropertyRuleOptions(this, { description: description, expression: expression, reformat: reformat }, error);
		new ExoWeb.Model.Rule.stringFormat(this._containingType, options);
		return this;
	},
	listLength: function (options, error) {
		var options = preparePropertyRuleOptions(this, { staticLength: options.staticLength, compareSource: options.compareSource, compareOperator: options.compareOperator }, error);
		new ExoWeb.Model.Rule.listLength(this._containingType, options);
		return this;
	},
	triggersRoundtrip: function (paths) {
		this.addChanged(function (sender, args) {
			sender.meta.type.model.server.roundtrip(sender, paths);
		});
	}
});
Property.mixin(Functor.eventing);
exports.Property = Property;
