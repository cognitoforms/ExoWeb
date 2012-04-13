function Model() {
	this._types = {};

	this._validatingQueue = new ExoWeb.EventQueue(
		function(e) {
			var meta = e.sender;
			meta._raiseEvent("propertyValidating:" + e.propName, [meta, e.propName]);
		},
		function(a, b) {
			return a.sender == b.sender && a.propName == b.propName;
		}
	);

	this._validatedQueue = new ExoWeb.EventQueue(
		function(e) {
			var meta = e.sender;
			var propName = e.property;

			var conditions = [];
			Sys.Observer.makeObservable(conditions);
			Array.addRange(conditions, meta._propertyConditions[propName] || []);
			meta._raiseEvent("propertyValidated:" + propName, [meta, conditions]);
		},
		function(a, b) {
			return a.sender == b.sender && a.property == b.property;
		}
	);
}

Model.property = function Model$property(path, thisType/*, lazyLoadTypes, callback, thisPtr*/) {
	var tokens = new PathTokens(path);
	var firstStep = tokens.steps[0];
	var isGlobal = firstStep.property !== "this";

	var type;

	var lazyLoadTypes = arguments.length >= 3 && arguments[2] && arguments[2].constructor === Boolean ? arguments[2] : false;
	var callback = arguments[3];
	var thisPtr = arguments[4];

	if (isGlobal) {
		// Get all but the last step in the path.
		var typePathSteps = tokens.steps.filter(function(item, i) { return i != tokens.steps.length - 1; });

		// Construct a string from these steps.
		var typeName = typePathSteps.map(function(item) { return item.property; }).join(".");

		// Empty type name is an error.  The type name must be included as a part of the path.
		if (typeName.length === 0) {
			ExoWeb.trace.throwAndLog(["model"], "Invalid static property path \"{0}\":  type name must be included.", [path]);
		}

		// Retrieve the javascript type by name.
		type = Model.getJsType(typeName, true);

		// Handle non-existant or non-loaded type.
		if (!type) {
			if (callback) {
				// Retry when type is loaded
				$extend(typeName, Model.property.prepare(this, Array.prototype.slice.call(arguments)));
				return;
			}
			else {
				ExoWeb.trace.throwAndLog(["model"], "Invalid static property path \"{0}\":  type \"{1}\" could not be found.", [path, typeName]);
			}
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
				ExoWeb.trace.throwAndLog("model", "Path '{0}' references an unknown type: {1}", [path, firstStep.cast]);
			}
			type = jstype.meta;
		}
		else if (thisType instanceof Function) {
			type = thisType.meta;
		}
		else {
			type = thisType;
		}

		tokens.steps.dequeue();
	}

	if (tokens.steps.length === 1) {
		var name = tokens.steps[0].property;
		if (callback) {
			if (!LazyLoader.isLoaded(type)) {
				if (lazyLoadTypes) {
					LazyLoader.load(type, null, function() {
						callback.call(thisPtr || this, type.property(name, true));
					});
				}
				else {
					$extend(type._fullName, function() {
						callback.call(thisPtr || this, type.property(name, true));
					});
				}
			}
			else {
				callback.call(thisPtr || this, type.property(name, true));
			}
		}
		else {
			return type.property(name, true);
		}
	}
	else {
		if (callback) {
			new PropertyChain(type, tokens, lazyLoadTypes, thisPtr ? callback.bind(thisPtr) : callback);
		}
		else {
			return new PropertyChain(type, tokens, lazyLoadTypes, thisPtr ? callback.bind(thisPtr) : callback);
		}
	}
};

Model.prototype = {
	dispose: function Model$dispose() {
		for(var key in this._types) {
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
	get_types: function() {
		return Array.prototype.slice.call(this._types);
	},
	type: function(name) {
		return this._types[name];
	},
	addBeforeContextReady: function(handler) {
		// Only executes the given handler once, since the event should only fire once
		if (!this._contextReady) {
			this._addEvent("beforeContextReady", handler, null, true);
		}
		else {
			handler();
		}
	},
	notifyBeforeContextReady: function() {
		this._contextReady = true;
		this._raiseEvent("beforeContextReady", []);
	},
	addAfterPropertySet: function(handler) {
		this._addEvent("afterPropertySet", handler);
	},
	notifyAfterPropertySet: function(obj, property, newVal, oldVal) {
		this._raiseEvent("afterPropertySet", [obj, property, newVal, oldVal]);
	},
	addObjectRegistered: function(func, objectOrFunction, once) {
		this._addEvent("objectRegistered", func, objectOrFunction ? (objectOrFunction instanceof Function ? objectOrFunction : equals(objectOrFunction)) : null, once);
	},
	removeObjectRegistered: function(func) {
		this._removeEvent("objectRegistered", func);
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
				throw new Error($format("The type \"{0}\" could not be found.  Failed on step \"{1}\".", [name, step]));
			}
		}
	}
	return obj;
};

ExoWeb.Model.Model = Model;
