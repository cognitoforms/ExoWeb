var Observer = { };

Observer.addPathChanged = function Observer$addPathChanged(target, path, handler, allowNoTarget) {
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
					Observer.addCollectionChanged(source, function(sender, args) {
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

Observer.removePathChanged = function Sys$Observer$removePathChanged(target, path, handler) {
	path = (path instanceof Array) ? path.join(".") : path;

	var pathChangeHandlers = target.__pathChangeHandlers ? target.__pathChangeHandlers[path] : null;

	if (pathChangeHandlers) {
		// Search the list for handlers that match the given handler and stop and remove them
		pathChangeHandlers.purge(function(pathChangeHandler) {
			if (pathChangeHandler.handler === handler) {
				Array.forEach(pathChangeHandler.roots, function(observer) {
					observer.stop();
				});
				return true;
			}
		});

		// If there are no more handlers for this path then remove it from the cache
		if (pathChangeHandlers.length === 0) {
			// delete the data specific to this path
			delete target.__pathChangeHandlers[path];

			// determine if there are any other paths being watched
			var hasHandlers = false;
			for (var remainingHandler in target.__pathChangeHandlers) {
				if (target.__pathChangeHandlers.hasOwnProperty(remainingHandler)) {
					hasHandlers = true;
				}
			}

			// null out the property of the target if there are no longer any paths being watched
			if (!hasHandlers) {
				target.__pathChangeHandlers = null;
			}
		}
	}
};

var observableInterface = {
	makeObservable: function (target) {
		throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
	},
	disposeObservable: function (target) {
		throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
	},
	addCollectionChanged: function (target, handler) {
		throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
	},
	removeCollectionChanged: function (target, handler) {
		throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
	},
	addPropertyChanged: function (target, property, handler) {
		throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
	},
	removePropertyChanged: function (target, property, handler) {
		throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
	},
	raisePropertyChanged: function (target, property) {
		throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
	},
	setValue: function (target, property, value) {
		throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
	}
};

// sets the observer provider to use, verifying that it matches the defined interface.
function setObserverProvider(provider) {
	for (var method in observableInterface) {
		var definition = provider[method];
		if (!(definition instanceof Function)) {
			throw new Error("Observable provider does not implement '" + method + "'.");
		}
		Observer[method] = definition;
	}
};

// expose publicly
exports.setObserverProvider = setObserverProvider; // IGNORE
exports.Observer = Observer;