function Model() {
	this._types = {};
	this._ruleQueue = [];
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
	type: function (name) {
		return this._types[name];
	},
	types: function (filter) {
		var result = [], typeName, type;
		for (typeName in this._types) {
			type = this._types[typeName];
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
		if (!this._contextReady) {
			this._ruleQueue.push(rule);
		} else {
			rule.register();
		}
	},

	// register rules pending registration
	registerRules: function Model$registerRules() {
		var i, rules = this._ruleQueue;
		this._ruleQueue = [];
		for (i = 0; i < rules.length; i += 1) {
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
		var result, nsTokens, target = parentNamespace;

		if (target.constructor === String) {
			nsTokens = target.split(".");
			target = window;
			Array.forEach(nsTokens, function (token) {
				target = target[token];

				if (target === undefined) {
					throw new Error("Parent namespace \"" + parentNamespace + "\" could not be found.");
				}
			});
		} else if (target === undefined || target === null) {
			target = window;
		}

		// create the namespace object if it doesn't exist, otherwise return the existing namespace
		if (!(name in target)) {
			result = target[name] = {};
			return result;
		} else {
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

	return null;
}

exports.ensureType = ensureType; // IGNORE

Model.property = function Model$property(path, thisType/*, forceLoadTypes, callback, thisPtr*/) {

	var type,
		loadProperty,
		singlePropertyName,
		tokens = null,
		forceLoadTypes = arguments.length >= 3 && arguments[2] && arguments[2].constructor === Boolean ? arguments[2] : false,
		callback = arguments[3],
		thisPtr = arguments[4];

	// Allow the path argument to be either a string or PathTokens instance.
	if (path.constructor === PathTokens) {
		tokens = path;
		path = tokens.expression;
	}

	// Return cached property chains as soon as possible (in other words,
	// do as little as possible prior to returning the cached chain).
	if (thisType && thisType._chains && thisType._chains[path]) {
		if (callback) {
			callback.call(thisPtr || this, thisType._chains[path]);
			return null;
		} else {
			return thisType._chains[path];
		}
	}

	// The path argument was a string, so use it to create a PathTokens object.
	// Delay doing this as an optimization for cached property chains.
	if (!tokens) {
		tokens = new PathTokens(path);
	}

	// get the instance type, if specified
	type = thisType instanceof Function ? thisType.meta : thisType;

	// determine if a typecast was specified for the path to identify a specific subclass to use as the root type
	if (tokens.steps[0].property === "this" && tokens.steps[0].cast) {

		//Try and resolve cast to an actual type in the model
		type = Model.getJsType(tokens.steps[0].cast, false).meta;
		tokens.steps.dequeue();
	}

	// create a function to lazily load a property 
	loadProperty = function (containingType, propertyName, propertyCallback) {
		ensureType(containingType, forceLoadTypes, function () {
			propertyCallback.call(thisPtr || this, containingType.property(propertyName));
		});
	};

	// Optimize for a single property expression, as it is neither static nor a chain.
	if (tokens.steps.length === 1) {
		singlePropertyName = tokens.steps[0].property;
		if (callback) {
			loadProperty(type, singlePropertyName, callback);
		} else {
			return type.property(singlePropertyName);
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

		// Copy of the Model.property arguments for async re-entry.
		var outerArgs = Array.prototype.slice.call(arguments);

		// create a function to see if the path is a global property if instance processing fails
		var processGlobal = function (instanceParseError) {

			// Retrieve the javascript type by name.
			type = Model.getJsType(globalTypeName, true);

			// Handle non-existant or non-loaded type.
			if (!type) {
				if (callback) {
					// Retry when type is loaded
					$extend(globalTypeName, Model.property.prepare(Model, outerArgs));
					return null;
				} else {
					throw new Error(instanceParseError ? instanceParseError : ("Error getting type \"" + globalTypeName + "\"."));
				}
			}

			// Get the corresponding meta type.
			type = type.meta;

			// return the static property
			if (callback) {
				loadProperty(type, globalPropertyName, callback);
			} else {
				return type.property(globalPropertyName);
			}
		};

		if (callback) {
			PropertyChain.create(type, tokens, forceLoadTypes, thisPtr ? callback.bind(thisPtr) : callback, processGlobal);
		} else {
			return PropertyChain.create(type, tokens, forceLoadTypes) || processGlobal(null);
		}
	}
};

Model.intrinsicJsTypes = ["Object", "String", "Number", "Boolean", "Date", "TimeSpan", "Array"];
Model.types = {};
Model.getJsType = function Model$getJsType(name, allowUndefined) {
	/// <summary>
	/// Retrieves the JavaScript constructor function corresponding to the given full type name.
	/// </summary>
	/// <returns type="Object" />

	var obj = Model.types;
	var steps = name.split(".");
	if (steps.length === 1 && Model.intrinsicJsTypes.indexOf(name) > -1) {
		return window[name];
	}
	else {
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
	}
};

exports.Model = Model;
