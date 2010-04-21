; (function() {

	function execute() {
		var log = ExoWeb.trace.log;
		var throwAndLog = ExoWeb.trace.throwAndLog;

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
					var evalSource = new Function("$element", "$index", "$dataItem", "$context", "return " + properties.source + ";");
					var element = null;
					if (Sys.Component.isInstanceOfType(component)) {
						element = component.get_element();
					}
					else if (component instanceof Element) {
						element = component;
					}
					source = evalSource(element, templateContext.index, templateContext.dataItem, templateContext);

					// don't try to eval the path against window
					scopeChain = [];
				}
				else {
					source = templateContext.dataItem;
				}

				var prepareValue = null;

				var setValue = function lazy$setValue(value, msg) {
					log(["~", "markupExt"], "~ {path}, required=[{required}] (set) {message}- {value}", {
						path: (properties.$default || "(no path)"),
						required: properties.required || "",
						message: msg ? msg + " " : "",
						value: value
					});

					var finalValue = value;
					if (prepareValue && prepareValue instanceof Function) {
						finalValue = prepareValue(value);
					}

					Sys.Observer.setValue(component, properties.targetProperty || targetProperty, finalValue);
				};

				var setup = function lazy$setup(result, monitorChangesFromSource) {
					if (properties.transform && result instanceof Array) {
						// generate transform function
						var doTrans = new Function("list", "$element", "$index", "$dataItem", "return $transform(list)." + properties.transform + ";");

						// setup prepare function to perform the transform
						prepareValue = function doTransform(listValue) {
							return doTrans(listValue, component.get_element(), templateContext.index, templateContext.dataItem);
						};

						// watch for changes to the list and refresh
						var list = result;
						Sys.Observer.makeObservable(list);
						Sys.Observer.addCollectionChanged(list, function lazy$listChanged$transform(list, evt) {
							// take a count of all added and removed items
							var added = 0, removed = 0;
							Array.forEach(evt.get_changes(), function(change) {
								if (change.newItems) {
									added += change.newItems.length;
								}
								if (change.oldItems) {
									removed += change.oldItems.length;
								}
							});

							var msg = "changes to underlying list [" + added + " added, " + removed + " removed]";

							// if additional paths are required then load them before updating the value
							if (properties.required) {
								Array.forEach(evt.get_changes(), function(change) {
									ExoWeb.Model.LazyLoader.evalAll(change.newItems || [], properties.required, function() {
										setValue(result, msg);
									});
								});
							}
							// otherwise, simply update the value
							else {
								setValue(result, msg);
							}
						});
					}
					else {
						// setup prepare function to use the specified format
						prepareValue = function doFormat(obj) {
							if (properties.format && result.constructor.formats && result.constructor.formats[properties.format]) {
								return obj.constructor.formats[properties.format].convert(obj);
							}

							return obj;
						};

						if (properties.$default && monitorChangesFromSource) {
							Sys.Observer.addPathChanged(source, properties.$default, function(sender, args) {
								setValue(ExoWeb.getValue(source, properties.$default), args.get_propertyName() + " property change");
							});
						}
					}
					if (properties.required) {
						var watchItemRequiredPaths = function watchItemRequiredPaths(item) {
							if (item.meta) {
								try {
									ExoWeb.Model.Model.property("this." + properties.required, item.meta.type, true, function(chain) {
										chain.addChanged(function lazy$requiredChanged(obj, chain, val, oldVal, wasInited, triggerProperty) {
											// when a point in the required path changes then load the chain and refresh the value
											ExoWeb.Model.LazyLoader.evalAll(obj, chain.get_path(), function lazy$requiredChanged$load() {
												setValue(result, "required path property change [" + triggerProperty.get_name() + "]");
											});
										}, item);
									});
								}
								catch (e) {
									ExoWeb.trace.logError(["markupExt", "~"], e);
								}
							}
						};

						// attempt to watch changes along the required path
						var listToWatch = (result instanceof Array) ? result : [result];
						Array.forEach(listToWatch, watchItemRequiredPaths);
						Sys.Observer.makeObservable(listToWatch);
						Sys.Observer.addCollectionChanged(listToWatch, function lazy$listChanged$watchRequired(list, evt) {
							Array.forEach(evt.get_changes(), function(change) {
								Array.forEach(change.newItems || [], watchItemRequiredPaths);
							});
						});
					}
				}

				ExoWeb.Model.LazyLoader.eval(source, properties.$default,
					function lazy$Loaded(result, message) {
						log(["~", "markupExt"], "~ " + (properties.$default || "(no path)") + "  <.>");

						var init = function lazy$init(result) {
							try {
								// Load additional required paths
								if (properties.required) {
									ExoWeb.Model.LazyLoader.evalAll(result, properties.required, function() {
										setValue(result, message || "required path loaded");
									});
								}
								else {
									setValue(result, message || "no required path");
								}
							}
							catch (err) {
								throwAndLog(["~", "markupExt"], "Path '{0}' was evaluated but the '{2}' property on the target could not be set, {1}", [properties.$default, err, properties.targetProperty || targetProperty]);
							}
						}

						if (result === undefined || result === null) {
							setValue(result, "no value");

							var isSetup = false;

							Sys.Observer.addPathChanged(source, properties.$default, function(target, args) {
								ExoWeb.Model.LazyLoader.eval(source, properties.$default, function lazy$Loaded(result, message) {
									// If we now have a value, ensure initialization and set the value.
									if (result !== undefined && result !== null) {
										if (!isSetup) {
											setup(result, false);
											init(result, args.get_propertyName() + " property change");
											isSetup = true;
										}
									}

									setValue(result, args.get_propertyName() + " property change");
								});
							});
						}
						else {
							setup(result, true);
							init(result);
						}
					},
					function(err) {
						throwAndLog(["~", "markupExt"], "Couldn't evaluate path '{0}', {1}", [properties.$default, err]);
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
			this._ignoreTargetEvents = false;
			this._readySignal = new ExoWeb.Signal();

			if (options.optionsTransform) {
				this._optionsTransform = options.optionsTransform;
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
					throwAndLog(["@", "markupExt"], "Couldn't evaluate path '{0}', {1}", [propertyPath, err]);
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
					throwAndLog(["@", "markupExt"], "Property \"{p}\" could not be found.", { p: this._propertyPath });
				}

				// if the target is an adapter, prepend it's property chain
				if (this._target instanceof Adapter) {
					this._propertyChain.prepend(this._target.get_propertyChain());
					this._parentAdapter = this._target;
					this._target = this._target.get_target();
				}
			},
			_ensureObservable: function Adapter$_ensureObservable() {
				if (!this._observable) {
					Sys.Observer.makeObservable(this);

					// subscribe to property changes at all points in the path
					this._propertyChain.addChanged(this._onTargetChanged.setScope(this), this._target);

					this._observable = true;
				}
			},
			_onTargetChanged: function Adapter$_onTargetChanged() {
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
				var systemSignal = new ExoWeb.Signal("Adapter.systemValue");
				if (rawValue !== undefined && rawValue !== null) {
					Array.forEach(this.get_systemFormat().getPaths(), function(path) {
						if (rawValue instanceof Array) {
							Array.forEach(rawValue, function(val) {
								ExoWeb.Model.LazyLoader.eval(val, path, systemSignal.pending());
							});
						}
						else {
							ExoWeb.Model.LazyLoader.eval(rawValue, path, systemSignal.pending());
						}
					});
				}
				systemSignal.waitForAll(function() {
					Sys.Observer.raisePropertyChanged(_this, "systemValue");
				});

				// raise display value changed event
				var displaySignal = new ExoWeb.Signal("Adapter.displayValue");
				if (rawValue !== undefined && rawValue !== null) {
					Array.forEach(this.get_displayFormat().getPaths(), function(path) {
						if (rawValue instanceof Array) {
							Array.forEach(rawValue, function(val) {
								ExoWeb.Model.LazyLoader.eval(val, path, displaySignal.pending());
							});
						}
						else {
							ExoWeb.Model.LazyLoader.eval(rawValue, path, displaySignal.pending());
						}
					});
				}
				displaySignal.waitForAll(function() {
					Sys.Observer.raisePropertyChanged(_this, "displayValue");
				});
			},
			_reloadOptions: function Adapter$_reloadOptions() {
				this._options = null;

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

				meta.clearIssues(this);

				if (converted instanceof ExoWeb.Model.FormatIssue) {
					state.BadValue = value;

					issue = new ExoWeb.Model.RuleIssue(
								$format(converted.get_message(), { value: prop.get_label() }),
								[prop.lastProperty()],
								this);

					meta.issueIf(issue, true);

					// Update the model with the bad value if possible
					if (prop.canSetValue(this._target, value)) {
						prop.value(this._target, value);
					}
					// run the rules to preserve the order of issues
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
			ready: function Adapter$ready(callback) {
				this._readySignal.waitForAll(callback);
			},
			toString: function Adapter$toString() {
				var value = this.get_systemValue();
				return (!value || value.constructor === String) ? value : value.toString();
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
			get_allowedValues: function Adapter$get_allowedValues() {
				if (!this._allowedValues) {
					// TODO: refactor to use property chain change events?
					var prop = this._propertyChain.lastProperty();
					var rule = prop.rule(ExoWeb.Model.Rule.allowedValues);
					var targetObj = this._propertyChain.lastTarget(this._target);
					if (rule) {
						this._allowedValues = rule.values(targetObj);

						if (this._allowedValues !== undefined) {
							if (this._optionsTransform) {
								this._allowedValues = (new Function("$array", "{ return $transform($array)." + this._optionsTransform + "; }"))(this._allowedValues).live();
							}

							// watch for changes to the allowed values list and update options
							Sys.Observer.addCollectionChanged(this._allowedValues, this._reloadOptions.setScope(this));
						}
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

			// ???
			addPropertyValidating: function Adapter$addPropertyValidating(propName, handler) {
				this._propertyChain.lastTarget(this._target).meta.addPropertyValidating(this._propertyChain.get_name(), handler);
			},
			addPropertyValidated: function Adapter$addPropertyValidated(propName, handler) {
				this._propertyChain.lastTarget(this._target).meta.addPropertyValidated(this._propertyChain.get_name(), handler);
			}
		};
		ExoWeb.View.Adapter = Adapter;
		Adapter.registerClass("ExoWeb.View.Adapter");

		///////////////////////////////////////////////////////////////////////////////
		function OptionAdapter(parent, obj) {
			this._parent = parent;
			this._obj = obj;

			// watch for changes to properties of the source object and update the label
			this._ensureObservable();
		}

		OptionAdapter.prototype = {
			// Internal book-keeping and setup methods
			///////////////////////////////////////////////////////////////////////
			_ensureObservable: function OptionAdapter$_ensureObservable() {
				if (!this._observable) {
					Sys.Observer.makeObservable(this);

					// subscribe to property changes to the option's label (value shouldn't change)
					// TODO: can we make this more specific?
					Sys.Observer.addPropertyChanged(this._obj, this._onTargetChanged.setScope(this));

					this._observable = true;
				}
			},
			_onTargetChanged: function OptionAdapter$_onTargetChanged(sender, args) {
				if (this._ignoreTargetEvents) {
					return;
				}

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
				var format = this._parent.get_displayFormat();
				return format ? format.convert(this._obj) : this._obj;
			},
			get_systemValue: function OptionAdapter$get_systemValue() {
				var format = this._parent.get_systemFormat();
				return format ? format.convert(this._obj) : this._obj;
			},
			get_selected: function OptionAdapter$get_selected() {
				return this._parent.get_selected(this._obj);
			},
			set_selected: function OptionAdapter$set_selected(value) {
				this._parent.set_selected(this._obj, value);
			},

			// Pass validation events through to the target
			///////////////////////////////////////////////////////////////////////////
			addPropertyValidating: function OptionAdapter$addPropertyValidating(propName, handler) {
				var prop = this._parent.get_propertyChain();
				prop.lastTarget(this._parent._target).meta.addPropertyValidating(prop.get_name(), handler);
			},
			addPropertyValidated: function OptionAdapter$addPropertyValidated(propName, handler) {
				var prop = this._parent.get_propertyChain();
				prop.lastTarget(this._parent._target).meta.addPropertyValidated(prop.get_name(), handler);
			}
		};
		ExoWeb.View.OptionAdapter = OptionAdapter;
		OptionAdapter.registerClass("ExoWeb.View.OptionAdapter");

		(function() {
			var impl = Sys.Binding.prototype._targetChanged;
			Sys.Binding.prototype._targetChanged = function Sys$Binding$_targetChangedOverride(force) {

				// invoke the method implementation
				impl.apply(this, [force]);

				var target = this._target;

				// Set _lastTarget=false on other radio buttons in the group, since they only 
				// remember the last target that was recieved when an event fires and radio button
				// target change events fire on click (which does not account for de-selection).  
				// Otherwise, the source value is only set the first time the radio button is selected.
				if ($(target).is("input[type=radio]")) {
					$("input[type=radio][name='" + target.name + "']").each(
						function updateRadioLastTarget() {
							if (this != target) {
								var bindings = this.__msajaxbindings;
								for (var i = 0; i < bindings.length; i++) {
									bindings[i]._lastTarget = false;
								}
							}
						}
					);
				}
			};
		})();
	}

	if (window.Sys && Sys.loader) {
		Sys.loader.registerScript("ExoWebView", null, execute);
	}
	else {
		execute();
	}

})();
