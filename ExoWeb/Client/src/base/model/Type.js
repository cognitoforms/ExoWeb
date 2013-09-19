function Type(model, name, baseType, origin) {
	this._fullName = name;

	// if origin is not provided it is assumed to be client
	this._origin = origin || "client";
	this._originForNewProperties = this._origin;

	this._pool = {};
	this._legacyPool = {};
	this._counter = 0;
	this._properties = {}; 
	this._instanceProperties = {};
	this._staticProperties = {};
	this._pendingInit = [];
	this._pendingInvocation = [];

	// define properties
	Object.defineProperty(this, "model", { value: model });
	Object.defineProperty(this, "rules", { value: [] });

	// generate class and constructor
	var jstype = Model.getJsType(name, true);

	// create namespaces as needed
	var nameTokens = name.split("."),
		token = nameTokens.dequeue(),
		namespaceObj = Model.types,
		globalObj = window;

	while (nameTokens.length > 0) {
		namespaceObj = model._ensureNamespace(token, namespaceObj);
		globalObj = model._ensureNamespace(token, globalObj);
		token = nameTokens.dequeue();
	}

	// the final name to use is the last token
	var finalName = token;
	jstype = generateClass(this);

	this._jstype = jstype;

	// If the namespace already contains a type with this name, append a '$' to the name
	if (!namespaceObj[finalName]) {
		namespaceObj[finalName] = jstype;
	}
	else {
		namespaceObj['$' + finalName] = jstype;
	}

	// If the global object already contains a type with this name, append a '$' to the name
	if (!globalObj[finalName]) {
		globalObj[finalName] = jstype;
	}
	else {
		globalObj['$' + finalName] = jstype;
	}

	// setup inheritance
	this.derivedTypes = [];
	var baseJsType;

	if (baseType) {
		baseJsType = baseType._jstype;

		this.baseType = baseType;
		baseType.derivedTypes.push(this);
		
		// inherit all shortcut properties that have aleady been defined
		inheritBaseTypePropShortcuts(jstype, baseType);
	}
	else {
		baseJsType = Entity;
		this.baseType = null;
	}

	disableConstruction = true;
	this._jstype.prototype = new baseJsType();
	disableConstruction = false;

	this._jstype.prototype.constructor = this._jstype;

	// helpers
	jstype.meta = this;

	// Add self-reference to decrease the likelihood of errors
	// due to an absence of the necessary type vs. entity.
	this.type = this;
}

// copy shortcut properties from a base meta type (recursively) to a target jstype
function inheritBaseTypePropShortcuts(jstype, baseType) {
	for (var propName in baseType._properties) {
		jstype["$" + propName] = baseType._properties[propName];
	}

	// recursively add base type properties
	if (baseType.baseType) {
		inheritBaseTypePropShortcuts(jstype, baseType.baseType);
	}
}

var disableConstruction = false;

var validateId = function Type$validateId(type, id) {
	if (id === null || id === undefined) {
		throw new Error($format("Id cannot be {0} (entity = {1}).", id === null ? "null" : "undefined", type.get_fullName()));
	}
	else if (!ExoWeb.isString(id)) {
		throw new Error($format("Id must be a string:  encountered id {0} of type \"{1}\" (entity = {2}).",
			id.toString(), parseFunctionName(id.constructor), type.get_fullName()));
	}
	else if (id === "") {
		throw new Error($format("Id cannot be a blank string (entity = {0}).", type.get_fullName()));
	}
};

function generateClass(type) {
	function construct(idOrProps, props) {
		if (!disableConstruction) {
			if (idOrProps && idOrProps.constructor === String) {
				var id = idOrProps;
				var obj = type.get(id,
					// When a constructor is called we do not want to silently
					// return an instance of a sub type, so fetch using exact type.
					true,
					// Indicate that an object is currently being constructed.
					true);

				// If the instance already exists, then initialize properties and return it.
				if (obj) {
					if (props) {
						obj.init(props);
					}
					return obj;
				}

				// Register the newly constructed existing instance.
				type.register(this, id);

				// Initialize properties if provided.
				if (props) {
					this.init(props);
				}
			}
			else {
				// Register the newly constructed new instance. It will
				// be assigned a sequential client-generated id.
				type.register(this);

				// Set properties passed into constructor.
				if (idOrProps) {
					this.set(idOrProps);
				}

				// Raise initNew event if registered.
				for (var t = type; t; t = t.baseType) {
					var handler = t._getEventHandler("initNew");
					if (handler) {
						handler(this, {});
					}
				}
			}
		}
	}

	return construct;
}

var newIdPrefix = "+c";

Type.getNewIdPrefix = function getNewIdPrefix() {
	if (arguments.length > 0) throw new Error("The method getNewIdPrefix does not accept arguments");
	return newIdPrefix.substring(1);
};

Type.setNewIdPrefix = function setNewIdPrefix(prefix) {
	if (prefix === null || prefix === undefined) throw new Error("The new id prefix argument is required");
	if (typeof(prefix) !== "string") throw new TypeError("The new id prefix must be a string, found " + prefix.toString());
	if (prefix.length === 0) throw new Error("The new id prefix cannot be empty string");
	newIdPrefix = "+" + prefix;
};

Type.prototype = {
	// gets and optionally sets the pending initialization status for a static property on the type
	pendingInvocation: function Type$pendingInvocation(rule, value) {
		var indexOfRule = this._pendingInvocation.indexOf(rule);
		if (arguments.length > 1) {
			if (value && indexOfRule < 0) {
				this._pendingInvocation.push(rule);
			}
			else if (!value && indexOfRule >= 0) {
				this._pendingInvocation.splice(indexOfRule, 1);
			}
		}
		return indexOfRule >= 0;
	},

	addInitNew: function Type$addInitNew(handler, obj, once) {
		this._addEvent("initNew", handler, obj ? equals(obj) : null, once);
		return this;
	},

	// gets and optionally sets the pending initialization status for a static property on the type
	pendingInit: function Type$pendingInit(prop, value) {
		var result = this[prop._fieldName] === undefined || this._pendingInit[prop.get_name()] === true;
		if (arguments.length > 1) {
			if (value) {
				this._pendingInit[prop.get_name()] = true;
			}
			else {
				delete this._pendingInit[prop.get_name()];
			}
		}
		return result;
	},
	addInitExisting: function Type$addInitExisting(handler, obj, once) {
		this._addEvent("initExisting", handler, obj ? equals(obj) : null, once);
		return this;
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
		return newIdPrefix + nextId;
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
		Observer.makeObservable(obj);

		for (var t = this; t; t = t.baseType) {
			if (t._pool.hasOwnProperty(key)) {
				throw new Error($format("Object \"{0}|{1}\" has already been registered.", this.get_fullName(), id));
			}

			t._pool[key] = obj;
			if (t._known) {
				t._known.add(obj);
			}
		}

		this.model.notifyObjectRegistered(obj);
	},
	changeObjectId: function Type$changeObjectId(oldId, newId) {
		validateId(this, oldId);
		validateId(this, newId);

		var oldKey = oldId.toLowerCase();
		var newKey = newId.toLowerCase();

		var obj = this._pool[oldKey];

		if (obj) {
			obj.meta.legacyId = oldId;

			for (var t = this; t; t = t.baseType) {
				t._pool[newKey] = obj;

				delete t._pool[oldKey];

				t._legacyPool[oldKey] = obj;
			}

			obj.meta.id = newId;

			return obj;
		}
		else {
			logWarning($format("Attempting to change id: Instance of type \"{0}\" with id = \"{1}\" could not be found.", this.get_fullName(), oldId));
		}
	},
	unregister: function Type$unregister(obj) {
		for (var t = this; t; t = t.baseType) {
			delete t._pool[obj.meta.id.toLowerCase()];

			if (obj.meta.legacyId) {
				delete t._legacyPool[obj.meta.legacyId.toLowerCase()];
			}

			if (t._known) {
				t._known.remove(obj);
			}
		}

		this.model.notifyObjectUnregistered(obj);
	},
	get: function Type$get(id, exactTypeOnly) {
		validateId(this, id);

		var key = id.toLowerCase();
		var obj = this._pool[key] || this._legacyPool[key];

		// If exactTypeOnly is specified, don't return sub-types.
		if (obj && exactTypeOnly === true && obj.meta.type !== this) {
			throw new Error($format("The entity with id='{0}' is expected to be of type '{1}' but found type '{2}'.", id, this._fullName, obj.meta.type._fullName));
		}

		return obj;
	},
	// Gets an array of all objects of this type that have been registered.
	// The returned array is observable and collection changed events will be raised
	// when new objects are registered or unregistered.
	// The array is in no particular order.
	known: function Type$known() {
		var list = this._known;
		if (!list) {
			list = this._known = [];

			for (var id in this._pool) {
				list.push(this._pool[id]);
			}

			Observer.makeObservable(list);
		}

		return list;
	},
	addPropertyAdded: function (handler) {
		this._addEvent("propertyAdded", handler);
	},
	addRule: function Type$addRule(def) {
		return new Rule(this, def);
	},
	addProperty: function Type$addProperty(def) {
		var format = def.format;
		if (format && format.constructor === String) {
			format = getFormat(def.type, format);
		}

		var prop = new Property(this, def.name, def.type, def.label, def.helptext, format, def.isList, def.isStatic, def.isPersisted, def.isCalculated, def.index, def.defaultValue);

		this._properties[def.name] = prop;
		(def.isStatic ? this._staticProperties : this._instanceProperties)[def.name] = prop;

		// modify jstype to include functionality based on the type definition
		function genPropertyShortcut(mtype, overwrite) {
			var shortcutName = "$" + def.name;
			if (!(shortcutName in mtype._jstype) || overwrite) {
				mtype._jstype[shortcutName] = prop;
			}

			mtype.derivedTypes.forEach(function (t) {
				genPropertyShortcut(t, false);
			});
		}
		genPropertyShortcut(this, true);

		if (prop.get_isStatic()) {
			// for static properties add member to javascript type
			this._jstype["get_" + def.name] = this._makeGetter(prop, Property$_getter.bind(prop), true);
		}
		else {
			// for instance properties add member to all instances of this javascript type
			this._jstype.prototype["get_" + def.name] = this._makeGetter(prop, Property$_getter.bind(prop), true);
		}

		if (!prop.get_isList()) {
			if (prop.get_isStatic()) {
				this._jstype["set_" + def.name] = this._makeSetter(prop);
			}
			else {
				this._jstype.prototype["set_" + def.name] = this._makeSetter(prop);
			}
		}

		this._raiseEvent("propertyAdded", [this, { property: prop}]);

		return prop;
	},
	addMethod: function Type$addMethod(def) {
		var methodName = this.get_fullName() + "." + def.name;
		var method = function () {
			//signature: p1, p2, p#, paths, onSuccess, onFail

			// Detect the optional success and failure callback delegates
			var onSuccess;
			var onFail;
			var paths = null;

			if (arguments.length > 1) {
				onSuccess = arguments[arguments.length - 2];
				if (onSuccess instanceof Function) {
					onFail = arguments[arguments.length - 1];
				}
				else {
					onSuccess = arguments[arguments.length - 1];
				}
			}
			else if (arguments.length > 0)
				onSuccess = arguments[arguments.length - 1];

			if (!(onSuccess instanceof Function))
				onSuccess = undefined;

			var onSuccessFn = function (result) {
				if (onSuccess !== undefined) {
					onSuccess(result.event);
				}
			};

			var argCount = arguments.length - (onSuccess === undefined ? 0 : 1) - (onFail === undefined ? 0 : 1);
			var firstArgCouldBeParameterSet = argCount > 0 && arguments[0] instanceof Object && !(def.parameters.length === 0 || arguments[0][def.parameters[0]] === undefined);
			var instance = this instanceof Entity ? this : null;

			if (argCount >= 1 && argCount <= 2 && arguments[0] instanceof Object &&
					((argCount == 1 && (def.parameters.length != 1 || firstArgCouldBeParameterSet)) ||
					((argCount == 2 && (def.parameters.length != 2 || (firstArgCouldBeParameterSet && arguments[1] instanceof Array)))))) {

				// Invoke the server event
				context.server.raiseServerEvent(methodName, instance, arguments[0], false, onSuccessFn, onFail, argCount == 2 ? arguments[1] : null);
			}

			// Otherwise, assume that the parameters were all passed in sequential order
			else {
				// Throw an error if the incorrect number of arguments were passed to the method
				if (def.parameters.length == argCount - 1 && arguments[argCount - 1] instanceof Array)
					paths = arguments[argCount - 1];
				else if (def.parameters.length != argCount)
					throw new Error($format("Invalid number of arguments passed to \"{0}.{1}\" method.", this._fullName, def.name));

				if (def.isStatic && paths)
					throw new Error($format("Cannot include paths when invoking a static method - \"{0}.{1}\".", this.meta._fullName, def.name));

				// Construct the arguments to pass
				var args = {};
				for (var parameter in def.parameters) {
					if (def.parameters.hasOwnProperty(parameter)) {
						args[def.parameters[parameter]] = arguments[parameter];
					}
				}

				// Invoke the server event
				context.server.raiseServerEvent(methodName, instance, args, false, onSuccessFn, onFail, paths);
			}
		};

		// Assign the method to the type for static methods, otherwise assign it to the prototype for instance methods
		if (def.isStatic) {
			this._jstype[def.name] = method;
		}
		else {
			this._jstype.prototype[def.name] = method;
		}

	},
	_makeGetter: function Type$_makeGetter(property, getter, skipTypeCheck) {
		return function () {
			// ensure the property is initialized
			var result = getter.call(property, this, skipTypeCheck);

			// ensure the property is initialized
			if (result === undefined || (property.get_isList() && LazyLoader.isRegistered(result))) {
				throw new Error($format(
					"Property {0}.{1} is not initialized.  Make sure instances are loaded before accessing property values.  {2}|{3}",
					property._containingType.get_fullName(),
					property.get_name(),
					this.meta.type.get_fullName(),
					this.meta.id
				));
			}

			// return the result
			return result;
		};
	},
	_makeSetter: function Type$_makeSetter(prop) {
		var setter = function (val) {
			Property$_setter.call(prop, this, val, true);
		};

		setter.__notifies = true;

		return setter;
	},
	get_format: function Type$get_format() {
		return this._format ? this._format : (this.baseType ? this.baseType.get_format() : undefined);
	},
	set_format: function Type$set_format(value) {
		if (value && value.constructor == String)
			value = getFormat(this.get_jstype(), value);
		this._format = value;
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
	get_allproperties: function Type$get_allproperties() {
		var temp = ExoWeb.objectToArray(this._properties);

		//go up the base types until there are no more
		var tempObj = this;
		while (tempObj.baseType) {
			tempObj = tempObj.baseType;
			temp = tempObj.get_properties().concat(temp);
		}

		return temp;
	},
	get_baseproperties: function Type$get_baseproperties() {
		var temp = new Array();

		//go up the base types until there are no more
		var tempObj = this;
		var alreadyBase = true;
		while (tempObj.baseType) {
			tempObj = tempObj.baseType;
			temp = tempObj.get_properties().concat(temp);
			alreadyBase = false;
		}

		if (alreadyBase)
			temp = tempObj.get_properties();

		return temp;
	},
	get_staticProperties: function Type$get_staticProperties() {
		return this._staticProperties;
	},
	get_instanceProperties: function Type$get_instanceProperties() {
		return this._instanceProperties;
	},
	property: function Type$property(name) {
		var prop;
		for (var t = this; t && !prop; t = t.baseType) {
			prop = t._properties[name];

			if (prop) {
				return prop;
			}
		}
		return null;
	},
	conditionIf: function (options) {
		new ExoWeb.Model.Rule.condition(this, options);
		return this;
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
	compileExpression: function Type$compile(expression) {

		// use exports if required
		if (this._exports || ExoWeb.config.expressionScope) {
			expression = "return function() { return " + expression + "; }";
			var args;
			var values;

			// Include exported functions, if specified
			if (this._exports) {
				args = this._exports.names;
				values = this._exports.implementations;
			}

			// Include global expression scope variables, is specified
			if (ExoWeb.config.expressionScope) {
				if (!ExoWeb.config.expressionScope._names) {
					var scopeNames = [];
					var scopeValues = [];
					for(var key in ExoWeb.config.expressionScope){
						scopeNames.push(key);
						scopeValues.push(ExoWeb.config.expressionScope[key]);
					}
					ExoWeb.config.expressionScope._names = scopeNames;
					ExoWeb.config.expressionScope._values = scopeValues;
				}
				args = args ? args.concat(ExoWeb.config.expressionScope._names) : ExoWeb.config.expressionScope._names;
				values = values ? values.concat(ExoWeb.config.expressionScope._values) : ExoWeb.config.expressionScope._values;
			}

			// Compile the expression using the specified exported functions and global scope variables
			var compile = Function.apply(null, args.concat([expression]));
			return compile.apply(null, values);
		}

		// otherwise, just create the function based on the expression
		else {
			return new Function("return " + expression + ";");
		}
	},
	set_exports: function Type$set_exports(exports) {
		var names = [];
		var script = "return ["
		for (var name in exports) {
			names.push(name);
			script += exports[name] + ",";
		}
		if (script.length > 8) {
			script = script.slice(0, -1) + "];";
			this._exports = { names: names, implementations: new Function(script)() };
		}
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

		this.eachBaseType(function (baseType) {
			if (baseType === mtype) {
				result = true;
				return false;
			}
		});

		return result;
	},
	isLoaded: function (prop) {
		/// <summary locid="M:J#ExoWeb.Model.Type.isLoaded">
		/// Check whether the Type and optional property are loaded.
		/// </summary>
		/// <param name="prop" optional="true" mayBeNull="true" type="Object">The optional property object or property name to check.</param>

		// First see if there is a lazy loader attached to the entity (and optional property).
		if (LazyLoader.isRegistered(this, null, prop)) {
			return false;
		}

		// Immediately return true if a property name was not specified
		if (prop) {
			// Coerce property names into property instances
			if (isString(prop)) {
				prop = this.property(prop);
			}

			// Otherwise, get the property value and determine whether there is a
			// lazy loader attached to the property value, e.g. entity or list.
			var val = prop.value(this._jstype);
			if (val !== null && val !== undefined && LazyLoader.isRegistered(val)) {
				return false;
			}
		}

		return true;
	},
	toString: function Type$toString() {
		return this.get_fullName();
	}
};

Type.mixin(Functor.eventing);
exports.Type = Type;
