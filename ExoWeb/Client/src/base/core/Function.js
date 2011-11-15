var overridableNonEnumeratedMethods;

for (var m in {}) {
	if (m == "toString") {
		overridableNonEnumeratedMethods = [];
		break;
	}
}

if (!overridableNonEnumeratedMethods)
	overridableNonEnumeratedMethods = ["toString", "toLocaleString", "valueOf"];

Function.prototype.mixin = function mixin(methods, object) {
	if (!object) {
		object = this.prototype;
	}

	for (var m in methods) {
		if (methods.hasOwnProperty(m))
			object[m] = methods[m];
	}

	// IE's "in" operator doesn't return keys for native properties on the Object prototype
	overridableNonEnumeratedMethods.forEach(function (m) {
		if (methods.hasOwnProperty(m))
			object[m] = methods[m];
	});
};

Function.prototype.dontDoubleUp = function Function$dontDoubleUp(options) {
	var proceed = this;
	var calls = [];
	
	// Is the function already being called with the same arguments?
	return function dontDoubleUp() {
		var i, ilen, j, jlen, origCallback, origThisPtr, partitionedArg, partitionedArgIdx, groupBy, callsInProgress, call, shouldJoinCall, otherPartitionedArg, partitionedInCall, joinArgIdx, args;
	
		// Make a copy of the invocation arguments.
		args = Array.prototype.slice.call(arguments);

		// Extract callback and thisPtr arguments, if they exist.
		if (options.callbackArg < arguments.length) {
			origCallback = arguments[options.callbackArg];
		}
		if (options.thisPtrArg < arguments.length) {
			origThisPtr = arguments[options.thisPtrArg];
		}

		// Determine what arguments can be partitioned into separate calls
		if (options.partitionedArg !== null && options.partitionedArg !== undefined) {
			partitionedArg = arguments[options.partitionedArg];
			if (!(partitionedArg instanceof Array)) {
				throw "The partitioned argument must be an array.";
			}

			// Create a copy of the argument.
			partitionedArg = partitionedArg.copy();

			partitionedArgIdx = -1;
		}

		// Determine what values to use to group callers
		groupBy = [];
		if (options.groupBy && options.groupBy instanceof Array) {
			for (i = 0, ilen = options.groupBy.length; i < ilen; i++) {
				if (partitionedArg !== undefined && options.groupBy[i] === options.partitionedArg) {
					partitionedArgIdx = groupBy.length;
				}
				groupBy.push(arguments[options.groupBy[i]]);
			}
		}
		else if (options.groupBy !== null && options.groupBy !== undefined) {
			groupBy.push(arguments[options.groupBy]);
			if (options.groupBy === options.partitionedArg) {
				partitionedArgIdx = 0;
			}
		}
		else {
			for (i = 0, ilen = arguments.length; i < ilen; ++i) {
				if (i !== options.callbackArg && i !== options.thisPtrArg) {
					if (partitionedArg !== undefined && i === options.partitionedArg) {
						partitionedArgIdx = groupBy.length;
					}
					groupBy.push(arguments[i]);
				}
			}
		}

		// Verify that the the partitioned argument is part of the grouping.
		if (partitionedArgIdx === -1) {
			throw "Invalid partitionedArg option.";
		}

		// Is this call already in progress?
		callsInProgress = [];
		for (i = 0, ilen = calls.length; (partitionedArg === undefined || partitionedArg.length > 0) && i < ilen; i++) {
			call = calls[i];

			// TODO: handle optional params better
			if (groupBy.length != call.groupBy.length) {
				continue;
			}

			// Only join calls together if they were called on the same object.
			shouldJoinCall = this === call.context;

			// Make sure all of the arguments match.
			for (j = 0, jlen = groupBy.length; shouldJoinCall && j < jlen; j++) {
				if (j === partitionedArgIdx) {	
					// Attempt to find items in partitioned argument that are in progress and remove them
					shouldJoinCall = call.groupBy[j].some(function(p) {
						return partitionedArg.indexOf(p) >= 0;
					});
				}
				else if (groupBy[j] !== call.groupBy[j]) {
					shouldJoinCall = false;
				}
			}

			if (shouldJoinCall) {

				partitionedInCall = [];

				// Remove partitioned args that will be satisfied by the call in progress.
				if (partitionedArg !== undefined) {
					otherPartitionedArg = call.groupBy[partitionedArgIdx];
					for (j = 0, jlen = otherPartitionedArg.length; j < jlen; j++) {
						joinArgIdx = partitionedArg.indexOf(otherPartitionedArg[j]);
						if (joinArgIdx >= 0) {
							partitionedInCall.push(otherPartitionedArg[j]);
							partitionedArg.splice(joinArgIdx, 1);
						}
					}
				}

				callsInProgress.push({ call: call, partitioned: partitionedInCall });

			}
		}

		if (callsInProgress.length === 0 || (partitionedArg !== undefined && partitionedArg.length > 0)) {

			// track the next call that is about to be made
			call = { callback: Functor(), groupBy: groupBy, context: this };
			
			calls.push(call);

			// make sure the original callback is invoked and that cleanup occurs
			call.callback.add(function() {
				if (calls.indexOf(call) < 0) {
					throw "Call not found.";
				}
				if (origCallback) {
					origCallback.apply(origThisPtr || this, arguments);
				}
				calls.remove(call);
			});

			// Copy the args
			newArgs = args.slice();

			// use remaining partitioned args if in effect
			if (partitionedArg !== undefined && partitionedArg.length > 0) {
				newArgs[options.partitionedArg] = partitionedArg;
			}

			// pass the new callback to the inner function
			newArgs[options.callbackArg] = call.callback;

			call.args = newArgs;

			proceed.apply(this, newArgs);

		}

		if (callsInProgress.length > 0 && origCallback) {
		
			// wait for the original call to complete
			forEach(callsInProgress, function(call) {

				var invocationArgs;

				if (options.partitionedFilter) {
					invocationArgs = args.slice();
					invocationArgs[options.partitionedArg] = call.partitioned;
					invocationArgs[options.callbackArg] = origCallback;
				}

				call.call.callback.add(function() {

					var callbackArgs;

					if (options.partitionedFilter) {
						callbackArgs = Array.prototype.slice.call(arguments);
						options.partitionedFilter.call(origThisPtr || this, call.call.args, invocationArgs, callbackArgs);
					}
					else {
						callbackArgs = arguments;
					}

					origCallback.apply(origThisPtr || this, callbackArgs);

				});
			});

		}
	};
};

Function.prototype.cached = function Function$cached(options) {
	var proceed = this;
	var cache = {};

	var keygen = (options && options.key) || function(arg) { return arg; };

	return function cached() {
		var key = keygen.apply(this, arguments);
		return cache.hasOwnProperty(key) ? cache[key] : (cache[key] = proceed.apply(this, arguments));
	};
};

function bind(obj) {
	var slice = [].slice,
		args = slice.call(arguments, 1),
		self = this,
		nop = function () {},
		bound = function () {
			return self.apply(this instanceof nop ? this : (obj || {}),
				args.concat(slice.call(arguments)));
		};

	nop.prototype = self.prototype;
	bound.prototype = new nop();

	return bound;
}
exports.bind = bind; // IGNORE

// Function.prototype.bind polyfill
if (!Function.prototype.bind)
	Function.prototype.bind = bind;

Function.prototype.prepare = function prepare(thisPtr, args) {
	/// <summary>
	/// Returns a function that will invoke this function with the given
	/// this value and arguments, regardless of how the returned 
	/// function is invoked.
	/// </summary>

	var func = this;
	return function prepare$fn() {
		return func.apply(thisPtr || this, args || []);
	};
};

Function.prototype.prependArguments = function prependArguments(/* arg1, arg2, ... */) {
	var func = this;
	var additional = Array.prototype.slice.call(arguments);
	return function prependArguments$fn() {
		var args = [];
		args.addRange(additional);
		args.addRange(Array.prototype.slice.call(arguments));
		return func.apply(this, args);
	};
};

Function.prototype.appendArguments = function appendArguments(/* arg1, arg2, ... */) {
	var func = this;
	var additional = Array.prototype.slice.call(arguments);
	return function appendArguments$fn() {
		var args = Array.prototype.slice.call(arguments);
		args.addRange(additional);
		return func.apply(this, args);
	};
};

Function.prototype.spliceArguments = function spliceArguments(/* start, howmany, item1, item2, ... */) {
	var func = this;
	var spliceArgs = arguments;
	return function spliceArguments$fn() {
		var args = Array.prototype.slice.call(arguments);
		args.splice.apply(args, spliceArgs);
		return func.apply(this, args);
	};
};

Function.prototype.sliceArguments = function sliceArguments(/* start, end */) {
	var func = this;
	var sliceArgs = arguments;
	return function spliceArguments$fn() {
		var args = Array.prototype.slice.call(arguments);
		args = args.slice.apply(args, sliceArgs);
		return func.apply(this, args);
	};
};

function mergeFunctions(fn1, fn2, options) {
	// return early if one or both functions are not defined
	if (!fn1 && !fn2) return;
	if (!fn2) return fn1;
	if (!fn1) return fn2;

	if (options && options.async === true) {
		return function () {
			var idx = options.callbackIndex || 0;
			var callback = arguments[idx];

			if (!callback || !(callback instanceof Function))
				ExoWeb.trace.throwAndLog("functions",
					"Unable to merge async functions: the argument at index {0}{1} is not a function.",
					[idx, options.callbackIndex ? "" : " (default)"]);

			var signal = new Signal("mergeFunctions");

			// replace callback function with signal pending and invoke callback when both are complete
			var args1 = Array.prototype.slice.call(arguments);
			args1.splice(idx, 1, signal.pending());
			fn1.apply(this, args1);

			var args2 = Array.prototype.slice.call(arguments);
			args2.splice(idx, 1, signal.pending());
			fn2.apply(this, args2);

			signal.waitForAll(callback, (options.thisPtrIndex && arguments[options.thisPtrIndex]) || this);
		};
	}
	else {
		return function () {
			fn1.apply(this, arguments);
			fn2.apply(this, arguments);
		};
	}
}
exports.mergeFunctions = mergeFunctions; // IGNORE

function equals(obj) {
	return function(other) {
		return obj === other;
	};
}
exports.equals = equals; // IGNORE

function not(fn) {
	return function() {
		return !fn.apply(this, arguments);
	};
}
exports.not = not; // IGNORE

function before(original, fn) {
	return function() {
		fn.apply(this, arguments);
		original.apply(this, arguments);
	};
}
exports.before = before; // IGNORE

function after(original, fn) {
	return function() {
		original.apply(this, arguments);
		fn.apply(this, arguments);
	};
}
exports.after = after; // IGNORE
