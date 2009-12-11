; (function() {
	var log = ExoWeb.trace.log;

	Type.registerNamespace("ExoWeb.View");

	// Markup Extensions
	//////////////////////////////////////////////////////////////////////////////////////

	// Metadata adapter markup extension
	Sys.Application.registerMarkupExtension("@",
		function AdapterMarkupExtention(component, targetProperty, templateContext, properties) {
			log(["@", "markupExt"], "@ " + (properties.$default || "(no path)") + " (evaluating)");

			var path = properties.path || properties.$default;
			delete properties.$default;

			var adapter = new Adapter(properties.source || templateContext.dataItem, path, properties.systemFormat, properties.displayFormat, properties);

			adapter.ready(function AdapterReady() {
				log(["@", "markupExt"], "@ " + (adapter._propertyPath || "(no path)") + "  <.>");
				Sys.Observer.setValue(component, targetProperty, adapter);
			});
		}, false);

	// Lazy eval markup extension
	Sys.Application.registerMarkupExtension("~",
		function LazyMarkupExtension(component, targetProperty, templateContext, properties) {
			log(["~", "markupExt"], "~ " + (properties.$default || "(no path)") + " (evaluating)");

			var source;
			var scopeChain;

			if (properties.source) {
				var evalSource = new Function("$element", "$index", "$dataItem", "return " + properties.source + ";");
				source = evalSource(component.get_element(), templateContext.index, templateContext.dataItem);
				
				// don't try to eval the path against window
				scopeChain = [];
			}
			else {
				source = templateContext.dataItem;
			}

			ExoWeb.Model.LazyLoader.eval(source, properties.$default,
				function(result) {
					log(["~", "markupExt"], "~ " + (properties.$default || "(no path)") + "  <.>");
					
					if (properties.transform && result instanceof Array) {
						// generate transform function
						var doTrans = new Function("list", "$element", "$index", "$dataItem", "return $transform(list)." + properties.transform + ";");

						// transform the result to use now
						var list = result;
						result = doTrans(list, component.get_element(), templateContext.index, templateContext.dataItem);

						// watch for changes to the list and refresh
						Sys.Observer.makeObservable(list);
						Sys.Observer.addCollectionChanged(list, function() {
							Sys.Observer.setValue(component, targetProperty, doTrans(list, component.get_element(), templateContext.index, templateContext.dataItem));
						});
					}
					else {
						try {
							var doFormat = function(obj) {
								if (properties.format && result.constructor.formats && result.constructor.formats[properties.format])
									return obj.constructor.formats[properties.format].convert(obj);

								return obj;
							}

							if (properties.$default) {
								var props = properties.$default.split(".");
								var last = props.splice(-1);
								ExoWeb.Model.LazyLoader.eval(source, props.join("."), function(target) {
									Sys.Observer.addSpecificPropertyChanged(target, last, function(obj) {
										Sys.Observer.setValue(component, targetProperty, doFormat(ExoWeb.getValue(target, last)));
									});
								});
							}

							result = doFormat(result);
						}
						catch (e) {
							console.log(e);
						}
					}

					Sys.Observer.setValue(component, targetProperty, result);
				},
				function(err) {
					throw err;
				},
				scopeChain
			);
		},
		false
	);


	///////////////////////////////////////////////////////////////////////////////
	function Adapter(target, propertyPath, systemFormat, displayFormat, options) {
		this._target = target;
		this._propertyPath = propertyPath;

		this._systemState = { FormatName: systemFormat };
		this._displayState = { FormatName: displayFormat };

		this._emptyOption = true;
		this._ignoreTargetEvents = false;

		this._readySignal = new ExoWeb.Signal();
		var _this = this;

		// load the object this adapter is bound to
		ExoWeb.Model.LazyLoader.eval(this.get_target(), propertyPath, this._readySignal.pending(
			function Adapter$targetLoadedCallback() {
				if (!_this.get_propertyChain().get_isValueType()) {
					var prop = _this.get_propertyChain().lastProperty();
					var rule = prop.rule(ExoWeb.Model.Rule.allowedValues);
					var targetObj = _this.get_propertyChain().lastTarget(_this.get_target());
					if (rule && rule.propertyChain()) {
						var target = rule.propertyChain().get_isStatic() ? window : targetObj;
						ExoWeb.Model.LazyLoader.eval(target, rule.propertyChain().fullName(), _this._readySignal.pending());
					}
				}
			}
		));

		// Add arbitrary options so that they are made available in templates
		var allowedOverrides = ["label", "helptext", "emptyOption", "emptyOptionLabel"];
		if (options) {
			for (var optionName in options) {
				// check for existing getter and setter methods
				var getter = this["get_" + optionName];
				var setter = this["set_" + optionName];

				// if the option is already defined don't overwrite critical properties (e.g.: value)
				if (getter && !Array.contains(allowedOverrides, optionName))
					continue;

				// create a getter and setter if they don't exist
				if (!getter || !(getter instanceof Function))
					getter = this["get_" + optionName] =
						(function makeGetter(adapter, optionName) {
							return function Adapter$customGetter() { return adapter["_" + optionName]; };
						})(this, optionName);
				if (!setter || !(setter instanceof Function))
					setter = this["set_" + optionName] =
						(function makeSetter(adapter, optionName) {
							return function Adapter$customSetter(value) { adapter["_" + optionName] = value; };
						})(this, optionName);

				// set the option value
				setter.call(this, options[optionName]);
			}
		}
	}

	Adapter.prototype = {
		ready: function Adapter$ready(callback) {
			this._readySignal.waitForAll(callback);
		},
		get_target: function Adapter$get_target() {
			return this._target;
		},
		get_propertyPath: function Adapter$get_propertyPath() {
			return this._propertyPath;
		},
		get_propertyChain: function Adapter$get_propertyChain() {
			if (!this._propertyChain) {
				var sourceObject = (this._target instanceof Adapter) ? this._target.get_rawValue() : this._target;

				// get the property chain starting at the source object
				this._propertyChain = sourceObject.meta.property(this.get_propertyPath());
				if (!this._propertyChain)
					throw ($format("Property \"{p}\" could not be found.", { p: this.get_propertyPath() }));

				// prepend parent adapter's property path
				if (this._target instanceof Adapter)
					this._propertyChain.prepend(this._target.get_propertyChain());
			}

			return this._propertyChain;
		},
		initialize: function Adapter$initialize() {
			if (!this._observable) {
				var _this = this;
				Sys.Observer.makeObservable(this);
				// subscribe to property changes at any point in the path
				this.get_propertyChain().each(this.get_target(), function Adapter$RegisterPropertyChangeCallback(obj, prop) {
					if (prop.get_isEntityListType())
						Sys.Observer.addCollectionChanged(prop.value(obj), function Adapter$ListPropertyChangedCallback(sender, args) {
							_this._onTargetChanged(sender, args);
						});
					else
						Sys.Observer.addSpecificPropertyChanged(obj, prop.get_name(), function Adapter$PropertyChangedCallback(sender, args) {
							_this._onTargetChanged(sender, args);
						});
				});
				this._observable = true;
			}
		},
		// Pass property change events to the target object
		///////////////////////////////////////////////////////////////////////////
		_onTargetChanged: function Adapter$_onTargetChanged(sender, args) {
			if (this._ignoreTargetEvents)
				return;

			Sys.Observer.raisePropertyChanged(this, "rawValue");
			Sys.Observer.raisePropertyChanged(this, "systemValue");
			Sys.Observer.raisePropertyChanged(this, "displayValue");
		},

		// Properties that are intended to be used by templates
		///////////////////////////////////////////////////////////////////////////
		get_label: function Adapter$get_label() {
			return this._label || this.get_propertyChain().get_label();
		},
		get_helptext: function Adapter$get_helptext() {
			return this._helptext || "";
		},
		get_emptyOption: function Adapter$get_emptyOption() {
			return !!this._emptyOption;
		},
		set_emptyOption: function Adapter$set_emptyOption(value) {
			if (value.constructor != Boolean)
				value = Boolean.formats.TrueFalse.convertBack(value);

			this._emptyOption = value;
		},
		get_emptyOptionLabel: function Adapter$get_emptyOptionLabel() {
			return this._emptyOptionLabel ? this._emptyOptionLabel : " -- select -- ";
		},
		set_emptyOptionLabel: function Adapter$set_emptyOptionLabel(value) {
			this._emptyOptionLabel = value;
		},
		get_allowedValues: function Adapter$get_allowedValues() {
			if (!this._allowedValues) {
				if (!this.get_propertyChain().get_isValueType()) {
					var prop = this.get_propertyChain().lastProperty();
					var allowed = null;
					var rule = prop.rule(ExoWeb.Model.Rule.allowedValues);
					var targetObj = this.get_propertyChain().lastTarget(this.get_target());
					if (rule) {
						this._allowedValues = rule.values(targetObj);

						var _this = this;
						// watch for changes to the allowed values list and update options
						Sys.Observer.addCollectionChanged(this._allowedValues, function() {
							_this._options = null;
							Sys.Observer.raisePropertyChanged(_this, "options");
						});
					}
				}
			}

			return this._allowedValues;
		},
		get_options: function Adapter$get_options() {
			if (!this._options) {

				var allowed = this.get_allowedValues();

				this._options = [];

				if (this.get_propertyChain().get_isEntityType() && this.get_emptyOption())
					Array.add(this._options, new OptionAdapter(this, null));

				for (var a = 0; a < allowed.length; a++)
					Array.add(this._options, new OptionAdapter(this, allowed[a]));
			}

			return this._options;
		},

		getFormattedValue: function Adapter$getFormattedValue(formatName) {
			this.initialize();

			var state = this["_" + formatName + "State"];

			if (state) {
				if (state.BadValue !== undefined)
					return state.BadValue;

				var rawValue = this.get_rawValue();

				var formatMethod = this["get_" + formatName + "Format"];
				if (formatMethod) {
					var format = formatMethod.call(this);
					return format ? format.convert(rawValue) : rawValue;
				}
			}
		},
		setFormattedValue: function Adapter$setFormattedValue(formatName, value) {
			var state = this["_" + formatName + "State"];

			var formatMethod = this["get_" + formatName + "Format"];
			if (formatMethod)
				var format = formatMethod.call(this);

			var converted = format ? format.convertBack(value) : value;

			var prop = this.get_propertyChain();
			var meta = prop.lastTarget(this.get_target()).meta;

			meta.clearIssues(this);

			if (converted instanceof ExoWeb.Model.FormatIssue) {
				state.BadValue = value;

				issue = new ExoWeb.Model.RuleIssue(
							$format(converted.get_message(), { value: prop.get_label() }),
							[prop.lastProperty()],
							this);

				meta.issueIf(issue, true);

				// Update the model with the bad value if possible
				if (prop.canSetValue(this.get_target(), value))
					prop.value(this.get_target(), value);
				else
				// run the rules to preserve the order of issues
					meta.executeRules(prop.get_name());
			}
			else {
				var changed = prop.value(this.get_target()) !== converted;

				if (state.BadValue !== undefined) {
					delete state.BadValue;

					// force rules to run again in order to trigger validation events
					if (!changed)
						meta.executeRules(prop.get_name());
				}

				this.set_rawValue(converted, changed);
			}
		},

		// Raw Value
		////////////////////////////////////////////////////////////////////////
		get_rawValue: function Adapter$get_rawValue() {
			this.initialize();

			return this.get_propertyChain().value(this.get_target());
		},
		set_rawValue: function Adapter$set_rawValue(value, changed) {
			var prop = this.get_propertyChain();

			if (changed === undefined)
				changed = prop.value(this.get_target()) !== value;

			if (changed) {
				this._ignoreTargetEvents = true;

				try {
					prop.value(this.get_target(), value);
				}
				finally {
					this._ignoreTargetEvents = false;
				}
			}
		},

		// System Value
		//////////////////////////////////////////////////////////////////////////////////////////
		get_systemFormat: function Adapter$get_systemFormat() {
			if (!this._systemState.Format) {
				var jstype = this.get_propertyChain().get_jstype();

				if (this._systemState.FormatName)
					this._systemState.Format = jstype.formats[this._systemState.FormatName];
				else if (!(this._systemState.Format = this.get_propertyChain().get_format()))
					this._systemState.Format = jstype.formats.$system || jstype.formats.$display;
			}

			return this._systemState.Format;
		},
		get_systemValue: function Adapter$get_systemValue() {
			return this.getFormattedValue("system");
		},
		set_systemValue: function Adapter$set_systemValue(value) {
			this.setFormattedValue("system", value);
		},

		// Display Value
		//////////////////////////////////////////////////////////////////////////////////////////
		get_displayFormat: function Adapter$get_displayFormat() {
			if (!this._displayState.Format) {
				var jstype = this.get_propertyChain().get_jstype();

				if (this._displayState.FormatName)
					this._displayState.Format = jstype.formats[this._displayState.FormatName];
				else if (!(this._displayState.Format = this.get_propertyChain().get_format()))
					this._displayState.Format = jstype.formats.$display || jstype.formats.$system;
			}

			return this._displayState.Format;
		},
		get_displayValue: function Adapter$get_displayValue() {
			return this.getFormattedValue("display");
		},
		set_displayValue: function Adapter$set_displayValue(value) {
			this.setFormattedValue("display", value);
		},

		// Pass validation events through to the target
		///////////////////////////////////////////////////////////////////////////
		addPropertyValidating: function Adapter$addPropertyValidating(propName, handler) {
			var prop = this.get_propertyChain();
			prop.lastTarget(this.get_target()).meta.addPropertyValidating(prop.get_name(), handler);
		},
		addPropertyValidated: function Adapter$addPropertyValidated(propName, handler) {
			var prop = this.get_propertyChain();
			prop.lastTarget(this.get_target()).meta.addPropertyValidated(prop.get_name(), handler);
		},

		// Override toString so that UI can bind to the adapter directly
		///////////////////////////////////////////////////////////////////////////
		toString: function Adapter$toString() {
			return this.get_systemValue();
		}
	}
	ExoWeb.View.Adapter = Adapter;
	Adapter.registerClass("ExoWeb.View.Adapter");

	///////////////////////////////////////////////////////////////////////////////
	OptionAdapter = function(parent, obj) {
		this._parent = parent;
		this._obj = obj;

		if (this._obj) {
			var _this = this;
			Sys.Observer.makeObservable(this);
			// subscribe to property changes to the option's label (value shouldn't change)
			// TODO: can we make this more specific?
			Sys.Observer.addPropertyChanged(this._obj, function(sender, args) {
				_this._onTargetChanged(sender, args);
			});
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	OptionAdapter.prototype = {
		// Pass property change events to the target object
		///////////////////////////////////////////////////////////////////////////
		_onTargetChanged: function(sender, args) {
			if (this._ignoreTargetEvents)
				return;

			Sys.Observer.raisePropertyChanged(this, "label");
		},

		// Properties consumed by UI
		///////////////////////////////////////////////////////////////////////////
		get_parent: function OptionAdapter$get_parent() {
			return this._parent;
		},
		get_rawValue: function OptionAdapter$get_rawValue() {
			return this._obj;
		},
		get_displayValue: function OptionAdapter$get_displayValue() {
			if (!this._obj)
				return this._parent.get_emptyOptionLabel();

			var format = this._parent.get_displayFormat();
			return format ? format.convert(this._obj) : this._obj;
		},
		get_systemValue: function OptionAdapter$get_systemValue() {
			var format = this._parent.get_systemFormat();
			return format ? format.convert(this._obj) : this._obj;
		},
		get_selected: function OptionAdapter$get_selected() {
			var source = this._parent.get_rawValue();

			if (source instanceof Array)
				return Array.contains(source, this._obj);
			else
				return source == this._obj;
		},
		set_selected: function OptionAdapter$set_selected(value) {
			var source = this._parent.get_rawValue();

			if (source instanceof Array) {
				if (value && !Array.contains(source, this._obj))
					source.add(this._obj);
				else if (!value && Array.contains(source, this._obj))
					source.remove(this._obj);
			}
			else {
				if (!this._obj)
					this._parent.set_systemValue(null);
				else {
					var value = (this._parent.get_systemFormat()) ? this._parent.get_systemFormat().convert(this._obj) : this._obj;
					this._parent.set_systemValue(value);
				}
			}
		},

		// Pass validation events through to the target
		///////////////////////////////////////////////////////////////////////////
		addPropertyValidating: function OptionAdapter$addPropertyValidating(propName, handler) {
			var prop = this._parent.get_propertyChain();
			prop.lastTarget(this._parent.get_target()).meta.addPropertyValidating(prop.get_name(), handler);
		},
		addPropertyValidated: function OptionAdapter$addPropertyValidated(propName, handler) {
			var prop = this._parent.get_propertyChain();
			prop.lastTarget(this._parent.get_target()).meta.addPropertyValidated(prop.get_name(), handler);
		}
	}
	ExoWeb.View.OptionAdapter = OptionAdapter;
	OptionAdapter.registerClass("ExoWeb.View.OptionAdapter");
})();
