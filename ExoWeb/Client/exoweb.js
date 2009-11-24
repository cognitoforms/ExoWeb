Function.prototype.mixin = function(methods) {
	for (var m in methods)
		this.prototype[m] = methods[m];
}

Type.registerNamespace("ExoWeb");

(function() {
	var undefined;

	function Signal(debugLabel) {
		this._waitForAll = [];
		this._pending = 0;
		var _this = this;
		this._oneDoneFn = function() { ExoWeb.Signal.prototype.oneDone.apply(_this, arguments); };
		//this._debugLabel = debugLabel;
	}

	Signal.mixin({
		pending: function(callback) {
			this._pending++;
			if (console && this._debugLabel) console.log($format("{_debugLabel} (+) {_pending}", this));

			if (callback) {
				var _oneDoneFn = this._oneDoneFn;
				return function() {
					callback.apply(this, arguments);
					_oneDoneFn.apply(this, arguments);
				}
			}
			else
				return this._oneDoneFn;
		},
		waitForAll: function(callback) {
			if (!callback)
				return;

			if (this._pending == 0) {
				callback();
			} else
				this._waitForAll.push(callback);
		},
		oneDone: function() {
			if (console && this._debugLabel) console.log($format("{1} (-) {0}", [this._pending - 1, this._debugLabel]));

			if (--this._pending == 0) {
				while (this._waitForAll.length > 0)
					Array.dequeue(this._waitForAll).apply(this, arguments);
			}
		}
	});

	ExoWeb.Signal = Signal;


	//////////////////////////////////////////////////////////////////////////////////////
	function Functor() {
		var funcs = [];

		var f = function() {
			for (var i = 0; i < funcs.length; ++i)
				funcs[i].apply(this, arguments);
		};

		f._funcs = funcs;
		f.add = Functor.add;
		f.remove = Functor.remove;

		return f;
	}

	Functor.add = function() {
		for (var i = 0; i < arguments.length; ++i) {
			var f = arguments[i];

			if (f == null)
				continue;

			this._funcs.push(f);
		}
	}

	Functor.remove = function(old) {
		for (var i = this._funcs.length - 1; i >= 0; --i) {
			if (this._funcs[i] === old) {
				this._funcs.splice(i, 1);
				break;
			}
		}
	}

	Functor.eventing = {
		_addEvent: function(name, func) {
			if (!this["_" + name])
				this["_" + name] = new Functor();

			this["_" + name].add(func);
		},
		_removeEvent: function(name, func) {
			var handler = this["_" + name];
			if (handler)
				handler.remove(func);
		},
		_raiseEvent: function(name, argsArray) {
			var handler = this["_" + name];
			if (handler)
				handler.apply(this, argsArray);
		}
	};
	
	ExoWeb.Functor = Functor;

})();

///////////////////////////////////////////////////////////////////////////////
// Globals
function $format(str, values) {
	return str.replace(/{([a-z0-9_]+)}/ig, function(match, name) {
		var val = values[name];

		if (val === null)
			return "";
		if (val === undefined)
			return match;

		return val.toString();
	});
}
