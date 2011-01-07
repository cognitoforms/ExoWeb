function Adapter(target, propertyPath, systemFormat, displayFormat, options) {
	this._target = target;
	this._propertyPath = propertyPath;
	this._ignoreTargetEvents = false;
	this._readySignal = new ExoWeb.Signal("Adapter Ready");
	this._isDisposed = false;

	if (options.optionsTransform) {
		if (options.optionsTransform.indexOf("groupBy(") >= 0) {
			ExoWeb.trace.throwAndLog(["@", "markupExt"], "optionsTransform does not support grouping");
		}
		this._optionsTransform = options.optionsTransform;
	}

	if (options.allowedValuesMayBeNull) {
		this._allowedValuesMayBeNull = options.allowedValuesMayBeNull;
	}

	// Track state for system and display formats, including the format and bad value.
	this._systemState = { FormatName: systemFormat, Format: undefined, BadValue: undefined };
	this._displayState = { FormatName: displayFormat, Format: undefined, BadValue: undefined };

	// Initialize the property chain.
	this._initPropertyChain();

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
			for (var optionName in options) {
				// check for existing getter and setter methods
				var getter = this["get_" + optionName];
				var setter = this["set_" + optionName];

				// if the option is already defined don't overwrite critical properties (e.g.: value)
				if (getter && !Array.contains(allowedOverrides, optionName)) {
					continue;
				}

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
			ExoWeb.trace.throwAndLog(["@", "markupExt"], "Property \"{p}\" could not be found.", { p: this._propertyPath });
		}

		// if the target is an adapter, prepend it's property chain
		if (this._target instanceof Adapter) {
			this._propertyChain.prepend(this._target.get_propertyChain());
			this._parentAdapter = this._target;
			this._target = this._target.get_target();
		}
	},
	_loadForFormatAndRaiseChange: function Adapter$_loadForFormatAndRaiseChange(val, fmtName) {
		var signal = new ExoWeb.Signal("Adapter." + fmtName + "Value");
		if (val !== undefined && val !== null) {
			this._doForFormatPaths(val, fmtName, function(path) {
				ExoWeb.Model.LazyLoader.evalAll(val, path, signal.pending());
			});
		}
		signal.waitForAll(function() {
			Sys.Observer.raisePropertyChanged(this, fmtName + "Value");
		}, this);
	},
	_doForFormatPaths: function Adapter$_doForFormatPaths(val, fmtName, callback, thisPtr) {
		if (val === undefined || val === null) {
			return;
		}

		var fmtMethod = this["get_" + fmtName + "Format"];
		var fmt = fmtMethod.call(this);

		if (fmt) {
			Array.forEach(fmt.getPaths(), callback, thisPtr || this);
		}
	},
	_unsubscribeFromFormatChanges: function Adapter$_unsubscribeFromFormatChanges(val, fmtName) {
		this._doForFormatPaths(val, fmtName, function(path) {
			var fn = this._formatSubscribers[fmtName + "|" + path];
			Sys.Observer.removePathChanged(val, path, fn);
		});
	},
	_subscribeToFormatChanges: function Adapter$_subscribeToFormatChanges(val, fmtName) {
		this._doForFormatPaths(val, fmtName, function(path) {
			var fn = this._formatSubscribers[fmtName + "|" + path] = this._loadForFormatAndRaiseChange.setScope(this).prependArguments(val, fmtName);
			Sys.Observer.addPathChanged(val, path, fn);
		});
	},
	_ensureObservable: function Adapter$_ensureObservable() {
		var _this = this;

		if (!this._observable) {
			Sys.Observer.makeObservable(this);

			// subscribe to property changes at all points in the path
			this._propertyChain.addChanged(this._onTargetChanged.setScope(this), this._target);

			this._formatSubscribers = {};

			// set up initial watching of format paths
			if (this._propertyChain.lastTarget(this._target)) {
				var rawValue = this._propertyChain.value(this._target);
				this._subscribeToFormatChanges(rawValue, "system");
				this._subscribeToFormatChanges(rawValue, "display");
			}

			// when the value changes resubscribe
			this._propertyChain.addChanged(function(sender, args) {
				_this._unsubscribeFromFormatChanges(args.oldValue, "system");
				_this._unsubscribeFromFormatChanges(args.oldValue, "display");

				_this._subscribeToFormatChanges(args.newValue, "system");
				_this._subscribeToFormatChanges(args.newValue, "display");
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
		ExoWeb.Model.LazyLoader.eval(rawValue, null, function() {
			Sys.Observer.raisePropertyChanged(_this, "rawValue");
		});

		// raise system value changed event
		this._loadForFormatAndRaiseChange(rawValue, "system");

		// raise display value changed event
		this._loadForFormatAndRaiseChange(rawValue, "display");

		// Raise change on options representing the old and new value in the event that the property 
		// has be changed by non-UI code or another UI component.  This will result in double raising 
		// events if the value was set by changing selected on one of the OptionAdapter objects.
		if (this._options) {
			Array.forEach(this._options, function(o) {
				// Always reload selected for options in an array since we don't know what the old values in the list were
				if (args.newValue instanceof Array || o.get_rawValue() == args.newValue || o.get_rawValue() == args.oldValue) {
					Sys.Observer.raisePropertyChanged(o, "selected");
				}
			});
		}
	},
	_reloadOptions: function Adapter$_reloadOptions() {
//				ExoWeb.trace.log(["@", "markupExt"], "Reloading adapter options.");

		this._options = null;
		this._allowedValues = null;

		Sys.Observer.raisePropertyChanged(this, "allowedValues");
		Sys.Observer.raisePropertyChanged(this, "options");
	},
	_getFormattedValue: function Adapter$_getFormattedValue(formatName) {
		this._ensureObservable();

		var state = this["_" + formatName + "State"];

		if (state) {
			if (state.BadValue !== undefined) {
				return state.BadValue;
			}

			var rawValue = this.get_rawValue();

			var formatMethod = this["get_" + formatName + "Format"];
			if (formatMethod) {
				var format = formatMethod.call(this);
				if (format) {
					if (rawValue instanceof Array) {
						return rawValue.map(function(value) { return format.convert(value); });
					}
					else {
						return format.convert(rawValue);
					}
				}
				else {
					return rawValue;
				}
			}
		}
	},
	_setFormattedValue: function Adapter$_setFormattedValue(formatName, value) {
		var state = this["_" + formatName + "State"];

		var format;
		var formatMethod = this["get_" + formatName + "Format"];
		if (formatMethod) {
			format = formatMethod.call(this);
		}

		var converted = format ? format.convertBack(value) : value;

		var prop = this._propertyChain;
		var meta = prop.lastTarget(this._target).meta;

		meta.clearConditions(this);

		if (converted instanceof ExoWeb.Model.FormatError) {
			state.BadValue = value;

			condition = converted.createCondition(this, prop.lastProperty());

			meta.conditionIf(condition, true);

			// Update the model with the bad value if possible
			if (prop.canSetValue(this._target, value)) {
				prop.value(this._target, value);
			}
			// run the rules to preserve the order of conditions
			else {
				meta.executeRules(prop);
			}
		}
		else {
			var changed = prop.value(this._target) !== converted;

			if (state.BadValue !== undefined) {
				delete state.BadValue;

				// force rules to run again in order to trigger validation events
				if (!changed) {
					meta.executeRules(prop);
				}
			}

			this.set_rawValue(converted, changed);
		}
	},

	// Various methods.
	///////////////////////////////////////////////////////////////////////
	dispose: function Adapter$dispose() {
//				ExoWeb.trace.log(["@", "markupExt"], "Adapter disposed.");
		this._isDisposed = true;
	},
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
			value = this.get_systemValue();

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
	get_isList: function Adapter$get_isList() {
		return this._propertyChain.get_isList();
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

				var reloadOptions = function() {
//							ExoWeb.trace.log(["@", "markupExt"], "Reloading adapter options due to change in allowed values path.");

					this._reloadOptions();

					// clear values that are no longer allowed
					var targetObj = this._propertyChain.lastTarget(this._target);
					var rawValue = this.get_rawValue();
					var _this = this;

					if (rawValue instanceof Array) {
						Array.forEach(rawValue, function(item, index) {
							this._allowedValuesRule.satisfiesAsync(targetObj, item, function(answer) {
								if (!answer && !_this._isDisposed) {
//											ExoWeb.trace.log(["@", "markupExt"], "De-selecting item since it is no longer allowed.");
									_this.set_selected(item, false);
								}
							});
						}, this);
					}
					else {
						this._allowedValuesRule.satisfiesAsync(targetObj, rawValue, function(answer) {
							if (!answer && !_this._isDisposed) {
//										ExoWeb.trace.log(["@", "markupExt"], "De-selecting item since it is no longer allowed.");
								_this.set_rawValue(null);
							}
						});
					}

				}

				this._allowedValuesRule.addChanged(reloadOptions.setScope(this), this._propertyChain.lastTarget(this._target));
			}
		}
		return this._allowedValuesRule;
	},
	get_allowedValues: function Adapter$get_allowedValues() {
		if (!this._allowedValues) {
			var rule = this.get_allowedValuesRule();
			var targetObj = this._propertyChain.lastTarget(this._target);
			if (rule) {
				this._allowedValues = rule.values(targetObj, !!this._allowedValuesMayBeNull);

				if (this._allowedValues !== undefined) {
					if (!ExoWeb.Model.LazyLoader.isLoaded(this._allowedValues)) {
						ExoWeb.trace.logWarning(["@", "markupExt"], "Adapter forced loading of allowed values. Rule: {0}", [rule]);
						ExoWeb.Model.LazyLoader.load(this._allowedValues);
					}
					if (this._optionsTransform) {
						this._allowedValues = (new Function("$array", "{ return $transform($array)." + this._optionsTransform + "; }"))(this._allowedValues).live();
					}
				}
			}
			else if (this.isType(Boolean)) {
				this._allowedValues = [true, false];
			}
		}

		return this._allowedValues;
	},
	get_options: function Adapter$get_options() {
		if (!this._options) {

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
			return rawValue == obj;
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
			if (!obj) {
				this.set_systemValue(null);
			}
			else {
				var value = (this.get_systemFormat()) ? this.get_systemFormat().convert(obj) : obj;
				this.set_systemValue(value);
			}
		}
	},
	get_rawValue: function Adapter$get_rawValue() {
		this._ensureObservable();

		return (this._propertyChain.lastTarget(this._target)) ?
			this._propertyChain.value(this._target) :
			null;
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
	get_systemFormat: function Adapter$get_systemFormat() {
		if (!this._systemState.Format) {
			var jstype = this._propertyChain.get_jstype();

			if (this._systemState.FormatName) {
				this._systemState.Format = jstype.formats[this._systemState.FormatName];
			}
			else if (!(this._systemState.Format = this._propertyChain.get_format())) {
				this._systemState.Format = jstype.formats.$system || jstype.formats.$display;
			}
		}

		return this._systemState.Format;
	},
	get_systemValue: function Adapter$get_systemValue() {
		return this._getFormattedValue("system");
	},
	set_systemValue: function Adapter$set_systemValue(value) {
		this._setFormattedValue("system", value);
	},
	get_displayFormat: function Adapter$get_displayFormat() {
		if (!this._displayState.Format) {
			var jstype = this._propertyChain.get_jstype();

			if (this._displayState.FormatName) {
				this._displayState.Format = jstype.formats[this._displayState.FormatName];
			}
			else if (!(this._displayState.Format = this._propertyChain.get_format())) {
				this._displayState.Format = jstype.formats.$display || jstype.formats.$system;
			}
		}

		return this._displayState.Format;
	},
	get_displayValue: function Adapter$get_displayValue() {
		return this._getFormattedValue("display");
	},
	set_displayValue: function Adapter$set_displayValue(value) {
		this._setFormattedValue("display", value);
	},

	// Used to register validating and validated events through the adapter as if binding directly to an Entity
	addPropertyValidating: function Adapter$addPropertyValidating(propName, handler) {
		this._propertyChain.lastTarget(this._target).meta.addPropertyValidating(this._propertyChain.get_name(), handler);
	},
	addPropertyValidated: function Adapter$addPropertyValidated(propName, handler) {
		this._propertyChain.lastTarget(this._target).meta.addPropertyValidated(this._propertyChain.get_name(), handler);
	}
};

ExoWeb.View.Adapter = Adapter;
Adapter.registerClass("ExoWeb.View.Adapter");
