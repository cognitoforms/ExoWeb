/*global isType, PathTokens, logWarning, parseFunctionName, getValue, Signal */

function LazyLoader() {
}

LazyLoader.eval = function LazyLoader$eval(target, path, successCallback, errorCallback, scopeChain, thisPtr/*, continueFn, performedLoading, root, processed, invokeImmediatelyIfPossible*/) {
	var processed, root, performedLoading, continueFn, step, i, value, invokeImmediatelyIfPossible;

	if (path === undefined || path === null) {
		path = "";
	}

	if (isType(path, String)) {
		path = new PathTokens(path);
	}
	else if (isType(path, Array)) {
		logWarning("Calling LazyLoader.eval with a path Array is deprecated, please use a string path instead.");
		path = new PathTokens(path.join("."));
	}
	else if (!isType(path, PathTokens)) {
		throw new Error("Unknown path \"" + path + "\" of type " + parseFunctionName(path.constructor) + ".");
	}

	scopeChain = scopeChain || [window];

	// If additional arguments were specified (internal), then use those.
	if (arguments.length === 11) {
		// Allow an invocation to specify continuing loading properties using a given function, by default this is LazyLoader.eval.
		// This is used by evalAll to ensure that array properties can be force loaded at any point in the path.
		continueFn = arguments[6] instanceof Function ? arguments[6] : continueFn;
		// Allow recursive calling function (eval or evalAll) to specify that loading was performed.
		performedLoading = arguments[7] instanceof Boolean ? arguments[7] : false;
		// Allow recursive calling function (eval or evalAll) to specify the root object being used.
		root = arguments[8];
		// Allow recursive calling function (eval or evalAll) to specify the processed steps.
		processed = arguments[9];
		// Allow recursive calling function (eval or evalAll) to specify whether to invoke the callback immmediately if possible (when no loading is required).
		invokeImmediatelyIfPossible = arguments[10];
	}
	// Initialize to defaults.
	else {
		continueFn = LazyLoader.eval;
		performedLoading = false;
		root = target;
		processed = [];
		invokeImmediatelyIfPossible = null;
	}

	// If the target is null or undefined then attempt to backtrack using the scope chain
	if (target === undefined || target === null) {
		target = root = scopeChain.dequeue();
	}
	
	while (path.steps.length > 0) {
		// If null or undefined was passed in with no scope chain, fail
		if (target === undefined || target === null) {
			if (errorCallback) {
				errorCallback.apply(thisPtr || this, ["Target is null or undefined"]);
			}
			else {
				throw new Error("Cannot complete property evaluation because the target is null or undefined");
			}
		}

		// If an array is encountered and this call originated from "evalAll" then delegate to "evalAll", otherwise
		// this will most likely be an error condition unless the remainder of the path are properties of Array.
		if (continueFn !== LazyLoader.eval && target instanceof Array) {
			continueFn(target, path, successCallback, errorCallback, scopeChain, thisPtr, continueFn, performedLoading, root, processed, invokeImmediatelyIfPossible);
			return;
		}

		// Get the next step to evaluate
		step = path.steps.dequeue();

		// If the target is not loaded then load it and continue when complete
		if (LazyLoader.isRegistered(target, null, step.property)) {
			performedLoading = true;
			Array.insert(path.steps, 0, step);
			LazyLoader.load(target, step.property, function () {
				continueFn(target, path, successCallback, errorCallback, scopeChain, thisPtr, continueFn, performedLoading, root, processed, invokeImmediatelyIfPossible);
			});
			return;
		}

		// Get the value of the current step
		value = getValue(target, step.property);

		// If the value is undefined then there is a problem since getValue returns null if a property exists but returns no value.
		if (value === undefined) {
			// Attempt to backtrack using the next item in the scope chain.
			if (scopeChain.length > 0) {
				target = root = scopeChain.dequeue();
				Array.insert(path.steps, 0, step);
				for (i = processed.length - 1; i >= 0; i -= 1) {
					Array.insert(path.steps, 0, processed[i]);
				}
				processed.length = 0;
			}
			// Otherwise, fail since the path could not be evaluated
			else {
				if (errorCallback) {
					errorCallback.apply(thisPtr || this, ["Property is undefined: " + step.property]);
				}
				else {
					throw new Error("Cannot complete property evaluation because a property is undefined: " + step.property);
				}

				return;
			}
		}
		// The next target is null (nothing left to evaluate) or there is a cast of the current property and the value is
		// not of the cast type (no need to continue evaluating).
		else if (value === null || (step.cast && !isType(value, step.cast))) {
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
	if (target !== undefined && target !== null && LazyLoader.isRegistered(target)) {
		performedLoading = true;
		LazyLoader.load(target, null, successCallback ? successCallback.prepare(thisPtr || this, [target, performedLoading, root]) : undefined);
	}
	else if (successCallback) {
		successCallback.apply(thisPtr || this, [target, performedLoading, root]);
	}
};

LazyLoader.evalAll = function LazyLoader$evalAll(target, path, successCallback, errorCallback, scopeChain, thisPtr/*, continueFn, performedLoading, root, processed, invokeImmediatelyIfPossible*/) {
	var root, performedLoading, processed, invokeImmediatelyIfPossible, signal, results, errors, successCallbacks, errorCallbacks, allSucceeded;

	if (arguments.length === 11) {
		performedLoading = arguments[7] instanceof Boolean ? arguments[7] : false;
		root = arguments[8];
		processed = arguments[9];
		invokeImmediatelyIfPossible = arguments[10];
	}
	else {
		performedLoading = false;
		root = target;
		processed = [];
		invokeImmediatelyIfPossible = null;
	}

	// Ensure that the target is an array
	if (!(target instanceof Array)) {
		LazyLoader.eval(target, path, successCallback, errorCallback, scopeChain, thisPtr, LazyLoader.evalAll, performedLoading, root, processed, invokeImmediatelyIfPossible);
		return;
	}
		// Ensure that the array is loaded, then continue
	else if (LazyLoader.isRegistered(target)) {
		LazyLoader.load(target, null, function () {
			LazyLoader.evalAll(target, path, successCallback, errorCallback, scopeChain, thisPtr, LazyLoader.evalAll, performedLoading, root, processed, invokeImmediatelyIfPossible);
		});
		return;
	}

	signal = new Signal("evalAll - " + path);
	results = [];
	errors = [];
	successCallbacks = [];
	errorCallbacks = [];
	allSucceeded = true;

	target.forEach(function (subTarget, i) {
		results.push(null);
		errors.push(null);
		successCallbacks.push(signal.pending(function (result, performedLoadingOne, rootOne) {
			performedLoading = performedLoading || performedLoadingOne;
			results[i] = result;
			if (root !== rootOne) {
				logWarning("Found different roots when evaluating all paths.");
			}
			root = rootOne;
		}, null, invokeImmediatelyIfPossible));
		errorCallbacks.push(signal.orPending(function (err) {
			allSucceeded = false;
			errors[i] = err;
		}, null, invokeImmediatelyIfPossible));
	});

	target.forEach(function (subTarget, i) {
		// Make a copy of the original path tokens for arrays so that items' processing don't affect one another.
		if (path instanceof PathTokens) {
			path = path.buildExpression();
		}
		LazyLoader.eval(subTarget, path, successCallbacks[i], errorCallbacks[i], scopeChain, thisPtr, LazyLoader.evalAll, performedLoading, root, processed.slice(0), invokeImmediatelyIfPossible);
	});

	signal.waitForAll(function () {
		if (allSucceeded) {
			// call the success callback if one exists
			if (successCallback) {
				successCallback.apply(thisPtr || this, [results, performedLoading, root]);
			}
		}
		else if (errorCallback) {
			errorCallback.apply(thisPtr || this, [errors]);
		}
		else {
			errors.forEach(function (e) {
				throw new Error("Error encountered while attempting to eval paths for all items in the target array: " + e);
			});
		}
	}, null, invokeImmediatelyIfPossible);
};

LazyLoader.isRegistered = function LazyLoader$isRegistered(obj, targetLoader, targetProperty) {
	var reg, loader, propertyLoader, targetPropertyName;

	if (obj === null || obj === undefined) {
		return false;
	}

	reg = obj._lazyLoader;

	if (!reg) {
		return false;
	}

	if (targetProperty) {
		if (isString(targetProperty)) {
			targetPropertyName = targetProperty;
		} else if (targetProperty instanceof Property) {
			targetPropertyName = targetProperty.get_name();
		} else {
			throw new Error("Unexpected targetProperty argument value \"" + targetProperty + "\" in LazyLoader.isRegistered().");
		}
		// Attempt to retrieve a property-specific loader if it exists.
		if (reg.byProp && reg.byProp.hasOwnProperty(targetPropertyName)) {
			propertyLoader = reg.byProp[targetPropertyName];
			if (propertyLoader !== null && propertyLoader !== undefined) {
				return true;
			}
		}
	}

	loader = reg.allProps;
	if (loader !== null && loader !== undefined) {
		if (targetLoader) {
			return loader === targetLoader;
		}
		return true;
	}

	return false;
};

LazyLoader.isLoaded = function LazyLoader$isLoaded(obj /*, paths...*/) {
	var result, paths, singlePath, singleStep, nextStep, propName, filterType, property, value;

	if (obj === undefined) {
		result = undefined;
	} else if (obj === null) {
		result = null;
	} else {
		if (arguments.length === 1) {
			// No paths were specified...
			paths = null;
		} else {
			// Paths were specified in some form. They can be passed in as an array of 1 or
			// more arguments, or passed in seperately to be processed as "rest" arguments.
			if (arguments.length === 2) {
				if (isType(arguments[1], Array)) {
					// 1) isLoaded(obj, ["arg1", "arg2", ...]);
					paths = arguments[1];
				} else {
					// 2) isLoaded(obj, "arg");
					paths = [arguments[1]];
				}
			} else {
				// 3) isLoaded(obj, "arg1", "arg2", ...);
				paths = Array.prototype.slice.call(arguments, 1);
			}
		}

		if (!paths || paths.length === 0) {
			// No paths, so this is only an object-level check for the existence of a loader.
			result = !LazyLoader.isRegistered(obj);
		} else if (paths.length === 1) {
			// Only one path, so walk down the path until a non-loaded step is detected.
			singlePath = paths[0];

			// Remove unnecessary "this." prefix.
			if (isType(singlePath, String) && singlePath.startsWith("this.")) {
				singlePath = singlePath.substring(5);
			}

			// Attempt to optimize for a single property name or final path step.
			if (isType(singlePath, String) && singlePath.indexOf(".") < 0) {
				if (singlePath.length === 0) {
					throw new Error("Unexpected empty string passed to LazyLoader.isLoaded().");
				}
				propName = singlePath;
			} else if (isType(singlePath, PathTokens)) {
				if (singlePath.steps.length === 0) {
					throw new Error("Unexpected empty path tokens passed to LazyLoader.isLoaded().");
				} else if (singlePath.steps.length === 1) {
					singleStep = singlePath.steps.dequeue();
					propName = singleStep.property;
				}
			}

			if (propName) {
				// Optimize for a single property name or path step.
				if (LazyLoader.isRegistered(obj, null, propName)) {
					result = false;
				} else {
					// Get the value of the single property or final path step.
					if (obj.meta) {
						property = obj.meta.property(propName, true);
						value = property.value(obj);
					} else {
						value = getValue(obj, propName);
					}

					if (!value) {
						// There is no value, so there can be no lazy loader registered.
						return true;
					} else {
						// If the property value doesn't have a registered lazy loader, then it is considered loaded.
						return !LazyLoader.isRegistered(value);
					}
				}
			} else {
				if (isType(singlePath, String)) {
					if (singlePath.length === 0) {
						throw new Error("Unexpected empty string passed to LazyLoader.isLoaded().");
					}
					singlePath = new PathTokens(singlePath);
				} else if (!isType(singlePath, PathTokens)) {
					throw new Error("Unknown path \"" + singlePath + "\" of type " + parseFunctionName(singlePath.constructor) + ".");
				}

				// Get the value of the next step.
				nextStep = singlePath.steps.dequeue();
				if (obj.meta) {
					property = obj.meta.property(nextStep.property, true);
					value = property.value(obj);
				} else {
					value = getValue(obj, nextStep.property);
				}

				if (!value) {
					// There is no value, so there can be no lazy loader registered.
					return true;
				} else if (LazyLoader.isRegistered(value)) {
					// There is a lazy loader, so stop processing and return false.
					return false;
				} else {
					// There is no lazy loader, so continue processing the next step.
					if (nextStep.cast) {
						filterType = Model.getJsType(nextStep.cast, true);
					}
					if (nextStep.cast && !filterType) {
						// Stop processing since the filter type doesn't yet exist.
						result = true;
					} else if (isArray(value)) {
						// Make a copy of the original path tokens for arrays so that items' processing don't affect one another.
						if (singlePath instanceof PathTokens) {
							singlePath = singlePath.buildExpression();
						}
						result = !value.some(function (item) {
							return (!filterType || item instanceof filterType) && !LazyLoader.isLoaded(item, singlePath);
						});
					} else if (filterType && !(value instanceof filterType)) {
						// Stop processing since the value doesn't pass the filter.
						result = true;
					} else {
						result = LazyLoader.isLoaded(value, singlePath);
					}
				}
			}
		} else {
			// Multiple paths, so check each one individually.
			result = !paths.some(function (path) {
				// Use some and the inverse of the result in order to exit
				// immediately as soon as a non-loaded step is found.
				return !LazyLoader.isLoaded(obj, path);
			});
		}
	}

	return result;
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
			throw new Error($format("Attempting to load object but no appropriate loader is registered. object: {0}, property: {1}", obj, propName));
		}

		loader.load(obj, propName, callback, thisPtr);
	}
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

exports.LazyLoader = LazyLoader; // IGNORE
