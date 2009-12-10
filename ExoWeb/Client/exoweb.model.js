Type.registerNamespace("ExoWeb.Model");

(function() {
	var undefined;

	var log = ExoWeb.trace.log;

	var disableConstruction = false;

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

	Model.property = function(path, thisType) {
		var part = path.split(".");
		var isGlobal = part[0] !== "this";

		var type;

		if (isGlobal) {
			// locate first model type
			for (var t = window[Array.dequeue(part)]; t && part.length > 0; t = t[Array.dequeue(part)]) {
				if (t.meta) {
					type = t.meta;
					break;
				}
			}

			if (!type)
				throw $format("Invalid property path: {0}", [path]);
		}
		else {
			type = thisType;
			Array.dequeue(part);  // remove this reference			
		}

		return type.property(part.join("."));
	}

	Model.prototype = {
		addType: function Model$addType(name, base) {
			return this._types[name] = new Type(this, name, base);
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

	ObjectBase.mixin({
		toString: function ObjectBase$toString(formatName) {
			var format;

			if (formatName) {
				format = this.constructor.formats[formatName];

				if (!format)
					throw $format("Invalid format: {0}", arguments);
			} else
				format = this.constructor.formats.$display || this.constructor.formats.$system;

			return format.convert(this);
		}
	});

	ObjectBase.formats = {
		$system: new Format({
			convert: function(obj) {
				if (obj)
					return $format("{0}|{1}", [obj.meta.type.get_fullName(), obj.meta.id]);
				else if (obj === null)
					return "null";
			},
			convertBack: function(str) {
				if (str && str.constructor == String) {
					// indicates "no value", which is distinct from "no selection"
					if (str == "null") {
						return null;
					}
					else {
						var ids = str.split("|");
						var ctor = window[ids[0]];
						return ctor.get(ids[1]);
					}
				}
			}
		})
	}

	ExoWeb.Model.ObjectBase = ObjectBase;
	ObjectBase.registerClass("ExoWeb.Model.ObjectBase");


	//////////////////////////////////////////////////////////////////////////////////////
	function Type(model, name, baseType) {
		this._rules = {};
		this._fullName = name;
		this._pool = {};
		this._legacyPool = {};
		this._counter = 0;
		this._properties = {};
		this._model = model;

		// generate class and constructor
		var type = this;

		var jstype = window[name];

		if (jstype)
			throw $format("'{1}' has already been declared", arguments)

		function construct(id) {
			if (!disableConstruction) {
				if (id) {
					var obj = type.get(id);
					if (obj)
						return obj;

					type.register(this, id);
				}
				else {
					type.register(this);

					for (var propName in type._properties) {
						var prop = type._properties[propName];
						if (!prop.get_isStatic() && prop.get_isList()) {
							prop.init(this, []);
						}
					}
				}
			}
		}

		// use eval to generate the type so the function name appears in the debugger
		var ctorScript = $format("function {type}(id) { if(construct) { var obj=construct.apply(this, arguments); if(obj) return obj; } };" +
			"jstype = {type};",
			{ type: name });

		eval(ctorScript);
		window[name] = jstype;
		this._jstype = jstype;


		// setup inheritance
		this.derivedTypes = [];
		var baseJsType;

		if (baseType) {
			baseJsType = baseType._jstype;

			this.baseType = baseType;
			baseType.derivedTypes.push(this);
		} else {
			baseJsType = ObjectBase;
			this.baseType = null;
		}

		disableConstruction = true;
		this._jstype.prototype = new baseJsType();
		disableConstruction = false;

		this._jstype.prototype.constructor = this._jstype;

		// formats
		var formats = function() { };
		formats.prototype = baseJsType.formats;
		this._jstype.formats = new formats();

		// helpers
		jstype.meta = this;
		with ({ type: this }) {
			jstype.get = function(id) { return type.get(id); };
		}

		// done...
		this._jstype.registerClass(name, baseJsType);
	}

	Type.prototype = {
		newId: function Type$newId() {
			return "+c" + this._counter++;
		},
		register: function Type$register(obj, id) {
			obj.meta = new ObjectMeta(this, obj);

			if (!id) {
				id = this.newId();
				obj.meta.isNew = true;
			}

			obj.meta.id = id;
			Sys.Observer.makeObservable(obj);

			for (var t = this; t; t = t.baseType) {
				t._pool[id] = obj;
				if (t._known)
					t._known.add(obj);
			}

			this._model.notifyObjectRegistered(obj);
		},
		changeObjectId: function Type$changeObjectId(oldId, newId) {
			var obj = this._pool[oldId];

			// TODO: throw exceptions?
			if (obj) {
				for (var t = this; t; t = t.baseType) {
					t._pool[newId] = obj;

					delete t._pool[oldId];

					t._legacyPool[oldId] = obj;
				}
			}

			obj.meta.id = newId;
		},
		unregister: function Type$unregister(obj) {
			this._model.notifyObjectUnregistered(obj);

			for (var t = this; t; t = t.baseType) {
				delete t._pool[obj.meta.id];

				if (t._known)
					t._known.remove(obj);
			}

			delete obj.meta._obj;
			delete obj.meta;
		},
		get: function Type$get(id) {
			return this._pool[id] || this._legacyPool[id];
		},
		// Gets an array of all objects of this type that have been registered.
		// The returned array is observable and collection changed events will be raised
		// when new objects are registered or unregistered.
		// The array is in no particular order so if you need to sort it, make a copy or use $transform.
		known: function Type$known() {
			var list = this._known;
			if (!list) {
				list = this._known = [];

				for (id in this._pool)
					list.push(this._pool[id]);

				Sys.Observer.makeObservable(list);
			}

			return list;
		},
		addProperty: function(propName, jstype, isList, label, format, isStatic) {
			var prop = new Property(this, propName, jstype, isList, label, format, isStatic);

			this._properties[propName] = prop;

			// modify jstype to include functionality based on the type definition
			this._jstype["$" + propName] = prop;

			// add members to all instances of this type
			//this._jstype.prototype["$" + propName] = prop;  // is this useful?
			this._jstype.prototype["get_" + propName] = this._makeGetter(prop, prop.getter);

			if (!prop.get_isList())
				this._jstype.prototype["set_" + propName] = this._makeSetter(prop, prop.setter, true);

			return prop;
		},
		_makeGetter: function(receiver, fn) {
			return function() {
				return fn.call(receiver, this);
			}
		},
		_makeSetter: function(receiver, fn, notifiesChanges) {
			var setter = function(val) {
				fn.call(receiver, this, val);
			};
			
			setter.__notifies = !!notifiesChanges;
			
			return setter;
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
			if (prop.get_containingType() !== this)
				throw "TODO: implement cross type rules";

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
			return this.baseType ? this.baseType.getRule(propName, type) : null;
		},
		getPropertyRules: function Type$getPropertyRules(propName /*, result */) {
			var result = arguments[1] || [];

			var rules = this._rules[propName];

			if (rules) {
				for (var i = 0; i < rules.length; i++)
					result.push(rules[i]);
			}

			if (this.baseType)
				this.baseType.getPropertyRules(propName, result);

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
							log("rule", "executing rule '{0}' that depends on property '{1}'", [rule, prop]);
							rule.execute(obj, function(obj) {
								rule._isExecuting = false;
								_this.executeRules(obj, prop, i + 1);
							});
							break;
						}
						else {
							try {
								log("rule", "executing rule '{0}' that depends on property '{1}'", [rule, prop]);
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


	//////////////////////////////////////////////////////////////////////////////////////
	/// <remarks>
	/// If the interface for this class is changed it should also be changed in
	/// PropertyChain, since PropertyChain acts as an aggregation of properties 
	/// that can be treated as a single property.
	/// </remarks>
	///////////////////////////////////////////////////////////////////////////////
	function Property(containingType, name, jstype, isList, label, format, isStatic) {
		this._containingType = containingType;
		this._name = name;
		this._jstype = jstype;
		this._label = label || name.replace(/([^A-Z]+)([A-Z])/g, "$1 $2");
		this._format = format;
		this._isList = !!isList;
		this._isStatic = !!isStatic;
	}

	Property.mixin({
		rule: function(type) {
			return this._containingType.getRule(this._name, type);
		},

		toString: function() {
			return this.get_label();
		},

		get_containingType: function() {
			return this._containingType;
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
				Sys.Observer.raisePropertyChanged(obj, this._name);
				obj.meta.executeRules(this._name);
				this._containingType.get_model().notifyAfterPropertySet(obj, this, val, old);
			}
		},

		get_isEntityType: function() {
			return this.get_jstype().meta && !this._isList;
		},

		get_isEntityListType: function() {
			return this.get_jstype().meta && this._isList;
		},

		get_isValueType: function() {
			return !this.get_jstype().meta;
		},

		get_isList: function() {
			return this._isList;
		},

		get_isStatic: function() {
			return this._isStatic;
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
			if (val === null || val === undefined)
				return true;

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
				var setter = obj["set_" + this._name];
				
				// If a generated setter is found then use it instead of observer, since it will emulate observer 
				// behavior in order to allow application code to call it directly rather than going through the 
				// observer.  Calling the setter in place of observer eliminates unwanted duplicate events.
				if (setter && setter.__notifies)
					setter.call(obj, val);
				else
					Sys.Observer.setValue(obj, this._name, val);
			}
			else {
				var target = (this._isStatic ? this._containingType.get_jstype() : obj);

				// access directly since the caller might make a distinction between null and undefined
				return target[this._name];
			}
		},
		init: function Property$init(obj, val, force) {
			var target = (this._isStatic ? this._containingType.get_jstype() : obj);
			var curVal = target[this._name];

			if (curVal !== undefined && !(force === undefined || force))
				return;

			target[this._name] = val;

			if (val instanceof Array) {
				var prop = this;

				Sys.Observer.makeObservable(val);
				Sys.Observer.addCollectionChanged(val, function(sender, args) {
					obj.meta.executeRules(prop._name);
					prop._containingType.get_model().notifyListChanged(target, prop, args.get_changes());
				});
			}
		},

		calculated: function(options) {
			var prop = this;

			var inputs;

			if (options.basedOn) {
				var type = prop._containingType;
				inputs = options.basedOn.map(function(propName) {
					return Model.property(propName, type);
				});
			}
			else
				inputs = ModelRule.inferInputs(this._containingType, options.fn);

			var execute;

			if (this._isList)
				execute = function(obj) {
					// re-calculate the list values
					var newList = options.fn.apply(obj);

					// compare the new list to the old one to see if changes were made
					var curList = prop.value(obj);

					if (!curList) {
						curList = [];
						prop.init(obj, curList);
					}

					if (newList.length === curList.length) {
						var noChanges = true;

						for (var i = 0; i < newList.length; ++i) {
							if (newList[i] !== curList[i]) {
								noChanges = false;
								break;
							}
						}

						if (noChanges)
							return;
					}

					// update the current list so observers will receive the change events
					curList.beginUpdate();
					curList.clear();
					curList.addRange(newList);
					curList.endUpdate();
				}
			else
				execute = function(obj) {
					Sys.Observer.setValue(obj, prop._name, options.fn.apply(obj));
				}

			Rule.register({ execute: execute, toString: function() { return "calculation of " + prop._name; } }, inputs);

			// go ahead and calculate this property for all objects
			Array.forEach(this._containingType.known(), execute);

			return this;
		}
	});
	ExoWeb.Model.Property = Property;
	Property.registerClass("ExoWeb.Model.Property");

	///////////////////////////////////////////////////////////////////////////////
	/// <summary>
	/// Encapsulates the logic required to work with a chain of properties and
	/// a root object, allowing interaction with the chain as if it were a 
	/// single property of the root object.
	/// </summary>
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
				name += (name.length > 0 ? "." : (prop.get_isStatic() ? prop.get_containingType().get_fullName() + "." : "")) + prop.get_name();
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
		get_isStatic: function PropertyChain$get_isStatic() {
			// TODO
			return this.lastProperty().get_isStatic();
		},
		get_label: function PropertyChain$get_label() {
			return this.lastProperty().get_label();
		},
		get_name: function PropertyChain$get_name() {
			return this.lastProperty().get_name();
		},
		get_isValueType: function PropertyChain$get_isValueType() {
			return this.lastProperty().get_isValueType();
		},
		get_isEntityType: function PropertyChain$get_isEntityType() {
			return this.lastProperty().get_isEntityType();
		},
		get_isEntityListType: function PropertyChain$get_isEntityListType() {
			return this.lastProperty().get_isEntityListType();
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
				var target = obj;
				for (var p = 0; p < this._properties.length; p++) {
					var prop = this._properties[p];
					target = prop.value(target);
				}
				return target;
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
		rule.isAsync = !!isAsync;

		for (var i = 0; i < properties.length; ++i) {
			var prop = properties[i];
			prop.get_containingType().addRule(rule, prop);
		}
	}

	Rule.inferInputs = function inferInputs(rootType, func) {
		var inputs = [];
		var match;

		while (match = /this\.([a-zA-Z0-9_.]+)/g.exec(func.toString())) {
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

		Rule.register(this, properties);
	}
	RequiredRule.prototype = {
		execute: function(obj) {
			var val = this.prop.value(obj);

			if (val instanceof Array) {
				obj.meta.issueIf(this.err, val.length == 0);
			}
			else {
				obj.meta.issueIf(this.err, val == null || (String.trim(val.toString()) == ""));
			}
		},
		toString: function() {
			return $format("{0}.{1} is required", [this.prop.get_containingType().get_fullName(), this.prop.get_name()]);
		}
	}
	Rule.required = RequiredRule;

	//////////////////////////////////////////////////////////////////////////////////////
	function RangeRule(options, properties) {
		this.prop = properties[0];

		this.min = options.min;
		this.max = options.max;

		var hasMin = (this.min !== undefined && this.min != null);
		var hasMax = (this.max !== undefined && this.max != null);

		if (hasMin && hasMax) {
			this.err = new RuleIssue($format("{prop} must be between {min} and {max}", this), properties, this);
			this._test = this._testMinMax;
		}
		else if (hasMin) {
			this.err = new RuleIssue($format("{prop} must be at least {min}", this), properties, this);
			this._test = this._testMin;
		}
		else if (hasMax) {
			this.err = new RuleIssue($format("{prop} must no more than {max}", this), properties, this);
			this._test = this._testMax;
		}

		Rule.register(this, properties);
	}
	RangeRule.prototype = {
		execute: function(obj) {
			var val = this.prop.value(obj);
			obj.meta.issueIf(this.err, this._test(val));
		},
		_testMinMax: function(val) {
			return val < this.min || val > this.max;
		},
		_testMin: function(val) {
			return val < this.min;
		},
		_testMax: function(val) {
			return val > this.max;
		},
		toString: function() {
			return $format("{0}.{1} in range, min: {2}, max: {3}", [this.prop.get_containingType().get_fullName(), this.prop.get_name(), this.min, this.max]);
		}
	}
	Rule.range = RangeRule;

	//////////////////////////////////////////////////////////////////////////////////////
	function AllowedValuesRule(options, properties) {
		var prop = this.prop = properties[0];

		this.path = options.source;

		this.err = new RuleIssue($format("{prop} has an invalid value", this), properties, this);

		Rule.register(this, properties);

		this._needsInit = true;
	}
	AllowedValuesRule.prototype = {
		_init: function() {
			if (this._needsInit) {
				this._propertyChain = ExoWeb.Model.Model.property(this.path, this.prop.get_containingType());

				delete this._needsInit;
			}
		},
		addChanged: function(obj, handler) {
			this._init();

			if (this._propertyChain) {
				this._propertyChain.each(obj, function(obj, prop) {
					if (prop.get_isEntityListType())
						Sys.Observer.addCollectionChanged(prop.value(obj), function(sender, args) {
							handler(sender, args);
						});
					else
						Sys.Observer.addSpecificPropertyChanged(obj, prop.get_name(), function(sender, args) {
							handler(sender, args);
						});
				});
			}
		},
		execute: function(obj) {
			this._init();
			var val = this.prop.value(obj);

			if (val instanceof Array) {
				var allowed = this.values(obj);
				obj.meta.issueIf(this.err, !val.every(function(item) { return allowed.indexOf(item) >= 0; }));
			}
			else {
				obj.meta.issueIf(this.err, val && !Array.contains(this.values(obj), val));
			}
		},
		propertyChain: function(obj) {
			this._init();
			return this._propertyChain;
		},
		values: function(obj) {
			this._init();
			if (this._propertyChain) {
				// get the allowed values from the property chain
				return this._propertyChain.value(obj);
			}
		},
		toString: function() {
			return $format("{0}.{1} allowed values", [this.prop.get_containingType().get_fullName(), this.prop.get_name()]);
		}
	}
	Rule.allowedValues = AllowedValuesRule;

	Property.mixin({
		allowedValues: function(options) {

			// create a rule that will recalculate allowed values when dependencies change
			var source = this.get_name() + "AllowedValues";
			var valuesProp = this.get_containingType().addProperty(source, this.get_jstype(), true);
			valuesProp.calculated(options);

			new AllowedValuesRule({ source: source }, [this]);
		}
	});

	///////////////////////////////////////////////////////////////////////////////////////
	function StringLengthRule(options, properties) {
		this.prop = properties[0];

		this.min = options.min;
		this.max = options.max;

		var hasMin = (this.min !== undefined && this.min != null);
		var hasMax = (this.max !== undefined && this.max != null);

		if (hasMin && hasMax) {
			this.err = new RuleIssue($format("{prop} must be between {min} and {max} characters", this), properties, this);
			this._test = this._testMinMax;
		}
		else if (hasMin) {
			this.err = new RuleIssue($format("{prop} must be at least {min} characters", this), properties, this);
			this._test = this._testMin;
		}
		else if (hasMax) {
			this.err = new RuleIssue($format("{prop} must be no more than {max} characters", this), properties, this);
			this._test = this._testMax;
		}

		Rule.register(this, properties);
	}
	StringLengthRule.prototype = {
		execute: function(obj) {
			var val = this.prop.value(obj);
			obj.meta.issueIf(this.err, this._test(val));
		},
		_testMinMax: function(val) {
			return val.length < this.min || val.length > this.max;
		},
		_testMin: function(val) {
			return val.length < this.min;
		},
		_testMax: function(val) {
			return val.length > this.max;
		},
		toString: function() {
			return $format("{0}.{1} in range, min: {2}, max: {3}", [this.prop.get_containingType().get_fullName(), this.prop.get_name(), this.min, this.max]);
		}
	}
	Rule.stringLength = StringLengthRule;


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

	Format.fromTemplate = (function Format$fromTemplate(convertTemplate) {
		return new Format({
			convert: function convert(obj) {
				if (obj === null || obj === undefined)
					return "";

				return $format(convertTemplate, obj);
			}
		});
	}).cached({ key: function(convertTemplate) { return convertTemplate; } });

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
		convertBack: function(val) {
			if (!val)
				return null;

			if (val.constructor == String) {
				val = $.trim(val);

				if (val.length == 0)
					return null;
			}

			if (!this._convertBack)
				return val;

			try {
				return this._convertBack(val);
			}
			catch (err) {
				return new FormatIssue(this._description ?
							"{value} must be formatted as " + this._description :
							"{value} is not properly formatted",
							val);
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

	Number.formats.$system = Number.formats.Float;

	String.formats.Phone = new Format({
		description: "###-###-####",
		convertBack: function(str) {
			if (!/^[0-9]{3}-[0-9]{3}-[0-9]{4}$/.test(str))
				throw "invalid format";

			return str;
		}
	});

	String.formats.$system = new Format({
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

	Boolean.formats.$system = Boolean.formats.TrueFalse;
	Boolean.formats.$display = Boolean.formats.YesNo;

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

	Date.formats.$system = Date.formats.ShortDate;


	/////////////////////////////////////////////////////////////////////////////////////////////////////////
	function LazyLoader() {
	}

	LazyLoader.eval = function eval(target, path, successCallback, errorCallback, scopeChain) {
		if (!path)
			path = [];
		else if (!(path instanceof Array))
			path = path.split(".");

		scopeChain = scopeChain || [window];
		target = target || Array.dequeue(scopeChain);

		while (path.length > 0) {
			var prop = Array.dequeue(path);

			if (!LazyLoader.isLoaded(target, prop)) {
				LazyLoader.load(target, prop, function() {
					var nextTarget = ExoWeb.getValue(target, prop);

					if (nextTarget === undefined) {
						if (scopeChain.length > 0) {
							Array.insert(path, 0, prop);

							LazyLoader.eval(Array.dequeue(scopeChain), path, successCallback, errorCallback, scopeChain);
						}
						else if (errorCallback)
							errorCallback("Property is undefined: " + prop);
						else
							throw $format("Cannot complete property evaluation because a property is undefined: {0}", [prop]);
					}
					else if (nextTarget != null)
						LazyLoader.eval(nextTarget, path, successCallback, errorCallback, []);
					else if (successCallback)
						successCallback(null);
				});

				return;
			}
			else {
				var propValue = ExoWeb.getValue(target, prop);

				if (propValue === undefined) {
					if (scopeChain.length > 0) {
						Array.insert(path, 0, prop);
						target = Array.dequeue(scopeChain);
					}
					else {
						if (errorCallback)
							errorCallback("Property is undefined: " + prop)
						else
							throw $format("Cannot complete property evaluation because a property is undefined: {0}", [prop]);

						return;
					}
				}
				else if (propValue == null) {
					if (successCallback)
						successCallback(null);
					return;
				}
				else {
					if (scopeChain.length > 0)
						scopeChain = [];

					target = propValue;
				}
			}
		}

		// Load final object
		if (target != null && !LazyLoader.isLoaded(target))
			LazyLoader.load(target, null, function() { successCallback(target); });
		else
			successCallback(target);
	}

	LazyLoader.isLoaded = function isLoaded(obj, propName) {
		var reg = obj._lazyLoader;

		if (!reg)
			return true;

		var loader;
		if (propName && reg.byProp)
			loader = reg.byProp[propName];

		if (!loader)
			loader = reg.allProps;

		return !loader || (loader.isLoaded && obj._lazyLoader.isLoaded(obj, propName));
	}

	LazyLoader.load = function load(obj, propName, callback) {
		var reg = obj._lazyLoader;
		if (!reg) {
			if (callback)
				callback();
		}
		else {
			var loader;
			if (propName && reg.byProp)
				loader = reg.byProp[propName];

			var loader;
			if (!loader)
				loader = reg.allProps;

			if (!loader)
				throw $format("Attempting to load object but no appropriate loader is registered. object: {0}, property: {1}", [obj, propName]);

			loader.load(obj, propName, callback);
		}
	}

	LazyLoader.isRegistered = function isRegistered(obj, loader, propName) {
		var reg = obj._lazyLoader;

		if (!reg)
			return false;
		if (propName)
			return reg.byProp && reg.byProp[propName] === loader;

		return reg.allProps === loader;
	}

	LazyLoader.register = function register(obj, loader, propName) {
		var reg = obj._lazyLoader;

		if (!reg)
			reg = obj._lazyLoader = {};

		if (propName) {
			if (!reg.byProp)
				reg.byProp = {};

			reg.byProp[propName] = loader;
		}
		else
			obj._lazyLoader.allProps = loader;
	}

	LazyLoader.unregister = function unregister(obj, loader, propName) {
		var reg = obj._lazyLoader;

		if (!reg)
			return;

		if (propName) {
			delete reg.byProp[propName];
		} else if (reg.byProp) {
			var allDeleted = true;
			for (var p in reg.byProp) {
				if (reg.byProp[p] === loader)
					delete reg.byProp[p];
				else
					allDeleted = false;
			}

			if (allDeleted)
				delete reg.byProp;
		}

		if (reg.allProps === loader)
			delete reg.allProps;

		if (!reg.byProp && !reg.allProps)
			delete obj._lazyLoader;
	}

	ExoWeb.Model.LazyLoader = LazyLoader;
	LazyLoader.registerClass("ExoWeb.Model.LazyLoader");

})();
