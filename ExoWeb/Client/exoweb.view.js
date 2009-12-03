; (function() {
	Type.registerNamespace("ExoWeb.View");

	//////////////////////////////////////////////////////////////////////////////////////
	// MS Ajax extensions

	// Get's a DOM element's bindings
	Sys.Binding.getElementBindings = function(el) {
		return el.__msajaxbindings || [];
	};

	// Get's the last object in the source path.  Ex: Customer.Address.Street returns the Address object.
	Sys.Binding.mixin({
		get_finalSourceObject: function() {
			var src = this.get_source();

			for (var i = 0; i < this._pathArray.length - 1; ++i)
				src = src[this._pathArray[i]];

			return src;
		},
		get_finalPath: function() {
			return this._pathArray[this._pathArray.length - 1];
		}
	});

	function _raiseSpecificPropertyChanged(target, args) {
		var func = target.__propertyChangeHandlers[args.get_propertyName()];
		func(target);
	}

	// Converts observer events from being for ALL properties to a specific one.
	// This is an optimization that prevents handlers interested only in a single
	// property from being run when other, unrelated properties change.
	Sys.Observer.addSpecificPropertyChanged = function(target, property, handler) {
		if (!target.__propertyChangeHandlers) {
			target.__propertyChangeHandlers = {};

			Sys.Observer.addPropertyChanged(target, _raiseSpecificPropertyChanged);
		}

		var func = target.__propertyChangeHandlers[property];

		if (!func)
			target.__propertyChangeHandlers[property] = func = ExoWeb.Functor();

		func.add(handler);
	};

	// Sets a value
	Sys.Observer.getValue = function(target, property) {
		var getter = target["get_" + property];
		return getter ? getter.call(target) : target[property];
	}

	// Markup Extensions
	//////////////////////////////////////////////////////////////////////////////////////

	// Metadata adapter markup extension
	Sys.Application.registerMarkupExtension("@",
		function AdapterMarkupExtention(component, targetProperty, templateContext, properties) {
			console.log("@ " + (properties.$default || "(no path)"));

			var path = properties.path || properties.$default;
			delete properties.$default;

			var adapter = new Adapter(templateContext, path, properties.valueFormat, properties.labelFormat, properties);

			adapter.ready(function AdapterReady() {
				Sys.Observer.setValue(component, targetProperty, adapter);
			});
		}, false);

	// Lazy eval markup extension
	Sys.Application.registerMarkupExtension("~",
		function LazyMarkupExtension(component, targetProperty, templateContext, properties) {
			console.log("~ " + (properties.$default || "(no path)"));

			ExoWeb.Model.LazyLoader.eval(templateContext.dataItem, properties.$default,
				function(result) {
					if (properties.format && result.constructor.formats && result.constructor.formats[properties.format])
						result = result.constructor.formats[properties.format].convert(result);

					Sys.Observer.setValue(component, targetProperty, result);
				},
				function(err) {
					console.error(err);
				}
			);
		},
		false
	);


	///////////////////////////////////////////////////////////////////////////////
	function Adapter(context, propertyPath, valueFormatName, labelFormatName, options) {
		this._context = context;
		this._propertyPath = propertyPath;
		this._valueFormatName = valueFormatName;
		this._labelFormatName = labelFormatName;
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
			if (!this._target) {
				if (this._context instanceof ExoWeb.Model.ObjectBase)
					this._target = this._context;
				else if (this._context.dataItem instanceof Adapter)
					this._target = this._context.dataItem.property().target();
				else
					this._target = this._context.dataItem;
			}

			return this._target;
		},
		get_propertyPath: function Adapter$get_propertyPath() {
			return this._propertyPath;
		},
		get_propertyChain: function Adapter$get_propertyChain() {
			if (!this._propertyChain) {
				var adapterOrObject = this._context instanceof ExoWeb.Model.ObjectBase ? this._context : this._context.dataItem;
				var sourceObject = (adapterOrObject instanceof Adapter) ? adapterOrObject.get_value() : adapterOrObject;

				// get the property chain starting at the source object
				this._propertyChain = sourceObject.meta.property(this.get_propertyPath());
				if (!this._propertyChain)
					throw ($format("Property \"{p}\" could not be found.", { p: this.get_propertyPath() }));

				// prepend parent adapter's property path
				if (adapterOrObject instanceof Adapter)
					this._propertyChain.prepend(adapterOrObject.property());
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

			Sys.Observer.raisePropertyChanged(this, "value");
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
		get_options: function Adapter$get_options() {
			if (!this._options) {

				if (!this.get_propertyChain().get_isValueType()) {
					var prop = this.get_propertyChain().lastProperty();
					var allowed = null;
					var rule = prop.rule(ExoWeb.Model.Rule.allowedValues);
					var targetObj = this.get_propertyChain().lastTarget(this.get_target());
					if (rule) {
						allowed = rule.values(targetObj);

						this._options = [];

						if (this.get_propertyChain().get_isEntityType() && this.get_emptyOption())
							Array.add(this._options, new OptionAdapter(this, null));

						for (var a = 0; a < allowed.length; a++)
							Array.add(this._options, new OptionAdapter(this, allowed[a]));
					}
				}
			}

			return this._options;
		},
		get_badValue: function Adapter$get_badValue() {
			return this._badValue;
		},
		get_valueFormat: function Adapter$get_valueFormat() {
			if (!this._valueFormat) {
				var t = this.get_propertyChain().get_jstype();

				if (this._valueFormatName)
					this._valueFormat = t.formats[this._valueFormatName];
				else if (!(this._valueFormat = this.get_propertyChain().get_format()))
					this._valueFormat = t.formats.$value || t.formats.$label;
			}

			return this._valueFormat;
		},
		get_labelFormat: function Adapter$get_labelFormat() {
			if (!this._labelFormat) {
				var t = this.get_propertyChain().get_jstype();

				if (this._labelFormatName)
					this._labelFormat = t.formats[this._labelFormatName];
				else if (!(this._labelFormat = this.get_propertyChain().get_format()))
					this._labelFormat = t.formats.$label || t.formats.$value;
			}

			return this._labelFormat;
		},
		get_rawValue: function Adapter$get_rawValue() {
			return this.get_propertyChain().value(this.get_target());
		},
		get_value: function Adapter$get_value() {
			this.initialize();

			if (this._badValue !== undefined)
				return this._badValue;

			var rawValue = this.get_rawValue();

			var format = this.get_valueFormat();
			return format ? format.convert(rawValue) : rawValue;
		},
		set_value: function Adapter$set_value(value) {
			this.initialize();

			var converted = (this.get_valueFormat()) ? this.get_valueFormat().convertBack(value) : value;

			var prop = this.get_propertyChain();
			var meta = prop.lastTarget(this.get_target()).meta;

			meta.clearIssues(this);

			if (converted instanceof ExoWeb.Model.FormatIssue) {
				this._badValue = value;

				issue = new ExoWeb.Model.RuleIssue(
							$format(converted.get_message(), { value: prop.get_label() }),
							[prop.lastProperty()],
							this);

				meta.issueIf(issue, true);

				// Update the model with the bad value if possible
				if (prop.canSetValue(this.get_target(), value))
					prop.value(this.get_target(), value);

				// run the rules to preserve the order of issues
				meta.executeRules(prop.get_name());
			}
			else {
				var changed = prop.value(this.get_target()) !== converted;

				if (this._badValue !== undefined) {
					delete this._badValue;

					// force rules to run again in order to trigger validation events
					if (!changed)
						meta.executeRules(prop.get_name());
				}

				if (changed) {
					this._ignoreTargetEvents = true;

					try {
						prop.value(this.get_target(), converted);
					}
					finally {
						this._ignoreTargetEvents = false;
					}
				}
			}
		},

		// Pass validation events through to the target
		///////////////////////////////////////////////////////////////////////////
		addPropertyValidating: function Adapter$addPropertyValidating(propName, handler) {
			this.get_propertyChain().lastTarget(this.get_target()).meta.addPropertyValidating(this.get_propertyChain().get_name(), handler);
		},
		addPropertyValidated: function Adapter$addPropertyValidated(propName, handler) {
			this.get_propertyChain().lastTarget(this.get_target()).meta.addPropertyValidated(this.get_propertyChain().get_name(), handler);
		},

		// Override toString so that UI can bind to the adapter directly
		///////////////////////////////////////////////////////////////////////////
		toString: function Adapter$toString() {
			return this.get_value();
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
		get_label: function() {
			if (!this._obj)
				return this._parent.get_emptyOptionLabel();

			var format = this._parent.get_labelFormat();
			return format ? format.convert(this._obj) : this._obj;
		},
		get_value: function() {
			if (!this._obj)
				return "";

			var format = this._parent.get_valueFormat();
			return format ? format.convert(this._obj) : this._obj;
		},
		get_selected: function() {
			var source = this._parent.get_rawValue();

			if (source instanceof Array)
				return Array.contains(source, this._obj);
			else
				return source == this._obj;
		},
		set_selected: function(value) {
			var source = this._parent.get_rawValue();

			if (source instanceof Array) {
				if (value && !Array.contains(source, this._obj))
					source.add(this._obj);
				else if (!value && Array.contains(source, this._obj))
					source.remove(this._obj);
			}
			else {
				if (!this._obj)
					this._parent.set_value(null);
				else {
					var value = (this._parent.get_valueFormat()) ? this._parent.get_valueFormat().convert(this._obj) : this._obj;
					this._parent.set_value(value);
				}
			}
		}
	}

})();