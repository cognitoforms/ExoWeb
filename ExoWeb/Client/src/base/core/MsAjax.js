function _raiseSpecificPropertyChanged(target, args) {
	var func = target.__propertyChangeHandlers[args.get_propertyName()];
	if (func && func instanceof Function) {
		func.apply(this, arguments);
	}
}

// Converts observer events from being for ALL properties to a specific one.
// This is an optimization that prevents handlers interested only in a single
// property from being run when other, unrelated properties change.
Sys.Observer.addSpecificPropertyChanged = function Sys$Observer$addSpecificPropertyChanged(target, property, handler) {
	if (!target.__propertyChangeHandlers) {
		target.__propertyChangeHandlers = {};

		Sys.Observer.addPropertyChanged(target, _raiseSpecificPropertyChanged);
	}

	var func = target.__propertyChangeHandlers[property];

	if (!func) {
		target.__propertyChangeHandlers[property] = func = ExoWeb.Functor();
	}

	func.add(handler);
};

Sys.Observer.removeSpecificPropertyChanged = function Sys$Observer$removeSpecificPropertyChanged(target, property, handler) {
	var func = target.__propertyChangeHandlers ? target.__propertyChangeHandlers[property] : null;

	if (func) {
		func.remove(handler);

		// if the functor is empty then remove the callback as an optimization
		if (func.isEmpty()) {
			delete target.__propertyChangeHandlers[property];

			var hasHandlers = false;
			for (var handler in target.__propertyChangeHandlers) {
				hasHandlers = true;
			}

			if (!hasHandlers) {
				delete target.__propertyChangeHandlers;
				Sys.Observer.removePropertyChanged(target, _raiseSpecificPropertyChanged);
			}
		}
	}
};


Sys.Observer.addPathChanged = function Sys$Observer$addPathChanged(target, path, handler, allowNoTarget) {
	// Throw an error if the target is null or undefined, unless the calling code specifies that this is ok
	if (target === undefined || target === null) {
		if (allowNoTarget === true) {
			return;
		}
		else {
			ExoWeb.trace.throwAndLog("observer", "Cannot watch for changes to \"{0}\" on a null or undefined target.", [path instanceof Array ? path.join(".") : path]);
		}
	}

	// Ensure a set of path change handlers
	if (!target.__pathChangeHandlers) {
		target.__pathChangeHandlers = {};
	}

	var list = path;
	if (path instanceof Array) {
		path = path.join(".");
	}
	else {
		list = path.split(".");
	}

	var roots = [];

	function processStep(parent, item, index) {
		var observers = [];

		function addObserver(value) {
			var obs = new PropertyObserver(item);

			observers.push(obs);
			if (index === 0) {
				roots.push(obs);
			}

			obs.start(value, handler);

			// Continue to next steps if there are any
			if (index + 1 < list.length) {
				processStep(obs, list[index + 1], index + 1);
			}
		}

		function removeObserver(value) {
			for (var i = 0; i < observers.length; i++) {
				var obs = observers[i];
				if (obs._source === value) {
					Array.removeAt(observers, i--);
					if (index === 0) {
						Array.remove(roots, obs);
					}

					obs.stop();
				}
			}
		}

		// If there is a step before this one, then respond to 
		// changes to the value(s) at that step.
		if (parent) {
			parent._addEvent("valueCaptured", addObserver);
			parent._addEvent("valueReleased", removeObserver);
		}

		var source = index === 0 ? target : parent.value();
		if (source !== undefined && source !== null) {
			if (source instanceof Array) {
				Array.forEach(source, addObserver);

				// Watch for changes to the target if it is an array, so that we can
				// add new observers, remove old ones, and call the handler.
				if (index === 0) {
					Sys.Observer.addCollectionChanged(source, function(sender, args) {
						var changes = args.get_changes();

						Array.forEach(changes.removed || [], removeObserver);
						Array.forEach(changes.added || [], addObserver);
						handler();
					});
				}
			}
			else {
				addObserver(source);
			}
		}
	}

	// Start processing the path
	processStep(null, list[0], 0);

	// Store the observer on the object
	var pathChangeHandlers = target.__pathChangeHandlers[path];
	if (!pathChangeHandlers) {
		target.__pathChangeHandlers[path] = pathChangeHandlers = [];
	}
	pathChangeHandlers.push({ roots: roots, handler: handler });
};

Sys.Observer.removePathChanged = function Sys$Observer$removePathChanged(target, path, handler) {
	path = (path instanceof Array) ? path.join(".") : path;

	var pathChangeHandlers = target.__pathChangeHandlers ? target.__pathChangeHandlers[path] : null;

	if (pathChangeHandlers) {
		// Search the list for handlers that match the given handler and stop and remove them
		for (var i = 0; i < pathChangeHandlers.length; i++) {
			var pathChangeHandler = pathChangeHandlers[i];
			if (pathChangeHandler.handler === handler) {
				Array.forEach(pathChangeHandler.roots, function(observer) {
					observer.stop();
				});
				Array.removeAt(pathChangeHandlers, i--);
			}
		}

		// If there are no more handlers for this path then remove it from the cache
		if (pathChangeHandlers.length === 0) {
			// delete the data specific to this path
			delete target.__pathChangeHandlers[path];

			// determine if there are any other paths being watched
			var hasHandlers = false;
			for (var handler in target.__pathChangeHandlers) {
				hasHandlers = true;
			}

			// delete the property from the object if there are no longer any paths being watched
			if (!hasHandlers) {
				delete target.__pathChangeHandlers;
			}
		}
	}
};

// Supress raising of property changed when a generated setter is already raising the event
Sys.Observer._setValue = function Sys$Observer$_setValue$override(target, propertyName, value) {
	var getter, setter, mainTarget = target, path = propertyName.split('.');
	for (var i = 0, l = (path.length - 1); i < l; i++) {
		var name = path[i];
		getter = target["get_" + name];
		if (typeof (getter) === "function") {
			target = getter.call(target);
		}
		else {
			target = target[name];
		}
		var type = typeof (target);
		if ((target === null) || (type === "undefined")) {
			throw Error.invalidOperation(String.format(Sys.Res.nullReferenceInPath, propertyName));
		}
	}

	var notify = true; // added
	var currentValue, lastPath = path[l];
	getter = target["get_" + lastPath];
	setter = target["set_" + lastPath];
	if (typeof (getter) === 'function') {
		currentValue = getter.call(target);
	}
	else {
		currentValue = target[lastPath];
	}
	if (typeof (setter) === 'function') {
		notify = !setter.__notifies; // added
		setter.call(target, value);
	}
	else {
		target[lastPath] = value;
	}
	if (currentValue !== value) {
		var ctx = Sys.Observer._getContext(mainTarget);
		if (ctx && ctx.updating) {
			ctx.dirty = true;
			return;
		}
		if (notify) {
			Sys.Observer.raisePropertyChanged(mainTarget, path[0]);
		}
	}
};
