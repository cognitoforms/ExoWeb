var pendingSignalTimeouts = null;

function Signal(debugLabel) {
	this._waitForAll = [];
	this._pending = 0;
	var _this = this;
	this._oneDoneFn = function Signal$_oneDoneFn() { Signal.prototype.oneDone.apply(_this, arguments); };

	this._debugLabel = debugLabel;
}

var setupCallbacks = function setupCallbacks() {
	window.setTimeout(function () {
		var callbacks, maxBatch = isNumber(config.signalMaxBatchSize) ? config.signalMaxBatchSize : null;
		if (maxBatch && pendingSignalTimeouts.length > maxBatch) {
			// Exceeds max batch size, so only invoke the max number and delay the rest
			callbacks = pendingSignalTimeouts.splice(0, maxBatch);
			setupCallbacks();
		}
		else {
			// No max batch, or does not exceed size, so call all pending callbacks
			callbacks = pendingSignalTimeouts;
			pendingSignalTimeouts = null;
		}
		// Call each callback in order
		callbacks.forEach(callArgument);
	}, 1);
};

function doCallback(name, thisPtr, callback, args, executeImmediately) {
	if (executeImmediately === false || (config.signalTimeout === true && executeImmediately !== true)) {
		var batch = Batch.suspendCurrent("_doCallback");

		// manage a queue of callbacks to ensure the order of execution

		var setup = false;
		if (pendingSignalTimeouts === null) {
			pendingSignalTimeouts = [];
			setup = true;
		}

		pendingSignalTimeouts.push(function() {
			Batch.resume(batch);
			callback.apply(thisPtr, args || []);
		});

		if (setup) {
			setupCallbacks();
		}
	}
	else {
		callback.apply(thisPtr, args || []);
	}
}

Signal.mixin({
	pending: function Signal$pending(callback, thisPtr, executeImmediately) {
		if (this._pending === 0) {
			Signal.allPending.push(this);
		}

		this._pending++;
		return this._genCallback(callback, thisPtr, executeImmediately);
	},
	orPending: function Signal$orPending(callback, thisPtr, executeImmediately) {
		return this._genCallback(callback, thisPtr, executeImmediately);
	},
	_doCallback: function Signal$_doCallback(name, thisPtr, callback, args, executeImmediately) {
		doCallback.apply(this, arguments);
	},
	_genCallback: function Signal$_genCallback(callback, thisPtr, executeImmediately) {
		var signal = this, called = false;
		return function Signal$_genCallback$result() {
			signal._doCallback("pending", thisPtr || this, function Signal$_genCallback$fn() {

				// Throw an error if the signal callback has already been called
				if (called) throw new Error("(" + signal._debugLabel + ") signal callback was called more than once.");

				// Record the fact that the callback has already been called in case it is called again
				called = true;

				// Invoke the callback if it exists
				if (callback) callback.apply(this, arguments);

				// Signal that the callback is complete
				signal.oneDone();

			}, arguments, executeImmediately);
		};
	},
	waitForAll: function Signal$waitForAll(callback, thisPtr, executeImmediately) {
		if (!callback) {
			return;
		}

		if (this._pending === 0) {
			this._doCallback("waitForAll", thisPtr, callback, [], executeImmediately);
		}
		else {
			this._waitForAll.push({ "callback": callback, "thisPtr": thisPtr, "executeImmediately": executeImmediately });
		}
	},
	oneDone: function Signal$oneDone() {
		--this._pending;

		if (this._pending === 0) {
			Signal.allPending.remove(this);
		}

		while (this._pending === 0 && this._waitForAll.length > 0) {
			var item = this._waitForAll.dequeue();
			this._doCallback("waitForAll", item.thisPtr, item.callback, [], item.executeImmediately);
		}
	},
	isActive: function Signal$isActive() {
		return this._pending > 0;
	}
});

Signal.allPending = [];

exports.Signal = Signal;
