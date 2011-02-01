function Type(model, name, baseType) {
	this._rules = {};
	this._fullName = name;
	this._pool = {};
	this._legacyPool = {};
	this._counter = 0;
	this._properties = {};
	this._instanceProperties = {};
	this._staticProperties = {};
	this._model = model;
	this._initNewProps = [];
	this._initExistingProps = [];

	// generate class and constructor
	var jstype = Model.getJsType(name, true);

	if (jstype) {
		ExoWeb.trace.throwAndLog(["model"], "'{1}' has already been declared", arguments);
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
	jstype = generateClass(this);

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

var disableConstruction = false;

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
};

function generateClass(type)
{
	function construct(idOrProps, props) {
		if (!disableConstruction) {
			if (idOrProps && idOrProps.constructor === String) {
				var id = idOrProps;
				var obj = type.get(id);
				if (obj) {
					if (props) {
						obj.init(props);
					}
					return obj;
				}

				type.register(this, id);
				type._initProperties(this, "_initExistingProps");

				if (props) {
					this.init(props);
				}
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

	return construct;
}

Type.prototype = {
	toIdString: function Type$toIdString(id) {
		if (id) {
			return $format("{0}|{1}", [this.get_fullName(), id]);
		}
	},
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
			if (t._pool.hasOwnProperty(key)){
				ExoWeb.trace.throwAndLog("model", "Object \"{0}|{1}\" has already been registered.", [this.get_fullName(), id]);
			}

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
				ExoWeb.trace.throwAndLog("model", "Cannot create property {0}.{1} because there is not a '{2}' format defined for {3}", [this._fullName, def.name, def.format, def.type]);
			}
		}

		var prop = new Property(this, def.name, def.type, def.isList, def.label, format, def.isStatic, def.index);

		this._properties[def.name] = prop;
		(def.isStatic ? this._staticProperties : this._instanceProperties)[def.name] = prop;

		// modify jstype to include functionality based on the type definition
		function genPropertyShortcut(mtype, overwrite) {
			var shortcutName = "$" + def.name;
			if (!(shortcutName in mtype._jstype) || overwrite) {
				mtype._jstype[shortcutName] = prop;
			}

			mtype.derivedTypes.forEach(function(t) {
				genPropertyShortcut(t, false);
			});
		}
		genPropertyShortcut(this, true);

		// does this property need to be inited during object construction?
		// note: this is an optimization so that all properties defined for a type and 
		// its sub types don't need to be iterated over each time the constructor is called.
		if (!prop.get_isStatic()) {
			if (prop.get_isList()) {
				this._initNewProps.push({ property: prop, valueFn: function() { return []; } });

				if (prop.get_origin() != "server") {
					this._initExistingProps.push({ property: prop, valueFn: function() { return []; } });
					Array.forEach(this.known(), function(obj) {
						prop.init(obj, []);
					});
				}
			}
			// Presumably the reason for this is that property calculation could be based on init of
			// this property, though it seems unlikely that this would solve more problems that it causes.
			else if (prop.get_origin() == "server") {
				this._initNewProps.push({ property: prop, valueFn: function() { return undefined; } });
			}
		}


		if (prop.get_isStatic()) {
			// for static properties add member to javascript type
			this._jstype["get_" + def.name] = this._makeGetter(prop, prop._getter, true);
		}
		else {
			// for instance properties add member to all instances of this javascript type
			this._jstype.prototype["get_" + def.name] = this._makeGetter(prop, prop._getter, true);
		}

		if (!prop.get_isList()) {
			if (prop.get_isStatic()) {
				this._jstype["set_" + def.name] = this._makeSetter(prop, prop._setter, true, true);
			}
			else {
				this._jstype.prototype["set_" + def.name] = this._makeSetter(prop, prop._setter, true, true);
			}
		}

		return prop;
	},
	addMethod: function Type$addMethod(def) {
		this._jstype.prototype[def.name] = function () 
		{
			// Detect the optional success and failure callback delegates
			var onSuccess;
			var onFail;
			var paths = null;					

			if (arguments.length > 1)
			{
				onSuccess = arguments[arguments.length-2];
				if (onSuccess instanceof Function) {
					onFail = arguments[arguments.length-1];
				}
				else {
					onSuccess = arguments[arguments.length-1];
				}						
			}
			else if (arguments.length > 0)
				onSuccess = arguments[arguments.length-1];

			if (!onSuccess instanceof Function)
				onSuccess = undefined;

			var argCount = arguments.length - (onSuccess === undefined ? 0 : 1) - (onFail === undefined ? 0 : 1);
			var firstArgCouldBeParameterSet = argCount > 0 && arguments[0] instanceof Object && !(def.parameters.length == 0 || arguments[0][def.parameters[0]] === undefined);

			if (argCount >= 1 && argCount <= 2 && arguments[0] instanceof Object &&
					((argCount == 1 && (def.parameters.length != 1 || firstArgCouldBeParameterSet)) ||
					((argCount == 2 && (def.parameters.length != 2 || (firstArgCouldBeParameterSet && arguments[1] instanceof Array))))))
			{

				// Invoke the server event
				context.server.raiseServerEvent(def.name, this, arguments[0], false, function(result) { onSuccess(result.event); }, onFail, false, argCount == 2 ? arguments[1] : null);
			}

			// Otherwise, assume that the parameters were all passed in sequential order
			else {
				// Throw an error if the incorrect number of arguments were passed to the method
				if (def.parameters.length == argCount - 1 && arguments[argCount - 1] instanceof Array)
					paths = arguments[argCount - 1];
				else if (def.parameters.length != argCount)
					ExoWeb.trace.throwAndLog("type", "Invalid number of arguments passed to \"{0}.{1}\" method.", [this._fullName, def.name]);

				// Construct the arguments to pass
				var args = {};
				for (var parameter in def.parameters)
					args[def.parameters[parameter]] = arguments[parameter];

				// Invoke the server event
				context.server.raiseServerEvent(def.name, this, args, false, function(result) { onSuccess(result.event); }, onFail, false, paths);
			}
		};
	},
	_makeGetter: function Type$_makeGetter(receiver, fn, skipTypeCheck) {
		return function() {
			return fn.call(receiver, this, skipTypeCheck);
		};
	},
	_makeSetter: function Type$_makeSetter(receiver, fn, notifiesChanges, skipTypeCheck) {
		var setter = function(val) {
			fn.call(receiver, this, val, skipTypeCheck);
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
	get_properties: function Type$get_properties() {
		return ExoWeb.objectToArray(this._properties);
	},
	get_staticProperties: function Type$get_staticProperties() {
		return this._staticProperties;
	},
	get_instanceProperties: function Type$get_instanceProperties() {
		return this._instanceProperties;
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
		function Type$addRule$init(sender, args) {
			if (!args.wasInited && rule.inputs.every(function(input) { return input.property === args.property || !input.get_dependsOnInit() || input.property.isInited(sender, true); })) {
				Type$addRule$fn(sender, args.property, rule.execute);
			}
		}
		function Type$addRule$changed(sender, args) {
			if (args.wasInited && rule.inputs.every(function(input) { return input.property == args.property || !input.get_dependsOnInit() || input.property.isInited(sender, true); })) {
				Type$addRule$fn(sender, args.property, rule.execute);
			}
		}
		function Type$addRule$get(sender, args) {
			try {
				// Only execute rule on property get if the property has not been initialized.
				// This is based on the assumption that a rule should only fire on property
				// get for the purpose of lazy initializing the property value.
				if (!args.isInited) {
					Type$addRule$fn(sender, args.property, rule.execute);
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
				ExoWeb.trace.log("rule", "executing rule '{0}' that depends on property '{1}'", [rule, prop]);
				fn.call(rule, obj);
			}
			catch (err) {
				ExoWeb.trace.throwAndLog("rules", "Error running rule '{0}': {1}", [rule, err]);
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
					function(sender, args) {
						if (sender instanceof jstype) {
							Type$addRule$changed.apply(this, arguments);
						}
					}
				);
			}

			if (input.get_dependsOnInit()) {
				prop.addChanged(isSameType ?
					Type$addRule$init :
					function(sender, args) {
						if (sender instanceof jstype) {
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
//									ExoWeb.trace.log("rule", "executing rule '{0}' that depends on property '{1}'", [rule, prop]);
							rule.execute(obj, function() {
								rule._isExecuting = false;
								_this.executeRules(obj, prop, callback, i + 1);
							});
							break;
						}
						else {
							try {
//										ExoWeb.trace.log("rule", "executing rule '{0}' that depends on property '{1}'", [rule, prop]);
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
	eachBaseType: function Type$eachBaseType(callback, thisPtr) {
		for (var baseType = this.baseType; !!baseType; baseType = baseType.baseType) {
			if (callback.call(thisPtr || this, baseType) === false) {
				return;
			}
		}
	},
	isSubclassOf: function Type$isSubclassOf(mtype) {
		var result = false;

		this.eachBaseType(function(baseType) {
			if (baseType === mtype) {
				result = true;
				return false;
			}
		});

		return result;
	},
	toString: function Type$toString() {
		return this.get_fullName();
	}
};

Type.mixin(ExoWeb.Functor.eventing);
ExoWeb.Model.Type = Type;
Type.registerClass("ExoWeb.Model.Type");