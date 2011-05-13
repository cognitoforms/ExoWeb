function ChangeSet(source, initialChanges) {
	if (!source || source.constructor !== String) {
		ExoWeb.trace.throwAndLog("changeLog", "Creating a change set requires a string source argument.");
	}

	this._source = source;
	this._changes = (initialChanges && initialChanges instanceof Array) ?
		[].concat(initialChanges) :
		[];
}

ChangeSet.mixin(Functor.eventing);

ChangeSet.mixin({
	add: function(change) {
		var idx = this._changes.push(change) - 1;
		this._raiseEvent("changeAdded", [change, idx, this]);
		return idx;
	},
	addChangeAdded: function(fn, filter, once) {
		this._addEvent("changeAdded", fn, filter, once);
	},
	addChangeUndone: function(fn, filter, once) {
		this._addEvent("changeUndone", fn, filter, once);
	},
	addTruncated: function(fn, filter, once) {
		this._addEvent("truncated", fn, filter, once);
	},
	changes: function() {
		return this._changes;
	},
	count: function (filter, thisPtr) {
		if (!filter) {
			return this._changes.length;
		}

		return this._changes.filter(filter, thisPtr).length;
	},
	lastChange: function() {
		return this._changes.length > 0 ? this._changes[this._changes.length - 1] : null;
	},
	serialize: function(filter, thisPtr) {
		return {
			source: (this._source === "init" || this._source === "client") ? this._source : "server",
			changes: filter ? 
				this._changes.filter(filter, thisPtr) :
				Array.prototype.slice.call(this._changes)
		};
	},
	source: function() {
		return this._source;
	},
	truncate: function(filter, thisPtr) {
		// Discard all changes that match the given filter

		var numRemoved;
		if (filter) {
			var removedAt = this._changes.purge(filter, thisPtr);
			numRemoved = removedAt ? removedAt.length : 0;
		}
		else {
			numRemoved = this._changes.length;
			this._changes.clear();
		}

		this._raiseEvent("truncated", [numRemoved, this]);
		return numRemoved;
	},
	undo: function() {
		if (this._changes.length > 0) {
			var lastIdx = this._changes.length - 1;
			var change = this._changes[lastIdx];
			this._changes.splice(lastIdx, 1);
			this._raiseEvent("changeUndone", [change, lastIdx, this]);
			return change;
		}

		return null;
	}
});
exports.ChangeSet = ChangeSet; // IGNORE
