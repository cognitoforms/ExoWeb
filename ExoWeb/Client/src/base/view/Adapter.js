function Adapter(target, propertyPath, format, options) {
	Adapter.initializeBase(this);

	this._target = target instanceof OptionAdapter ? target.get_rawValue() : target;
	this._propertyPath = propertyPath;
	this._settingRawValue = false;
	this._readySignal = new ExoWeb.Signal("Adapter Ready");

	if (options.allowedValuesTransform) {
		this._allowedValuesTransform = options.allowedValuesTransform;
	}

	if (options.optionsTransform) {
		throw new Error($format("Option \"optionsTransform\" is obsolete, use \"allowedValuesTransform\" instead. Path = \"{0}\".", propertyPath));
	}

	if (options.allowedValuesMayBeNull) {
		this._allowedValuesMayBeNull = options.allowedValuesMayBeNull;
	}

	// Initialize the property chain.
	this._initPropertyChain();

	// Determine the display format to use
	this._format = format ? getFormat(this._propertyChain.get_jstype(), format) : this._propertyChain.get_format();

	// Load the object this adapter is bound to and then load allowed values.
	LazyLoader.eval(this._target, this._propertyChain.get_path(),
		this._readySignal.pending(null, null, true),
		this._readySignal.orPending(function(err) {
			throw new Error($format("Couldn't evaluate path '{0}', {1}", propertyPath, err));
		}, null, true)
	);

	// Add arbitrary options so that they are made available in templates.
	this._extendProperties(options);
}

Adapter.mixin({
	// Internal book-keeping and setup methods
	///////////////////////////////////////////////////////////////////////
	_extendProperties: function Adapter$_extendProperties(options) {
		if (options) {
			var allowedOverrides = ["label", "helptext"];

			// The "nullOption" value can be specified for booleans since options
			// are exposed and they are not treated as nullable by default.
			if (this.isType(Boolean)) {
				allowedOverrides.push("nullOption");
			}

			this._extendedProperties = [];
			for (var optionName in options) {
				// check for existing getter and setter methods
				var getter = this["get_" + optionName];
				var setter = this["set_" + optionName];

				// if the option is already defined don't overwrite critical properties (e.g.: value)
				if (getter && !Array.contains(allowedOverrides, optionName)) {
					continue;
				}

				this._extendedProperties.push(optionName);

				// create a getter and setter if they don't exist
				if (!getter || !(getter instanceof Function)) {
					getter = this["get_" + optionName] =
						(function makeGetter(adapter, optionName) {
							return function Adapter$customGetter() { return adapter["_" + optionName]; };
						})(this, optionName);
				}
				if (!setter || !(setter instanceof Function)) {
					setter = this["set_" + optionName] =
						(function makeSetter(adapter, optionName) {
							return function Adapter$customSetter(value) { adapter["_" + optionName] = value; };
						})(this, optionName);
				}

				// set the option value
				setter.call(this, options[optionName]);
			}
		}
	},
	_initPropertyChain: function Adapter$_initPropertyChain() {
		var sourceType;

		if (this._target instanceof Adapter) {
			if (!this._target.get_isEntity()) {
				throw new Error("Adapter source is not an entity.");
			}

			sourceType = this._target._propertyChain.get_jstype().meta;
		}
		else {
			var sourceObject = this._target;

			if (!(sourceObject instanceof Entity)) {
				throw new Error("Adapter source is not an entity, found " + (sourceObject != null ? typeof (sourceObject) : "null"));
			}

			sourceType = sourceObject.meta.type;
		}

		// get the property chain for this adapter starting at the source object
		this._propertyChain = Model.property(this._propertyPath, sourceType);
		if (!this._propertyChain) {
			throw new Error($format("Property \"{0}\" could not be found.", this._propertyPath));
		}

		// If the target is an adapter, prepend its property chain.  Cannot simply concatenate paths
		// since the child path could be instance-dependent (i.e. the parents value is a subtype).
		if (this._target instanceof Adapter) {
			if (this._propertyChain instanceof Property) {
				this._propertyChain = new PropertyChain(this._propertyChain.get_containingType(), [this._propertyChain], []);
			}
			this._propertyChain.prepend(this._target.get_propertyChain());
			this._parentAdapter = this._target;
			this._target = this._target.get_target();
		}
	},
	_loadForFormatAndRaiseChange: function Adapter$_loadForFormatAndRaiseChange(val) {
		EventScope$onExit(function() {
			var signal = new ExoWeb.Signal("Adapter.displayValue");
			this._doForFormatPaths(val, function(path) {
				EventScope$perform(function() {
					LazyLoader.evalAll(val, path, signal.pending(), signal.orPending(), null, null, function() {
						EventScope$perform(LazyLoader.evalAll.bind(this, arguments));
					}, false, val, []);
				}, this);
			});
			signal.waitForAll(function() {
				Observer.raisePropertyChanged(this, "displayValue");
				Observer.raisePropertyChanged(this, "systemValue");
			}, this);
		}, this);
	},
	_doForFormatPaths: function Adapter$_doForFormatPaths(val, callback, thisPtr) {
		if (val === undefined || val === null || !this._format) {
			return;
		}

		this._format.getPaths().forEach(callback, thisPtr || this);
	},
	_unsubscribeFromFormatChanges: function Adapter$_unsubscribeFromFormatChanges(val) {
		this._doForFormatPaths(val, function (path) {
			var subscription = this._formatSubscribers[path];
			if (subscription && subscription.chain) {
				subscription.chain.removeChanged(subscription.handler);
			}
		});
	},
	_subscribeToFormatChanges: function Adapter$_subscribeToFormatChanges(val) {
		this._doForFormatPaths(val, function (path) {
			Model.property(path, this._propertyChain.lastProperty().get_jstype().meta, true, function (chain) {
				var subscription = this._formatSubscribers[path] = { chain: chain, handler: this._loadForFormatAndRaiseChange.bind(this).prependArguments(val) };
				var entities = val instanceof Array ? val : [val];
				entities.forEach(function (entity) {
					chain.addChanged(subscription.handler, entity, false, true);
				});
			}, this);
		});
	},
	_ensureObservable: function Adapter$_ensureObservable() {
		var _this = this;

		if (!this._observable) {
			Observer.makeObservable(this);

			// subscribe to property changes at all points in the path
			this._targetChangedHandler = this._onTargetChanged.bind(this);
			this._propertyChain.addChanged(this._targetChangedHandler, this._target, false, true);

			this._formatSubscribers = {};

			// set up initial watching of format paths
			if (this._propertyChain.lastTarget(this._target)) {
				var rawValue = this._propertyChain.value(this._target);
				this._subscribeToFormatChanges(rawValue);
			}

			// when the value changes resubscribe
			this._propertyChain.addChanged(function (sender, args) {
				_this._unsubscribeFromFormatChanges(args.oldValue);
				_this._subscribeToFormatChanges(args.newValue);
			}, this._target, false, true);

			this._observable = true;
		}
	},
	_onTargetChanged: function Adapter$_onTargetChanged(sender, args) {
		var _this = this;
		var rawValue = this.get_rawValue();

		if (!this._settingRawValue) {
			// raise raw value changed event
			LazyLoader.eval(rawValue, null, function () {
				Observer.raisePropertyChanged(_this, "rawValue");
			});
		}

		// raise value changed event
		this._loadForFormatAndRaiseChange(rawValue);

		// Re-attach validation handlers if needed
		var properties = this._propertyChain.properties();
		var numProps = properties.length;

		// The last target does not change if this is a single-property chain,
		// so no need to update validation events
		if (numProps > 1 && args.triggeredBy !== this._propertyChain.lastProperty()) {
			// Remove event handlers for previous last target 
			if (args.oldValue) {
				// Determine the old last target
				var property,
					propIndex = properties.indexOf(args.triggeredBy) + 1,
					newLastTarget = this._propertyChain.lastTarget(this._target),
					oldLastTarget = args.oldValue;
				while (oldLastTarget && propIndex < numProps - 1) {
					property = properties[propIndex++],
					oldLastTarget = property.value(oldLastTarget);
				}

				// Remove and re-add validation handlers if the last target has changed
				if (oldLastTarget && oldLastTarget !== newLastTarget) {
					this.get_conditions().clear();
					if (this._conditionsChangedHandler) {
						oldLastTarget.meta.removeConditionsChanged(this._conditionsChangedHandler);
					}
				}
			}

			// Add the conditions for the new target and subscribe to changes
			if (this.get_conditions() && newLastTarget) {
				this.get_conditions().addRange(newLastTarget.meta.conditions(this.get_propertyChain().lastProperty()));
				if (this._conditionsChangedHandler) {
					newLastTarget.meta.addConditionsChanged(this._conditionsChangedHandler, this.get_propertyChain());
				}
			}
		}

		if (!this._settingRawValue) {
			// Raise change on options representing the old and new value in the event that the property 
			// has be changed by non-UI code or another UI component.  This will result in double raising 
			// events if the value was set by changing selected on one of the OptionAdapter objects.
			if (this._options) {
				Array.forEach(this._options, function (o) {
					// Always reload selected for options in an array since we don't know what the old values in the list were
					if (args.newValue instanceof Array || o.get_rawValue() == args.newValue || o.get_rawValue() == args.oldValue) {
						Observer.raisePropertyChanged(o, "selected");
					}
				});
			}

			// Dispose of existing event handlers related to allowed value loading
			disposeOptions.call(this);
			signalOptionsReady.call(this);
		}
	},
	_setValue: function Adapter$_setValue(value) {
		var prop = this._propertyChain;

		// Clear existing format errors before adding a new one.
		if (this._formatError) {
			this.get_conditions().remove(this._formatError);
			this._formatError = undefined;
		}

		if (value instanceof ExoWeb.Model.FormatError) {
			// Insert new format errors if the value is not valid.
			this._formatError = value.createCondition(prop.lastTarget(this._target), prop.lastProperty());
			this.get_conditions().insert(0, this._formatError);
		} else {
			// Otherwise, update the property value.
			var changed = prop.value(this._target) !== value;
			this.set_rawValue(value, changed);
		}
	},

	// Various methods.
	///////////////////////////////////////////////////////////////////////
	ready: function Adapter$ready(callback, thisPtr) {
		this._readySignal.waitForAll(callback, thisPtr, true);
	},
	toString: function Adapter$toString() {
		var targetType;
		if (this._target === null) {
			targetType = "null";
		}
		else if (this._target === undefined) {
			targetType = "undefined";
		}
		else {
			targetType = parseFunctionName(this._target.constructor);
		}

		var value;
		try {
			value = this.get_rawValue();

			if (value === null) {
				value = "null";
			}
			else if (value === undefined) {
				value = "undefined";
			}
			else if (value.constructor !== String) {
				value = value.toString();
			}
		}
		catch (e) {
			value = "[error]";
		}

		return $format("<{0}>.{1}:  {2}", [targetType, this._propertyPath, value]);
	},

	// Properties that are intended to be used by templates.
	///////////////////////////////////////////////////////////////////////
	isType: function Adapter$isType(jstype) {
		if (this._jstype && this._jstype instanceof Function) {
			return this._jstype === jstype;
		}

		for (var propType = this._propertyChain.get_jstype(); propType !== null; propType = propType.getBaseType()) {
			if (propType === jstype) {
				return true;
			}
		}

		return false;
	},
	aspects: function Adapter$aspects() {
		if (!this._aspects) {
			this._aspects = {
				"isList": this.get_isList(),
				"isReference": this.get_isEntity() || this.get_isEntityList(),
				"dataType": this.get_dataType()
			};
		}
		return this._aspects;
	},
	get_isList: function Adapter$get_isList() {
		return this._propertyChain.get_isList();
	},
	get_isEntity: function Adapter$get_isEntity() {
		return this._propertyChain.get_isEntityType();
	},
	get_isEntityList: function Adapter$get_isEntityList() {
		return this._propertyChain.get_isEntityListType();
	},
	get_isStatic: function Adapter$get_isStatic() {
		return this._propertyChain.get_isStatic();
	},
	get_target: function Adapter$get_target() {
		return this._target;
	},
	get_propertyPath: function Adapter$get_propertyPath() {
		return this._propertyPath;
	},
	get_propertyChain: function Adapter$get_propertyChain() {
		return this._propertyChain;
	},
	get_format: function Adapter$get_format() {
		return this._format;
	},
	get_dataType: function Adapter$get_dataType() {
		return this._propertyChain.get_jstype();
	},
	get_label: function Adapter$get_label() {
		// if no label is specified then use the property label
		return this._label || this._propertyChain.get_label();
	},
	get_helptext: function Adapter$get_helptext() {
		// help text may also be included in the model?
		return this._helptext || this._propertyChain.get_helptext() || "";
	},
	get_nullOption: function Adapter$get_nullOption() {
		if (this.isType(Boolean)) {
			if (this.hasOwnProperty("_nullOption")) {
				return this._nullOption;
			}

			// Booleans are not nullable by default.
			return false;
		}

		return true;
	},
	get_values: function Adapter$get_values() {
		this._ensureObservable();
		if (this.get_isList()) {
			var _this = this;
			var values = this._propertyChain.value(this._target);
			return values.map(function (v, i) { return new ListValueAdapter(_this, i) });
		}
		else {
			throw new Error("Adapter values are only available for list properties.");
		}
	},
	get_rawValue: function Adapter$get_rawValue() {
		this._ensureObservable();
		return this._propertyChain.value(this._target);
	},
	set_rawValue: function Adapter$set_rawValue(value, changed) {
		var prop = this._propertyChain, target, targetType;

		if (changed === undefined) {
			changed = prop.value(this._target) !== value;
		}

		if (changed) {
			this._settingRawValue = true;

			try {
				target = this._target;
				if (target === null) {
					targetType = "null";
				} else if (target === undefined) {
					targetType = "undefined";
				} else if (target instanceof ExoWeb.Model.Entity) {
					targetType = target.meta.type.get_fullName();
				} else if (target instanceof ExoWeb.View.Adapter) {
					targetType = "Adapter";
				} else if (target instanceof ExoWeb.View.OptionAdapter) {
					targetType = "OptionAdapter";
				} else if (target instanceof ExoWeb.View.OptionGroupAdapter) {
					targetType = "OptionGroupAdapter";
				} else {
					targetType = parseFunctionName(target.constructor);
				}

				if (ExoWeb.config.enableBatchChanges) {
					context.server.batchChanges($format("adapter: {0}.{1}", targetType, this._propertyPath), function () {
						prop.value(target, value);
					});
				}
				else {
					prop.value(target, value);
				}
			}
			finally {
				this._settingRawValue = false;
			}
		}
	},
	get_systemValue: function Adapter$get_systemValue() {
		var rawValue = this.get_rawValue();
		if (this.get_isEntity()) {
			return rawValue ? Entity.toIdString(rawValue) : "";
		}
		else if (this.isType(Boolean)) {
			if (rawValue === true) {
				return "true";
			}
			else if (rawValue === false) {
				return "false";
			}
			else {
				return "";
			}
		}
		else if (this.isType(String)) {
			return rawValue;
		}
		else {
			logWarning("Possible incorrect usage of systemValue for a type that is not supported");
			return rawValue ? rawValue.toString() : "";
		}
	},
	set_systemValue: function Adapter$set_systemValue(value) {
		if (this.get_isEntity()) {

			// set to null
			if (!value) {
				this._setValue(null);
			}
			else {
				var entity = Entity.fromIdString(value);

				// lazy load if necessary
				if (LazyLoader.isRegistered(entity)) {
					// Load the entity (in scope) before setting the value.
					LazyLoader.load(entity, null, true, function () {
						this._setValue(entity);
					}, this);
				}
				// set immediately if loaded
				else {
					this._setValue(entity);
				}
			}
		}
		else if (this.isType(Boolean)) {
			if (value === "true") {
				this._setValue(true);
			}
			else if (value === "false") {
				this._setValue(false);
			}
			else {
				this._setValue(null);
			}
		}
		else if (this.isType(String)) {
			if (!value) 
				this._setValue(null);
			else
				this._setValue(value);
		}
		else {
			throw new Error("Cannot set systemValue property of Adapters for non-entity types.");
		}
	},
	get_displayValue: function Adapter$get_displayValue() {
		var displayValue;
		var rawValue = this.get_rawValue();

		if (this._format) {
			// Use a markup or property format if available
			if (rawValue instanceof Array) {
				displayValue = rawValue.map(function (value) { return this._format.convert(value); }, this);
			}
			else {
				displayValue = this._format.convert(rawValue);
			}
		}
		else if (rawValue instanceof Array) {
			// If no format exists, then fall back to toString
			displayValue = rawValue.map(function (value) {
				if (value === null || value === undefined) {
					return "";
				}
				else {
					return value.toString();
				}
			}, this);
		}
		else if (rawValue === null || rawValue === undefined) {
			displayValue = "";
		}
		else {
			displayValue = rawValue.toString();
		}

		return displayValue instanceof Array ? displayValue.join(", ") : displayValue;
	},
	set_displayValue: function Adapter$set_displayValue(value) {
		if (this.get_isEntity()) {
			throw new Error("Cannot set displayValue property of Adapters for entity types.");
		}
		else if (this.get_isList()) {
			throw new Error("Cannot set displayValue property of Adapters for list types.");
		}
		else {
			var initialValue = value;
			value = this._format ? this._format.convertBack(value) : value;
			this._setValue(value);
			if (ExoWeb.config.autoReformat && !(value instanceof ExoWeb.Model.FormatError)) {
				var newValue = this.get_displayValue();
				if (initialValue != newValue) {
					var adapter = this;
					window.setTimeout(function () { Observer.raisePropertyChanged(adapter, "displayValue"); }, 1);
				}
			}
		}
	},

	dispose: function Adapter$dispose() {
		var disposed = this._disposed, options = null;

		if (!disposed) {
			this._disposed = true;
			disposeOptions.call(this);
			options = this._options;
			if (this._extendedProperties) {
				var ext = this._extendedProperties;
				for (var i = 0, l = ext.length; i < l; i++) {
					this["_" + ext[i]] = null;
				}
				this._extendedProperties = null;
			}
			if (this._targetChangedHandler) {
				this._propertyChain.removeChanged(this._targetChangedHandler);
				this._targetChangedHandler = null;
			}
			this._unsubscribeFromFormatChanges(this.get_rawValue());
			// Clean up validation event handlers
			var lastTarget = this._propertyChain.lastTarget(this._target);
			if (lastTarget) {
				if (this._conditionsChangedHandler) {
					lastTarget.meta.removeConditionsChanged(this._conditionsChangedHandler);
				}
			}
			this._allowedValues = this._allowedValuesMayBeNull = this._aspects =
				this._format = this._formatSubscribers = this._helptext = this._jstype = this._settingRawValue = this._label =
				this._observable = this._options = this._allowedValuesTransform = this._parentAdapter = this._propertyChain =
				this._propertyPath = this._readySignal = this._target = null;
		}

		Adapter.callBaseMethod(this, "dispose");

		if (!disposed) {
			Observer.disposeObservable(this);
			if (options) {
				options.forEach(Observer.disposeObservable);
			}
		}
	}
});

// #region Conditions

function conditionsChangedHandler(conditions, sender, args) {
	if (args.add) {
		conditions.add(args.conditionTarget.condition);
	}
	else if (args.remove) {
		conditions.remove(args.conditionTarget.condition);
	}
}

function getFirstError(conditions, includeWarnings) {
	var firstError = null;
	for (var c = 0; c < conditions.length; c++) {
		var condition = conditions[c];
		if (condition.type instanceof ConditionType.Error || (includeWarnings === true && condition.type instanceof ConditionType.Warning)) {
			if (firstError === null || /FormatError/i.test(condition.type.code)) {
				firstError = condition;
			}
			// Ensures a format error takes precedence over a required field error
			else if (!/FormatError/i.test(firstError.type.code) && /Required/i.test(condition.type.code))
			{
				firstError = condition;
			}
		}
	}
	return firstError;
}

Adapter.mixin({
	get_conditions: function Adapter$get_conditions() {

		// initialize the conditions if necessary
		if (!this._conditions) {

			// get the current target
			var target = this.get_propertyChain().lastTarget(this._target);

			// get the current set of conditions
			var conditions = this._conditions = target ? target.meta.conditions(this.get_propertyChain().lastProperty()) : [];

			// make the conditions observable
			Observer.makeObservable(this._conditions);

			// subscribe to condition changes on the current target
			if (target) {
				var handler = this._conditionsChangedHandler = conditionsChangedHandler.prependArguments(conditions);
				target.meta.addConditionsChanged(handler, this.get_propertyChain());
			}
		}
		return this._conditions;
	},
	get_firstErrorOrWarning: function Adapter$get_firstErrorOrWarning() {
		// gets the first error or warning in a set of conditions, always returning format errors first followed by required field errors, and null if no errors exist
		// initialize on first access
		if (!this.hasOwnProperty("_firstErrorOrWarning")) {

			var conditions = this.get_conditions();
			this._firstErrorOrWarning = getFirstError(conditions, true);

			// automatically update when condition changes occur
			var adapter = this;
			conditions.add_collectionChanged(function (sender, args) {

				var err = getFirstError(conditions, true);

				// store the first error and raise property change if it differs from the previous first error
				if (adapter._firstErrorOrWarning !== err) {
					adapter._firstErrorOrWarning = err;
					Observer.raisePropertyChanged(adapter, "firstErrorOrWarning");
				}
			});
		}

		// return the first error
		return this._firstErrorOrWarning;
	},
	get_firstError: function Adapter$get_firstError() {
		// gets the first error in a set of conditions, always returning format errors first followed by required field errors, and null if no errors exist
		// initialize on first access
		if (!this.hasOwnProperty("_firstError")) {

			var conditions = this.get_conditions();
			this._firstError = getFirstError(conditions);

			// automatically update when condition changes occur
			var adapter = this;
			conditions.add_collectionChanged(function (sender, args) {

				var err = getFirstError(conditions);

				// store the first error and raise property change if it differs from the previous first error
				if (adapter._firstError !== err) {
					adapter._firstError = err;
					Observer.raisePropertyChanged(adapter, "firstError");
				}
			});
		}

		// return the first error
		return this._firstError;
	},
	get_hasError: function Adapter$get_hasError() {
		// initialize on first access
		if (!this.hasOwnProperty("_hasError")) {

			var conditions = this.get_conditions();
			this._hasError = !!this.get_firstError();

			// automatically update when condition changes occur
			var adapter = this;
			conditions.add_collectionChanged(function (sender, args) {

				var val = !!adapter.get_firstError();

				// store the first error and raise property change if it differs from the previous first error
				if (adapter._hasError !== val) {
					adapter._hasError = val;
					Observer.raisePropertyChanged(adapter, "hasError");
				}
			});
		}

		return this._hasError;
	}
});

// #endregion

// #region Options

function disposeOptions() {
	var lastProperty = this._propertyChain.lastProperty();
	var allowedValuesRule = lastProperty.rule(ExoWeb.Model.Rule.allowedValues);
	if (this._allowedValuesChangedHandler) {
		allowedValuesRule.removeChanged(this._allowedValuesChangedHandler);
		this._allowedValuesChangedHandler = null;
	}
	if ( this._allowedValuesRuleExistsHandler) {
		this._propertyChain.lastProperty().removeRuleRegistered(this._allowedValuesRuleExistsHandler);
		this._allowedValuesRuleExistsHandler = null;
	}
	if (this._allowedValuesExistHandler) {
		allowedValuesRule.removeChanged(this._allowedValuesExistHandler);
		this._allowedValuesExistHandler = null;
	}
	this._options = null;
}

// Create an option adapter from the given object
function createOptionAdapter(item) {
	// If it is a transform group then create an option group
	if (item instanceof TransformGroup) {
		return new OptionGroupAdapter(this, item.group, item.items);
	}
	// Otherwise,create a single option
	else {
		return new OptionAdapter(this, item);
	}
}

// Notify subscribers that options are available
function signalOptionsReady() {
	if (this._disposed) {
		return;
	}

	// Delete backing fields so that options can be recalculated (and loaded)
	delete this._options;

	// Raise events in order to cause subscribers to fetch the new value
	ExoWeb.Observer.raisePropertyChanged(this, "options");
}

// If the given rule is allowed values, signal options ready
function checkAllowedValuesRuleExists(rule) {
	if (rule instanceof Rule.allowedValues) {
		this._propertyChain.lastProperty().removeRuleRegistered(this._allowedValuesRuleExistsHandler);
		signalOptionsReady.call(this);
	}
}

function checkAllowedValuesExist() {
	var lastProperty = this._propertyChain.lastProperty();
	var allowedValuesRule = lastProperty.rule(ExoWeb.Model.Rule.allowedValues);
	var targetObj = this._propertyChain.lastTarget(this._target);
	var allowedValues = allowedValuesRule.values(targetObj, !!this._allowedValuesMayBeNull);

	if (allowedValues instanceof Array) {
		allowedValuesRule.removeChanged(this._allowedValuesExistHandler);
		delete this._allowedValuesExistHandler;
		signalOptionsReady.call(this);
	}
}

// Update the given options source array to match the current allowed values
function refreshOptionsFromAllowedValues(optionsSourceArray) {
	var lastProperty = this._propertyChain.lastProperty();
	var allowedValuesRule = lastProperty.rule(ExoWeb.Model.Rule.allowedValues);
	var targetObj = this._propertyChain.lastTarget(this._target);
	var allowedValues = allowedValuesRule.values(targetObj, !!this._allowedValuesMayBeNull);
	if (allowedValues) {
		optionsSourceArray.beginUpdate();
		update(optionsSourceArray, allowedValues);
		optionsSourceArray.endUpdate();
	}
	else {
		signalOptionsReady.call(this);
	}
}

// Perform any required loading of allowed values items
function ensureAllowedValuesLoaded(newItems, callback, thisPtr) {
	// Wait until the "batch" of work is complete before lazy loading options. Otherwise,
	// the lazy loading could occur during processing of a response which already contains
	// the data, which could cause performance degredation due to redundant data loading.
	Batch.whenDone(function () {
		var signal = new Signal("ensureAllowedValuesLoaded");
		newItems.forEach(function(item) {
			if (LazyLoader.isRegistered(item)) {
				LazyLoader.load(item, null, true, signal.pending());
			}
		});
		signal.waitForAll(callback, thisPtr);
	});
}

function clearInvalidOptions(allowedValues) {
	var rawValue = this.get_rawValue();
	var isDateProp = this.isType(Date);

	function isAllowedValue(value) {
		if (isDateProp) {
			return allowedValues.some(function (v) {
				return v instanceof Date && value.valueOf() === v.valueOf();
			});
		}

		return allowedValues.indexOf(value) !== -1;
	}

	if (rawValue !== null && allowedValues) {
		// Remove option values that are no longer valid
		if (rawValue instanceof Array) {
			purge(rawValue, function (item) {
				return !isAllowedValue(item);
			}, this);
		} else if (!isAllowedValue(rawValue) && this._propertyChain.value(this._target) !== null) {
			this._propertyChain.value(this._target, null);
		}
	} else if (rawValue instanceof Array) {
		rawValue.clear();
	} else if (this._propertyChain.value(this._target) !== null) {
		this._propertyChain.value(this._target, null);
	}
}

function allowedValuesChanged(optionsSourceArray, sender, args) {
	var lastProperty = this._propertyChain.lastProperty();
	var allowedValuesRule = lastProperty.rule(ExoWeb.Model.Rule.allowedValues);
	var allowedValues = allowedValuesRule.values(this._propertyChain.lastTarget(this._target), !!this._allowedValuesMayBeNull);

    // Clear out invalid selections
	if (!allowedValuesRule.ignoreValidation) {
	    clearInvalidOptions.call(this, allowedValues);
	}

	// Load allowed value items that were added
	if (args.changes) {
		// Collect all items that were added
		var newItems = [];
		args.changes.forEach(function(change) {
			if (change.newItems) {
				newItems.addRange(change.newItems);
			}
		});
		if (newItems.length > 0) {
			ensureAllowedValuesLoaded(newItems, refreshOptionsFromAllowedValues.prependArguments(optionsSourceArray), this);
		}
		else {
			refreshOptionsFromAllowedValues.call(this, optionsSourceArray);
		}
	}
	else if (!args.oldValue && args.newValue) {
		// If there was previously not a value of the path and now there is, then all items are new
		ensureAllowedValuesLoaded(allowedValues, refreshOptionsFromAllowedValues.prependArguments(optionsSourceArray), this);
	}
	else {
		refreshOptionsFromAllowedValues.call(this, optionsSourceArray);
	}

}

Adapter.mixin({
	get_options: function Adapter$get_options() {
		if (!this.hasOwnProperty("_options")) {
			if (this.isType(Boolean)) {
				this._options = [createOptionAdapter.call(this, true), createOptionAdapter.call(this, false)];
			}
			else {
				var lastProperty = this._propertyChain.lastProperty();
				var allowedValuesRule = lastProperty.rule(ExoWeb.Model.Rule.allowedValues);

				// Watch for the registration of an allowed values rule if it doesn't exist
				if (!allowedValuesRule) {
					this._allowedValuesRuleExistsHandler = checkAllowedValuesRuleExists.bind(this);
					lastProperty.addRuleRegistered(this._allowedValuesRuleExistsHandler);
					this._options = null;
					return;
				}

				// Cache the last target
				var targetObj = this._propertyChain.lastTarget(this._target);

				// Retrieve the value of allowed values property
				var allowedValues = allowedValuesRule.values(targetObj, !!this._allowedValuesMayBeNull);

				// Load allowed values if the path is not inited
				if (allowedValues === undefined && (allowedValuesRule.source instanceof Property || allowedValuesRule.source instanceof PropertyChain)) {
					logWarning("Adapter forced eval of allowed values. Rule: " + allowedValuesRule);
					LazyLoader.eval(allowedValuesRule.source.get_isStatic() ? null : targetObj,
						allowedValuesRule.source.get_path(),
						signalOptionsReady.bind(this));
					this._options = null;
					return;
				}

				// Watch for changes until the allowed values path has a value
				if (!allowedValues) {
					this._allowedValuesExistHandler = checkAllowedValuesExist.bind(this);
					allowedValuesRule.addChanged(this._allowedValuesExistHandler, targetObj);
					if (!allowedValuesRule.ignoreValidation) {
					    clearInvalidOptions.call(this);
					}
					this._options = null;
					return;
				}

				// Load the allowed values list if it is not already loaded
				if (LazyLoader.isRegistered(allowedValues)) {
					logWarning("Adapter forced loading of allowed values list. Rule: " + allowedValuesRule);
					LazyLoader.load(allowedValues, null, true, signalOptionsReady.bind(this), this);
					this._options = null;
					return;
				}

				if (!allowedValuesRule.ignoreValidation) {
				    clearInvalidOptions.call(this, allowedValues);
				}

				// Create an observable copy of the allowed values that we can keep up to date in our own time
				var observableAllowedValues = allowedValues.slice();
				ExoWeb.Observer.makeObservable(observableAllowedValues);

				// Respond to changes to allowed values
				this._allowedValuesChangedHandler = allowedValuesChanged.bind(this).prependArguments(observableAllowedValues);
				allowedValuesRule.addChanged(this._allowedValuesChangedHandler, targetObj, false, true);

				// Create a transform that watches the observable copy and uses the user-supplied _allowedValuesTransform if given
				if (this._allowedValuesTransform) {
					transformedAllowedValues = (new Function("$array", "{ return $transform($array, true)." + this._allowedValuesTransform + "; }"))(observableAllowedValues);
					if (transformedAllowedValues.live !== Transform.prototype.live) {
						throw new Error("Invalid options transform result: may only contain \"where\", \"orderBy\", \"select\", \"selectMany\", and \"groupBy\".");
					}
				}
				else {
					transformedAllowedValues = $transform(observableAllowedValues, true);
				}

				// Map the allowed values to option adapters
				this._options = transformedAllowedValues.select(createOptionAdapter.bind(this)).live();
			}
		}

		return this._options;
	}
});

// #endregion

ExoWeb.View.Adapter = Adapter;
Adapter.registerClass("ExoWeb.View.Adapter", Sys.Component, Sys.UI.ITemplateContextConsumer);
