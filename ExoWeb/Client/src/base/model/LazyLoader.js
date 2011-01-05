function LazyLoader() {
}

LazyLoader.eval = function LazyLoader$eval(target, path, successCallback, errorCallback, scopeChain, thisPtr/*, continueFn, performedLoading*/) {
	if (path === undefined || path === null) {
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

	if (target === undefined || target === null) {
		target = Array.dequeue(scopeChain);
	}

	// Initialize to defaults.
	var performedLoading = false;
	var continueFn = LazyLoader.eval;

	// If additional arguments were specified (internal), then use those.
	if (arguments.length == 8) {
		// Allow an invocation to specify continuing loading properties using a given function, by default this is LazyLoader.eval.
		// This is used by evalAll to ensure that array properties can be force loaded at any point in the path.
		continueFn = arguments[6] instanceof Function ? arguments[6] : continueFn;
		// Allow recursive calling function (eval or evalAll) to specify that loading was performed.
		performedLoading = arguments[7] instanceof Boolean ? arguments[7] : performedLoading;
	}

	while (path.steps.length > 0) {
		// If an array is encountered and this call originated from "evalAll" then delegate to "evalAll", otherwise 
		// this will most likely be an error condition unless the remainder of the path are properties of Array.
		if (continueFn == LazyLoader.evalAll && target instanceof Array) {
			continueFn(target, path, successCallback, errorCallback, scopeChain, thisPtr, continueFn, performedLoading);
			return;
		}

		var step = Array.dequeue(path.steps);

		if (!LazyLoader.isLoaded(target, step.property)) {
			performedLoading = true;
			LazyLoader.load(target, step.property, function() {
				var nextTarget = ExoWeb.getValue(target, step.property);

				// If the next target is undefined then there is a problem since getValue returns null if a property exists but returns no value.
				if (nextTarget === undefined) {
					// Backtrack using the next item in the scope chain.
					if (scopeChain.length > 0) {
						Array.insert(path.steps, 0, step);

						continueFn(Array.dequeue(scopeChain), path, successCallback, errorCallback, scopeChain, thisPtr, continueFn, performedLoading);
					}
					// Nowhere to backtrack, so return or throw an error.
					else if (errorCallback) {
						errorCallback.call(thisPtr, "Property is undefined: " + step.property);
					}
					else {
						ExoWeb.trace.throwAndLog(["lazyLoad"], "Cannot complete property evaluation because a property is undefined: {0}", [step.property]);
					}
				}
				// Continue if there is a next target and either no cast of the current property or the value is of the cast type.
				else if (nextTarget !== null && (!step.cast || ExoWeb.isType(nextTarget, step.cast))) {
					continueFn(nextTarget, path, successCallback, errorCallback, [], thisPtr, continueFn, performedLoading);
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
						ExoWeb.trace.throwAndLog(["lazyLoad"], "Cannot complete property evaluation because a property is undefined: {0}", [step.property]);
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
	if (target !== undefined && target !== null && !LazyLoader.isLoaded(target)) {
		performedLoading = true;
		LazyLoader.load(target, null, successCallback.prepare(thisPtr, [target, performedLoading]));
	}
	else if (successCallback) {
		successCallback.call(thisPtr, target, performedLoading);
	}
};

LazyLoader.evalAll = function LazyLoader$evalAll(target, path, successCallback, errorCallback, scopeChain, thisPtr/*, continueFn, performedLoading*/) {
	var performedLoading = arguments.length == 8 && arguments[7] instanceof Boolean ? arguments[7] : false;

	if (target instanceof Array) {
		if (LazyLoader.isLoaded(target)) {
			var signal = new ExoWeb.Signal("evalAll - " + path);
			var results = [];
			var errors = [];
			var successCallbacks = [];
			var errorCallbacks = [];

			var allSucceeded = true;

			Array.forEach(target, function(subTarget, i) {
				results.push(null);
				errors.push(null);
				successCallbacks.push(signal.pending(function(result, performedLoadingOne) {
					performedLoading = performedLoading || performedLoadingOne;
					results[i] = result;
				}));
				errorCallbacks.push(signal.orPending(function(err) {
					allSucceeded = false;
					errors[i] = err;
				}));
			});

			Array.forEach(target, function(subTarget, i) {
				// Make a copy of the original path tokens for arrays so that items' processing don't affect one another.
				if (path instanceof PathTokens) {
					path = path.buildExpression();
				}

				LazyLoader.eval(subTarget, path, successCallbacks[i], errorCallbacks[i], scopeChain, thisPtr, LazyLoader.evalAll, performedLoading);
			});

			signal.waitForAll(function() {
				if (allSucceeded) {
					// call the success callback if one exists
					if (successCallback) {
						successCallback.call(thisPtr, results, performedLoading);
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
						ExoWeb.trace.throwAndLog(["lazyLoad"], "{0} errors encountered while attempting to eval paths for all items in the target array.", [numErrors]);
					});
				}
			});
		}
		else {
			LazyLoader.load(target, null, function() {
				LazyLoader.evalAll(target, path, successCallback, errorCallback, scopeChain, thisPtr, LazyLoader.evalAll, performedLoading);
			});
		}
	}
	else {
		LazyLoader.evalAll([target], path, successCallback, errorCallback, scopeChain, thisPtr, LazyLoader.evalAll, performedLoading);
	}
};

LazyLoader.isLoaded = function LazyLoader$isLoaded(obj, propName) {
	if (obj === undefined || obj === null) {
		return;
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

	return !loader || (!!loader.isLoaded && obj._lazyLoader.isLoaded(obj, propName));
};

LazyLoader.load = function LazyLoader$load(obj, propName, callback, thisPtr) {
	var reg = obj._lazyLoader;
	if (!reg) {
		if (callback && callback instanceof Function) {
			callback.call(thisPtr || this);
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
			ExoWeb.trace.throwAndLog(["lazyLoad"], "Attempting to load object but no appropriate loader is registered. object: {0}, property: {1}", [obj, propName]);
		}

		loader.load(obj, propName, callback, thisPtr);
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
