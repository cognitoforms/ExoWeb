function Signal(debugLabel) {
	this._waitForAll = [];
	this._pending = 0;
	var _this = this;
	this._oneDoneFn = function Signal$_oneDoneFn() { ExoWeb.Signal.prototype.oneDone.apply(_this, arguments); };

	this._debugLabel = debugLabel;
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
		try {
			if (executeImmediately === false || (ExoWeb.config.signalTimeout === true && executeImmediately !== true)) {
				var batch = Batch.suspendCurrent("_doCallback");
				window.setTimeout(function Signal$_doCallback$timeout() {
					ExoWeb.Batch.resume(batch);
					callback.apply(thisPtr, args || []);
				}, 1);
			}
			else {
				callback.apply(thisPtr, args || []);
			}
		}
		catch (e) {
			logError("signal", "({0}) {1} callback threw an exception: {2}", [this._debugLabel, name, e]);
		}
	},
	_genCallback: function Signal$_genCallback(callback, thisPtr, executeImmediately) {
		if (callback) {
			var signal = this;
			return function Signal$_genCallback$result() {
				signal._doCallback("pending", thisPtr || this, function Signal$_genCallback$fn() {
					callback.apply(this, arguments);
					signal.oneDone();
				}, arguments, executeImmediately);
			};
		}
		else {
			return this._oneDoneFn;
		}
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
			Array.remove(Signal.allPending, this);
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
