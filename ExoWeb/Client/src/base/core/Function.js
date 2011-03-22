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

	return function dontDoubleUp() {
		// is the function already being called with the same arguments?

		var origCallback;
		var origThisPtr;

		if (options.callbackArg < arguments.length) {
			origCallback = arguments[options.callbackArg];
		}

		if (options.thisPtrArg < arguments.length) {
			origThisPtr = arguments[options.thisPtrArg];
		}

		// determine what values to use to group callers
		var groupBy;

		if (options.groupBy) {
			groupBy = options.groupBy.apply(this, arguments);
		}
		else {
			groupBy = [this];
			for (var i = 0; i < arguments.length; ++i) {
				if (i !== options.callbackArg && i !== options.thisPtrArg) {
					groupBy.push(arguments[i]);
				}
			}
		}

		// is this call already in progress?
		var callInProgress;

		for (var c = 0; !callInProgress && c < calls.length; ++c) {
			var call = calls[c];

			// TODO: handle optional params better
			if (groupBy.length != call.groupBy.length) {
				continue;
			}

			callInProgress = call;
			for (var j = 0; j < groupBy.length; ++j) {
				if (groupBy[j] !== call.groupBy[j]) {
					callInProgress = null;
					break;
				}
			}
		}

		if (!callInProgress) {
			// track the next call that is about to be made
			var call = { callback: Functor(), groupBy: groupBy };
			calls.push(call);

			// make sure the original callback is invoked and that cleanup occurs
			call.callback.add(function() {
				Array.remove(calls, call);
				if (origCallback) {
					origCallback.apply(origThisPtr || this, arguments);
				}
			});

			// pass the new callback to the inner function
			arguments[options.callbackArg] = call.callback;
			proceed.apply(this, arguments);
		}
		else if (origCallback) {
			// wait for the original call to complete
			var batch = Batch.suspendCurrent("dontDoubleUp");
			callInProgress.callback.add(function() {
				ExoWeb.Batch.resume(batch);
				origCallback.apply(origThisPtr || this, arguments);
			});
		}
	};
};

Function.prototype.cached = function Function$cached(options) {
	var proceed = this;
	var cache = {};

	return function cached() {
		var key = options.key.apply(this, arguments);

		var result = cache[key];

		if (result === undefined) {
			result = proceed.apply(this, arguments);
			cache[key] = result;
		}

		return result;
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

Function.prototype.setScope = function() {
	ExoWeb.trace.logWarning("functions", "Function \"setScope\" is decprecated. Use \"bind\" instead.");
	bind.apply(this, arguments);
};

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
