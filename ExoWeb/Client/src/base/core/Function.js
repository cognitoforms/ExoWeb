
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

Function.prototype.setScope = function setScope(obj) {
	var func = this;
	return function setScope$fn() {
		return func.apply(obj, arguments);
	};
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
		Array.addRange(args, additional);
		Array.addRange(args, Array.prototype.slice.call(arguments));
		return func.apply(this, args);
	};
};

Function.prototype.appendArguments = function appendArguments(/* arg1, arg2, ... */) {
	var func = this;
	var additional = Array.prototype.slice.call(arguments);
	return function appendArguments$fn() {
		var args = Array.prototype.slice.call(arguments);
		Array.addRange(args, additional);
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
