Type.registerNamespace("ExoWeb.Model");

(function() {
	var undefined;

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
		addType: function Model$addType(name) {
			var jstype = window[name];

			var type;

			if (!jstype) {
				// use eval to generate the type so the function name appears in the debugger
				var ctorScript = $format("function {type}(id) {" +
					"if (id) {" +
						"var obj = type.get(id); " +
						"if (obj)" +
							"return obj;" +
					"};" +
					"type.register(this, id);" +
				"}" +
				"jstype = {type}",
				{ type: name });

				eval(ctorScript);
				window[name] = jstype;
			}
			else if (jstype.meta) {
				throw $format("Type already has been added to the model: {0}", arguments)
			}

			var formats = function() { }
			jstype.formats = new formats;

			type = new Type(this, jstype, name);

			jstype.meta = type;
			jstype.get = function(id) { return type.get(id); };

			this._types[name] = type;

			return type;
		},
		get_validatedQueue: function() {
			return this._validatedQueue;
		},
		type: function(name) {
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
		},
		addListChanged: function(func) {
			this._addEvent("listChanged", func);
		},
		notifyListChanged: function(obj, property, changes) {
			this._raiseEvent("listChanged", [obj, property, changes]);
		}
	}
	Model.mixin(ExoWeb.Functor.eventing);

	ExoWeb.Model.Model = Model;
	Model.registerClass("ExoWeb.Model.Model");

	//////////////////////////////////////////////////////////////////////////////////////
	function ObjectBase() {
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

	ExoWeb.Model.ObjectBase = ObjectBase;
	ObjectBase.registerClass("ExoWeb.Model.ObjectBase", null, Sys.Data.IDataProvider);


	//////////////////////////////////////////////////////////////////////////////////////
	function Type(model, jstype, fullName) {
		this._rules = {};
		this._jstype = jstype;
		this._fullName = fullName;
		this._pool = {};
		this._counter = 0;
		this._properties = {};
		this._model = model;

		this.derivedTypes = [];
	}

	Type.prototype = {
		newId: function() {
			return "+c" + this._counter++;
		},

		register: function(obj, id) {
			obj.meta = new ObjectMeta(this, obj);

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

		addProperty: function(propName, jstype, label, format, isList, isShared) {
			var prop = new Property(this, propName, jstype, label, format, isList, isShared);

			this._properties[propName] = prop;

			// modify jstype to include functionality based on the type definition
			//this._jstype["$" + propName] = prop;  // is this useful?

			// add members to all instances of this type
			//this._jstype.prototype["$" + propName] = prop;  // is this useful?
			this._jstype.prototype["get_" + propName] = this._makeGetter(prop, prop.getter);

			if (!prop.get_isList())
				this._jstype.prototype["set_" + propName] = this._makeSetter(prop, prop.setter);

			return prop;
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
		set_baseType: function(baseType) {
			var baseJsType;

			if (baseType) {
				baseType.derivedTypes.push(this);
				baseJsType = baseType._jstype;
			} else
				baseJsType = ObjectBase;

			this.baseType = baseType;

			this._jstype.prototype = new baseJsType();
			this._jstype.prototype.constructor = this._jstype;

			var formats = function() { };
			formats.prototype = baseJsType.formats;
			this._jstype.formats = new formats();

			// TODO: can this be done earlier w/o the base type being known?
			this._jstype.registerClass(this._fullName, baseJsType);

		},
		property: function(name) {
			var p = (name.indexOf(".") >= 0) ? name.substring(0, name.indexOf(".")) : name;

			var prop;
			for (var t = this; t && !prop; t = t.baseType)
				prop = t._properties[p];

			if (prop) {
				var prop = new PropertyChain(prop);

				// evaluate the remainder of the property path
				if (name.indexOf(".") >= 0) {
					var remainder = name.substring(name.indexOf(".") + 1);

					var type = prop.get_jstype().meta;

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

		addRule: function Type$addRule(rule, prop) {
			var propName = prop.get_name();
			var rules = this._rules[propName];

			if (!rules) {
				this._rules[propName] = [rule];
			}
			else
				rules.push(rule);
		},
		getRule: function Type$getRule(propName, type) {
			var rules = this._rules[propName];

			if (rules) {
				for (var i = 0; i < rules.length; i++) {
					var rule = rules[i];
					if (rule instanceof type)
						return rule;
				}
			}
			return this._baseType ? this._baseType.getRule(propName, type) : null;
		},
		getPropertyRules: function Type$getPropertyRules(propName /*, result */) {
			var result = arguments[1] || [];

			var rules = this._rules[propName];

			if (rules) {
				for (var i = 0; i < rules.length; i++)
					result.push(rules[i]);
			}
			
			if(this._baseType)
				this._baseType.getPropertyRules(propName, result);
			
			return result;
		},
//		constraint: function(condition, issueDesc) {
//			var type = this;
//			var issueProps = [];

//			// update description and discover the properties the issue should be bound to
//			issueDesc = issueDesc.replace(/\$([a-z0-9_]+)/ig,
//						function(s, propName) {
//							var prop = type.property(propName);

//							if ($.inArray(prop.lastProperty(), issueProps) < 0)
//								issueProps.push(prop.lastProperty());

//							return prop.get_label();
//						}
//					);

//			var inputProps = Rule.inferInputs(this, condition);

//			var err = new RuleIssue(issueDesc, issueProps);

//			type.rule(
//						inputProps,
//						function(obj) {
//							obj.meta.issueIf(err, !condition.apply(obj));
//						},
//						false,
//						[err]);

//			return this;
//		},

		// Executes all rules that have a particular property as input
		executeRules: function Type$executeRules(obj, prop, start) {
			var i = (start ? start : 0);
			var processing;

			var rules = this.getPropertyRules(prop);

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
	/// <remarks>
	/// If the interface for this class is changed it should also be changed in
	/// PropertyChain, since PropertyChain acts as an aggregation of properties 
	/// that can be treated as a single property.
	/// </remarks>
	///////////////////////////////////////////////////////////////////////////////
	function Property(containingType, name, jstype, label, format, isList, isShared) {
		this._containingType = containingType;
		this._name = name;
		this._jstype = jstype;
		this._label = label || name.replace(/([^A-Z]+)([A-Z])/g, "$1 $2");
		this._format = format;
		this._isList = !!isList;
		this._isShared = !!isShared;
	}

	Property.prototype = {
		rule: function(type) {
			return this._containingType.getRule(this._name, type);
		},

		toString: function() {
			return this.get_label();
		},

		get_containingType: function() {
			return this._containingType;
		},

		get_typeClass: function() {
			if (!this._typeClass) {
				if (this.get_jstype().meta) {
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

		get_jstype: function() {
			return this._jstype;
		},

		get_format: function() {
			return this._format;
		},

		getter: function(obj) {
			this._containingType.get_model().notifyBeforePropertyGet(obj, this);
			return obj[this._name];
		},

		setter: function(obj, val) {
			if (!this.canSetValue(obj, val))
				throw $format("Cannot set {0}={1}. A value of type {2} was expected", [this._name, val === undefined ? "<undefined>" : val, this._jstype.getName()]);

			var old = obj[this._name];

			if (old !== val) {
				obj[this._name] = val;
				obj.meta.executeRules(this._name);
				this._containingType.get_model().notifyAfterPropertySet(obj, this, val, old);
			}
		},

		get_isList: function() {
			return this._isList;
		},

		get_isShared: function() {
			return this._isShared;
		},

		get_label: function() {
			return this._label;
		},

		get_name: function() {
			return this._name;
		},

		get_uniqueName: function() {
			return this._containingType.get_fullName() + "$" + this._name;
		},
		canSetValue: function Property$canSetValue(obj, val) {
			// only allow values of the correct data type to be set in the model
			if (val === null)
				return true;
			else if (val === undefined)
				return false;

			var valType;

			if (val.constructor)
				valType = val.constructor;
			else {
				switch (typeof (val)) {
					case "string": valType = String; break;
					case "number": valType = Number; break;
					case "boolean": valType = Boolean; break;
				}
			};

			return valType === this._jstype;
		},
		value: function Property$value(obj, val) {
			if (arguments.length == 2) {
				Sys.Observer.setValue(obj, this._name, val);
				return val;
			}
			else
				return obj[this._name];
		},
		init: function Property$init(obj, val, force) {
			var target = (this._isShared ? this._containingType.get_jstype() : obj);
			var curVal = target[this._name];

			if (curVal !== undefined && !(force === undefined || force))
				return;

			target[this._name] = val;

			if (val instanceof Array) {
				if (!this._notifyListChangedFn) {
					var prop = this;
					this._notifyListChangedFn = function(sender, args) {
						prop._containingType.get_model().notifyListChanged(target, prop, args.get_changes());
					}
				}

				Sys.Observer.makeObservable(val);
				Sys.Observer.addCollectionChanged(val, this._notifyListChangedFn);
			}
		},

		get_notifyListChangedFn: function() {

			return this._notifyListChangedFn;
		}
	}
	ExoWeb.Model.Property = Property;
	Property.registerClass("ExoWeb.Model.Property");


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
	/// var addressProp = chain.lastProperty();
	/// // the Address object
	/// var address = chain.value(driver);
	/// // the owner's locations for the given driver
	/// var loc = chain.lastTarget(driver);
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
	///////////////////////////////////////////////////////////////////////////
	function PropertyChain(properties) {
		this._properties = properties.length ? properties : [properties];

		if (this._properties.length == 0)
			throw ("PropertyChain cannot be zero-length.");
	}

	PropertyChain.prototype = {
		all: function() {
			return this._properties;
		},
		append: function(prop) {
			Array.addRange(this._properties, prop.all());
		},
		each: function(obj, callback) {
			if (!callback || typeof (callback) != "function")
				throw ("Invalid Parameter: callback function");

			if (!obj)
				throw ("Invalid Parameter: source object");

			var target = obj;
			for (var p = 0; p < this._properties.length; p++) {
				var prop = this._properties[p];
				callback(target, prop);
				target = prop.value(target);
			}
		},
		fullName: function() {
			var name = "";
			Array.forEach(this._properties, function(prop) {
				name += (name.length > 0 ? "." : "") + prop.get_name();
			});
			return name;
		},
		lastProperty: function() {
			return this._properties[this._properties.length - 1];
		},
		lastTarget: function(obj) {
			for (var p = 0; p < this._properties.length - 1; p++) {
				var prop = this._properties[p];
				obj = prop.value(obj);
			}
			return obj;
		},
		prepend: function(prop) {
			var newProps = prop.all();
			for (var p = newProps.length - 1; p >= 0; p--) {
				Array.insert(this._properties, 0, newProps[p]);
			}
		},
		canSetValue: function canSetValue(obj, value) {
			return this.lastProperty().canSetValue(this.lastTarget(obj), value);
		},

		// Property pass-through methods
		///////////////////////////////////////////////////////////////////////
		get_containingType: function PropertyChain$get_containingType() {
			return this.lastProperty().get_containingType();
		},
		get_jstype: function PropertyChain$get_jstype() {
			return this.lastProperty().get_jstype();
		},
		get_format: function PropertyChain$get_format() {
			return this.lastProperty().get_format();
		},
		get_isList: function PropertyChain$get_isList() {
			return this.lastProperty().get_isList();
		},
		get_label: function PropertyChain$get_label() {
			return this.lastProperty().get_label();
		},
		get_name: function PropertyChain$get_name() {
			return this.lastProperty().get_name();
		},
		get_typeClass: function PropertyChain$get_typeClass() {
			return this.lastProperty().get_typeClass();
		},
		get_uniqueName: function PropertyChain$get_uniqueName() {
			return this.lastProperty().get_uniqueName();
		},
		value: function PropertyChain$value(obj, val) {
			if (arguments.length == 2) {
				obj = this.lastTarget(obj);
				Sys.Observer.setValue(obj, this.get_name(), val);
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


	///////////////////////////////////////////////////////////////////////////
	function ObjectMeta(type, obj) {
		this._obj = obj;
		this.type = type;
		this._issues = [];
		this._propertyIssues = {};
	}

	ObjectMeta.prototype = {
		executeRules: function(propName) {
			this.type.get_model().get_validatedQueue().push({ sender: this, property: propName });
			this._raisePropertyValidating(propName);
			this.type.executeRules(this._obj, propName);
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
		},

		destroy: function() {
			this.type.unregister(this.obj);
		}
	}
	ObjectMeta.mixin(ExoWeb.Functor.eventing);
	ExoWeb.Model.ObjectMeta = ObjectMeta;
	ObjectMeta.registerClass("ExoWeb.Model.ObjectMeta");

	//////////////////////////////////////////////////////////////////////////////////////
	function Rule() { }

	Rule.register = function register(rule, properties, isAsync) {
		rule.isAsync = isAsync;

		for (var i = 0; i < properties.length; ++i) {
			var prop = properties[i];
			prop.get_containingType().addRule(rule, prop);
		}
	}

	Rule.inferInputs = function inferInputs(rootType, func) {
		var inputs = [];
		var match;

		while (match = /this\.([a-zA-Z0-9_]+)/g.exec(func.toString())) {
			inputs.push(rootType.property(match[1]).lastProperty());
		}

		return inputs;
	}
	ExoWeb.Model.Rule = Rule;
	Rule.registerClass("ExoWeb.Model.Rule");

	//////////////////////////////////////////////////////////////////////////////////////
	function RequiredRule(options, properties) {
		this.prop = properties[0];
		this.err = new RuleIssue(this.prop.get_label() + " is required", properties, this);

		Rule.register(this, properties, false);
	}
	RequiredRule.prototype = {
		execute: function(obj) {
			var val = this.prop.value(obj);
			obj.meta.issueIf(this.err, val == null || (String.trim(val.toString()) == ""));
		}
	}
	ExoWeb.Model.Rule.required = RequiredRule;

	//////////////////////////////////////////////////////////////////////////////////////
	function RangeRule(options, properties) {
		this.prop = properties[0];

		this.minimum = options.minimum;
		this.maximum = options.maximum;

		var hasMin = (this.minimum !== undefined && this.minimum != null);
		var hasMax = (this.maximum !== undefined && this.maximum != null);

		if (hasMin && hasMax) {
			this.err = new RuleIssue($format("{prop} must be between {minimum} and {maximum}", this), properties, this);
			this._test = this._testMinMax;
		}
		else if (hasMin) {
			this.err = new RuleIssue($format("{prop} must be at least {minimum}", this), properties, this);
			this._test = this._testMin;
		}
		else if (hasMax) {
			this.err = new RuleIssue($format("{prop} must no more than {maximum}", this), properties, this);
			this._test = this._testMax;
		}

		Rule.register(this, properties, false);
	}
	RangeRule.prototype = {
		execute: function(obj) {
			var val = this.prop.value(obj);
			obj.meta.issueIf(this.err, this._test(val));
		},
		_testMinMax: function(val) {
			return val < this.minimum || val > this.maximum;
		},
		_testMin: function(val) {
			return val < this.minimum;
		},
		_testMax: function(val) {
			return val > this.maximum;
		}
	}
	ExoWeb.Model.Rule.range = RangeRule;

	//////////////////////////////////////////////////////////////////////////////////////
	function AllowedValuesRule(options, properties) {
		this.prop = properties[0];
		this.path = options.source;
		this.err = new RuleIssue($format("{prop} has an invalid value", this), properties, this);

		Rule.register(this, properties, false);
	}
	AllowedValuesRule.prototype = {
		addChanged: function(obj, handler) {
			if (this.path && this.path.length > 0) {
				var props = obj.meta.property(this.path);

				if (props) {
					props.each(obj, function(obj, prop) {
						if (prop.get_typeClass() == "entitylist")
							Sys.Observer.addCollectionChanged(prop.value(obj), function(sender, args) {
								handler(sender, args);
							});
						else
							Sys.Observer.addSpecificPropertyChanged(obj, prop.get_name(), function(sender, args) {
								handler(sender, args);
							});
					});
				}
				else {
					// if the property is not defined look for a global object by that name
					var obj = window;
					var names = this.path.split(".");
					for (var n = 0; obj && n < names.length; n++)
						obj = obj[names[n]];

					Sys.Observer.addCollectionChanged(obj, function(sender, args) {
						handler(sender, args);
					});
				}
			}
		},
		execute: function(obj) {
			var val = this.prop.value(obj);
			obj.meta.issueIf(this.err, val && !Array.contains(this.values(obj), val));
		},
		values: function(obj) {
			if (this.path && this.path.length > 0) {
				var props = obj.meta.property(this.path);

				if (props) {
					// get the allowed values from the property chain
					return props.value(obj);
				}
				else {
					// if the property is not defined look for a global object by that name
					var obj = window;
					var names = this.path.split(".");
					for (var n = 0; obj && n < names.length; n++)
						obj = obj[names[n]];
					return obj;
				}
			}
		}
	}
	ExoWeb.Model.Rule.allowedValues = AllowedValuesRule;

	//	//////////////////////////////////////////////////////////////////////////////////////
	//	function StringLengthRule(options, properties) {
	//		this.prop = properties[0];

	//		this.minimumLength = options.minimumLength;
	//		this.maximumLength = options.maximumLength;

	//		var hasMin = (this.minimumLength !== undefined && this.minimumLength != null);
	//		var hasMax = (this.maximumLength !== undefined && this.maximumLength != null);

	//		if (hasMin && hasMax) {
	//			this.err = new RuleIssue($format("{prop} must be between {minimumLength} and {maximumLength} characters", this), properties, this);
	//			this._test = this._testMinMax;
	//		}
	//		else if (hasMin) {
	//			this.err = new RuleIssue($format("{prop} must be at least {minimumLength} characters", this), properties, this);
	//			this._test = this._testMin;
	//		}
	//		else if (hasMax) {
	//			this.err = new RuleIssue($format("{prop} must no more than {maximumLength} characters", this), properties, this);
	//			this._test = this._testMax;
	//		}
	//
	//		Rule.register(this, properties, false);
	//	}
	//	StringLengthRule.prototype = {
	//		execute: function(obj) {
	//			var val = this.prop.value(obj);
	//			obj.meta.issueIf(this.err, this._test(val));
	//		},
	//		_testMinMax: function(val) {
	//			return val.length < this.minimumLength || val.length > this.maximumLength;
	//		},
	//		_testMin: function(val) {
	//			return val.length < this.minimumLength;
	//		},
	//		_testMax: function(val) {
	//			return val.length > this.maximumLength;
	//		}
	//	}
	//	ExoWeb.Model.Rule.stringLength = StringLengthRule;


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
			if (val === undefined || val == null)
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

	String.formats.$value = new Format({
		convertBack: function(val) {
			return val ? val.trim() : val;
		}
	});

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


	/////////////////////////////////////////////////////////////////////////////////////////////////////////
	function LazyLoader() {
	}

	LazyLoader.eval = function eval(target, path, successCallback, errorCallback) {
		if (!path)
			path = [];

		if (!(path instanceof Array))
			path = path.split(".");

		target = target || window;

		while (path.length > 0) {
			var prop = Array.dequeue(path);

			if (!LazyLoader.isLoaded(target, prop)) {
				LazyLoader.load(target, prop, function() {
					var nextTarget = Sys.Observer.getValue(target, prop);

					if (nextTarget === undefined) {
						if (errorCallback)
							errorCallback("Property is undefined: " + prop)
					}
					else
						LazyLoader.eval(nextTarget, path, successCallback, errorCallback);
				});

				return;
			}
			else {
				var propValue = Sys.Observer.getValue(target, prop);
				target = propValue;
			}
		}

		// Load final object
		if (!LazyLoader.isLoaded(target))
			LazyLoader.load(target, null, function() { successCallback(target); });
		else
			successCallback(target);
	}

	LazyLoader.isLoaded = function isLoaded(obj, propName) {
		return !obj._lazyLoader || (obj._lazyLoader.isLoaded && obj._lazyLoader.isLoaded(obj, propName));
	}

	LazyLoader.load = function load(obj, propName, callback) {
		if (obj._lazyLoader)
			obj._lazyLoader.load(obj, propName, callback);
		else if (callback)
			callback();
	}

	LazyLoader.register = function register(obj, loader) {
		obj._lazyLoader = loader;
	}

	LazyLoader.unregister = function register(obj) {
		delete obj._lazyLoader;
	}

	ExoWeb.Model.LazyLoader = LazyLoader;
	LazyLoader.registerClass("ExoWeb.Model.LazyLoader");

})();
