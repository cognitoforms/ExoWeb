/// <reference path="Errors.js" />

function FunctionChain(steps, thisPtr) {
	if (!(steps instanceof Array)) throw new ArgumentTypeError("steps", "array", steps);

	this._steps = steps;
	this._thisPtr = thisPtr;
}

FunctionChain.prepare = function FunctionChain$_invoke() {
	// Return a function that can be invoked with callback and thisPtr.
	// Useful for assigning to a prototype member, since "this" is used
	// as the thisPtr for the chain if "thisPtr" argument is not supplied,
	// while "thisPtr" of invocation is used as the argument to "invoke".

	var steps = null,
		thisPtrOuter = null;

	// no args => empty chain
	if (arguments.length === 0) {
		steps = [];
	}
	// one array arg => array of steps
	else if (arguments.length === 1 && arguments[0] instanceof Array) {
		steps = arguments[0];
	}
	// two args (first array) => array of steps and this pointer
	else if (arguments.length === 2 && arguments[0] instanceof Array) {
		steps = arguments[0];
		thisPtrOuter = arguments[1];
	}
	// otherwise, assume arguments correspond to steps
	else {
		steps = Array.prototype.slice.call(arguments);
	}

	return function(callback, thisPtr) {
		var chain = new FunctionChain(steps, thisPtrOuter || this);
		chain.invoke(callback, thisPtr);
	};
};

function doStep(idx, callback, thisPtr) {
	var _callback = callback;
	var _thisPtr = thisPtr;
	var nextStep = idx + 1 < this._steps.length ?
		doStep.prependArguments(idx + 1, _callback, _thisPtr) :
		function() {
			if (_callback && _callback instanceof Function) {
				_callback.apply(_thisPtr || this, arguments);
			}
		};

	this._steps[idx].call(this._thisPtr || this, nextStep, this);
}

FunctionChain.mixin({
	invoke: function(callback, thisPtr) {
		doStep.call(this, 0, callback, thisPtr);
	}
});

exports.FunctionChain = FunctionChain;
