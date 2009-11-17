
Function.prototype.mixin = function(methods) {
	for (var m in methods)
		this.prototype[m] = methods[m];
}


Type.registerNamespace("ExoWeb.Model");

(function() {
	//////////////////////////////////////////////////////////////////////////////////////
	function Functor() {
		var funcs = [];

		var f = function() {
			for (var i = 0; i < funcs.length; ++i)
				funcs[i].apply(this, arguments);
		};

		f._funcs = funcs;
		f.add = Functor.add;
		f.remove = Functor.remove;

		return f;
	}

	Functor.add = function() {
		for (var i = 0; i < arguments.length; ++i) {
			var f = arguments[i];

			if (f == null)
				continue;

			this._funcs.push(f);
		}
	}

	Functor.remove = function(old) {
		for (var i = this._funcs.length - 1; i >= 0; --i) {
			if (this._funcs[i] === old) {
				this._funcs.splice(i, 1);
				break;
			}
		}
	}

	Functor.eventing = {
		_addEvent: function(name, func) {
			if (!this["_" + name])
				this["_" + name] = new Functor();

			this["_" + name].add(func);
		},
		_removeEvent: function(name, func) {
			var handler = this["_" + name];
			if (handler)
				handler.remove(func);
		},
		_raiseEvent: function(name, argsArray) {
			var handler = this["_" + name];
			if (handler)
				handler.apply(this, argsArray);
		}
	};

	//////////////////////////////////////////////////////////////////////////////////////
	function Model() {
		this._types = {};

		this._validatedQueue = new EventQueue(
					function(e) {
						e.sender._raisePropertyValidated(e.property);
					},
					function(a, b) {
						return a.sender == b.sender && a.property == b.property;
					}
				);
	}

	Model.prototype = {
		addType: function(name, baseClass, properties) {
			var jstype = window[name];

			var type; // referenced in constructor

			if (!jstype) {
				window[name] = jstype = function(id) {

					if (id) {
						var obj = type.get(id);

						if (obj)
							return obj;
					}

					type.register(this, id);
				};
			}

			// TODO: make this a method that uses the pool?
			jstype.All = [];

			if (baseClass) {
				if (typeof (baseClass) == "string")
					baseClass = window[baseClass];
			}
			else {
				baseClass = ObjectBase;
			}

			jstype.prototype = new baseClass();

			var formats = function() { }
			formats.prototype = baseClass.formats;
			jstype.formats = new formats;

			type = new Type(this, jstype, name, properties);

			jstype.meta = type;

			this._types[name] = type;

			return type;
		},
		get_validatedQueue: function() {
			return this._validatedQueue;
		},
		get_type: function(name) {
			return this._types[name];
		},
		addAfterPropertySet: function(handler) {
			this._addEvent("afterPropertySet", handler);
		},
		notifyAfterPropertySet: function(obj, property, newVal, oldVal) {
			this._raiseEvent("afterPropertySet", [obj, property, newVal, oldVal]);
		},
		addBeforePropertyGet: function(func) {
			this._addEvent("beforePropertySet", func);
		},
		notifyBeforePropertyGet: function(obj, property) {
			this._raiseEvent("beforePropertySet", [obj, property]);
		},
		addObjectRegistered: function(func) {
			this._addEvent("objectRegistered", func);
		},
		notifyObjectRegistered: function(obj) {
			this._raiseEvent("objectRegistered", [obj]);
		},
		addObjectUnregistered: function(func) {
			this._addEvent("objectUnregistered", func);
		},
		notifyObjectUnregistered: function(obj) {
			this._raiseEvent("objectUnregistered", [obj]);
		}
	}
	Model.mixin(Functor.eventing);

	ExoWeb.Model.Model = Model;
	Model.registerClass("ExoWeb.Model.Model");

	//////////////////////////////////////////////////////////////////////////////////////
	function ObjectBase() {
	}

	ObjectBase.prototype = {
		destroy: function() {
			this.meta.get_type().unregister(this);
		}
	}

	ObjectBase.formats = {
		$value: new Format({
			convert: function(obj) {
				return $format("{type}|{id}", { type: obj.meta.type.get_fullName(), id: obj.meta.id });
			},
			convertBack: function(str) {
				var ids = str.split("|");
				var ctor = window[ids[0]];
				return new ctor(ids[1]);
			}
		})
	}


	//////////////////////////////////////////////////////////////////////////////////////
	function Type(model, jstype, fullName, properties) {
		this._rules = [];
		this._jstype = jstype;
		this._fullName = fullName;
		this._pool = {};
		this._counter = 0;
		this._properties = {};
		this._model = model;

		this.define(properties);
	}

	Type.prototype = {
		newId: function() {
			return "?" + this._counter++;
		},

		register: function(obj, id) {
			obj.meta = new ObjectMeta(this, obj);

			for (var prop in this._properties)
				obj[prop] = null;

			if (!id) {
				id = this.newId();
				obj.meta.isNew = true;
			}

			obj.meta.id = id;

			Sys.Observer.makeObservable(obj);

			this._pool[id] = obj;

			this._model.notifyObjectRegistered(obj);
		},

		unregister: function(obj) {
			this._model.notifyObjectUnregistered(obj);
			delete this._pool[obj.meta.id];
			delete obj.meta._obj;
			delete obj.meta;
		},

		get: function(id) {
			return this._pool[id];
		},

		define: function(properties) {
			for (var propName in properties)
				this.addProperty(propName, properties[propName]);
		},

		addProperty: function(propName, def) {
			var prop = new Property(propName, def.type, def.label, def.format ? window[def.type].formats[def.format] : null, def.allowed, def.isList);
			prop.set_containingType(this);

			this._properties[propName] = prop;

			// modify jstype to include functionality based on the type definition
			this._jstype["$" + propName] = prop;

			// add members to all instances of this type
			this._jstype.prototype["$" + propName] = prop;
			this._jstype.prototype["get_" + propName] = this._makeGetter(prop, prop.getter);
			this._jstype.prototype["set_" + propName] = this._makeSetter(prop, prop.setter);
		},

		_makeGetter: function(receiver, fn) {
			return function() {
				return fn.call(receiver, this);
			}
		},

		_makeSetter: function(receiver, fn) {
			return function(val) {
				fn.call(receiver, this, val);
			}
		},

		get_model: function() {
			return this._model;
		},

		get_fullName: function() {
			return this._fullName;
		},

		get_jstype: function() {
			return this._jstype;
		},

		property: function(name) {
			var p = (name.indexOf(".") >= 0) ? name.substring(0, name.indexOf(".")) : name;

			var prop = this._properties[p];

			if (prop) {
				var prop = new PropertyChain(prop);

				// evaluate the remainder of the property path
				if (name.indexOf(".") >= 0) {
					var remainder = name.substring(name.indexOf(".") + 1);
					var propType = prop.last().get_typeName();
					var type = this._model.get_type(propType);

					var children = type.property(remainder);
					if (children)
						prop.append(children);
					else {
						// if finding a child property failed then return null
						// TODO: should this be more lax and burden consuming 
						// code with checking the property chain for nulls?
						prop = null;
					}
				}
			}

			return prop;
		},

		rule: function(inputs, func, async, issues) {
			var rule = new Rule(async, func);

			for (var i = 0; i < inputs.length; ++i) {
				var propName = inputs[i].get_name();
				var rules = this._rules[propName];

				if (!rules) {
					rules = [rule];
					this._rules[propName] = rules;
				}
				else
					rules.push(rule);
			}

			if (issues)
				for (var i = 0; i < issues.length; ++i)
				issues[i].set_origin(rule);
		},

		constraint: function(condition, issueDesc) {
			var type = this;
			var issueProps = [];

			// update description and discover the properties the issue should be bound to
			issueDesc = issueDesc.replace(/\$([a-z0-9_]+)/ig,
						function(s, propName) {
							var prop = type.property(propName);

							// TODO: is using last appropriate for multi-hop?
							if ($.inArray(prop.last(), issueProps) < 0)
								issueProps.push(prop.last());

							return prop.last().get_label();
						}
					);

			var inputProps = Rule.inferInputs(this, condition);

			var err = new RuleIssue(issueDesc, issueProps);

			type.rule(
						inputProps,
						function(obj) {
							obj.meta.issueIf(err, !condition.apply(obj));
						},
						false,
						[err]);

			return this;
		},

		// Executes all rules that have a particular property as input
		executeRules: function(obj, prop, start) {
			var i = (start ? start : 0);
			var processing;

			var rules = this._rules[prop];

			if (rules) {
				while (processing = (i < rules.length)) {
					var rule = rules[i];
					if (!rule._isExecuting) {
						rule._isExecuting = true;

						if (rule.isAsync) {
							// run rule asynchronously, and then pickup running next rules afterwards
							var _this = this;
							rule.execute(obj, function(obj) {
								rule._isExecuting = false;
								_this.executeRules(obj, prop, i + 1);
							});
							break;
						}
						else {
							try {
								rule.execute(obj);
							}
							finally {
								rule._isExecuting = false;
							}
						}
					}

					++i;
				}
			}

			if (!processing)
				this._model.get_validatedQueue().raise();
		}
	}
	ExoWeb.Model.Type = Type;
	Type.registerClass("ExoWeb.Model.Type");

	///////////////////////////////////////////////////////////////////////////////
	ExoWeb.Model.TypeClass = TypeClass = { Intrinsic: "intrinsic", Entity: "entity", EntityList: "entitylist" }


	//////////////////////////////////////////////////////////////////////////////////////
	function Property(name, dataType, label, format, allowedValues, isList) {
		this._name = name;
		this._fullTypeName = dataType;
		this._label = label;
		this._format = format;
		this._allowedValues = allowedValues;
		this._isList = (isList ? true : false);
	}

	Property.prototype = {

		toString: function() {
			return this.get_label();
		},

		set_containingType: function(type) {
			this._containingType = type;
		},

		get_containingType: function() {
			return this._containingType;
		},

		get_fullTypeName: function() {
			return this._fullTypeName;
		},

		get_typeName: function() {
			if (!this._typeName) {
				this._typeName = this._fullTypeName;

				if (this._typeName.indexOf("|") >= 0)
					this._typeName = this._typeName.split("|")[1];
			}

			return this._typeName;
		},

		get_typeClass: function() {
			if (!this._typeClass) {
				if (this.get_dataType().meta) {
					if (this.get_isList())
						this._typeClass = TypeClass.EntityList;
					else
						this._typeClass = TypeClass.Entity;
				}
				else {
					this._typeClass = TypeClass.Intrinsic;
				}
			}

			return this._typeClass;
		},

		get_dataType: function() {
			if (!this._dataType) {
				var dt = this._fullTypeName.indexOf("|") > 0 ? this._fullTypeName.split("|")[1] : this._fullTypeName;

				if (window[dt])
					this._dataType = window[dt];
				else if (dt == "Integer" || dt == "Float")
					this._dataType = Number;
				else {
					this._dataType = $format("Unknown data type \"{dt}\".", { dt: dt });
					throw (this._dataType);
				}
			}

			return this._dataType;
		},

		get_allowedValues: function() {
			return this._allowedValues;
		},

		get_format: function() {
			return this._format;
		},

		getter: function(obj) {
			this._containingType.get_model().notifyBeforePropertyGet(obj, this);
			return obj[this._name];
		},

		setter: function(obj, val) {
			var old = obj[this._name];

			if (old !== val) {
				obj[this._name] = val;
				this._containingType.get_model().notifyAfterPropertySet(obj, this, val, old);
			}
		},

		get_isList: function() {
			return this._isList;
		},

		get_label: function() {
			if (this._label)
				return this._label;

			return this._name;
		},

		get_name: function() {
			return this._name;
		},

		get_uniqueName: function() {
			return this._containingType.get_fullName() + "$" + this._name;
		},

		label: function(val) {
			this._label = val;
			return this;
		},

		value: function(obj, val) {
			if (arguments.length == 2) {
				Sys.Observer.setValue(obj, this._name, val);
				return val;
			}
			else
				return obj[this._name];
		}
	}
	ExoWeb.Model.Property = Property;
	Property.registerClass("ExoWeb.Model.Property");

	//////////////////////////////////////////////////////////////////////////////////////
	function ObjectMeta(type, obj) {
		this._obj = obj;
		this.type = type;
		this._issues = [];
		this._propertyIssues = {};

		// watch for changes to object's state
		Sys.Observer.makeObservable(obj);
		Sys.Observer.addPropertyChanged(obj, this._propertyChanged);
	}

	ObjectMeta.prototype = {
		_propertyChanged: function(sender, e) {
			var propName = e.get_propertyName();
			sender.meta.executeRules(propName);
		},

		executeRules: function(propName) {
			this.type.get_model().get_validatedQueue().push({ sender: this, property: propName });
			this._raisePropertyValidating(propName);
			this.type.executeRules(this, propName);
		},

		property: function(propName) {
			return this.type.property(propName);
		},
		clearIssues: function(origin) {
			var issues = this._issues;

			for (var i = issues.length - 1; i >= 0; --i) {
				var issue = issues[i];

				if (issue.get_origin() == origin) {
					this._removeIssue(i);
					this._queuePropertiesValidated(issue.get_properties());
				}
			}
		},

		issueIf: function(issue, condition) {
			// always remove and re-add the issue to preserve order
			var idx = $.inArray(issue, this._issues);

			if (idx >= 0)
				this._removeIssue(idx);

			if (condition)
				this._addIssue(issue);

			if ((idx < 0 && condition) || (idx >= 0 && !condition))
				this._queuePropertiesValidated(issue.get_properties());
		},

		_addIssue: function(issue) {
			this._issues.push(issue);

			// update _propertyIssues
			var props = issue.get_properties();
			for (var i = 0; i < props.length; ++i) {
				var propName = props[i].get_name();
				var pi = this._propertyIssues[propName];

				if (!pi) {
					pi = [];
					this._propertyIssues[propName] = pi;
				}

				pi.push(issue);
			}
		},

		_removeIssue: function(idx) {
			var issue = this._issues[idx];
			this._issues.splice(idx, 1);

			// update _propertyIssues
			var props = issue.get_properties();
			for (var i = 0; i < props.length; ++i) {
				var propName = props[i].get_name();
				var pi = this._propertyIssues[propName];

				var piIdx = $.inArray(issue, pi);
				pi.splice(piIdx, 1);
			}
		},

		issues: function(prop) {
			if (!prop)
				return this._issues;

			var ret = [];

			for (var i = 0; i < this._issues.length; ++i) {
				var issue = this._issues[i];
				var props = issue.get_properties();

				for (var p = 0; p < props.length; ++p) {
					if (props[p] == prop) {
						ret.push(issue);
						break;
					}
				}
			}

			return ret;
		},

		_queuePropertiesValidated: function(properties) {
			var queue = this.type.get_model().get_validatedQueue();

			for (var i = 0; i < properties.length; ++i)
				queue.push({ sender: this, property: properties[i].get_name() });
		},
		_raisePropertyValidated: function(propName) {
			var issues = this._propertyIssues[propName];
			this._raiseEvent("propertyValidated:" + propName, [this, issues ? issues : []])
		},
		addPropertyValidated: function(propName, handler) {
			this._addEvent("propertyValidated:" + propName, handler);
		},
		_raisePropertyValidating: function(propName) {
			this._raiseEvent("propertyValidating:" + propName)
		},
		addPropertyValidating: function(propName, handler) {
			this._addEvent("propertyValidating:" + propName, handler);
		}
	}
	ObjectMeta.mixin(Functor.eventing);
	ExoWeb.Model.ObjectMeta = ObjectMeta;
	ObjectMeta.registerClass("ExoWeb.Model.ObjectMeta");

	//////////////////////////////////////////////////////////////////////////////////////
	function Rule(isAsync, code) {
		this.isAsync = isAsync;
		this._code = code;
	}

	Rule.inferInputs = function(rootType, func) {
		var inputs = [];
		var match;

		while (match = /this\.([a-zA-Z0-9_]+)/g.exec(func.toString())) {
			// TODO: is using last appropriate for multi-hops?
			inputs.push(rootType.property(match[1]).last());
		}

		return inputs;
	}

	Rule.prototype = {
		execute: function(obj, callback) {
			if (!this.isAsync)
				this._code(obj);
			else
				this._code(obj, callback);
		},

		asyncRule: function(func, issues) {
			this._containingType.rule([this], func, true, issues);
			return this;
		},

		rule: function(func, issues) {
			this._containingType.rule([this], func, false, issues);
			return this;
		},

		calculated: function(func) {
			var prop = this;

			var inputs = Rule.inferInputs(this._containingType, func);

			this._containingType.rule(
						inputs,
						function(obj) {
							Sys.Observer.setValue(obj, prop._name, func.apply(obj));
						},
						false
					);

			return this;
		},

		range: function(min, max) {
			var prop = this;
			var err = null;
			var fn = null;

			var hasMin = (typeof (min) != "undefined" && min != null);
			var hasMax = (typeof (max) != "undefined" && max != null);

			if (hasMin && hasMax) {
				err = new RuleIssue(prop.get_label() + " must be between " + min + " and " + max, [prop]);
				fn = function(obj) {
					var val = prop.value(obj);
					obj.meta.issueIf(err, val < min || val > max);
				}
			}
			else if (hasMin) {
				err = new RuleIssue(prop.get_label() + " must be at least " + min, [prop]);
				fn = function(obj) {
					var val = prop.value(obj);
					obj.meta.issueIf(err, val < min);
				}
			}
			else if (hasMax) {
				err = new RuleIssue(prop.get_label() + " must no more than " + max, [prop]);
				fn = function(obj) {
					var val = prop.value(obj);
					obj.meta.issueIf(err, val > max);
				}
			}

			return fn ? prop.rule(fn, [err]) : this;
		},

		required: function() {
			var prop = this;
			var err = new RuleIssue(prop.get_label() + " is required", [prop]);

			return prop.rule(function(obj) {
				var val = prop.value(obj);
				obj.meta.issueIf(err, val == null || (String.trim(val.toString()) == ""));
			},
		[err]);
		},

		length: function(maxChars) {
			var prop = this;
			var err = new RuleIssue(prop.get_label() + " must be " + maxChars + " characters or less", [prop]);

			return prop.rule(function(obj) {
				var val = prop.value(obj);
				obj.meta.issueIf(err, String.trim(val.toString()).length > maxChars);
			},
		[err]);
		},

		format: function(pattern, description) {
			var prop = this;
			var err = new RuleIssue(prop.get_label() + " must be formatted as " + description, [prop]);

			return prop.rule(function(obj) {
				var val = prop.value(obj);
				obj.meta.issueIf(err, !pattern.test(val));
			},
				[err]);
		},

		phone: function(description) {
			return this.format(/^[0-9]{3}-[0-9]{3}-[0-9]{4}$/, description ? description : "###-###-####");
		},

		get_fromString: function() {
			var _this = this;
			return function(str) {
				if (_this._converter && _this._converter.fromString)
					return _this._converter.fromString(str);

				return null;
			}
		},

		serverRules: function(errorProbability) {
			var prop = this;
			var randomErr = new RuleIssue("p=" + errorProbability, [prop]);

			return this.asyncRule(function(obj, callback) {
				// remove all current server issues
				obj.meta.clearIssues(this);

				if (obj.meta.issues(prop).length > 0) {
					// if there are already issues with this property then do nothing
					callback();
				}
				else {
					// callback when complete
					window.setTimeout(function() {
						obj.meta.issueIf(randomErr, Math.random() < errorProbability);
						callback();
					}, 1000);  // simulate server call
				}
			},
					[randomErr]);
		}
	}
	ExoWeb.Model.Rule = Rule;
	Rule.registerClass("ExoWeb.Model.Rule");

	//////////////////////////////////////////////////////////////////////////////////////
	function EventQueue(raise, areEqual) {
		this._queue = [];
		this._raise = raise;
		this._areEqual = areEqual;
	}

	EventQueue.prototype = {
		push: function(item) {
			// don't double queue items...
			if (this._areEqual) {
				for (var i = 0; i < this._queue.length; ++i) {
					if (this._areEqual(item, this._queue[i]))
						return;
				}
			}

			this._queue.push(item);
		},

		raise: function() {
			try {
				for (var i = 0; i < this._queue.length; ++i)
					this._raise(this._queue[i]);
			}
			finally {
				if (this._queue.length > 0)
					this._queue = [];
			}
		}
	}

	//////////////////////////////////////////////////////////////////////////////////////
	function RuleIssue(message, relatedProperties, origin) {
		this._properties = relatedProperties || [];
		this._message = message;
		this._origin = origin;
	}

	RuleIssue.prototype = {
		get_properties: function() {
			return this._properties;
		},
		get_message: function() {
			return this._message;
		},
		get_origin: function() {
			return this._origin;
		},
		set_origin: function(origin) {
			this._origin = origin;
		},
		equals: function(o) {
			return o.property.equals(this.property) && o._message.equals(this._message);
		}
	}
	ExoWeb.Model.RuleIssue = RuleIssue;
	RuleIssue.registerClass("ExoWeb.Model.RuleIssue");

	//////////////////////////////////////////////////////////////////////////////////////
	function FormatIssue(message, invalidValue) {
		this._message = message;
		this._invalidValue = invalidValue;
	}

	FormatIssue.prototype = {
		get_message: function() {
			return this._message;
		},
		toString: function() {
			return this._invalidValue;
		},
		get_invalidValue: function() {
			return this._invalidValue;
		}
	}
	ExoWeb.Model.FormatIssue = FormatIssue;
	FormatIssue.registerClass("ExoWeb.Model.FormatIssue");

	//////////////////////////////////////////////////////////////////////////////////////
	function Format(options) {
		this._convert = options.convert;
		this._convertBack = options.convertBack;
		this._description = options.description;
	}

	Format.mixin({
		convert: function(val) {
			if (typeof (val) == "undefined" || val == null)
				return "";

			if (val instanceof FormatIssue)
				return val.get_invalidValue();

			if (!this._convert)
				return val;

			return this._convert(val);
		},
		convertBack: function(str) {
			if (!str)
				return null;

			str = $.trim(str);

			if (str.length == 0)
				return null;

			if (!this._convertBack)
				return str;

			try {
				return this._convertBack(str);
			}
			catch (err) {
				return new FormatIssue(this._description ?
							"{value} must be formatted as " + this._description :
							"{value} is not properly formatted",
							str);
			}
		}
	});

	ExoWeb.Model.Format = Format;
	Format.registerClass("ExoWeb.Model.Format");

	//////////////////////////////////////////////////////////////////////////////////////
	// MS Ajax extensions

	// Get's an DOM element's bindings
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
			target.__propertyChangeHandlers[property] = func = Functor();

		func.add(handler);
	};

	//////////////////////////////////////////////////////////////////////////////////////
	// utilities			
	Date.prototype.subtract = function(d) {
		var diff = this - d;

		var milliseconds = Math.floor(diff % 1000);
		diff = diff / 1000;
		var seconds = Math.floor(diff % 60);
		diff = diff / 60;
		var minutes = Math.floor(diff % 60);
		diff = diff / 60;
		var hours = Math.floor(diff % 24);
		diff = diff / 24;
		var days = Math.floor(diff);

		return { days: days, hours: hours, minutes: minutes, seconds: seconds, milliseconds: milliseconds };
	}

	function getAdapter(component, targetProperty, templateContext, properties) {

		var path = properties.path || properties.$default;

		var source = templateContext.dataItem;
		var target = templateContext.dataItem;

		if (templateContext.dataItem instanceof Adapter) {
			target = source.property().target();
			source = source.get_value();

			// TODO: what if the binding expression is "value"?
			if (path.indexOf("value.") == 0)
				path = path.substring(6);
		}

		var props = source.meta.property(path);
		if (!props)
			throw ($format("Property \"{p}\" could not be found.", { p: path }));

		if (templateContext.dataItem instanceof Adapter) {
			props.prepend(templateContext.dataItem.property());
		}

		var dt = props.last().get_dataType();

		var valueFormat;
		if (properties.valueFormat)
			valueFormat = dt.formats[properties.valueFormat];
		else if (!(valueFormat = props.last().get_format()))
			valueFormat = dt.formats.$value || dt.formats.$label;

		var labelFormat;
		if (properties.labelFormat)
			labelFormat = dt.formats[properties.labelFormat];
		else if (!(labelFormat = props.last().get_format()))
			labelFormat = dt.formats.$label || dt.formats.$value;

		delete properties.$default;

		return new Adapter(target, props, valueFormat, labelFormat, properties);
	}

	// Markup Extensions
	//////////////////////////////////////////////////////////////////////////////////////
	Sys.Application.registerMarkupExtension("@", getAdapter, true);
	Sys.Application.registerMarkupExtension("@=",
		function(component, targetProperty, templateContext, properties) {
			var adapter = getAdapter(component, targetProperty, templateContext, properties);

			var options = {
				source: adapter,
				path: "value",
				templateContext: templateContext,
				target: component,
				targetProperty: targetProperty
			};

			var binding = Sys.Binding.bind(options);
			templateContext.components.push(binding);
		},
		false
	);

	// Type Format Strings
	/////////////////////////////////////////////////////////////////////////////////////////////////////////

	Number.formats = {};
	String.formats = {};
	Date.formats = {};
	Boolean.formats = {};

	//TODO: number formatting include commas
	Number.formats.Integer = new Format({
		description: "#,###",
		convert: function(val) {
			return Math.round(val).toString();
		},
		convertBack: function(str) {
			if (!/^([-\+])?(\d+)?\,?(\d+)?\,?(\d+)?\,?(\d+)$/.test(str))
				throw "invalid format";

			return parseInt(str, 10);
		}
	});

	Number.formats.Float = new Format({
		description: "#,###.#",
		convert: function(val) {
			return val.toString();
		},
		convertBack: function(str) {
			return parseFloat(str);
		}
	});

	Number.formats.$value = Number.formats.Float;

	String.formats.Phone = new Format({
		description: "###-###-####",
		convertBack: function(str) {
			if (!/^[0-9]{3}-[0-9]{3}-[0-9]{4}$/.test(str))
				throw "invalid format";

			return str;
		}
	});

	String.formats.$value = new Format({});

	Boolean.formats.YesNo = new Format({
		convert: function(val) { return val ? "yes" : "no"; },
		convertBack: function(str) { return str == "yes"; }
	});

	Boolean.formats.TrueFalse = new Format({
		convert: function(val) { return val ? "true" : "false"; },
		convertBack: function(str) { return (str.toLowerCase() == "true"); }
	});

	Boolean.formats.$value = Boolean.formats.TrueFalse;

	Date.formats.ShortDate = new Format({
		description: "mm/dd/yyyy",
		convert: function(val) {
			return val.format("MM/dd/yyyy");
		},
		convertBack: function(str) {
			var val = Date.parseInvariant(str);

			if (val != null)
				return val;

			throw "invalid date";
		}
	});

	Date.formats.$value = Date.formats.ShortDate;


	///////////////////////////////////////////////////////////////////////////////
	/// <summary>
	/// Encapsulates the logic required to work with a chain of properties and
	/// a root object, allowing interaction with the chain as if it were a 
	/// single property of the root object.
	/// </summary>
	///
	/// <example>
	///
	/// var driver = new Driver("1");
	/// var chain = driver.meta.type.property("Owner.Location.Address");
	///
	/// // the "Address" portion of the property
	/// var addressProp = chain.last();
	/// // the Address object
	/// var address = chain.value(driver);
	/// // the owner's locations for the given driver
	/// var loc = chain.parent(driver);
	///
	/// var stateAbbrevProp = address.meta.type.property("State.Abbreviation");
	/// // returns a state abbreviation, like "NY"
	/// var abbrev1 = stateAbbrevProp.value(address);
	/// // extend the original property
	/// chain.append(stateAbbrevProp);
	/// // returns the same state abbreviation as above
	/// var abbrev2 = chain.value(driver);
	///
	/// </example>
	///////////////////////////////////////////////////////////////////////////////
	function PropertyChain(properties) {
		this._properties = properties.length ? properties : [properties];

		if (this._properties.length == 0)
			throw ("PropertyChain cannot be zero-length.");
	}

	PropertyChain.prototype = {
		parent: function(obj) {
			for (var p = 0; p < this._properties.length - 1; p++) {
				var prop = this._properties[p];
				obj = prop.value(obj);
			}
			return obj;
		},
		first: function() {
			return this._properties[0];
		},
		last: function() {
			return this._properties[this._properties.length - 1];
		},
		all: function() {
			return this._properties;
		},
		fullName: function() {
			var fullName = "";
			for (var p = 0; p < this._properties.length; p++) {
				var prop = this._properties[p];
				fullName += (fullName.length > 0 ? "." : "") + prop.get_name();
			}
			return fullName;
		},
		each: function(obj, callback) {
			if (!callback || typeof (callback) != "function")
				throw ("Invalid Parameter: callback function");

			if (!obj)
				throw ("Invalid Parameter: source object");

			for (var p = 0; p < this._properties.length; p++) {
				var prop = this._properties[p];
				callback(obj, prop);
				obj = prop.value(obj);
			}
		},
		append: function(prop) {
			Array.addRange(this._properties, prop.all());
		},
		prepend: function(prop) {
			var newProps = prop.all();
			for (var p = newProps.length - 1; p >= 0; p--) {
				Array.insert(this._properties, 0, newProps[p]);
			}
		},
		value: function(obj, val) {
			if (arguments.length == 2) {
				obj = this.parent(obj);

				Sys.Observer.setValue(obj, this.last().get_name(), val);
			}
			else {
				for (var p = 0; p < this._properties.length; p++) {
					var prop = this._properties[p];
					obj = prop.value(obj);
				}
				return obj;
			}
		}
	}
	ExoWeb.Model.PropertyChain = PropertyChain;
	PropertyChain.registerClass("ExoWeb.Model.PropertyChain");


	///////////////////////////////////////////////////////////////////////////////
	function PropertyAdapter(target, propertyChain) {
		this._target = target;
		this._properties = propertyChain;
	}

	PropertyAdapter.prototype = {
		addChanged: function(handler) {
			this.each(function(obj, prop) {
				if (prop.get_typeClass() == "entitylist")
					Sys.Observer.addCollectionChanged(prop.value(obj), handler);
				else
					Sys.Observer.addSpecificPropertyChanged(obj, prop.get_name(), handler);
			});
		},
		all: function() {
			return this._properties.all();
		},
		each: function(callback) {
			this._properties.each(this._target, callback);
		},
		target: function() {
			return this._target;
		},
		parent: function() {
			return this._properties.parent(this._target);
		},
		properties: function() {
			return this._properties;
		},
		last: function() {
			return this._properties.last();
		},
		value: function(val) {
			if (arguments.length == 0) {
				return this._properties.value(this._target);
			}
			else {
				this._properties.value(this._target, val);
			}
		},

		// TODO:  How to handle pass-through?  Set up in constructor?
		get_containingType: function() {
			return this.last().get_containingType();
		},
		get_name: function() {
			return this.last().get_name();
		},
		get_label: function() {
			return this.last().get_label();
		},
		get_typeClass: function() {
			return this.last().get_typeClass();
		},
		get_allowedValues: function() {
			return this.last().get_allowedValues();
		}
	}
	ExoWeb.Model.PropertyAdapter = PropertyAdapter;
	PropertyAdapter.registerClass("ExoWeb.Model.PropertyAdapter");

	///////////////////////////////////////////////////////////////////////////////
	function Adapter(target, propertyChain, valueFormat, labelFormat, options) {
		this._property = new PropertyAdapter(target, propertyChain);
		this._valueFormat = valueFormat;
		this._labelFormat = labelFormat;
		this._ignoreTargetEvents = false;

		// Add arbitrary options so that they are made available in templates
		var allowedOverrides = ["label", "helptext"];
		if (options) {
			for (var opt in options) {

				// Check if the option is already defined and is not available to
				// override, as in the case of critical properties (e.g.: value)
				if (this["get_" + opt] && !Array.contains(allowedOverrides, opt))
				//throw ($format("{opt} is already defined.", { opt: opt }));
					continue;

				var _opt = "_" + opt;
				this[_opt] = options[opt];

				// create a getter if one doesn't exist
				if (!this["get_" + opt]) {
					var type = this._property.get_containingType();
					this["get_" + opt] = type._makeGetter(this, function() { return this[_opt]; });
				}
			}
		}

		var _this = this;
		Sys.Observer.makeObservable(this);
		// subscribe to property changes at any point in the path
		this._property.addChanged(function(sender, args) {
			_this._onTargetChanged(sender, args);
		});

		var allowed = this._property.get_allowedValues();
		if (allowed && allowed.length > 0) {
			var root = this._property.parent();
			var props = root.meta.property(allowed);
			if (props) {
				props = new PropertyAdapter(root, props);
				props.addChanged(function(sender, args) {
					_this._onTargetChanged(sender, args);
				});
			}
		}
	}

	Adapter.prototype = {
		property: function() {
			return this._property;
		},

		// Pass property change events to the target object
		///////////////////////////////////////////////////////////////////////////
		_onTargetChanged: function(sender, args) {
			if (this._ignoreTargetEvents)
				return;

			Sys.Observer.raisePropertyChanged(this, "value");
		},

		// Properties that are intended to be used by templates
		///////////////////////////////////////////////////////////////////////////
		get_label: function() {
			return this._label || this._property.get_label();
		},
		get_helptext: function() {
			return this._helptext || "";
		},
		get_emptyOptionLabel: function() {
			return this._emptyOptionLabel ? this._emptyOptionLabel : " -- select -- ";
		},
		set_emptyOptionLabel: function(value) {
			this._emptyOptionLabel = value;
		},
		get_options: function() {
			if (!this._options) {
				if (this._property.get_typeClass() == TypeClass.Intrinsic)
					return null;

				// TODO: handle allowed values in multiple forms (function, websvc call, string path)
				var allowed = null;
				var path = this._property.get_allowedValues();
				if (path && path.length > 0) {
					var root = this._property.parent();
					var props = root.meta.property(path);

					if (props) {
						// get the allowed values from the property chain
						root = props.value(root);
					}
					else {
						// if the property is not defined look for a global object by that name
						var root = window;
						var names = path.split(".");
						for (var n = 0; root && n < names.length; n++)
							root = root[names[n]];
					}

					// TODO: verify list?
					if (!root) {
						this._options = $format("Allowed values property \"{p}\" could not be found.", { p: path });
						throw (this._options);
					}

					allowed = root;
				}

				if (this._property.get_typeClass() == TypeClass.Entity) {
					this._options = [];

					this._options[0] = new OptionAdapter(this, null);

					for (var a = 0; a < allowed.length; a++)
						Array.add(this._options, new OptionAdapter(this, allowed[a]));
				}
				else if (this._property.get_typeClass() == TypeClass.EntityList) {
					this._options = [];

					for (var a = 0; a < allowed.length; a++)
						this._options[a] = new OptionAdapter(this, allowed[a]);
				}
			}

			return this._options;
		},
		get_badValue: function() {
			return this._badValue;
		},
		get_valueFormat: function() {
			return this._valueFormat;
		},
		get_labelFormat: function() {
			return this._labelFormat;
		},
		get_rawValue: function() {
			return this._property.value();
		},
		get_value: function() {
			if (typeof (this._badValue) !== "undefined")
				return this._badValue;

			var rawValue = this.get_rawValue();

			return (this._valueFormat) ? this._valueFormat.convert(rawValue) : rawValue;
		},
		set_value: function(value) {
			var converted = (this._valueFormat) ? this._valueFormat.convertBack(value) : value;

			this._property.parent().meta.clearIssues(this);

			if (converted instanceof FormatIssue) {
				this._badValue = value;

				issue = new RuleIssue(
							$format(converted.get_message(), { value: this._property.get_label() }),
							[this._property.last()],
							this);

				this._property.parent().meta.issueIf(issue, true);

				// run the rules to preserve the order of issues
				this._property.parent().meta.executeRules(this._property.get_name());
			}
			else {

				var changed = this._property.value() !== converted;

				if (typeof (this._badValue) !== "undefined") {
					delete this._badValue;

					// force rules to run again in order to trigger validation events
					if (!changed)
						this._property.parent().meta.executeRules(this._property.get_name());
				}

				if (changed) {
					this._ignoreTargetEvents = true;

					try {
						this._property.value(converted);
					}
					finally {
						this._ignoreTargetEvents = false;
					}
				}
			}
		},

		// Pass validation events through to the target
		///////////////////////////////////////////////////////////////////////////
		addPropertyValidating: function(propName, handler) {
			this._property.parent().meta.addPropertyValidating(this._property.get_name(), handler);
		},
		addPropertyValidated: function(propName, handler) {
			this._property.parent().meta.addPropertyValidated(this._property.get_name(), handler);
		},

		// Override toString so that UI can bind to the adapter directly
		///////////////////////////////////////////////////////////////////////////
		toString: function() {
			return this.get_value();
		}
	}
	ExoWeb.Model.Adapter = Adapter;
	Adapter.registerClass("ExoWeb.Model.Adapter");


	///////////////////////////////////////////////////////////////////////////////
	OptionAdapter = function(parent, obj) {
		this._parent = parent;
		this._obj = obj;
	}

	///////////////////////////////////////////////////////////////////////////////
	OptionAdapter.prototype = {
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


	///////////////////////////////////////////////////////////////////////////////
	// Globals
	function $format(str, values) {
		return str.replace(/{([a-z0-9_]+)}/ig, function(match, name) {
			var val = values[name];

			if (val === null)
				return "";
			if (typeof (val) == "undefined")
				return match;

			return val.toString();
		});
	}
	window.$format = $format;
})();
