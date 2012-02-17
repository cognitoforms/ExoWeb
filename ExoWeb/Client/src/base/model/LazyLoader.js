function LazyLoader() {
}

LazyLoader.eval = function LazyLoader$eval(target, path, successCallback, errorCallback, scopeChain, thisPtr/*, continueFn, performedLoading, root, processed*/) {
	var processed, root, performedLoading, continueFn, step, scope, i, value;

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
		throw new Error("lazyLoad: Unknown path \"" + path + "\" of type " + ExoWeb.parseFunctionName(path.constructor) + ".");
	}

	scopeChain = scopeChain || [window];

	// If additional arguments were specified (internal), then use those.
	if (arguments.length === 10) {
		// Allow an invocation to specify continuing loading properties using a given function, by default this is LazyLoader.eval.
		// This is used by evalAll to ensure that array properties can be force loaded at any point in the path.
		continueFn = arguments[6] instanceof Function ? arguments[6] : continueFn;
		// Allow recursive calling function (eval or evalAll) to specify that loading was performed.
		performedLoading = arguments[7] instanceof Boolean ? arguments[7] : performedLoading;
		// Allow recursive calling function (eval or evalAll) to specify the root object being used.
		root = arguments[8];
		// Allow recursive calling function (eval or evalAll) to specify the processed steps.
		processed = arguments[9];
	}
	// Initialize to defaults.
	else {
		continueFn = LazyLoader.eval;
		performedLoading = false;
		root = target;
		processed = [];
	}

	// If the target is null or undefined then attempt to backtrack using the scope chain
	if (target === undefined || target === null) {
		target = root = Array.dequeue(scopeChain);
	}

	while (path.steps.length > 0) {
		// If null or undefined was passed in with no scope chain, fail
		if (target === undefined || target === null) {
			if (errorCallback) {
				errorCallback.call(thisPtr, "Target is null or undefined");
			}
			else {
				throw new Error("lazyLoad: Cannot complete property evaluation because the target is null or undefined");
			}
		}

		// If an array is encountered and this call originated from "evalAll" then delegate to "evalAll", otherwise 
		// this will most likely be an error condition unless the remainder of the path are properties of Array.
		if (continueFn === LazyLoader.evalAll && target instanceof Array) {
			continueFn(target, path, successCallback, errorCallback, scopeChain, thisPtr, continueFn, performedLoading, root, processed);
			return;
		}

		// Get the next step to evaluate
		step = Array.dequeue(path.steps);

		// If the target is not loaded then load it and continue when complete
		if (!LazyLoader.isLoaded(target, step.property)) {
			performedLoading = true;
			Array.insert(path.steps, 0, step);
			LazyLoader.load(target, step.property, function() {
				continueFn(target, path, successCallback, errorCallback, scopeChain, thisPtr, continueFn, performedLoading, root, processed);
			});
			return;
		}

		// Get the value of the current step
		value = ExoWeb.getValue(target, step.property);

		// If the value is undefined then there is a problem since getValue returns null if a property exists but returns no value.
		if (value === undefined) {
			// Attempt to backtrack using the next item in the scope chain.
			if (scopeChain.length > 0) {
				target = root = Array.dequeue(scopeChain);
				Array.insert(path.steps, 0, step);
				for (i = processed.length - 1; i >= 0; i--) {
					Array.insert(path.steps, 0, processed[i]);
				}
				processed.length = 0;
			}
			// Otherwise, fail since the path could not be evaluated
			else {
				if (errorCallback) {
					errorCallback.call(thisPtr, "Property is undefined: " + step.property);
				}
				else {
					throw new Error("lazyLoad: Cannot complete property evaluation because a property is undefined: " + step.property);
				}

				return;
			}
		}
		// The next target is null (nothing left to evaluate) or there is a cast of the current property and the value is 
		// not of the cast type (no need to continue evaluating).
		else if (value === null || (step.cast && !ExoWeb.isType(value, step.cast))) {
			if (successCallback) {
				successCallback.apply(thisPtr || this, [null, performedLoading, root]);
			}
			return;
		}
		// Otherwise, continue to the next property.
		else {
			processed.push(step);
			target = value;
		}
	}

	// Load final object
	if (target !== undefined && target !== null && !LazyLoader.isLoaded(target)) {
		performedLoading = true;
		LazyLoader.load(target, null, successCallback.prepare(thisPtr, [target, performedLoading, root]));
	}
	else if (successCallback) {
		successCallback.apply(thisPtr, [target, performedLoading, root]);
	}
};

LazyLoader.evalAll = function LazyLoader$evalAll(target, path, successCallback, errorCallback, scopeChain, thisPtr/*, continueFn, performedLoading, root*/) {
	// Ensure that the target is an array
	if (!(target instanceof Array)) {
		target = [target];
	}
	// Ensure that the array is loaded, then continue
	else if (!LazyLoader.isLoaded(target)) {
		LazyLoader.load(target, null, function() {
			LazyLoader.evalAll(target, path, successCallback, errorCallback, scopeChain, thisPtr, LazyLoader.evalAll, performedLoading, root);
		});
		return;
	}

	var root = target;
	var performedLoading = false;

	if (arguments.length === 9) {
		performedLoading = arguments[7] instanceof Boolean ? arguments[7] : false;
		root = arguments[8];
	}

	var signal = new ExoWeb.Signal("evalAll - " + path);
	var results = [];
	var roots = [];
	var errors = [];
	var successCallbacks = [];
	var errorCallbacks = [];
	var allSucceeded = true;

	Array.forEach(target, function(subTarget, i) {
		results.push(null);
		errors.push(null);
		successCallbacks.push(signal.pending(function(result, performedLoadingOne, rootOne) {
			performedLoading = performedLoading || performedLoadingOne;
			results[i] = result;
			roots[i] = rootOne;
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
		LazyLoader.eval(subTarget, path, successCallbacks[i], errorCallbacks[i], scopeChain, thisPtr, LazyLoader.evalAll, performedLoading, root);
	});

	signal.waitForAll(function() {
		if (allSucceeded) {
			// call the success callback if one exists
			if (successCallback) {
				successCallback.apply(thisPtr, [results, performedLoading, roots]);
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

exports.LazyLoader = LazyLoader;
