/// <reference path="../core/Errors.js" />
/// <reference path="Entity.js" />

//////////////////////////////////////////////////////////////////////////////////////
/// <remarks>
/// If the interface for this class is changed it should also be changed in
/// PropertyChain, since PropertyChain acts as an aggregation of properties 
/// that can be treated as a single property.
/// </remarks>
///////////////////////////////////////////////////////////////////////////////
function Property(containingType, name, jstype, label, helptext, format, isList, isStatic, isPersisted, isCalculated, index, defaultValue, constant) {
	this._containingType = containingType;
	this._name = name;
	this._fieldName = "_" + name;
	this._jstype = jstype;
	this._label = label || makeHumanReadable(name);
	this._helptext = helptext;
	this._format = format;
	this._isList = isList === true;
	this._isStatic = isStatic === true;
	this._isPersisted = isPersisted === true;
	this._isCalculated = isCalculated === true;
	this._index = index;
	this._defaultValue =
		defaultValue !== undefined ? defaultValue :
			isList ? [] :
				jstype === Boolean ? false :
					jstype === Number ? 0 :
						null;

	this._constant = null;
	if (constant !== null && constant !== undefined) {
		// constant value should be lazily initialized to ensure any type dependencies have been resolved
		if (isList && constant instanceof Array) {
			this._constant = function () {
				return constant.map(function (i) {
					return new jstype(i);
				});
			};
		}
		else if (!isList && typeof constant === "object") {
			this._constant = function () {
				new jstype(i);
			};
		}
	}

	this._rules = [];

	if (containingType.get_originForNewProperties()) {
		this._origin = containingType.get_originForNewProperties();
	}

	if (this._origin === "client" && this._isPersisted) {
		logWarning($format("Client-origin properties should not be marked as persisted: Type = {0}, Name = {1}", containingType.get_fullName(), name));
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
	var changedEvent = property._getEventHandler("changed");
	return changedEvent && !changedEvent.isEmpty([obj]);
}

// registers a rule with a specific property
function registerPropertyRule(property, rule) {
	property._rules.push(rule);

	// Raise events if registered.
	var ruleRegisteredEvent = property._getEventHandler("ruleRegistered");
	if (ruleRegisteredEvent && !ruleRegisteredEvent.isEmpty()) {
		ruleRegisteredEvent(rule, { property: property });
	}
}

function Property$_init(obj, val, force) {
	var target = (this._isStatic ? this._containingType.get_jstype() : obj);
	var curVal = target[this._fieldName];

	if (curVal !== undefined && !(force === undefined || force)) {
		return;
	}

	target[this._fieldName] = val;

	target.meta.pendingInit(this, false);

	if (val instanceof Array) {
		var _this = this;
		Observer.makeObservable(val);
		Observer.addCollectionChanged(val, function Property$collectionChanged(sender, args) {
			var changes = args.get_changes();

			// Don't raise the change event unless there is actually a change to the collection
			if (changes && changes.some(function (change) { return (change.newItems && change.newItems.length > 0) || (change.oldItems && change.oldItems.length > 0); })) {
				// NOTE: property change should be broadcast before rules are run so that if 
				// any rule causes a roundtrip to the server these changes will be available
				_this._containingType.model.notifyListChanged(target, _this, changes);

				// NOTE: oldValue is not currently implemented for lists
				_this._raiseEvent("changed", [target, { property: _this, newValue: val, oldValue: undefined, changes: changes, collectionChanged: true }]);

				Observer.raisePropertyChanged(target, _this._name);
			}
		});

		// Override the default toString on arrays so that we get a comma-delimited list
		val.toString = Property$_arrayToString.bind(val);
	}

	Observer.raisePropertyChanged(target, this._name);

	// Return the property to support method chaining
	return this;
}

function Property$_arrayToString() {
	return this.join(", ");
}

function Property$_ensureInited(obj) {
	// Determine if the property has been initialized with a value
	// and initialize the property if necessary
	if (!obj.hasOwnProperty(this._fieldName)) {

		// Do not initialize calculated properties. Calculated properties should be initialized using a property get rule.  
		if (!this.get_isCalculated()) {
			var value = this.get_constant() !== null ? this.get_constant() : this.get_defaultValue();
			Property$_init.call(this, obj, value);
		}

		// Mark the property as pending initialization
		obj.meta.pendingInit(this, true);
	}
}

function Property$_getter(obj) {
	// Ensure the entity is loaded before accessing property values
	if (LazyLoader.isRegistered(obj)) {
		return;
	}

	// Ensure that the property has an initial (possibly default) value
	Property$_ensureInited.call(this, obj);

	// Raise get events
	// NOTE: get events may result in a change, so the value cannot be cached
	var getEvent = this._getEventHandler("get");
	if (getEvent && !getEvent.isEmpty()) {
		getEvent(obj, { property: this, value: obj[this._fieldName] });
	}

	// Return the property value
	return obj[this._fieldName];
}

exports.Property$_getter = Property$_getter; // IGNORE

function Property$_setter(obj, val, skipTypeCheck, additionalArgs) {
	// Ensure the entity is loaded before setting property values
	if (LazyLoader.isRegistered(obj)) {
		throw new Error("Cannot set " + this.get_name() + "=" + (val === undefined ? "<undefined>" : val) + " for instance " + obj.meta.type.get_fullName() + "|" + obj.meta.id + ": object is ghosted.");
	}

	// Ensure that the property has an initial (possibly default) value
	Property$_ensureInited.call(this, obj);

	if (!this.canSetValue(obj, val)) {
		throw new Error("Cannot set " + this.get_name() + "=" + (val === undefined ? "<undefined>" : val) + " for instance " + obj.meta.type.get_fullName() + "|" + obj.meta.id + ": a value of type " + (this._jstype && this._jstype.meta ? this._jstype.meta.get_fullName() : parseFunctionName(this._jstype)) + " was expected.");
	}

	var old = obj[this._fieldName];

	// Update lists as batch remove/add operations
	if (this.get_isList()) {
		old.beginUpdate();
		update(old, val);
		old.endUpdate();
	}
	else {

		// compare values so that this check is accurate for primitives
		var oldValue = (old === undefined || old === null) ? old : old.valueOf();
		var newValue = (val === undefined || val === null) ? val : val.valueOf();

		// Do nothing if the new value is the same as the old value. Account for NaN numbers, which are
		// not equivalent (even to themselves). Although isNaN returns true for non-Number values, we won't
		// get this far for Number properties unless the value is actually of type Number (a number or NaN).
		if (oldValue !== newValue && !(this._jstype === Number && isNaN(oldValue) && isNaN(newValue))) {
			// Set the backing field value
			obj[this._fieldName] = val;

			obj.meta.pendingInit(this, false);

			// Do not raise change if the property has not been initialized. 
			if (old !== undefined) {
				this.raiseChanged(obj, val, old, additionalArgs);
			}
		}
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

	raiseChanged: function (obj, val, old, additionalArgs) {
		// NOTE: property change should be broadcast before rules are run so that if 
		// any rule causes a roundtrip to the server these changes will be available
		this._containingType.model.notifyAfterPropertySet(obj, this, val, old);

		var changedEvent = this._getEventHandler("changed");
		if (changedEvent && !changedEvent.isEmpty()) {
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

			changedEvent(obj, args);
		}

		Observer.raisePropertyChanged(obj, this._name);
	},

	rule: function (type) {
		if (type == null) throw new ArgumentNullError("type");
		if (typeof (type) !== "function") throw new ArgumentTypeError("type", "function", type);

		return first(this._rules, function (rule) {
			if (rule instanceof type) {
				return true;
			}
		});
	},
	rules: function (filter) {
		return filter && filter instanceof Function ? this._rules.filter(filter) : this._rules.slice();
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
	isDefinedBy: function Property$isDefinedBy(mtype) {
		return this._containingType === mtype || mtype.isSubclassOf(this._containingType);
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
					this._defaultValue instanceof Function ? this._defaultValue() :
						this._defaultValue;
	},

	get_origin: function Property$get_origin() {
		return this._origin ? this._origin : this._containingType.get_origin();
	},

	get_isEntityType: function Property$get_isEntityType() {
		if (!this.get_jstype().meta) {
			return false;
		}
		return !this._isList;
	},

	get_isEntityListType: function Property$get_isEntityListType() {
		if (!this.get_jstype().meta) {
			return false;
		}
		return this._isList;
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

	get_constant: function Property$get_constant() {
		// initialize and cache the constant value if we have not already
		if (typeof this._constant === "function")
			this._constant = this._constant();
		return this._constant;
	},

	get_isPersisted: function Property$get_isPersisted() {
		return this._isPersisted;
	},

	get_isCalculated: function Property$get_isCalculated() {
		return this._isCalculated;
	},

	get_label: function Property$get_label() {
		return this._label;
	},

	get_helptext: function Property$get_helptext() {
		return this._helptext;
	},

	get_name: function Property$get_name() {
		return this._name;
	},

	get_fieldName: function Property$get_fieldName() {
		return this._fieldName;
	},

	get_path: function Property$get_path() {
		return this._isStatic ? (this._containingType.get_fullName() + "." + this._name) : this._name;
	},

	canSetValue: function Property$canSetValue(obj, val) {
		// NOTE: only allow values of the correct data type to be set in the model

		if (val === undefined) {
			logWarning("You should not set property values to undefined, use null instead: property = ." + this._name + ".");
			return true;
		}

		if (val === null) {
			return true;
		}

		// for entities check base types as well
		if (val.constructor && val.constructor.meta) {
			for (var valType = val.constructor.meta; valType; valType = valType.baseType) {
				if (valType._jstype === this._jstype) {
					return true;
				}
			}

			return false;
		}

		//Data types
		else {
			var valObjectType = val.constructor;

			//"Normalize" data type in case it came from another frame as well as ensure that the types are the same
			switch (type(val)) {
				case "string":
					valObjectType = String;
					break;
				case "number":
					valObjectType = Number;
					break;
				case "boolean":
					valObjectType = Boolean;
					break;
				case "date":
					valObjectType = Date;
					break;
				case "array":
					valObjectType = Array;
					break;
			}

			// value property type check
			return valObjectType === this._jstype ||

				// entity array type check
				(valObjectType === Array && this.get_isList() && val.every(function (child) {
					if (child.constructor && child.constructor.meta) {
						for (var childType = child.constructor.meta; childType; childType = childType.baseType) {
							if (childType._jstype === this._jstype) {
								return true;
							}
						}
					}
					return child.constructor === this._jstype;
				}, this));
		}
	},

	value: function Property$value(obj, val, args) {
		var target = (this._isStatic ? this._containingType.get_jstype() : obj);

		if (target === undefined || target === null) {
			throw new Error($format(
				"Cannot {0} value for {1}static property \"{2}\" on type \"{3}\": target is null or undefined.",
				(arguments.length > 1 ? "set" : "get"), (this._isStatic ? "" : "non-"), this.get_path(), this._containingType.get_fullName()));
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
			if (value === undefined || !LazyLoader.isLoaded(value)) {
				// If the list is not-loaded, then the property is not initialized
				return false;
			}
		}
		return true;
	},

	// starts listening for get events on the property. Use obj argument to
	// optionally filter the events to a specific object
	addGet: function Property$addGet(handler, obj, once) {
		this._addEvent("get", handler, obj ? equals(obj) : null, once);

		// Return the property to support method chaining
		return this;
	},
	removeGet: function Property$removeGet(handler) {
		this._removeEvent("get", handler);
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

	helptext: function (helptext) {
		this._helptext = helptext;
		return this;
	},

	// Adds a rule to the property that will update its value based on a calculation.
	calculated: function (options) {
		options.property = this;
		var definedType = options.rootType ? options.rootType.meta : this._containingType;
		delete options.rootType;

		new CalculatedPropertyRule(definedType, options);

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
	optionValues: function (source, error) {
		var options = preparePropertyRuleOptions(this, { source: source, onInit: false, onInitNew: false, onInitExisting: false }, error);
		options.ignoreValidation = true;
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
		var definedType = options.rootType ? options.rootType.meta : this._containingType;
		delete options.rootType;

		options = preparePropertyRuleOptions(this, options, type);
		new ExoWeb.Model.Rule.validated(definedType, options);
		return this;
	},
	errorIf: function (options, error) {
		return this.conditionIf(options, error);
	},
	warningIf: function (options, warning) {
		return this.conditionIf(jQuery.extend(options, { category: ConditionType.Warning }), warning);
	},
	requiredIf: function (source, operator, value, error) {
		if (source.constructor === String) {
			var options = preparePropertyRuleOptions(this, { compareSource: source, compareOperator: operator, compareValue: value }, error);
			new ExoWeb.Model.Rule.requiredIf(this._containingType, options);
		}
		else {
			var definedType = source.rootType ? source.rootType.meta : this._containingType;
			delete source.rootType;
			source = preparePropertyRuleOptions(this, source);

			new ExoWeb.Model.Rule.requiredIf(definedType, source);
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
	}
});
Property.mixin(Functor.eventing);
exports.Property = Property;
