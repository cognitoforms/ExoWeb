function Functor() {
	var funcs = [];

	var f = function Functor$fn() {
		for (var i = 0; i < funcs.length; ++i) {
			var item = funcs[i];

			// Don't re-run one-time subscriptions that have already been applied.
			if (item.applied === true) {
				continue;
			}

			// Ensure that there is either no filter or the filter passes.
			if (!item.filter || item.filter.apply(this, arguments) === true) {
				// If handler is set to execute once,
				// remove the handler before calling.
				if (item.once === true) {
					// Mark as applied but leave item in array to avoid potential
					// problems due to re-entry into event invalidating iteration
					// index. In some cases re-entry would be a red-flag, but for
					// "global" events, where the context of the event is derived
					// from the arguments, the event could easily be re-entered
					// in a different context with different arguments.
					item.applied = true;
				}

				// Call the handler function.
				item.fn.apply(this, arguments);
			}
		}
	};

	f._funcs = funcs;
	f.add = Functor$add;
	f.remove = Functor$remove;
	f.isEmpty = Functor$isEmpty;
	f.clear = Functor$clear;

	return f;
}

function Functor$add(fn, filter, once) {
	var item = { fn: fn };

	if (filter !== undefined) {
		item.filter = filter;
	}

	if (once !== undefined) {
		item.once = once;
	}

	this._funcs.push(item);

	return fn;
}

function Functor$remove(old) {
	for (var i = this._funcs.length - 1; i >= 0; --i) {
		if (this._funcs[i].fn === old) {
			this._funcs.splice(i, 1);
			return true;
		}
	}

	return false;
}

function Functor$clear() {
	this._funcs.length = 0;
}

function Functor$isEmpty(args) {
	return !this._funcs.some(function (item) { return item.applied !== true && (!args || !item.filter || item.filter.apply(this, args)); }, this);
}

var functorEventsInProgress = 0;

// busy if there are any events in progress
registerActivity("Functor", function() {
	return functorEventsInProgress > 0;
});

Functor.eventing = {
	_addEvent: function Functor$_addEvent(name, func, filter, once) {
		if (!this["_" + name]) {
			this["_" + name] = new Functor();
		}

		this["_" + name].add(func, filter, once);

		return func;
	},
	_removeEvent: function Functor$_removeEvent(name, func) {
		var handler = this["_" + name];
		if (handler) {
			handler.remove(func);
			return true;
		}

		return false;
	},
	_raiseEvent: function Functor$_raiseEvent(name, argsArray) {
		var handler = this["_" + name];
		if (handler) {
			try {
				functorEventsInProgress++;
				handler.apply(this, argsArray || []);
			}
			finally {
				functorEventsInProgress--;
			}
		}
	},
	_clearEvent: function Functor$_clearEvent(name) {
		var evtName = "_" + name;
		if (this.hasOwnProperty(evtName)) {
			this[evtName] = null;
		}
	},
	_getEventHandler: function Functor$_getEventHandler(name) {
		return this["_" + name];
	}
};

exports.Functor = Functor;
