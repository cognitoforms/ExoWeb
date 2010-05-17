Type.registerNamespace("ExoWeb.Model");

(function() {

	function execute() {

		var evalAffectsScope = false;
		eval("evalAffectsScope = true;");

		var undefined;

		var log = ExoWeb.trace.log;
		var throwAndLog = ExoWeb.trace.throwAndLog;

		var disableConstruction = false;

		//////////////////////////////////////////////////////////////////////////////////////
		function Model() {
			this._types = {};

			this._validatingQueue = new EventQueue(
						function(e) {
							var meta = e.sender;
							var conditions = meta._propertyConditions[e.propName];
							meta._raiseEvent("propertyValidating:" + e.propName, [meta, e.propName]);
						},
						function(a, b) {
							return a.sender == b.sender && a.propName == b.propName;
						}
					);

			this._validatedQueue = new EventQueue(
						function(e) {
							var meta = e.sender;
							var propName = e.property;

							var conditions = meta._propertyConditions[propName];
							meta._raiseEvent("propertyValidated:" + propName, [meta, conditions ? conditions : []]);
						},
						function(a, b) {
							return a.sender == b.sender && a.property == b.property;
						}
					);
		}

		Model.property = function Model$property(path, thisType/*, lazyLoadTypes, callback*/) {
			var tokens = new PathTokens(path);
			var firstStep = tokens.steps[0];
			var isGlobal = firstStep.property !== "this";

			var type;

			if (isGlobal) {
				// Get all but the last step in the path.
				var typePathSteps = $transform(tokens.steps).where(function(item, i) { return i != tokens.steps.length - 1; });

				// Construct a string from these steps.
				var typeName = typePathSteps.map(function(item) { return item.property; }).join(".");

				// Empty type name is an error.  The type name must be included as a part of the path.
				if (typeName.length === 0) {
					throwAndLog(["model"], "Invalid static property path \"{0}\":  type name must be included.", [path]);
				}

				// Retrieve the javascript type by name.
				type = Model.getJsType(typeName);

				// If the type is not found then the path must be bad.
				if (!type) {
					throwAndLog(["model"], "Invalid static property path \"{0}\":  type \"{1}\" could not be found.", [path, typeName]);
				}

				// Get the corresponding meta type.
				type = type.meta;

				// Chop off type portion of property path.
				tokens.steps.splice(0, tokens.steps.length - 1);
			}
			else {
				if (firstStep.cast) {
					var jstype = Model.getJsType(firstStep.cast);

					if (!jstype) {
						throwAndLog("model", "Path '{0}' references an unknown type: {1}", [path, firstStep.cast]);
					}
					type = jstype.meta;
				}
				else if (thisType instanceof Function) {
					type = thisType.meta;
				}
				else {
					type = thisType;
				}

				Array.dequeue(tokens.steps);
			}

			var lazyLoadTypes = arguments.length >= 3 && arguments[2] && arguments[2].constructor === Boolean ? arguments[2] : false;
			var callback = arguments.length >= 4 && arguments[3] && arguments[3] instanceof Function ? arguments[3] : null;

			if (tokens.steps.length == 1) {
				var name = tokens.steps[0].property;
				if (lazyLoadTypes) {
					if (!LazyLoader.isLoaded(type)) {
						LazyLoader.load(type, function() {
							callback(type.property(name, true));
						});
					}
					else {
						callback(type.property(name, true));
					}
				}
				else {
					return type.property(name, true);
				}
			}
			else {
				return new PropertyChain(type, tokens, lazyLoadTypes, callback);
			}
		};

		Model.prototype = {
			addType: function Model$addType(name, base) {
				var type = new Type(this, name, base);
				this._types[name] = type;
				return type;
			},
			beginValidation: function Model$beginValidation() {
				this._validatingQueue.startQueueing();
				this._validatedQueue.startQueueing();
			},
			endValidation: function Model$endValidation() {
				this._validatingQueue.stopQueueing();
				this._validatedQueue.stopQueueing();
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
			},
			_ensureNamespace: function Model$_ensureNamespace(name, parentNamespace) {
				var target = parentNamespace;

				if (target.constructor === String) {
					var nsTokens = target.split(".");
					target = window;
					Array.forEach(nsTokens, function(token) {
						target = target[token];

						if (target === undefined) {
							ExoWeb.trace.throwAndLog("model", "Parent namespace \"{0}\" could not be found.", parentNamespace);
						}
					});
				}
				else if (target === undefined || target === null) {
					target = window;
				}

				// create the namespace object if it doesn't exist, otherwise return the existing namespace
				if (!(name in target)) {
					var result = target[name] = {};
					return result;
				}
				else {
					return target[name];
				}
			}
		};

		Model.mixin(ExoWeb.Functor.eventing);

		Model.getJsType = function Model$getJsType(name, allowUndefined) {
			/// <summary>
			/// Retrieves the JavaScript constructor function corresponding to the given full type name.
			/// </summary>
			/// <returns type="Object" />

			var obj = window;
			var steps = name.split(".");
			for (var i = 0; i < steps.length; i++) {
				var step = steps[i];
				obj = obj[step];
				if (obj === undefined) {
					if (allowUndefined) {
						return;
					}
					else {
						throw Error($format("The type \"{0}\" could not be found.  Failed on step \"{1}\".", [name, step]));
					}
				}
			}
			return obj;
		};

		ExoWeb.Model.Model = Model;
		Model.registerClass("ExoWeb.Model.Model");

		//////////////////////////////////////////////////////////////////////////////////////
		function Entity() {
		}

		Entity.mixin({
			set: function Entity$set( /*[properties] or [propName, propValue] */) {
				if (arguments.length == 2) {
					var propName = arguments[0];
					var propValue = arguments[1];
					this._accessor("set", propName).call(this, propValue);
				}
				else {
					var properties = arguments[0];
					for (var prop in properties) {
						this._accessor("set", prop).call(this, properties[prop]);
					}
				}
			},
			get: function Entity$get(propName) {
				return this._accessor("get", propName).call(this);
			},
			_accessor: function Entity$_accessor(getOrSet, property) {
				var fn = this[getOrSet + "_" + property];

				if (!fn) {
					throwAndLog("model", "Unknown property: {0}.{1}", [this.meta.type.get_fullName(), property]);
				}

				return fn;
			},
			toString: function Entity$toString(formatName) {
				var format;

				if (formatName) {
					format = this.constructor.formats[formatName];

					if (!format) {
						throwAndLog(["formatting"], "Invalid format: {0}", arguments);
					}
				}
				else {
					format = this.constructor.formats.$display || this.constructor.formats.$system;
				}

				return format.convert(this);
			}
		});

		Entity.formats = {
			$system: new Format({
				undefinedString: "",
				nullString: "",
				convert: function(obj) {
					return $format("{0}|{1}", [obj.meta.type.get_fullName(), obj.meta.id]);
				},
				convertBack: function(str) {
					// indicates "no value", which is distinct from "no selection"
					var ids = str.split("|");
					var jstype = Model.getJsType(ids[0]);
					if (jstype && jstype.meta) {
						return jstype.meta.get(ids[1]);
					}
				}
			})
		};

		ExoWeb.Model.Entity = Entity;
		Entity.registerClass("ExoWeb.Model.Entity");

		var validateId = function Type$validateId(type, id) {
			if (id === null || id === undefined) {
				ExoWeb.trace.throwAndLog("model",
					"Id cannot be {0} (entity = {1}).",
					[id === null ? "null" : "undefined", type.get_fullName()]
				);
			}
			else if (id.constructor !== String) {
				ExoWeb.trace.throwAndLog("model",
					"Id must be a string:  encountered id {0} of type \"{1}\" (entity = {2}).",
					[id.toString(), ExoWeb.parseFunctionName(id.constructor), type.get_fullName()]
				);
			}
			else if (id == "") {
				ExoWeb.trace.throwAndLog("model",
					"Id cannot be a blank string (entity = {0}).",
					[type.get_fullName()]
				);
			}
		}

		//////////////////////////////////////////////////////////////////////////////////////
		function Type(model, name, baseType) {
			this._rules = {};
			this._fullName = name;
			this._pool = {};
			this._legacyPool = {};
			this._counter = 0;
			this._properties = {};
			this._model = model;
			this._initNewProps = [];
			this._initExistingProps = [];

			// generate class and constructor
			var type = this;

			var jstype = Model.getJsType(name, true);

			if (jstype) {
				throwAndLog(["model"], "'{1}' has already been declared", arguments);
			}

			// create namespaces as needed
			var nameTokens = name.split("."),
				token = Array.dequeue(nameTokens),
				namespaceObj = window;
			while (nameTokens.length > 0) {
				namespaceObj = model._ensureNamespace(token, namespaceObj);
				token = Array.dequeue(nameTokens);
			}

			// the final name to use is the last token
			var finalName = token;
			// the full name (used as the function label) must be a valid identifier
			var fullName = name.replace(/\./ig, "$");

			function construct(idOrProps) {
				if (!disableConstruction) {
					if (idOrProps && idOrProps.constructor === String) {
						var id = idOrProps;
						var obj = type.get(id);
						if (obj) {
							return obj;
						}

						type.register(this, id);
						type._initProperties(this, "_initExistingProps");
					}
					else {
						type.register(this);
						type._initProperties(this, "_initNewProps");

						// set properties passed into constructor
						if (idOrProps) {
							this.set(idOrProps);
						}
					}
				}
			}

			if (evalAffectsScope) {
				// use eval to generate the type so the function name appears in the debugger
				var ctorScript = $format("function {type}(idOrProps) { var obj=construct.apply(this, arguments); if(obj) return obj; };" +
					"jstype = {type};",
					{ "type": fullName });

				eval(ctorScript);
			}
			else {
				jstype = construct;
			}

			this._jstype = namespaceObj[finalName] = jstype;

			// setup inheritance
			this.derivedTypes = [];
			var baseJsType;

			if (baseType) {
				baseJsType = baseType._jstype;

				this.baseType = baseType;
				baseType.derivedTypes.push(this);

				// inherit all shortcut properties that have aleady been defined
				for (var propName in baseType._properties) {
					jstype["$" + propName] = baseType._properties[propName];
				}
			}
			else {
				baseJsType = Entity;
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

			// done...
			this._jstype.registerClass(name, baseJsType);
		}

		Type.prototype = {
			newId: function Type$newId() {
				// Get the next id for this type's heirarchy.
				for (var nextId, type = this; type; type = type.baseType) {
					nextId = Math.max(nextId || 0, type._counter);
				}

				// Update the counter for each type in the heirarchy.
				for (var type = this; type; type = type.baseType) {
					type._counter = nextId + 1;
				}

				// Return the new id.
				return "+c" + nextId;
			},
			register: function Type$register(obj, id) {
				// register is called with single argument from default constructor
				if (arguments.length === 2) {
					validateId(this, id);
				}

				obj.meta = new ObjectMeta(this, obj);

				if (!id) {
					id = this.newId();
					obj.meta.isNew = true;
				}

				var key = id.toLowerCase();

				obj.meta.id = id;
				Sys.Observer.makeObservable(obj);

				for (var t = this; t; t = t.baseType) {
					t._pool[key] = obj;
					if (t._known) {
						t._known.add(obj);
					}
				}

				this._model.notifyObjectRegistered(obj);
			},
			changeObjectId: function Type$changeObjectId(oldId, newId) {
				validateId(this, oldId);
				validateId(this, newId);

				var oldKey = oldId.toLowerCase();
				var newKey = newId.toLowerCase();

				var obj = this._pool[oldKey];

				if (obj) {
					for (var t = this; t; t = t.baseType) {
						t._pool[newKey] = obj;

						delete t._pool[oldKey];

						t._legacyPool[oldKey] = obj;
					}

					obj.meta.id = newId;

					return obj;
				}
				else {
					ExoWeb.trace.logWarning("model",
						"Attempting to change id: Instance of type \"{0}\" with id = \"{1}\" could not be found.",
						[this.get_fullName(), oldId]
					);
				}
			},
			unregister: function Type$unregister(obj) {
				this._model.notifyObjectUnregistered(obj);

				for (var t = this; t; t = t.baseType) {
					delete t._pool[obj.meta.id.toLowerCase()];

					if (t._known) {
						t._known.remove(obj);
					}
				}

				delete obj.meta._obj;
				delete obj.meta;
			},
			get: function Type$get(id) {
				validateId(this, id);

				var key = id.toLowerCase();
				return this._pool[key] || this._legacyPool[key];
			},
			// Gets an array of all objects of this type that have been registered.
			// The returned array is observable and collection changed events will be raised
			// when new objects are registered or unregistered.
			// The array is in no particular order so if you need to sort it, make a copy or use $transform.
			known: function Type$known() {
				var list = this._known;
				if (!list) {
					list = this._known = [];

					for (var id in this._pool) {
						list.push(this._pool[id]);
					}

					Sys.Observer.makeObservable(list);
				}

				return list;
			},
			addProperty: function Type$addProperty(def) {
				var format = def.format;
				if (format && format.constructor === String) {
					format = def.type.formats[format];

					if (!format) {
						throwAndLog("model", "Cannot create property {0}.{1} because there is not a '{2}' format defined for {3}", [this._fullName, def.name, def.format, def.type]);
					}
				}

				var prop = new Property(this, def.name, def.type, def.isList, def.label, format, def.isStatic);

				this._properties[def.name] = prop;

				// modify jstype to include functionality based on the type definition
				function genPropertyShortcut(mtype) {
					mtype._jstype["$" + def.name] = prop;

					mtype.derivedTypes.forEach(function(t) {
						genPropertyShortcut(t);
					});
				}
				genPropertyShortcut(this);

				// does this property need to be inited during object construction?
				// note: this is an optimization so that all properties defined for a type and 
				// its sub types don't need to be iterated over each time the constructor is called.
				if (!prop.get_isStatic()) {
					if (prop.get_isList()) {
						this._initNewProps.push({ property: prop, valueFn: function() { return []; } });

						if (prop.get_origin() != "server")
							this._initExistingProps.push({ property: prop, valueFn: function() { return []; } });
					}
					else if (prop.get_origin() == "server") {
						this._initNewProps.push({ property: prop, valueFn: function() { return undefined; } });
					}
				}


				if (prop.get_isStatic()) {
					// for static properties add member to javascript type
					this._jstype["get_" + def.name] = this._makeGetter(prop, prop._getter);
				}
				else {
					// for instance properties add member to all instances of this javascript type
					this._jstype.prototype["get_" + def.name] = this._makeGetter(prop, prop._getter);
				}

				if (!prop.get_isList()) {
					if (prop.get_isStatic()) {
						this._jstype["set_" + def.name] = this._makeSetter(prop, prop._setter, true);
					}
					else {
						this._jstype.prototype["set_" + def.name] = this._makeSetter(prop, prop._setter, true);
					}
				}

				return prop;
			},
			_makeGetter: function Type$_makeGetter(receiver, fn) {
				return function() {
					return fn.call(receiver, this);
				};
			},
			_makeSetter: function Type$_makeSetter(receiver, fn, notifiesChanges) {
				var setter = function(val) {
					fn.call(receiver, this, val);
				};

				setter.__notifies = !!notifiesChanges;

				return setter;
			},
			_initProperties: function Type$_initProperties(obj, initsArrayName) {
				for (var t = this; t !== null; t = t.baseType) {
					var inits = t[initsArrayName];

					for (var i = 0; i < inits.length; ++i) {
						var init = inits[i];
						init.property.init(obj, init.valueFn());
					}
				}
			},
			get_model: function Type$get_model() {
				return this._model;
			},
			get_fullName: function Type$get_fullName() {
				return this._fullName;
			},
			get_jstype: function Type$get_jstype() {
				return this._jstype;
			},
			property: function Type$property(name, thisOnly) {
				if (!thisOnly) {
					return new PropertyChain(this, new PathTokens(name));
				}

				var prop;
				for (var t = this; t && !prop; t = t.baseType) {
					prop = t._properties[name];

					if (prop) {
						return prop;
					}
				}

				return null;
			},
			addRule: function Type$addRule(rule) {
				function Type$addRule$init(obj, prop, newValue, oldValue, wasInited) {
					if (!wasInited && rule.inputs.every(function(input) { return !input.get_dependsOnInit() || input.property.isInited(obj); })) {
						Type$addRule$fn(obj, prop, rule.execute);
					}
				}
				function Type$addRule$changed(obj, prop, newValue, oldValue, wasInited) {
					if (wasInited && rule.inputs.every(function(input) { return !input.get_dependsOnInit() || input.property.isInited(obj); })) {
						Type$addRule$fn(obj, prop, rule.execute);
					}
				}
				function Type$addRule$get(obj, prop, value, isInited) {
					try {
						// Only execute rule on property get if the property has not been initialized.
						// This is based on the assumption that a rule should only fire on property
						// get for the purpose of lazy initializing the property value.
						if (!isInited) {
							Type$addRule$fn(obj, prop, rule.execute);
						}
					}
					catch (e) {
						ExoWeb.trace.log("model", e);
					}
				}

				function Type$addRule$fn(obj, prop, fn) {
					try {
						prop.get_containingType().get_model().beginValidation();
						rule._isExecuting = true;
						log("rule", "executing rule '{0}' that depends on property '{1}'", [rule, prop]);
						fn.call(rule, obj);
					}
					catch (err) {
						throwAndLog("rules", "Error running rule '{0}': {1}", [rule, err]);
					}
					finally {
						rule._isExecuting = false;
						prop.get_containingType().get_model().endValidation();
					}
				}

				// Store off javascript type to use for comparison
				var jstype = this.get_jstype();

				for (var i = 0; i < rule.inputs.length; ++i) {
					var input = rule.inputs[i];
					var prop = input.property;

					// If the containing type of the input is the same as the type 
					// that the rule is attached to, then we do not need to check types.
					var isSameType = this === prop.get_containingType();

					if (input.get_dependsOnChange()) {
						prop.addChanged(isSameType ?
							Type$addRule$changed :
							function(obj, prop, newValue, oldValue, wasInited) {
								if (obj instanceof jstype) {
									Type$addRule$changed.apply(this, arguments);
								}
							}
						);
					}

					if (input.get_dependsOnInit()) {
						prop.addChanged(isSameType ?
							Type$addRule$init :
							function(obj, prop, newValue, oldValue, wasInited) {
								if (obj instanceof jstype) {
									Type$addRule$init.apply(this, arguments);
								}
							}
						);
					}

					if (input.get_dependsOnGet()) {
						prop.addGet(isSameType ?
							Type$addRule$get :
							function(obj, prop, value, isInited) {
								if (obj instanceof jstype) {
									Type$addRule$get.apply(this, arguments);
								}
							}
						);
					}

					(prop instanceof PropertyChain ? prop.lastProperty() : prop)._addRule(rule, input.get_isTarget());
				}
			},
			// Executes all rules that have a particular property as input
			executeRules: function Type$executeRules(obj, prop, callback, start) {

				var processing;

				if (start === undefined) {
					this._model.beginValidation();
				}

				try {
					var i = (start ? start : 0);

					var rules = prop.get_rules(true);
					if (rules) {
						processing = (i < rules.length);
						while (processing) {
							var rule = rules[i];
							if (!rule._isExecuting) {
								rule._isExecuting = true;

								if (rule.isAsync) {
									// run rule asynchronously, and then pickup running next rules afterwards
									var _this = this;
									log("rule", "executing rule '{0}' that depends on property '{1}'", [rule, prop]);
									rule.execute(obj, function() {
										rule._isExecuting = false;
										_this.executeRules(obj, prop, callback, i + 1);
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
							processing = (i < rules.length);
						}
					}
				}
				finally {
					if (!processing) {
						this._model.endValidation();
					}
				}

				if (!processing && callback && callback instanceof Function) {
					callback();
				}

				return !processing;
			},
			set_originForNewProperties: function Type$set_originForNewProperties(value) {
				this._originForNewProperties = value;
			},
			get_originForNewProperties: function Type$get_originForNewProperties() {
				return this._originForNewProperties;
			},
			set_origin: function Type$set_origin(value) {
				this._origin = value;
			},
			get_origin: function Type$get_origin() {
				return this._origin;
			},
			toString: function Type$toString() {
				return this.get_fullName();
			}
		};

		Type.mixin(ExoWeb.Functor.eventing);
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
			this._fieldName = "_" + name;
			this._jstype = jstype;
			this._label = label || name.replace(/([^A-Z]+)([A-Z])/g, "$1 $2");
			this._format = format;
			this._isList = !!isList;
			this._isStatic = !!isStatic;

			if (containingType.get_originForNewProperties()) {
				this._origin = containingType.get_originForNewProperties();
			}
		}

		Property.mixin({
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
			rule: function Property$rule(type, onlyTargets) {
				if (!type || !(type instanceof Function)) {
					ExoWeb.trace.throwAndLog("rule", "{0} is not a valid rule type.", [type]);
				}

				if (this._rules) {
					for (var i = 0; i < this._rules.length; i++) {
						var rule = this._rules[i];
						if (rule.value instanceof type) {
							if (!onlyTargets || rule.isTarget === true) {
								return rule.value;
							}
						}
					}
				}
				return null;
			},
			isDefinedBy: function Property$isDefinedBy(mtype) {
				for (var type = mtype; type; type = type.baseType) {
					if (this._containingType === type) {
						return true;
					}
				}

				return false;
			},
			_addRule: function Property$_addRule(rule, isTarget) {
				if (!this._rules) {
					this._rules = [{ value: rule, isTarget: isTarget}];
				}
				else {
					this._rules.push({ value: rule, isTarget: isTarget });
				}
			},
			get_rules: function Property$get_rules(onlyTargets) {
				return $transform(this._rules)
					.where(function(r) {
						return !onlyTargets || r.isTarget === true;
					}).map(function(r) {
						return r.value;
					});
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

			get_jstype: function Property$get_jstype() {
				return this._jstype;
			},

			get_format: function Property$get_format() {
				return this._format;
			},
			get_origin: function Property$get_origin() {
				return this._origin ? this._origin : this._containingType.get_origin();
			},

			_assertType: function Property$_assertType(obj) {
				if (obj === undefined || obj === null) {
					throwAndLog(["model", "entity"], "Target object cannot be <{0}>.", [obj === undefined ? "undefined" : "null"]);
				}

				if (this._isStatic === true) {
					if (!ExoWeb.isType(obj.meta, Type)) {
						throwAndLog(["model", "entity"], "A model type was expected, found \"{0}\".", [ExoWeb.parseFunctionName(obj.constructor)]);
					}

					if (!this.isDefinedBy(obj.meta)) {
						throwAndLog(["model", "entity"], "Type {0} does not define property {1}.{2}.", [
							obj.get_fullName(),
							this._containingType.get_fullName(),
							this.get_label()
						]);
					}
				}
				else {
					if (!ExoWeb.isType(obj, Entity)) {
						throwAndLog(["model", "entity"], "An entity was expected, found \"{0}\".", [ExoWeb.parseFunctionName(obj.constructor)]);
					}

					if (!this.isDefinedBy(obj.meta.type)) {
						throwAndLog(["model", "entity"], "Type {0} does not define property {1}.{2}.", [
							obj.meta.type.get_fullName(),
							this._containingType.get_fullName(),
							this.get_label()
						]);
					}
				}
			},

			_getter: function Property$_getter(obj) {
				this._assertType(obj);

				this._raiseEvent("get", [obj, this, obj[this._fieldName], obj.hasOwnProperty(this._fieldName)]);

				if (this._name !== this._fieldName && obj.hasOwnProperty(this._name)) {
					ExoWeb.trace.logWarning("model",
						"Possible incorrect property usage:  property \"{0}\" is defined on object but field name should be \"{1}\", make sure you are using getters and setters.",
						[this._name, this._fieldName]
					);
				}

				return obj[this._fieldName];
			},

			_setter: function Property$_setter(obj, val) {
				this._assertType(obj);

				if (!this.canSetValue(obj, val)) {
					throwAndLog(["model", "entity"], "Cannot set {0}={1}. A value of type {2} was expected", [this._name, val === undefined ? "<undefined>" : val, this._jstype.getName()]);
				}

				var old = obj[this._fieldName];

				// compare values so that this check is accurate for primitives
				var oldValue = (old === undefined || old === null) ? old : old.valueOf();
				var newValue = (val === undefined || val === null) ? val : val.valueOf();

				if (oldValue !== newValue) {
					var wasInited = this.isInited(obj);

					obj[this._fieldName] = val;

					// NOTE: property change should be broadcast before rules are run so that if 
					// any rule causes a roundtrip to the server these changes will be available
					this._containingType.get_model().notifyAfterPropertySet(obj, this, val, old, wasInited);

					this._raiseEvent("changed", [obj, this, val, old, wasInited]);

					Sys.Observer.raisePropertyChanged(obj, this._name);
				}
			},

			get_isEntityType: function Property$get_isEntityType() {
				return !!this.get_jstype().meta && !this._isList;
			},

			get_isEntityListType: function Property$get_isEntityListType() {
				return !!this.get_jstype().meta && this._isList;
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

			get_label: function Property$get_label() {
				return this._label;
			},

			get_name: function Property$get_name() {
				return this._name;
			},
			get_path: function Property$get_path() {
				return this._isStatic ? (this._containingType.get_fullName() + "." + this._name) : this._name;
			},
			canSetValue: function Property$canSetValue(obj, val) {
				// only allow values of the correct data type to be set in the model
				if (val === null || val === undefined) {
					return true;
				}

				if (val.constructor) {
					// for entities check base types as well
					if (val.constructor.meta) {
						for (var valType = val.constructor.meta; valType; valType = valType.baseType) {
							if (valType._jstype === this._jstype) {
								return true;
							}
						}

						return false;
					}
					else {
						return val.constructor === this._jstype;
					}
				}
				else {
					var valObjectType;

					switch (typeof (val)) {
						case "string": valObjectType = String; break;
						case "number": valObjectType = Number; break;
						case "boolean": valObjectType = Boolean; break;
					}

					return valObjectType === this._jstype;
				}
			},
			value: function Property$value(obj, val) {
				var target = (this._isStatic ? this._containingType.get_jstype() : obj);

				if (target === undefined || target === null) {
					ExoWeb.trace.throwAndLog(["model"],
						"Cannot get or set value for {0}static property \"{1}\" on type \"{2}\": target is null or undefined.",
						[(this._isStatic ? "" : "non-"), this.get_path(), this._containingType.get_fullName()]);
				}

				if (arguments.length == 2) {
					this._setter(target, val);
				}
				else {
					return this._getter(target);
				}
			},
			init: function Property$init(obj, val, force) {
				var target = (this._isStatic ? this._containingType.get_jstype() : obj);
				var curVal = target[this._fieldName];

				if (curVal !== undefined && !(force === undefined || force)) {
					return;
				}

				target[this._fieldName] = val;

				if (val instanceof Array) {
					var prop = this;

					Sys.Observer.makeObservable(val);
					Sys.Observer.addCollectionChanged(val, function Property$collectionChanged(sender, args) {
						// NOTE: property change should be broadcast before rules are run so that if 
						// any rule causes a roundtrip to the server these changes will be available
						prop._containingType.get_model().notifyListChanged(target, prop, args.get_changes());

						// NOTE: oldValue is not currently implemented for lists
						prop._raiseEvent("changed", [target, prop, val, undefined, true]);
					});
				}

				this._raiseEvent("changed", [target, this, val, undefined, false]);
			},
			isInited: function Property$isInited(obj) {
				var target = (this._isStatic ? this._containingType.get_jstype() : obj);
				return target.hasOwnProperty(this._fieldName);
			},

			// starts listening for get events on the property. Use obj argument to
			// optionally filter the events to a specific object
			addGet: function Property$addGet(handler, obj) {
				var f;

				if (obj) {
					f = function(target, property, value, isInited) {
						if (obj === target) {
							handler(target, property, value, isInited);
						}
					};
				}
				else {
					f = handler;
				}

				this._addEvent("get", f);
			},

			// starts listening for change events on the property. Use obj argument to
			// optionally filter the events to a specific object
			addChanged: function Property$addChanged(handler, obj) {
				var f;

				if (obj) {
					f = function(target) {
						if (obj === target) {
							handler.apply(this, arguments);
						}
					};
				}
				else {
					f = handler;
				}

				this._addEvent("changed", f);
			},
			_addCalculatedRule: function Property$_addCalculatedRule(calculateFn, isAsync, inputs) {
				// calculated property should always be initialized when first accessed
				var input = new RuleInput(this);
				input.set_dependsOnGet(true);
				input.set_dependsOnChange(false);
				input.set_isTarget(true);
				inputs.push(input);

				var rule = {
					prop: this,
					execute: function Property$calculated$execute(obj, callback) {
						var signal = new ExoWeb.Signal();
						var prop = this.prop;

						if (prop._isList) {
							// Initialize list if needed.  A calculated list property cannot depend on initialization 
							// of a server-based list property since initialization is done when the object is constructed 
							// and before data is available.  If it depends only on the change of the server-based list 
							// property then initialization will not happen until the property value is requested.
							if (!prop.isInited(obj)) {
								prop.init(obj, []);
							}

							// re-calculate the list values
							var newList;
							if (isAsync) {
								calculateFn.call(obj, signal.pending(function(result) {
									newList = result;
								}));
							}
							else {
								newList = calculateFn.apply(obj);
							}

							signal.waitForAll(function() {
								// compare the new list to the old one to see if changes were made
								var curList = prop.value(obj);

								if (newList.length === curList.length) {
									var noChanges = true;

									for (var i = 0; i < newList.length; ++i) {
										if (newList[i] !== curList[i]) {
											noChanges = false;
											break;
										}
									}

									if (noChanges) {
										return;
									}
								}

								// update the current list so observers will receive the change events
								curList.beginUpdate();
								curList.clear();
								curList.addRange(newList);
								curList.endUpdate();

								if (callback) {
									callback(obj);
								}
							}, null, !isAsync);
						}
						else {
							var newValue;
							if (isAsync) {
								calculateFn.call(obj, signal.pending(function(result) {
									newValue = result;
								}));
							}
							else {
								newValue = calculateFn.apply(obj);
							}

							signal.waitForAll(function() {
								prop.value(obj, newValue);
								if (callback) {
									callback(obj);
								}
							}, null, !isAsync);
						}
					},
					toString: function() { return "calculation of " + this.prop._name; }
				};

				Rule.register(rule, inputs, isAsync, this.get_containingType());
			},
			// Adds a rule to the property that will update its value
			// based on a calculation.
			calculated: function Property$calculated(options) {
				var prop = this;
				var rootType = (options.rootType) ? options.rootType.meta : prop._containingType;

				if (options.basedOn) {
					this._readySignal = new ExoWeb.Signal("calculated property dependencies");
					var inputs = [];

					// setup loading of each property path that the calculation is based on
					Array.forEach(options.basedOn, function(p, i) {
						var dependsOnChange;
						var dependsOnInit = true;

						// if the event was specified then parse it
						var parts = p.split(" of ");
						if (parts.length >= 2) {
							var events = parts[0].split(",");
							dependsOnInit = (events.indexOf("init") >= 0);
							dependsOnChange = (events.indexOf("change") >= 0);
						}

						var path = (parts.length >= 2) ? parts[1] : p;
						Model.property(path, rootType, true, prop._readySignal.pending(function Property$calculated$chainLoaded(chain) {
							var input = new RuleInput(chain);

							if (!input.property) {
								throwAndLog("model", "Calculated property {0}.{1} is based on an invalid property: {2}", [rootType.get_fullName(), prop._name, p]);
							}

							input.set_dependsOnInit(dependsOnInit);
							if (dependsOnChange !== undefined) {
								input.set_dependsOnChange(dependsOnChange);
							}

							inputs.push(input);
						}));
					});

					// wait until all property information is available to initialize the calculation
					this._readySignal.waitForAll(function() {
						prop._addCalculatedRule(options.fn, options.isAsync, inputs);
					});
				}
				else {
					var inferredInputs = Rule.inferInputs(rootType, options.fn);
					inferredInputs.forEach(function(input) {
						input.set_dependsOnInit(true);
					});
					prop._addCalculatedRule(options.fn, options.isAsync, inferredInputs);
				}

				return this;
			},
			rootedPath: function Property$rootedPath(type) {
				if (this.isDefinedBy(type)) {
					return (this._isStatic ? "" : "this.") + this._name;
				}
			}
		});
		Property.mixin(ExoWeb.Functor.eventing);
		ExoWeb.Model.Property = Property;
		Property.registerClass("ExoWeb.Model.Property");

		///////////////////////////////////////////////////////////////////////////
		function PathTokens(expression) {
			this.expression = expression;

			// replace "." in type casts so that they do not interfere with splitting path
			expression = expression.replace(/<[^>]*>/ig, function(e) { return e.replace(/\./ig, "$_$"); });

			if (expression.length > 0) {
				this.steps = expression.split(".").map(function(step) {
					var parsed = step.match(/^([a-z0-9_]+)(<([a-z0-9_$]+)>)?$/i);

					if (!parsed) {
						return null;
					}

					var result = { property: parsed[1] };

					if (parsed[3]) {
						// restore "." in type case expression
						result.cast = parsed[3].replace(/\$_\$/ig, ".");
					}

					return result;
				});
			}
			else {
				this.steps = [];
			}
		}

		PathTokens.normalizePaths = function PathTokens$normalizePaths(paths) {
			var result = [];

			if (paths) {
				paths.forEach(function(p) {
					var stack = [];
					var parent;
					var start = 0;
					var pLen = p.length;

					for (var i = 0; i < pLen; ++i) {
						var c = p.charAt(i);

						if (c === '{' || c === ',' || c === '}') {
							var seg = p.substring(start, i).trim();
							start = i + 1;

							if (c === '{') {
								if (parent) {
									stack.push(parent);
									parent += "." + seg;
								}
								else {
									parent = seg;
								}
							}
							else {   // ',' or '}'
								if (seg.length > 0) {
									result.push(new PathTokens(parent ? parent + "." + seg : seg));
								}

								if (c === '}') {
									parent = (stack.length === 0) ? undefined : stack.pop();
								}
							}
						}
					}

					if (stack.length > 0) {
						throwAndLog("model", "Unclosed '{' in path: {0}", [p]);
					}

					if (start === 0) {
						result.push(new PathTokens(p.trim()));
					}
				});
			}
			return result;
		};

		PathTokens.mixin({
			toString: function PathTokens$toString() {
				return this.expression;
			}
		});
		ExoWeb.Model.PathTokens = PathTokens;
		PathTokens.registerClass("ExoWeb.Model.PathTokens");


		///////////////////////////////////////////////////////////////////////////
		function PropertyChain(rootType, pathTokens/*, lazyLoadTypes, callback*/) {
			/// <summary>
			/// Encapsulates the logic required to work with a chain of properties and
			/// a root object, allowing interaction with the chain as if it were a 
			/// single property of the root object.
			/// </summary>

			this._rootType = rootType;
			var type = rootType;
			var chain = this;

			this._properties = [];
			this._filters = [];

			// initialize optional arguments
			var lazyLoadTypes = arguments.length >= 3 && arguments[2] && arguments[2].constructor === Boolean ? arguments[2] : false;
			var callback = arguments.length >= 4 && arguments[3] && arguments[3] instanceof Function ? arguments[3] : null;
			var allowAsync = !!(lazyLoadTypes && callback);

			// process each step in the path either synchronously or asynchronously depending on arguments
			var processStep = function PropertyChain$processStep() {
				var step = Array.dequeue(pathTokens.steps);

				if (!step) {
					throwAndLog("model", "Syntax error in property path: {0}", [path]);
				}

				var prop = type.property(step.property, true);

				if (!prop) {
					throwAndLog("model", "Path '{0}' references an unknown property: {1}.{2}", [pathTokens, type.get_fullName(), step.property]);
				}

				chain._properties.push(prop);

				if (step.cast) {
					type = type.get_model().type(step.cast);

					if (!type) {
						throwAndLog("model", "Path '{0}' references an unknown type: {1}", [pathTokens, step.cast]);
					}

					var jstype = type.get_jstype();
					chain._filters[chain._properties.length] = function(target) {
						return target instanceof jstype;
					};
				}
				else {
					type = prop.get_jstype().meta;
				}

				if (pathTokens.steps.length === 0) {
					// processing the path is complete, verify that chain is not zero-length
					if (chain._properties.length === 0) {
						throwAndLog(["model"], "PropertyChain cannot be zero-length.");
					}

					// if asynchronous processing was allowed, invoke the callback
					if (allowAsync) {
						callback(chain);
					}
				}
				else {
					// process the next step in the path, first ensuring that the type is loaded if lazy loading is allowed
					if (allowAsync && !LazyLoader.isLoaded(type)) {
						LazyLoader.load(type, null, processStep);
					}
					else {
						processStep();
					}
				}
			};

			// begin processing steps in the path
			if (!LazyLoader.isLoaded(type)) {
				LazyLoader.load(type, processStep);
			}
			else {
				processStep();
			}
		}

		PropertyChain.prototype = {
			equals: function PropertyChain$equals(prop) {
				if (prop !== undefined && prop !== null) {
					if (prop instanceof Property) {
						return prop.equals(this);
					}
					else if (prop instanceof PropertyChain) {
						if (prop._properties.length !== this._properties.length) {
							return false;
						}

						for (var i = 0; i < this._properties.length; i++) {
							if (!this._properties[i].equals(prop._properties[i])) {
								return false;
							}
						}

						return true;
					}
				}
			},
			all: function PropertyChain$all() {
				return this._properties;
			},
			append: function PropertyChain$append(prop) {
				Array.addRange(this._properties, prop.all());
			},
			each: function PropertyChain$each(obj, callback, propFilter /*, target, p, lastProp*/) {
				/// <summary>
				/// Iterates over all objects along a property chain starting with the root object (obj).  This
				/// is analogous to the Array forEach function.  The callback may return a Boolean value to indicate 
				/// whether or not to continue iterating.
				/// </summary>
				/// <param name="obj" type="ExoWeb.Model.Entity">
				/// The root object to use in iterating over the chain.
				/// </param>
				/// <param name="callback" type="Function">
				/// The function to invoke at each iteration step.  May return a Boolean value to indicate whether 
				/// or not to continue iterating.
				/// </param>
				/// <param name="propFilter" type="ExoWeb.Model.Property" optional="true">
				/// If specified, only iterates over objects that are RETURNED by the property filter.  In other
				/// words, steps that correspond to a value or values of the chain at a specific property step).
				/// For example, if the chain path is "this.PropA.ListPropB", then...
				/// 	chain.each(target, callback, ListPropB);
				/// ...will iterate of the values of the list property only.
				/// </param>

				if (!callback || typeof (callback) != "function") {
					throwAndLog(["model"], "Invalid Parameter: callback function");
				}

				if (!obj) {
					throwAndLog(["model"], "Invalid Parameter: source object");
				}

				// invoke callback on obj first
				var target = arguments[3] || obj;
				var lastProp = arguments[5] || null;
				for (var p = arguments[4] || 0; p < this._properties.length; p++) {
					var prop = this._properties[p];
					var canSkipRemainingProps = propFilter && lastProp === propFilter;
					var enableCallback = (!propFilter || lastProp === propFilter);

					if (target instanceof Array) {
						// if the target is a list, invoke the callback once per item in the list
						for (var i = 0; i < target.length; ++i) {
							// take into account any any chain filters along the way
							if (!this._filters[p] || this._filters[p](target[i])) {

								if (enableCallback && callback(target[i], prop) === false) {
									return false;
								}

								// continue along the chain for this list item
								if (!canSkipRemainingProps && this.each(obj, callback, propFilter, prop.value(target[i]), p + 1, prop) === false) {
									return false;
								}
							}
						}
						// subsequent properties already visited in preceding loop
						return true;
					}
					else {
						// return early if the target is filtered and does not match
						if (this._filters[p] && this._filters[p](target) === false) {
							break;
						}

						// take into account any chain filters along the way
						if (enableCallback && callback(target, prop) === false) {
							return false;
						}
					}

					// if a property filter is used and was just evaluated, stop early
					if (canSkipRemainingProps) {
						break;
					}

					// move to next property in the chain
					target = prop.value(target);

					// break early if the target is undefined
					if (target === undefined || target === null) {
						break;
					}

					lastProp = prop;
				}

				return true;
			},
			get_path: function PropertyChain$get_path() {
				if (!this._path) {
					this._path = this._getPathFromIndex(0);
				}

				return this._path;
			},
			_getPathFromIndex: function PropertyChain$_getPathFromIndex(startIndex) {
				var parts = [];
				if (this._properties[startIndex].get_isStatic()) {
					parts.push(this._properties[startIndex].get_containingType().get_fullName());
				}

				this._properties.slice(startIndex).forEach(function(p) { parts.push(p.get_name()); });

				return parts.join(".");
			},
			firstProperty: function PropertyChain$firstProperty() {
				return this._properties[0];
			},
			lastProperty: function PropertyChain$lastProperty() {
				return this._properties[this._properties.length - 1];
			},
			lastTarget: function PropertyChain$lastTarget(obj, exitEarly) {
				for (var p = 0; p < this._properties.length - 1; p++) {
					var prop = this._properties[p];

					// exit early (and return undefined) on null or undefined
					if (exitEarly === true && (obj === undefined || obj === null)) {
						return;
					}

					obj = prop.value(obj);
				}
				return obj;
			},
			prepend: function PropertyChain$prepend(prop) {
				var newProps = prop.all();
				for (var p = newProps.length - 1; p >= 0; p--) {
					Array.insert(this._properties, 0, newProps[p]);
				}
			},
			canSetValue: function PropertyChain$canSetValue(obj, value) {
				return this.lastProperty().canSetValue(this.lastTarget(obj), value);
			},
			// Determines if this property chain connects two objects.
			connects: function PropertyChain$connects(fromRoot, toObj, viaProperty) {
				var connected = false;

				// perform simple comparison if no property is defined
				if (!viaProperty) {
					return fromRoot === toObj;
				}

				this.each(fromRoot, function(target) {
					if (target === toObj) {
						connected = true;
						return false;
					}
				}, viaProperty);

				return connected;
			},
			rootedPath: function PropertyChain$rootedPath(rootType) {
				for (var i = 0; i < this._properties.length; i++) {
					if (this._properties[i].isDefinedBy(rootType)) {
						var path = this._getPathFromIndex(i);
						return (this._properties[i]._isStatic ? "" : "this.") + path;
					}
				}
			},
			// starts listening for the get event of the last property in the chain on any known instances. Use obj argument to
			// optionally filter the events to a specific object
			addGet: function PropertyChain$addGet(handler, obj) {
				var chain = this;

				this.lastProperty().addGet(function PropertyChain$_raiseGet(sender, property, value, isInited) {
					handler(sender, chain, value, isInited);
				}, obj);
			},
			// starts listening for change events along the property chain on any known instances. Use obj argument to
			// optionally filter the events to a specific object
			addChanged: function PropertyChain$addChanged(handler, obj) {
				var chain = this;

				if (this._properties.length == 1) {
					// OPTIMIZATION: no need to search all known objects for single property chains
					this._properties[0].addChanged(function PropertyChain$_raiseChanged$1Prop(sender, property, val, oldVal, wasInited) {
						handler(sender, chain, val, oldVal, wasInited, property);
					}, obj);
				}
				else {
					Array.forEach(this._properties, function(prop, index) {
						var priorProp = (index === 0) ? undefined : chain._properties[index - 1];
						if (obj) {
							// CASE: using object filter
							prop.addChanged(function PropertyChain$_raiseChanged$1Obj(sender, property, val, oldVal, wasInited) {
								if (chain.connects(obj, sender, priorProp)) {
									handler(obj, chain, val, oldVal, wasInited, property);
								}
							});
						}
						else {
							// CASE: no object filter
							prop.addChanged(function PropertyChain$_raiseChanged$Multi(sender, property, val, oldVal, wasInited) {
								// scan all known objects of this type and raise event for any instance connected
								// to the one that sent the event.
								Array.forEach(chain._rootType.known(), function(known) {
									if (chain.isInited(known) && chain.connects(known, sender, priorProp)) {
										handler(known, chain, val, oldVal, wasInited, property);
									}
								});
							});
						}
					});
				}
			},
			// Property pass-through methods
			///////////////////////////////////////////////////////////////////////
			get_containingType: function PropertyChain$get_containingType() {
				return this._rootType;
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
			get_rules: function PropertyChain$_get_rules(onlyTargets) {
				return this.lastProperty().get_rules(onlyTargets);
			},
			value: function PropertyChain$value(obj, val) {
				var target = this.lastTarget(obj);
				var prop = this.lastProperty();

				if (arguments.length == 2) {
					prop.value(target, val);
				}
				else {
					return prop.value(target);
				}
			},
			isInited: function PropertyChain$isInited(obj) {
				var allInited = true;
				var numProperties = 0;
				this.each(obj, function(target, property) {
					numProperties++;
					if (!property.isInited(target)) {
						allInited = false;
						return false;
					}
				});

				if (numProperties < this._properties.length) {
					allInited = false;
					log("model", "Path \"{0}\" is not inited since \"{1}\" is undefined.", [this.get_path(), this._properties[numProperties - 1].get_name()]);
				}
				else if (allInited) {
					log("model", "Path \"{0}\" has been inited.", [this.get_path()]);
				}
				else {
					log("model", "Path \"{0}\" has NOT been inited.", [this.get_path()]);
				}

				return allInited;
			},
			toString: function PropertyChain$toString() {
				if (this._isStatic) {
					return this.get_path();
				}
				else {
					var path = this._properties.map(function(e) { return e.get_name(); }).join(".");
					return $format("this<{0}>.{1}", [this.get_containingType(), path]);
				}
			}
		};

		ExoWeb.Model.PropertyChain = PropertyChain;
		PropertyChain.registerClass("ExoWeb.Model.PropertyChain");


		///////////////////////////////////////////////////////////////////////////
		function ObjectMeta(type, obj) {
			this._obj = obj;
			this.type = type;
			this._conditions = [];
			this._propertyConditions = {};
		}

		ObjectMeta.prototype = {
			executeRules: function ObjectMeta$executeRules(prop) {
				this.type.get_model()._validatedQueue.push({ sender: this, property: prop.get_name() });
				this._raisePropertyValidating(prop.get_name());

				this.type.executeRules(this._obj, prop);
			},
			property: function ObjectMeta$property(propName) {
				return this.type.property(propName);
			},
			clearConditions: function ObjectMeta$clearConditions(origin) {
				var conditions = this._conditions;

				for (var i = conditions.length - 1; i >= 0; --i) {
					var condition = conditions[i];

					if (condition.get_origin() == origin) {
						this._removeCondition(i);
						this._raisePropertiesValidated(condition.get_properties());
					}
				}
			},

			conditionIf: function ObjectMeta$conditionIf(condition, when) {
				// always remove and re-add the condition to preserve order
				var idx = -1;
				for (var i = 0; i < this._conditions.length; i++) {
					if (this._conditions[i].get_type() === condition.get_type()) {
						idx = i;
						break;
					}
				}

				if (idx >= 0) {
					this._removeCondition(idx);
				}

				if (when) {
					this._addCondition(condition);
				}

				if ((idx < 0 && condition) || (idx >= 0 && !condition)) {
					this._raisePropertiesValidated(condition.get_properties());
				}
			},

			_addCondition: function(condition) {
				this._conditions.push(condition);

				// update _propertyConditions
				var props = condition.get_properties();
				for (var i = 0; i < props.length; ++i) {
					var propName = props[i].get_name();
					var pi = this._propertyConditions[propName];

					if (!pi) {
						pi = [];
						this._propertyConditions[propName] = pi;
					}

					pi.push(condition);
				}
			},

			_removeCondition: function(idx) {
				var condition = this._conditions[idx];
				this._conditions.splice(idx, 1);

				// update _propertyConditions
				var props = condition.get_properties();
				for (var i = 0; i < props.length; ++i) {
					var propName = props[i].get_name();
					var pi = this._propertyConditions[propName];

					var piIdx = $.inArray(condition, pi);
					pi.splice(piIdx, 1);
				}
			},

			_isAllowedOne: function ObjectMeta$_isAllowedOne(code) {
				var conditionType = ConditionType.get(code);

				if (conditionType !== undefined) {
					if (!(conditionType instanceof ConditionType.Permission)) {
						ExoWeb.trace.throwAndLog(["conditions"], "Condition type \"{0}\" should be a Permission.", [code]);
					}

					for (var i = 0; i < this._conditions.length; i++) {
						var condition = this._conditions[i];
						if (condition.get_type() == conditionType) {
							return conditionType.get_isAllowed();
						}
					}

					return !conditionType.get_isAllowed();
				}

				return undefined;
			},

			isAllowed: function ObjectMeta$isAllowed(/*codes*/) {
				if (arguments.length === 0) {
					return undefined;
				}

				for (var i = 0; i < arguments.length; i++) {
					var allowed = this._isAllowedOne(arguments[i]);
					if (!allowed) {
						return allowed;
					}
				}

				return true;
			},

			conditions: function ObjectMeta$conditions(prop) {
				if (!prop) {
					return this._conditions;
				}

				var ret = [];

				for (var i = 0; i < this._conditions.length; ++i) {
					var condition = this._conditions[i];
					var props = condition.get_properties();

					for (var p = 0; p < props.length; ++p) {
						if (props[p].equals(prop)) {
							ret.push(condition);
							break;
						}
					}
				}

				return ret;
			},

			_raisePropertiesValidated: function(properties) {
				var queue = this.type.get_model()._validatedQueue;
				for (var i = 0; i < properties.length; ++i) {
					queue.push({ sender: this, property: properties[i].get_name() });
				}
			},
			addPropertyValidated: function(propName, handler) {
				this._addEvent("propertyValidated:" + propName, handler);
			},
			_raisePropertyValidating: function(propName) {
				var queue = this.type.get_model()._validatingQueue;
				queue.push({ sender: this, propName: propName });
			},
			addPropertyValidating: function(propName, handler) {
				this._addEvent("propertyValidating:" + propName, handler);
			},
			destroy: function() {
				this.type.unregister(this.obj);
			}
		};

		ObjectMeta.mixin(ExoWeb.Functor.eventing);
		ExoWeb.Model.ObjectMeta = ObjectMeta;
		ObjectMeta.registerClass("ExoWeb.Model.ObjectMeta");

		//////////////////////////////////////////////////////////////////////////////////////
		function Rule() { }

		Rule.register = function Rule$register(rule, inputs, isAsync, typeFilter) {
			rule.isAsync = !!isAsync;

			rule.inputs = inputs.map(function(item) {
				if (item instanceof RuleInput) {
					return item;
				}
				else {
					var input = new RuleInput(item);

					// If inputs are not setup up front then they are 
					// assumed to be a target of the rule.

					input.set_isTarget(true);
					return input;
				}
			});

			// If the type filter was not specified then assume 
			// the containing type of the first input property.
			if (arguments.length < 4) {
				typeFilter = rule.inputs[0].property.get_containingType();
			}

			typeFilter.addRule(rule);
		};

		Rule.ensureError = function Rule$ensureError(ruleName, prop) {
			var generatedCode = $format("{0}.{1}.{2}", [prop.get_containingType().get_fullName(), prop.get_label(), name]);
			var conditionType = ConditionType.get(generatedCode);

			if (!conditionType) {
				conditionType = new ConditionType.Error(generatedCode, $format("Generated condition type for {0} rule.", [ruleName]));
				return conditionType;
			}
			else if (conditionType instanceof ConditionType.Error) {
				return conditionType;
			}
			else {
				ExoWeb.trace.throwAndLog("conditions", "Condition type \"{0}\" already exists but is not an error.", [generatedCode]);
			}
		};

		Rule.inferInputs = function Rule$inferInputs(rootType, func) {
			var inputs = [];
			var expr = /this\.get_([a-zA-Z0-9_.]+)/g;

			var match = expr.exec(func.toString());
			while (match) {
				inputs.push(new RuleInput(rootType.property(match[1]).lastProperty()));
				match = expr.exec(func.toString());
			}

			return inputs;
		};

		ExoWeb.Model.Rule = Rule;
		Rule.registerClass("ExoWeb.Model.Rule");

		//////////////////////////////////////////////////////////////////////////////////////
		function RuleInput(property) {
			this.property = property;
		}

		RuleInput.prototype = {
			set_dependsOnInit: function RuleInput$set_dependsOnInit(value) {
				this._init = value;
			},
			get_dependsOnInit: function RuleInput$get_dependsOnInit() {
				return this._init === undefined ? false : this._init;
			},
			set_dependsOnChange: function RuleInput$set_dependsOnChange(value) {
				this._change = value;
			},
			get_dependsOnChange: function RuleInput$get_dependsOnChange() {
				return this._change === undefined ? true : this._change;
			},
			set_dependsOnGet: function RuleInput$set_dependsOnGet(value) {
				this._get = value;
			},
			get_dependsOnGet: function RuleInput$get_dependsOnGet() {
				return this._get === undefined ? false : this._get;
			},
			get_isTarget: function RuleInput$get_isTarget() {
				return this._isTarget === undefined ? false : this._isTarget;
			},
			set_isTarget: function RuleInput$set_isTarget(value) {
				this._isTarget = value;
			}
		};
		ExoWeb.Model.RuleInput = RuleInput;
		RuleInput.registerClass("ExoWeb.Model.RuleInput");

		//////////////////////////////////////////////////////////////////////////////////////
		function RequiredRule(options, properties, type) {
			this.prop = properties[0];

			if (!type) {
				type = Rule.ensureError("required", this.prop);
			}

			this.err = new Condition(type, this.prop.get_label() + " is required", properties, this);

			Rule.register(this, properties);
		}
		RequiredRule.prototype = {
			execute: function(obj) {
				var val = this.prop.value(obj);

				if (val instanceof Array) {
					obj.meta.conditionIf(this.err, val.length === 0);
				}
				else {
					obj.meta.conditionIf(this.err, val === null || val === undefined || ($.trim(val.toString()) == ""));
				}
			},
			toString: function() {
				return $format("{0}.{1} is required", [this.prop.get_containingType().get_fullName(), this.prop.get_name()]);
			}
		};

		Rule.required = RequiredRule;

		//////////////////////////////////////////////////////////////////////////////////////
		function RangeRule(options, properties, type) {
			this.prop = properties[0];

			if (!type) {
				type = Rule.ensureError("range", this.prop);
			}

			this.min = options.min;
			this.max = options.max;

			var hasMin = (this.min !== undefined && this.min !== null);
			var hasMax = (this.max !== undefined && this.max !== null);

			if (hasMin && hasMax) {
				this.err = new Condition(type, $format("{0} must be between {1} and {2}", [this.prop.get_label(), this.min, this.max]), properties, this);
				this._test = this._testMinMax;
			}
			else if (hasMin) {
				this.err = new Condition(type, $format("{0} must be at least {1}", [this.prop.get_label(), this.min]), properties, this);
				this._test = this._testMin;
			}
			else if (hasMax) {
				this.err = new Condition(type, $format("{0} must no more than {1}", [this.prop.get_label()], this.max), properties, this);
				this._test = this._testMax;
			}

			Rule.register(this, properties);
		}
		RangeRule.prototype = {
			execute: function(obj) {
				var val = this.prop.value(obj);
				obj.meta.conditionIf(this.err, this._test(val));
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
				return $format("{0}.{1} in range, min: {2}, max: {3}",
					[this.prop.get_containingType().get_fullName(),
					this.prop.get_name(),
					this.min === undefined ? "" : this.min,
					this.max === undefined ? "" : this.max]);
			}
		};

		Rule.range = RangeRule;

		//////////////////////////////////////////////////////////////////////////////////////
		function AllowedValuesRule(options, properties, type) {
			var prop = this.prop = properties[0];

			if (!type) {
				type = Rule.ensureError("allowedValues", this.prop);
			}

			this.path = options.source;

			this.err = new Condition(type, $format("{0} has an invalid value", [this.prop.get_label()]), properties, this);

			Rule.register(this, properties);

			this._needsInit = true;
		}
		AllowedValuesRule.prototype = {
			_init: function AllowedValuesRule$_init() {
				if (this._needsInit) {
					// type is undefined or not loaded
					if (LazyLoader.isLoaded(this.prop.get_containingType())) {
						this._property = ExoWeb.Model.Model.property(this.path, this.prop.get_containingType());
					}

					delete this._needsInit;
				}
			},
			execute: function AllowedValuesRule$execute(obj) {
				this._init();

				// get the list of allowed values of the property for the given object
				var allowed = this.values(obj);

				if (allowed !== undefined) {

					// get the current value of the property for the given object
					var val = this.prop.value(obj);

					// ensure that the value or list of values is in the allowed values list (single and multi-select)
					if (val instanceof Array) {
						obj.meta.conditionIf(this.err, !val.every(function(item) { return Array.contains(allowed, item); }));
					}
					else {
						obj.meta.conditionIf(this.err, val && !Array.contains(allowed, val));
					}
				}
			},
			property: function AllowedValuesRule$property(obj) {
				this._init();
				return this._property;
			},
			values: function AllowedValuesRule$values(obj) {
				this._init();
				if (this._property && (this._property.get_isStatic() || this._property instanceof Property || this._property.lastTarget(obj))) {

					// get the allowed values from the property chain
					var values = this._property.value(obj);

					// ignore if allowed values list is undefined (non-existent or unloaded type) or has not been loaded
					if (values !== undefined && LazyLoader.isLoaded(values)) {
						return values;
					}
				}
			},
			toString: function AllowedValuesRule$toString() {
				return $format("{0}.{1} allowed values", [this.prop.get_containingType().get_fullName(), this.prop.get_name()]);
			}
		};

		Rule.allowedValues = AllowedValuesRule;

		///////////////////////////////////////////////////////////////////////////////////////
		function StringLengthRule(options, properties, type) {
			this.prop = properties[0];

			if (!type) {
				type = Rule.ensureError("stringLength", this.prop);
			}

			this.min = options.min;
			this.max = options.max;

			var hasMin = (this.min !== undefined && this.min !== null);
			var hasMax = (this.max !== undefined && this.max !== null);

			if (hasMin && hasMax) {
				this.err = new Condition(type, $format("{0} must be between {1} and {2} characters", [this.prop.get_label(), this.min, this.max]), properties, this);
				this._test = this._testMinMax;
			}
			else if (hasMin) {
				this.err = new Condition(type, $format("{0} must be at least {1} characters", [this.prop.get_label(), this.min]), properties, this);
				this._test = this._testMin;
			}
			else if (hasMax) {
				this.err = new Condition(type, $format("{0} must be no more than {1} characters", [this.prop.get_label(), this.max]), properties, this);
				this._test = this._testMax;
			}

			Rule.register(this, properties);
		}
		StringLengthRule.prototype = {
			execute: function(obj) {
				var val = this.prop.value(obj);
				obj.meta.conditionIf(this.err, this._test(val || ""));
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
				return $format("{0}.{1} in range, min: {2}, max: {3}",
					[this.prop.get_containingType().get_fullName(),
					this.prop.get_name(),
					this.min == undefined ? "" : this.min,
					this.max === undefined ? "" : this.max]);
			}
		};

		Rule.stringLength = StringLengthRule;


		//////////////////////////////////////////////////////////////////////////////////////
		function EventQueue(raise, areEqual) {
			this._queueing = 0;
			this._queue = [];
			this._raise = raise;
			this._areEqual = areEqual;
		}

		EventQueue.prototype = {
			startQueueing: function EventQueue$startQueueing() {
				++this._queueing;
			},
			stopQueueing: function EventQueue$stopQueueing() {
				if (--this._queueing === 0) {
					this.raiseQueue();
				}
			},
			push: function EventQueue$push(item) {
				if (this._queueing) {
					if (this._areEqual) {
						for (var i = 0; i < this._queue.length; ++i) {
							if (this._areEqual(item, this._queue[i])) {
								return;
							}
						}
					}

					this._queue.push(item);
				}
				else {
					this._raise(item);
				}
			},
			raiseQueue: function EventQueue$raiseQueue() {
				try {
					for (var i = 0; i < this._queue.length; ++i) {
						this._raise(this._queue[i]);
					}
				}
				finally {
					if (this._queue.length > 0) {
						this._queue = [];
					}
				}
			}
		};

		//////////////////////////////////////////////////////////////////////////////////////
		function ConditionType(code, category, message) {
			// So that sub types can use it's prototype.
			if (arguments.length === 0) {
				return;
			}

			this._code = code;
			this._category = category;
			this._message = message;

			ConditionType._all[code] = this;
		}

		ConditionType._all = {};

		ConditionType.get = function ConditionType$get(code) {
			return ConditionType._all[code];
		};

		ConditionType.prototype = {
			get_code: function ConditionType$get_code() {
				return this._code;
			},
			get_category: function ConditionType$get_category() {
				return this._category;
			},
			get_message: function ConditionType$get_message() {
				return this._message;
			},
			extend: function ConditionType$extend(data) {
				for (var prop in data) {
					if (prop !== "__type" && !this["get_" + prop]) {
						var fieldName = "_" + prop;
						this[fieldName] = data[prop];
						this["get" + fieldName] = function ConditionType$getter() {
							return this[fieldName];
						}
					}
				}
			}
		}
		ExoWeb.Model.ConditionType = ConditionType;
		ConditionType.registerClass("ExoWeb.Model.ConditionType");

		(function() {
			//////////////////////////////////////////////////////////////////////////////////////
			function Error(code, message) {
				ConditionType.call(this, code, "Error", message);
			}

			Error.prototype = new ConditionType();

			ExoWeb.Model.ConditionType.Error = Error;
			Error.registerClass("ExoWeb.Model.ConditionType.Error", ConditionType);

			//////////////////////////////////////////////////////////////////////////////////////
			function Warning(code, message) {
				ConditionType.call(this, code, "Warning", message);
			}

			Warning.prototype = new ConditionType();

			ExoWeb.Model.ConditionType.Warning = Warning;
			Warning.registerClass("ExoWeb.Model.ConditionType.Warning", ConditionType);

			//////////////////////////////////////////////////////////////////////////////////////
			function Permission(code, message, permissionType, isAllowed) {
				ConditionType.call(this, code, "Permission", message);
				this._permissionType = permissionType;
				this._isAllowed = isAllowed;
			}

			Permission.prototype = new ConditionType();

			Permission.mixin({
				get_permissionType: function Permission$get_permissionType() {
					return this._permissionType;
				},
				get_isAllowed: function Permission$get_isAllowed() {
					return this._isAllowed;
				}
			});

			ExoWeb.Model.ConditionType.Permission = Permission;
			Permission.registerClass("ExoWeb.Model.ConditionType.Permission", ConditionType);
		})();

		//////////////////////////////////////////////////////////////////////////////////////
		function Condition(type, message, relatedProperties, origin) {
			this._type = type;
			this._properties = relatedProperties || [];
			this._message = message;
			this._origin = origin;
		}

		Condition.prototype = {
			get_type: function Condition$get_type() {
				return this._type;
			},
			get_properties: function Condition$get_properties() {
				return this._properties;
			},
			get_message: function Condition$get_message() {
				return this._message;
			},
			get_origin: function Condition$get_origin() {
				return this._origin;
			},
			set_origin: function Condition$set_origin(origin) {
				this._origin = origin;
			},
			equals: function Condition$equals(o) {
				return o.property.equals(this.property) && o._message.equals(this._message);
			}
		};

		ExoWeb.Model.Condition = Condition;
		Condition.registerClass("ExoWeb.Model.Condition");

		//////////////////////////////////////////////////////////////////////////////////////
		var formatConditionType = new ConditionType("FormatError", "Error", "The value is not properly formatted.");

		function FormatError(message, invalidValue) {
			this._message = message;
			this._invalidValue = invalidValue;
		}

		FormatError.mixin({
			createCondition: function FormatError$createCondition(origin, prop) {
				return new Condition(formatConditionType,
					$format(this.get_message(), { value: prop.get_label() }),
					[prop],
					origin);
			},
			get_message: function FormateError$get_message() {
				return this._message;
			},
			get_invalidValue: function FormateError$get_invalidValue() {
				return this._invalidValue;
			},
			toString: function FormateError$toString() {
				return this._invalidValue;
			}
		});

		ExoWeb.Model.FormatError = FormatError;
		FormatError.registerClass("ExoWeb.Model.FormatError");

		//////////////////////////////////////////////////////////////////////////////////////
		function Format(options) {
			this._paths = options.paths;
			this._convert = options.convert;
			this._convertBack = options.convertBack;
			this._description = options.description;
			this._nullString = options.nullString || "";
			this._undefinedString = options.undefinedString || "";
		}

		Format.fromTemplate = (function Format$fromTemplate(convertTemplate) {
			var paths = [];
			convertTemplate.replace(/{([a-z0-9_.]+)}/ig, function(match, expr) {
				paths.push(expr);
				return expr;
			});

			return new Format({
				paths: paths,
				convert: function convert(obj) {
					if (obj === null || obj === undefined) {
						return "";
					}

					return $format(convertTemplate, obj);
				}
			});
		}).cached({ key: function(convertTemplate) { return convertTemplate; } });

		Format.mixin({
			getPaths: function() {
				return this._paths || [];
			},
			convert: function(val) {
				if (val === undefined) {
					return this._undefinedString;
				}

				if (val === null) {
					return this._nullString;
				}

				if (val instanceof FormatError) {
					return val.get_invalidValue();
				}

				if (!this._convert) {
					return val;
				}

				return this._convert(val);
			},
			convertBack: function(val) {
				if (val == this._nullString) {
					return null;
				}

				if (val == this._undefinedString) {
					return;
				}

				if (val.constructor == String) {
					val = val.trim();

					if (val.length === 0) {
						return null;
					}
				}

				if (!this._convertBack) {
					return val;
				}

				try {
					return this._convertBack(val);
				}
				catch (err) {
					return new FormatError(this._description ?
								"{value} must be formatted as " + this._description :
								"{value} is not properly formatted",
								val);
				}
			}
		});

		ExoWeb.Model.Format = Format;
		Format.registerClass("ExoWeb.Model.Format");

		// Type Format Strings
		/////////////////////////////////////////////////////////////////////////////////////////////////////////
		Number.formats = {};
		String.formats = {};
		Date.formats = {};
		TimeSpan.formats = {};
		Boolean.formats = {};
		Object.formats = {};

		//TODO: number formatting include commas
		Number.formats.Integer = new Format({
			description: "#,###",
			convert: function(val) {
				return Math.round(val).toString();
			},
			convertBack: function(str) {
				if (!/^([-\+])?(\d+)?\,?(\d+)?\,?(\d+)?\,?(\d+)$/.test(str)) {
					throw new Error("invalid format");
				}

				return parseInt(str, 10);
			}
		});

		Number.formats.Float = new Format({
			description: "#,###.#",
			convert: function(val) {
				return val.toString();
			},
			convertBack: function(str) {
				var val = parseFloat(str);
				if (isNaN(val)) {
					throw new Error("invalid format");
				}
				return val;
			}
		});

		Number.formats.Percent = new Format({
			description: "##.#%",
			convert: function(val) {
				return (val * 100).toPrecision(3).toString() + " %";
			}
		});

		Number.formats.Currency = new Format({
			description: "$#.##",
			convert: function(val) {
				return "$" + val.toFixed(2).toString();
			}
		});

		Number.formats.$system = Number.formats.Float;

		String.formats.Phone = new Format({
			description: "###-###-####",
			convertBack: function(str) {
				if (!/^[0-9]{3}-[0-9]{3}-[0-9]{4}$/.test(str)) {
					throw new Error("invalid format");
				}

				return str;
			}
		});

		String.formats.$system = new Format({
			convertBack: function(val) {
				return val ? $.trim(val) : val;
			}
		});

		Boolean.formats.YesNo = new Format({
			convert: function(val) { return val ? "yes" : "no"; },
			convertBack: function(str) { return str == "yes"; }
		});

		Boolean.formats.TrueFalse = new Format({
			convert: function(val) { return val ? "true" : "false"; },
			convertBack: function(str) {
				if (str.toLowerCase() == "true") {
					return true;
				}
				else if (str.toLowerCase() == "false") {
					return false;
				}
			}
		});

		Boolean.formats.$system = Boolean.formats.TrueFalse;
		Boolean.formats.$display = Boolean.formats.YesNo;

		Date.formats.DateTime = new Format({
			description: "mm/dd/yyyy hh:mm AM/PM",
			convert: function(val) {
				return val.format("MM/dd/yyyy h:mm tt");
			},
			convertBack: function(str) {
				var val = Date.parseInvariant(str);

				if (val !== null) {
					return val;
				}

				throw new Error("invalid date");
			}
		});

		Date.formats.ShortDate = new Format({
			description: "mm/dd/yyyy",
			convert: function(val) {
				return val.format("M/d/yyyy");
			},
			convertBack: function(str) {
				var val = Date.parseInvariant(str);

				if (val !== null) {
					return val;
				}

				throw new Error("invalid date");
			}
		});

		Date.formats.Time = new Format({
			description: "HH:MM AM/PM",
			convert: function(val) {
				return val.format("h:mm tt");
			},
			convertBack: function(str) {
				var parser = /^(1[0-2]|0?[1-9]):([0-5][0-9]) *(AM?|(PM?))$/i;

				var parts = str.match(parser);

				if (!parts) {
					throw new Error("invalid time");
				}

				// build new date, start with current data and overwite the time component
				var val = new Date();

				// hours
				if (parts[4]) {
					val.setHours((parseInt(parts[1], 10) % 12) + 12);  // PM
				}
				else {
					val.setHours(parseInt(parts[1], 10) % 12);  // AM
				}

				// minutes
				val.setMinutes(parseInt(parts[2], 10));

				// keep the rest of the time component clean
				val.setSeconds(0);
				val.setMilliseconds(0);

				return val;
			}
		});

		Date.formats.$system = Date.formats.DateTime;
		Date.formats.$display = Date.formats.DateTime;

		TimeSpan.formats.Meeting = new ExoWeb.Model.Format({
			convert: function(val) {
				var num;
				var label;

				if (val.totalHours < 1) {
					num = Math.round(val.totalMinutes);
					label = "minute";
				}
				else if (val.totalDays < 1) {
					num = Math.round(val.totalHours * 100) / 100;
					label = "hour";
				}
				else {
					num = Math.round(val.totalDays * 100) / 100;
					label = "day";
				}

				return num == 1 ? (num + " " + label) : (num + " " + label + "s");
			},
			convertBack: function(str) {
				var parser = /^([0-9]+(\.[0-9]+)?) *(m((inute)?s)?|h((our)?s?)|hr|d((ay)?s)?)$/i;

				var parts = str.match(parser);

				if (!parts) {
					throw new Error("invalid format");
				}

				var num = parseFloat(parts[1]);
				var ms;

				if (parts[3].startsWith("m")) {
					ms = num * 60 * 1000;
				}
				else if (parts[3].startsWith("h")) {
					ms = num * 60 * 60 * 1000;
				}
				else if (parts[3].startsWith("d")) {
					ms = num * 24 * 60 * 60 * 1000;
				}

				return new TimeSpan(ms);
			}
		});

		TimeSpan.formats.$display = TimeSpan.formats.Meeting;
		TimeSpan.formats.$system = TimeSpan.formats.Meeting;  // TODO: implement Exact format

		/////////////////////////////////////////////////////////////////////////////////////////////////////////
		function LazyLoader() {
		}
		LazyLoader.eval = function LazyLoader$eval(target, path, successCallback, errorCallback, scopeChain, thisPtr/*, continueFn*/) {
			if (!ExoWeb.isDefined(path)) {
				path = "";
			}

			if (ExoWeb.isType(path, String)) {
				path = new PathTokens(path);
			}
			else if (ExoWeb.isType(path, Array)) {
				path = new PathTokens(path.join("."));
			}
			else if (!ExoWeb.isType(path, PathTokens)) {
				ExoWeb.trace.throwAndLog("lazyLoad", "Unknown path \"{0}\" of type {1}.", [path, ExoWeb.parseFunctionName(path.constructor)]);
			}

			scopeChain = scopeChain || [window];

			if (!ExoWeb.isDefined(target)) {
				target = Array.dequeue(scopeChain);
			}

			// Allow an invocation to specify continuing loading properties using a given function, by default this is LazyLoader.eval.
			// This is used by evalAll to ensure that array properties can be force loaded at any point in the path.
			var continueFn = arguments.length == 7 && arguments[6] instanceof Function ? arguments[6] : LazyLoader.eval;

			while (path.steps.length > 0) {
				// If an array is encountered and this call originated from "evalAll" then delegate to "evalAll", otherwise 
				// this will most likely be an error condition unless the remainder of the path are properties of Array.
				if (continueFn == LazyLoader.evalAll && target instanceof Array) {
					continueFn(target, path, successCallback, errorCallback, scopeChain, thisPtr, continueFn);
					return;
				}

				var step = Array.dequeue(path.steps);

				if (!LazyLoader.isLoaded(target, step.property)) {
					LazyLoader.load(target, step.property, function() {
						var nextTarget = ExoWeb.getValue(target, step.property);

						// If the next target is undefined then there is a problem since getValue returns null if a property exists but returns no value.
						if (nextTarget === undefined) {
							// Backtrack using the next item in the scope chain.
							if (scopeChain.length > 0) {
								Array.insert(path.steps, 0, step);

								continueFn(Array.dequeue(scopeChain), path, successCallback, errorCallback, scopeChain, thisPtr, continueFn);
							}
							// Nowhere to backtrack, so return or throw an error.
							else if (errorCallback) {
								errorCallback.call(thisPtr, "Property is undefined: " + step.property);
							}
							else {
								throwAndLog(["lazyLoad"], "Cannot complete property evaluation because a property is undefined: {0}", [step.property]);
							}
						}
						// Continue if there is a next target and either no cast of the current property or the value is of the cast type.
						else if (nextTarget !== null && (!step.cast || ExoWeb.isType(nextTarget, step.cast))) {
							continueFn(nextTarget, path, successCallback, errorCallback, [], thisPtr, continueFn);
						}
						// If the next target is defined & non-null or not of the cast type, then exit with success.
						else if (successCallback) {
							successCallback.call(thisPtr, null);
						}
					});

					return;
				}
				else {
					var propValue = ExoWeb.getValue(target, step.property);

					// If the value is undefined then there is a problem since getValue returns null if a property exists but returns no value.
					if (propValue === undefined) {
						if (scopeChain.length > 0) {
							Array.insert(path.steps, 0, step);
							target = Array.dequeue(scopeChain);
						}
						else {
							if (errorCallback) {
								errorCallback.call(thisPtr, "Property is undefined: " + step.property);
							}
							else {
								throwAndLog(["lazyLoad"], "Cannot complete property evaluation because a property is undefined: {0}", [step.property]);
							}

							return;
						}
					}
					// The next target is null (nothing left to evaluate) or there is a cast of the current property and the value is 
					// not of the cast type (no need to continue evaluating).
					else if (propValue === null || (step.cast && !ExoWeb.isType(propValue, step.cast))) {
						if (successCallback) {
							successCallback.call(thisPtr, null);
						}
						return;
					}
					// Otherwise, continue to the next property.
					else {
						if (scopeChain.length > 0) {
							scopeChain = [];
						}

						target = propValue;
					}
				}
			}

			// Load final object
			if (ExoWeb.isDefined(target) && !LazyLoader.isLoaded(target)) {
				LazyLoader.load(target, null, function() { successCallback.call(thisPtr, target); });
			}
			else if (successCallback) {
				successCallback.call(thisPtr, target);
			}
		};

		LazyLoader.evalAll = function LazyLoader$evalAll(target, path, successCallback, errorCallback, scopeChain, thisPtr) {
			if (target instanceof Array) {
				if (LazyLoader.isLoaded(target)) {
					var signal = new ExoWeb.Signal();
					var results = [];
					var errors = [];
					var successCallbacks = [];
					var errorCallbacks = [];

					var allSucceeded = true;

					Array.forEach(target, function(subTarget, i) {
						results.push(null);
						errors.push(null);
						successCallbacks.push(signal.pending(function(result) {
							results[i] = result;
						}));
						errorCallbacks.push(signal.orPending(function(err) {
							allSucceeded = false;
							errors[i] = err;
						}));
					});

					Array.forEach(target, function(subTarget, i) {
						LazyLoader.eval(subTarget, path, successCallbacks[i], errorCallbacks[i], scopeChain, thisPtr, LazyLoader.evalAll);
					});

					signal.waitForAll(function() {
						if (allSucceeded) {
							// call the success callback if one exists
							if (successCallback) {
								successCallback.call(thisPtr, results);
							}
						}
						else if (errorCallback) {
							errorCallback.call(thisPtr, errors);
						}
						else {
							var numErrors = 0;
							Array.forEach(errors, function(e) {
								if (e) {
									ExoWeb.trace.logError(["lazyLoad"], e);
									numErrors += 1;
								}
								throwAndLog(["lazyLoad"], "{0} errors encountered while attempting to eval paths for all items in the target array.", [numErrors]);
							});
						}
					});
				}
				else {
					LazyLoader.load(target, null, function() {
						LazyLoader.evalAll(target, path, successCallback, errorCallback, scopeChain, thisPtr);
					});
				}
			}
			else {
				LazyLoader.evalAll([target], path, successCallback, errorCallback, scopeChain, thisPtr);
			}
		};

		LazyLoader.isLoaded = function LazyLoader$isLoaded(obj, propName) {
			if (!ExoWeb.isDefined(obj)) {
				return false;
			}

			var reg = obj._lazyLoader;

			if (!reg) {
				return true;
			}

			var loader;
			if (propName && reg.byProp) {
				loader = reg.byProp[propName];
			}

			if (!loader) {
				loader = reg.allProps;
			}

			return !loader || (loader.isLoaded && obj._lazyLoader.isLoaded(obj, propName));
		};

		LazyLoader.load = function LazyLoader$load(obj, propName, callback) {
			var reg = obj._lazyLoader;
			if (!reg) {
				if (callback && callback instanceof Function) {
					callback();
				}
			}
			else {
				var loader;
				if (propName && reg.byProp) {
					loader = reg.byProp[propName];
				}

				if (!loader) {
					loader = reg.allProps;
				}

				if (!loader) {
					throwAndLog(["lazyLoad"], "Attempting to load object but no appropriate loader is registered. object: {0}, property: {1}", [obj, propName]);
				}

				loader.load(obj, propName, callback);
			}
		};

		LazyLoader.isRegistered = function LazyLoader$isRegistered(obj, loader, propName) {
			var reg = obj._lazyLoader;

			if (!reg) {
				return false;
			}
			if (propName) {
				return reg.byProp && reg.byProp[propName] === loader;
			}

			return reg.allProps === loader;
		};

		LazyLoader.register = function LazyLoader$register(obj, loader, propName) {
			var reg = obj._lazyLoader;

			if (!reg) {
				reg = obj._lazyLoader = {};
			}

			if (propName) {
				if (!reg.byProp) {
					reg.byProp = {};
				}

				reg.byProp[propName] = loader;
			}
			else {
				obj._lazyLoader.allProps = loader;
			}
		};

		LazyLoader.unregister = function LazyLoader$unregister(obj, loader, propName) {
			var reg = obj._lazyLoader;

			if (!reg) {
				return;
			}

			if (propName) {
				delete reg.byProp[propName];
			} else if (reg.byProp) {
				var allDeleted = true;
				for (var p in reg.byProp) {
					if (reg.byProp[p] === loader) {
						delete reg.byProp[p];
					}
					else {
						allDeleted = false;
					}
				}

				if (allDeleted) {
					delete reg.byProp;
				}
			}

			if (reg.allProps === loader) {
				delete reg.allProps;
			}

			if (!reg.byProp && !reg.allProps) {
				delete obj._lazyLoader;
			}
		};

		ExoWeb.Model.LazyLoader = LazyLoader;
		LazyLoader.registerClass("ExoWeb.Model.LazyLoader");
	}

	if (window.Sys && Sys.loader) {
		Sys.loader.registerScript("ExoWebModel", null, execute);
	}
	else {
		execute();
	}

})();
