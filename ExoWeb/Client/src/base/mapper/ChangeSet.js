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
	checkpoint: function(title, code) {
		// Generate a random code for the checkpoint if one is not given.
		if (!code) {
			code = randomText(10);
		}

		// Add the checkpoint and return the code.
		this.add({ type: "Checkpoint", title: title || "untitled", code: code });
		return code;
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
	truncate: function(checkpoint, filter, thisPtr) {
		// Allow calling as function(filter, thisPtr)
		if (checkpoint && Object.prototype.toString.call(checkpoint) === "[object Function]") {
			thisPtr = filter;
			filter = checkpoint;
			checkpoint = null;
		}

		// Wrap custom filter if a checkpoint is given.
		if (checkpoint) {
			var foundCheckpoint = false;
			var customFilter = filter;
			filter = function(change) {
				// Check to see if this is the checkpoint we're looking for.
				if (change.type === "Checkpoint" && change.code === checkpoint)
					foundCheckpoint = true;

				// Stop truncating when the checkpoint is found.
				if (foundCheckpoint === true)
					return false;

				// Delegate to custom filter if one is given.
				return customFilter ? customFilter.apply(this, arguments) : true;
			};
		}

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
		if (this._changes.some(function(c) { return c.type !== "Checkpoint"; })) {
			var lastIdx = this._changes.length - 1;
			var change = this._changes[lastIdx];
			while (change.type === "Checkpoint") {
				this._changes.splice(lastIdx--, 1);
				change = this._changes[lastIdx];
			}
			this._changes.splice(lastIdx, 1);
			this._raiseEvent("changeUndone", [change, lastIdx, this]);
			return change;
		}

		return null;
	}
});
exports.ChangeSet = ChangeSet; // IGNORE
