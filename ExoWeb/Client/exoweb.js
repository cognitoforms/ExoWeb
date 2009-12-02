Function.prototype.mixin = function(methods, object) {
	if(!object)
		object = this.prototype;

	for (var m in methods) {
		object[m] = methods[m];
	}
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
			if (console && this._debugLabel) console.log($format("[signal++ {_pending}] {_debugLabel}", this));

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
			if (console && this._debugLabel) console.log($format("[signal-- {0}] {1}", [this._pending - 1, this._debugLabel]));

			if (--this._pending == 0) {
				while (this._waitForAll.length > 0)
					Array.dequeue(this._waitForAll).apply(this, arguments);
			}
		}
	});

	ExoWeb.Signal = Signal;


	//////////////////////////////////////////////////////////////////////////////////////
	Function.prototype.dontDoubleUp = function(options) {
		var proceed = this;
		var calls = [];

		return function dontDoubleUp() {
			// is the function already being called with the same arguments?

			var origCallback;

			if (options.callbackArg < arguments.length)
				origCallback = arguments[options.callbackArg];

			// determine what values to use to group callers
			var groupBy;

			if (options.groupBy) {
				groupBy = options.groupBy.apply(this, arguments)
			}
			else {
				groupBy = [this];
				for (var i = 0; i < arguments.length; ++i) {
					if (i != options.callbackArg)
						groupBy.push(arguments[i]);
				}
			}

			if (options.debug) {
				console.groupCollapsed("dontDoubleUp: " + (options.debugLabel || ""));
				console.log("groupBy:");
				console.dir(groupBy);

				console.log("calls:" + calls.length);
			}

			// is this call already in progress?
			var callInProgress;

			for (var c = 0; !callInProgress && c < calls.length; ++c) {
				var call = calls[c];

				if (options.debug)
					console.dir(call.groupBy);

				// TODO: handle optional params better
				if (groupBy.length != call.groupBy.length)
					continue;

				callInProgress = call;
				for (var i = 0; i < groupBy.length; ++i) {
					if (groupBy[i] !== call.groupBy[i]) {
						callInProgress = null;
						break;
					}
				}
			}

			if (options.debug) {
				console.log("call in progress:");
				console.dir(callInProgress);
				console.groupEnd();
			}

			if (!callInProgress) {
				// track the next call that is about to be made
				var call = { callback: Functor(), groupBy: groupBy };
				calls.push(call);

				// make sure the original callback is invoked and that cleanup occurs
				call.callback.add(function() {
					Array.remove(calls, call);
					if (origCallback)
						origCallback.apply(this, arguments);
				});

				// pass the new callback to the inner function
				arguments[options.callbackArg] = call.callback;
				proceed.apply(this, arguments);
			}
			else if (origCallback) {
				// wait for the original call to complete
				callInProgress.callback.add(origCallback);
			}
		}
	}

	Function.prototype.logged = function(messageFormat) {
		var proceed = this;

		return function logged() {
			console.log("ENTER:" + $format(messageFormat, arguments));
			try {
				proceed.apply(this, arguments);
			}
			finally {
				console.log("EXIT:" + $format(messageFormat, arguments));
			}
		}
	}

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
	///////////////////////////////////////////////////////////////////////////////

	function Transform(array, root) {
		if (!root) {
			Function.mixin(Transform.prototype, array);
			return array;
		}
		else {
			this.array = array;
		}
	}

	Transform.mixin({
		input: function() {
			return this.array || this;
		},
		where: function where(filter) {
			if (!(filter instanceof Function))
				filter = new Function("$item", "$index", "with($item){ return (" + filter + ");}");

			var output = [];

			var input = this.input();
			var len = input.length;
			for (var i = 0; i < len; ++i) {
				var item = input[i];

				if (filter(item, i))
					output.push(item);
			}

			return new Transform(output);
		},
		groupBy: function groupBy(groups) {
			if (!(groups instanceof Function)) {
				groups = new Function("$item", "$index", "return $item['" + groups.split(",").join("']['") + "'];");
			}

			var output = [];

			var input = this.input();
			var len = input.length;
			for (var i = 0; i < len; i++) {
				var item = input[i];
				var groupKey = groups(item, i);

				var group = null;
				for (var g = 0; g < output.length; ++g) {
					if (output[g].group == groupKey) {
						group = output[g];
						group.items.push(item);
						break;
					}
				}

				if (!group)
					output.push({ group: groupKey, items: [item] });
			}
			return new Transform(output);
		}
	});

	ExoWeb.Transform = Transform;
	window.$transform = function $transform(array) { return new Transform(array, true); };


	///////////////////////////////////////////////////////////////////////////////
	// Globals
	function $format(str, values) {
		return str.replace(/{([a-z0-9_]+)}/ig, function(match, expr) {
			var val = values;
			var steps = expr.split(".");

			for (var i = 0; i < steps.length; ++i) {
				var name = steps[i];
				var val = val[name];

				if (val === null)
					return "";
				if (val === undefined)
					return match;
			}

			return val.toString();
		});
	}
	window.$format = $format;
})();

