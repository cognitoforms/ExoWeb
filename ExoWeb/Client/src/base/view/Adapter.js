function Adapter(target, propertyPath, format, options) {
	Adapter.initializeBase(this);

	this._target = target instanceof OptionAdapter ? target.get_rawValue() : target;
	this._propertyPath = propertyPath;
	this._ignoreTargetEvents = false;
	this._readySignal = new ExoWeb.Signal("Adapter Ready");

	if (options.optionsTransform) {
		if (options.optionsTransform.indexOf("groupBy(") >= 0) {
			ExoWeb.trace.throwAndLog(["@", "markupExt"], "The optionsTransform property does not support grouping");
		}
		this._optionsTransform = options.optionsTransform;
	}

	if (options.allowedValuesMayBeNull) {
		this._allowedValuesMayBeNull = options.allowedValuesMayBeNull;
	}

	// Initialize the property chain.
	this._initPropertyChain();

	// Determine the display format to use
	this._format = format ? getFormat(this._propertyChain.get_jstype(), format) : this._propertyChain.get_format();

	// Load the object this adapter is bound to and then load allowed values.
	ExoWeb.Model.LazyLoader.eval(this._target, this._propertyPath,
		this._readySignal.pending(),
		this._readySignal.orPending(function(err) {
			ExoWeb.trace.throwAndLog(["@", "markupExt"], "Couldn't evaluate path '{0}', {1}", [propertyPath, err]);
		})
	);

	// Add arbitrary options so that they are made available in templates.
	this._extendProperties(options);
}

Adapter.prototype = {
	// Internal book-keeping and setup methods
	///////////////////////////////////////////////////////////////////////
	_extendProperties: function Adapter$_extendProperties(options) {
		if (options) {
			var allowedOverrides = ["label", "helptext"];
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
		// start with the target or its raw value in the case of an adapter
		var sourceObject = (this._target instanceof Adapter) ? this._target.get_rawValue() : this._target;

		// get the property chain for this adapter starting at the source object
		this._propertyChain = sourceObject.meta.property(this._propertyPath);
		if (!this._propertyChain) {
			ExoWeb.trace.throwAndLog(["@", "markupExt"], "Property \"{0}\" could not be found.", this._propertyPath);
		}

		// If the target is an adapter, prepend its property chain.  Cannot simply concatenate paths
		// since the child path could be instance-dependent (i.e. the parents value is a subtype).
		if (this._target instanceof Adapter) {
			this._propertyChain.prepend(this._target.get_propertyChain());
			this._parentAdapter = this._target;
			this._target = this._target.get_target();
		}
	},
	_loadForFormatAndRaiseChange: function Adapter$_loadForFormatAndRaiseChange(val) {
		var signal = new ExoWeb.Signal("Adapter.displayValue");
		this._doForFormatPaths(val, function (path) {
			ExoWeb.Model.LazyLoader.evalAll(val, path, signal.pending());
		});
		signal.waitForAll(function () {
			Sys.Observer.raisePropertyChanged(this, "displayValue");
			Sys.Observer.raisePropertyChanged(this, "systemValue");
		}, this);
	},
	_doForFormatPaths: function Adapter$_doForFormatPaths(val, callback, thisPtr) {
		if (val === undefined || val === null || !this._format) {
			return;
		}

		if (fmt) {
			Array.forEach(this._format.getPaths(), callback, thisPtr || this);
		}
	},
	_unsubscribeFromFormatChanges: function Adapter$_unsubscribeFromFormatChanges(val) {
		this._doForFormatPaths(val, function (path) {
			var fn = this._formatSubscribers[path];
			Sys.Observer.removePathChanged(val, path, fn);
		});
	},
	_subscribeToFormatChanges: function Adapter$_subscribeToFormatChanges(val) {
		this._doForFormatPaths(val, function (path) {
			var fn = this._formatSubscribers[path] = this._loadForFormatAndRaiseChange.bind(this).prependArguments(val);
			Sys.Observer.addPathChanged(val, path, fn);
		});
	},
	_ensureObservable: function Adapter$_ensureObservable() {
		var _this = this;

		if (!this._observable) {
			Sys.Observer.makeObservable(this);

			// subscribe to property changes at all points in the path
			this._targetChangedHandler = this._onTargetChanged.bind(this);
			this._propertyChain.addChanged(this._targetChangedHandler, this._target);
			this._targetChangedHandlerArray = this._propertyChain._lastAddChangedHandlers;

			this._formatSubscribers = {};

			// set up initial watching of format paths
			if (this._propertyChain.lastTarget(this._target, true)) {
				var rawValue = this._propertyChain.value(this._target);
				this._subscribeToFormatChanges(rawValue);
			}

			// when the value changes resubscribe
			this._propertyChain.addChanged(function (sender, args) {
				_this._unsubscribeFromFormatChanges(args.oldValue);
				_this._subscribeToFormatChanges(args.newValue);
			}, this._target);

			this._observable = true;
		}
	},
	_onTargetChanged: function Adapter$_onTargetChanged(sender, args) {
		if (this._ignoreTargetEvents) {
			return;
		}

		var _this = this;
		var rawValue = this.get_rawValue();

		// raise raw value changed event
		ExoWeb.Model.LazyLoader.eval(rawValue, null, function () {
			Sys.Observer.raisePropertyChanged(_this, "rawValue");
		});

		// raise value changed event
		this._loadForFormatAndRaiseChange(rawValue);

		// Raise change on options representing the old and new value in the event that the property 
		// has be changed by non-UI code or another UI component.  This will result in double raising 
		// events if the value was set by changing selected on one of the OptionAdapter objects.
		if (this._options) {
			Array.forEach(this._options, function (o) {
				// Always reload selected for options in an array since we don't know what the old values in the list were
				if (args.newValue instanceof Array || o.get_rawValue() == args.newValue || o.get_rawValue() == args.oldValue) {
					Sys.Observer.raisePropertyChanged(o, "selected");
				}
			});
		}

		// Re-attach validation handlers if needed
		var properties = this._propertyChain._properties;
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
				if (oldLastTarget !== newLastTarget) {
					if (this._propertyValidatedHandler) {
						oldLastTarget.meta.removePropertyValidated(this._propertyChain.get_name(), this._propertyValidatedHandler);
						this.addPropertyValidated(null, this._propertyValidatedHandler);
					}
					if (this._propertyValidatingHandler) {
						oldLastTarget.meta.removePropertyValidating(this._propertyChain.get_name(), this._propertyValidatingHandler);
						this.addPropertyValidating(null, this._propertyValidatingHandler);
					}
				}
			}

			if (this._propertyValidatedHandler) {
				this.addPropertyValidated(null, this._propertyValidatedHandler);
			}
			if (this._propertyValidatingHandler) {
				this.addPropertyValidating(null, this._propertyValidatingHandler);
			}
		}
	},
	_reloadOptions: function Adapter$_reloadOptions(allowLazyLoad) {
		if (!this._disposed) {
			ExoWeb.trace.log(["@", "markupExt"], "Reloading adapter options.");
	
			if (allowLazyLoad === true) {
				// delete backing fields so that allowed values can be recalculated (and loaded)
				delete this._allowedValues;
				delete this._options;
			}
			else {
				// clear out backing fields so that allowed values can be recalculated
				this._allowedValues = undefined;
				this._options = undefined;
			}
	
			// raise events in order to cause subscribers to fetch the new value
			Sys.Observer.raisePropertyChanged(this, "allowedValues");
			Sys.Observer.raisePropertyChanged(this, "options");
		}
	},
	_setValue: function Adapter$_setValue(value) {
		var prop = this._propertyChain;
		var meta = prop.lastTarget(this._target).meta;

		meta.clearConditions(this);

		if (value instanceof ExoWeb.Model.FormatError) {
			this._condition = value.createCondition(this, prop.lastProperty());

			meta.conditionIf(this._condition, true);

			// Update the model with the bad value if possible
			if (prop.canSetValue(this._target, value)) {
				prop.value(this._target, value);
			}
			// run the rules to preserve the order of conditions
			else {
				// store the "bad value" since the actual value will be different
				this._badValue = value;
				meta.executeRules(prop);
			}
		}
		else {
			var changed = prop.value(this._target) !== value;

			if (this._badValue !== undefined) {
				delete this._badValue;
				delete this._condition;

				// force rules to run again in order to trigger validation events
				if (!changed) {
					meta.executeRules(prop);
				}
			}

			this.set_rawValue(value, changed);
		}
	},

	// Various methods.
	///////////////////////////////////////////////////////////////////////
	ready: function Adapter$ready(callback, thisPtr) {
		this._readySignal.waitForAll(callback, thisPtr);
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
			targetType = ExoWeb.parseFunctionName(this._target.constructor);
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
		return this._helptext || "";
	},
	get_allowedValuesRule: function Adapter$get_allowedValuesRule() {
		if (this._allowedValuesRule === undefined) {
			var prop = this._propertyChain.lastProperty();
			this._allowedValuesRule = prop.rule(ExoWeb.Model.Rule.allowedValues);
			if (this._allowedValuesRule) {

				var reloadOptions = function () {
					//ExoWeb.trace.log(["@", "markupExt"], "Reloading adapter options due to change in allowed values path.");

					this._reloadOptions(true);

					// clear values that are no longer allowed
					var targetObj = this._propertyChain.lastTarget(this._target);
					var rawValue = this.get_rawValue();
					var _this = this;

					if (rawValue instanceof Array) {
						Array.forEach(rawValue, function (item, index) {
							this._allowedValuesRule.satisfiesAsync(targetObj, item, !!this._allowedValuesMayBeNull, function (answer) {
								if (!answer && !_this._disposed) {
									//ExoWeb.trace.log(["@", "markupExt"], "De-selecting item since it is no longer allowed.");
									_this.set_selected(item, false);
								}
							});
						}, this);
					}
					else {
						this._allowedValuesRule.satisfiesAsync(targetObj, rawValue, !!this._allowedValuesMayBeNull, function (answer) {
							if (!answer && !_this._disposed) {
								//ExoWeb.trace.log(["@", "markupExt"], "De-selecting item since it is no longer allowed.");
								_this.set_rawValue(null);
							}
						});
					}
				}

				this._allowedValuesRule.addChanged(reloadOptions.bind(this).prependArguments(true), this._propertyChain.lastTarget(this._target));
			}
			else {
				var _this = this;
				prop.addRuleRegistered(function (sender, args) {
					if (!_this._allowedValuesRule) {
						_this._allowedValuesRule = prop.rule(ExoWeb.Model.Rule.allowedValues);
						if (_this._allowedValuesRule) {
							_this._reloadOptions(true);
						}
					}
				});
			}
		}
		return this._allowedValuesRule;
	},
	get_allowedValues: function Adapter$get_allowedValues() {
		if (this._allowedValues === undefined) {
			var rule = this.get_allowedValuesRule();
			if (rule) {
				var targetObj = this._propertyChain.lastTarget(this._target);
				var allowedValues = rule.values(targetObj, !!this._allowedValuesMayBeNull);

				// only do loading if backing field does not exist, which means we've never initialized or need to re-initialize
				if (!this.hasOwnProperty("_allowedValues")) {
					// create the backing field so that this logic does not execute again
					this._allowedValues = undefined;

					if (!allowedValues) {
						//allowedValues = rule.values(targetObj, !!this._allowedValuesMayBeNull);
						ExoWeb.trace.logWarning(["@", "markupExt"], "Adapter forced loading of allowed values. Rule: {0}", [rule]);
						this._reloadOptionsHandler = this._reloadOptions.bind(this);
						ExoWeb.Model.LazyLoader.eval(rule._allowedValuesProperty.get_isStatic() ? null : targetObj,
							rule._allowedValuesProperty.get_path(),
							this._reloadOptionsHandler);
						return;
					}

					if (!ExoWeb.Model.LazyLoader.isLoaded(allowedValues)) {
						ExoWeb.trace.logWarning(["@", "markupExt"], "Adapter forced loading of allowed values. Rule: {0}", [rule]);
						this._reloadOptionsHandler = this._reloadOptions.bind(this);
						ExoWeb.Model.LazyLoader.load(allowedValues, null, this._reloadOptionsHandler, this);
						return;
					}
				}

				if (this._optionsTransform)
					this._allowedValues = (new Function("$array", "{ return $transform($array)." + this._optionsTransform + "; }"))(allowedValues).live();
				else
					this._allowedValues = allowedValues;
			}
			else if (this.isType(Boolean)) {
				this._allowedValues = [true, false];
			}
		}

		return this._allowedValues;
	},
	get_options: function Adapter$get_options() {
		if (this._options === undefined) {

			var allowed = this.get_allowedValues();

			this._options = [];

			for (var a = 0; allowed && a < allowed.length; a++) {
				Array.add(this._options, new OptionAdapter(this, allowed[a]));
			}
		}

		return this._options;
	},
	get_selected: function Adapter$get_selected(obj) {
		var rawValue = this.get_rawValue();

		if (rawValue instanceof Array) {
			return Array.contains(rawValue, obj);
		}
		else {
			return rawValue === obj;
		}
	},
	set_selected: function Adapter$set_selected(obj, selected) {
		var rawValue = this.get_rawValue();

		if (rawValue instanceof Array) {
			if (selected && !Array.contains(rawValue, obj)) {
				rawValue.add(obj);
			}
			else if (!selected && Array.contains(rawValue, obj)) {
				rawValue.remove(obj);
			}
		}
		else {
			if (selected) {
				this.set_rawValue(obj);
			}
			else {
				this.set_rawValue(null);
			}
		}
	},
	get_rawValue: function Adapter$get_rawValue() {
		this._ensureObservable();
		return this._propertyChain.value(this._target);
	},
	set_rawValue: function Adapter$set_rawValue(value, changed) {
		var prop = this._propertyChain;

		if (changed === undefined) {
			changed = prop.value(this._target) !== value;
		}

		if (changed) {
			this._ignoreTargetEvents = true;

			try {
				prop.value(this._target, value);
			}
			finally {
				this._ignoreTargetEvents = false;
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
		else {
			ExoWeb.trace.logWarning(["@", "markupExt"], "Possible incorrect usage of systemValue for a type that is not supported");
			return rawValue ? rawValue.toString() : "";
		}
	},
	set_systemValue: function Adapter$set_systemValue(value) {
		if (this.get_isEntity()) {
			this._setValue(value ? Entity.fromIdString(value) : null);
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
		else {
			ExoWeb.trace.throwAndLog(["@", "markupExt"], "Cannot set systemValue property of Adapters for non-entity types.");
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
			ExoWeb.trace.throwAndLog(["@", "markupExt"], "Cannot set displayValue property of Adapters for entity types.");
		}
		else {
			value = this._format ? this._format.convertBack(value) : value;
			this._setValue(value);
		}
	},

	// Used to register validating and validated events through the adapter as if binding directly to an Entity
	addPropertyValidating: function Adapter$addPropertyValidating(propName, handler) {
		var lastTarget = this._propertyChain.lastTarget(this._target);

		this._propertyValidatingHandler = handler;

		if (lastTarget) {
			lastTarget.meta.addPropertyValidating(this._propertyChain.get_name(), handler);
		}
	},
	addPropertyValidated: function Adapter$addPropertyValidated(propName, handler) {
		var lastTarget = this._propertyChain.lastTarget(this._target);

		this._propertyValidatedHandler = handler;

		if (lastTarget) {
			lastTarget.meta.addPropertyValidated(this._propertyChain.get_name(), handler);
		}
	},

	clearValidation: function () {
		if (this._condition) {
			var prop = this._propertyChain;
			var meta = prop.lastTarget(this._target).meta;
			meta.conditionIf(this._condition, false);
			delete this._condition;
		}
	},
	dispose: function Adapter$dispose() {
		var disposed = this._disposed, options = null;

		if (!disposed) {
			this._disposed = true;
			options = this._options;
			this.clearValidation();
			if (this._extendedProperties) {
				var ext = this._extendedProperties;
				for (var i = 0, l = ext.length; i < l; i++) {
					this["_" + ext[i]] = null;
				}
				this._extendedProperties = null;
			}
			if (this._targetChangedHandler) {
				this._propertyChain.removeChanged(this._targetChangedHandlerArray);
				this._targetChangedHandler = null;
			}
			this._unsubscribeFromFormatChanges(this.get_rawValue());
			// Clean up validation event handlers
			var lastTarget = this._propertyChain.lastTarget(this._target, true);
			if (lastTarget) {
				if (this._propertyValidatedHandler) {
					lastTarget.meta.removePropertyValidating(this._propertyChain.get_name(), this._propertyValidatingHandler);
				}
				if (this._propertyValidatedHandler) {
					lastTarget.meta.removePropertyValidated(this._propertyChain.get_name(), this._propertyValidatedHandler);
				}
			}
			this._allowedValues = this._allowedValuesMayBeNull = this._allowedValuesRule = this._aspects = this._badValue =
				this._format = this._formatSubscribers = this._helptext = this._jstype = this._ignoreTargetEvents = this._label =
				this._observable = this._options = this._optionsTransform = this._parentAdapter = this._propertyChain =
				this._propertyPath = this._readySignal = this._reloadOptionsHandler = this._target = this._targetChangedHandlerArray = null;
		}

		Adapter.callBaseMethod(this, "dispose");

		if (!disposed) {
			Sys.Observer.disposeObservable(this);
			if (options) {
				options.forEach(Sys.Observer.disposeObservable);
			}
		}
	}
};

ExoWeb.View.Adapter = Adapter;
Adapter.registerClass("ExoWeb.View.Adapter", Sys.Component, Sys.UI.ITemplateContextConsumer);
