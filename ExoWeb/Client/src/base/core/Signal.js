var pendingSignalTimeouts = null;

function Signal(debugLabel) {
	this._waitForAll = [];
	this._pending = 0;
	var _this = this;
	this._oneDoneFn = function Signal$_oneDoneFn() { ExoWeb.Signal.prototype.oneDone.apply(_this, arguments); };

	this._debugLabel = debugLabel;
}

function doCallback(name, thisPtr, callback, args, executeImmediately) {
	if (executeImmediately === false || (ExoWeb.config.signalTimeout === true && executeImmediately !== true)) {
		var batch = Batch.suspendCurrent("_doCallback");

		// manage a queue of callbacks to ensure the order of execution

		var setup = false;
		if (pendingSignalTimeouts === null) {
			pendingSignalTimeouts = [];
			setup = true;
		}

		pendingSignalTimeouts.push(function() {
			ExoWeb.Batch.resume(batch);
			callback.apply(thisPtr, args || []);
		});

		if (setup) {
			window.setTimeout(function () {
				var callbacks = pendingSignalTimeouts;
				pendingSignalTimeouts = null;
				callbacks.forEach(function (cb) {
					cb();
				});
			}, 1);
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
		//ExoWeb.trace.log("signal", "(++{_pending}) {_debugLabel}", this);
		return this._genCallback(callback, thisPtr, executeImmediately);
	},
	orPending: function Signal$orPending(callback, thisPtr, executeImmediately) {
		return this._genCallback(callback, thisPtr, executeImmediately);
	},
	_doCallback: function Signal$_doCallback(name, thisPtr, callback, args, executeImmediately) {
		if (ExoWeb.config.debug === true) {
			doCallback.apply(this, arguments);
		}
		else {
			try {
				doCallback.apply(this, arguments);
			}
			catch (e) {
				logError("signal", "({0}) {1} callback threw an exception: {2}", [this._debugLabel, name, e]);
			}
		}
	},
	_genCallback: function Signal$_genCallback(callback, thisPtr, executeImmediately) {
		var signal = this, called = false;
		return function Signal$_genCallback$result() {
			signal._doCallback("pending", thisPtr || this, function Signal$_genCallback$fn() {
				if (called) {
					ExoWeb.trace.throwAndLog("signal", "({0}) signal callback was called more than once.", [signal._debugLabel]);
				}
				called = true;
				if (callback) {
					callback.apply(this, arguments);
				}
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
		//ExoWeb.trace.log("signal", "(--{0}) {1}", [this._pending - 1, this._debugLabel]);

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

ExoWeb.Signal = Signal;
