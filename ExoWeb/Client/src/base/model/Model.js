function Model() {
	this._types = {};
	this._ruleQueue = [];

	this._validatingQueue = new EventQueue(
		function(e) {
			var meta = e.sender;
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
			var conditions = meta.conditions(meta.type.property(propName));
			meta._raiseEvent("propertyValidated:" + propName, [meta, conditions]);
		},
		function (a, b) {
			return a.sender == b.sender && a.property == b.property;
		}
	);
}

Model.mixin(Functor.eventing);

Model.mixin({
	dispose: function Model$dispose() {
		for (var key in this._types) {
			delete window[key];
		}
	},
	addType: function Model$addType(name, base, origin, format) {
		var type = new Type(this, name, base, origin, format);
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
	type: function (name) {
		return this._types[name];
	},
	types: function (filter) {
		var result = [];
		for (var typeName in this._types) {
			var type = this._types[typeName];
			if (!filter || filter(type)) {
				result.push(type);
			}
		}
		return result;
	},
	addBeforeContextReady: function (handler) {
		// Only executes the given handler once, since the event should only fire once
		if (!this._contextReady) {
			this._addEvent("beforeContextReady", handler, null, true);
		}
		else {
			handler();
		}
	},

	// queues a rule to be registered
	registerRule: function Model$registerRule(rule) {
		if(!this._contextReady) {
			this._ruleQueue.push(rule);
		}
		else {
			rule.register();
		}
	},

	// register rules pending registration
	registerRules: function Model$registerRules() {
		var rules = this._ruleQueue;
		this._ruleQueue = [];
		for (var i = 0; i < rules.length; i++) {
			rules[i].register();
		}
	},
	notifyBeforeContextReady: function () {
		this._contextReady = true;
		this.registerRules();
		this._raiseEvent("beforeContextReady", []);
	},
	addAfterPropertySet: function (handler) {
		this._addEvent("afterPropertySet", handler);
	},
	notifyAfterPropertySet: function (obj, property, newVal, oldVal) {
		this._raiseEvent("afterPropertySet", [obj, property, newVal, oldVal]);
	},
	addObjectRegistered: function (func, objectOrFunction, once) {
		this._addEvent("objectRegistered", func, objectOrFunction ? (objectOrFunction instanceof Function ? objectOrFunction : equals(objectOrFunction)) : null, once);
	},
	removeObjectRegistered: function (func) {
		this._removeEvent("objectRegistered", func);
	},
	notifyObjectRegistered: function (obj) {
		this._raiseEvent("objectRegistered", [obj]);
	},
	addObjectUnregistered: function (func) {
		this._addEvent("objectUnregistered", func);
	},
	notifyObjectUnregistered: function (obj) {
		this._raiseEvent("objectUnregistered", [obj]);
	},
	addListChanged: function (func) {
		this._addEvent("listChanged", func);
	},
	notifyListChanged: function (obj, property, changes) {
		this._raiseEvent("listChanged", [obj, property, changes]);
	},
	_ensureNamespace: function Model$_ensureNamespace(name, parentNamespace) {
		var target = parentNamespace;

		if (target.constructor === String) {
			var nsTokens = target.split(".");
			target = window;
			Array.forEach(nsTokens, function (token) {
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
});

function ensureType(type, forceLoad, callback) {

	// immediately invoke the callback if no type was specified or the type is loaded
	if (!type || LazyLoader.isLoaded(type)) {
		return callback();
	}

	// force type loading if requested
	if (forceLoad) {
		LazyLoader.load(type, null, callback);
	}

	// otherwise, only continue processing when and if dependent types are loaded
	else {
		$extend(type._fullName, callback);
	}
};
exports.ensureType = ensureType; // IGNORE

Model.property = function Model$property(path, thisType/*, forceLoadTypes, callback, thisPtr*/) {

	// allow path to be either a string or PathTokens instance
	var tokens;
	if (path.constructor === PathTokens) {
		tokens = path;
		path = tokens.expression;
	}

	// get the optional arguments
	var forceLoadTypes = arguments.length >= 3 && arguments[2] && arguments[2].constructor === Boolean ? arguments[2] : false;
	var callback = arguments[3];
	var thisPtr = arguments[4];

	// immediately return cached property chains
	if (thisType && thisType._chains && thisType._chains[path]) {
		if (callback) {
			callback.call(thisPtr || this, thisType._chains[path]);
			return;
		}
		else {
			return thisType._chains[path];
		}
	}

	// get tokens for the specified path
	var tokens = tokens || new PathTokens(path);

	// get the instance type, if specified
	var type = thisType instanceof Function ? thisType.meta : thisType;

	// create a function to lazily load a property 
	var loadProperty = function (type, name, callback) {
		ensureType(type, forceLoadTypes, function () {
			callback.call(thisPtr || this, type.property(name));
		});
	}

	// handle single property expressions efficiently, as they are neither static nor chains
	if (tokens.steps.length === 1) {
		var name = tokens.steps[0].property;
		if (callback) {
			loadProperty(type, name, callback);
		}
		else {
			return type.property(name);
		}
	}

	// otherwise, first see if the path represents a property chain, and if not, a global property
	else {

		// predetermine the global type name and property name before seeing if the path is an instance path
		var globalTypeName = tokens.steps
			.slice(0, tokens.steps.length - 1)
			.map(function (item) { return item.property; })
			.join(".");

		var globalPropertyName = tokens.steps[tokens.steps.length - 1].property;

		// create a function to see if the path is a global property if instance processing fails
		var processGlobal = function (instanceParseError) {

			// Retrieve the javascript type by name.
			type = Model.getJsType(globalTypeName, true);

			// Handle non-existant or non-loaded type.
			if (!type) {
				if (callback) {
					// Retry when type is loaded
					$extend(globalTypeName, Model.property.prepare(this, Array.prototype.slice.call(arguments)));
					return;
				}
				else {
					ExoWeb.trace.throwAndLog(["model"], instanceParseError);
				}
			}

			// Get the corresponding meta type.
			type = type.meta;

			// return the static property
			if (callback) {
				loadProperty(type, globalPropertyName, callback);
			}
			else {
				return type.property(globalPropertyName);
			}
		}

		if (callback) {
			PropertyChain.create(type, tokens, forceLoadTypes, thisPtr ? callback.bind(thisPtr) : callback, processGlobal);
		}
		else {
			return PropertyChain.create(type, tokens, forceLoadTypes) || processGlobal(null);
		}
	}
};

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
				throw new Error($format("The type \"{0}\" could not be found.  Failed on step \"{1}\".", [name, step]));
			}
		}
	}
	return obj;
};

exports.Model = Model;
