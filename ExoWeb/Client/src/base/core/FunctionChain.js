/// <reference path="Errors.js" />

function FunctionChain(steps, thisPtr) {
	if (!(steps instanceof Array)) {
		throw new ArgumentTypeError("steps", "array", steps);
	}

	this._steps = steps;
	this._thisPtr = thisPtr;
}

FunctionChain.prepare = function FunctionChain$_invoke() {
	// Return a function that can be invoked with callback and thisPtr.
	// Useful for assigning to a prototype member, since "this" is used
	// as the thisPtr for the chain if "thisPtr" argument is not supplied,
	// while "thisPtr" of invocation is used as the argument to "invoke".

	var steps,
		thisPtrOuter = null;

	// no args => empty chain
	if (arguments.length === 0) {
		steps = [];
	} else if (arguments.length === 1 && arguments[0] instanceof Array) {
		// One array arg => array of steps
		steps = arguments[0];
	} else if (arguments.length === 2 && arguments[0] instanceof Array) {
		// Two args (first array) => array of steps and this pointer
		steps = arguments[0];
		thisPtrOuter = arguments[1];
	} else {
		// Otherwise, assume arguments correspond to steps
		steps = Array.prototype.slice.call(arguments);
	}

	return function(callback, thisPtr) {
		var chain = new FunctionChain(steps, thisPtrOuter || this);
		chain.invoke(callback, thisPtr);
	};
};

FunctionChain.forEachAsync = function (items, stepFunction, callback) {
	if (items.length === 0) {
		if (callback) {
			callback();
		}
		return;
	}

	var chain = new FunctionChain(items.map(function (item) {
		return function (cb, thisPtr) {
			stepFunction.call(thisPtr || this, item, cb, thisPtr || this);
		};
	}));
	chain.invoke(callback);
};

function doStep(idx, callback, thisPtr) {
	var outerCallback = callback;
	var outerThisPtr = thisPtr;
	var nextStep = idx + 1 < this._steps.length ?
		doStep.prependArguments(idx + 1, outerCallback, outerThisPtr).bind(this) :
		function() {
			if (outerCallback && outerCallback instanceof Function) {
				outerCallback.apply(outerThisPtr || this, arguments);
			}
		};

	this._steps[idx].call(this._thisPtr || this, nextStep);
}

FunctionChain.mixin({
	invoke: function(callback, thisPtr) {
		doStep.call(this, 0, callback, thisPtr);
	}
});

exports.FunctionChain = FunctionChain;
