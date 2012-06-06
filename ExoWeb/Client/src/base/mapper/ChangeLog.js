function ChangeLog() {
	this._activeSet = null;
	this._sets = [];
}

ChangeLog.mixin(Functor.eventing);

ChangeLog.mixin({
	activeSet: function () {
		// Returns the active change set.

		return this._activeSet;
	},
	add: function (change) {
		// Adds a new change to the log.

		if (this._activeSet === null) {
			throw new Error("The change log is not currently active.");
		}

		var idx = this._activeSet.add(change);

		this._raiseEvent("changeAdded", [change, idx, this._activeSet, this]);

		return idx;
	},
	addChangeAdded: function (fn, filter, once) {
		this._addEvent("changeAdded", fn, filter, once);
	},
	addChangeSetStarted: function (fn, filter, once) {
		this._addEvent("changeSetStarted", fn, filter, once);
	},
	addChangeUndone: function (fn, filter, once) {
		this._addEvent("changeUndone", fn, filter, once);
	},
	addSet: function (source, changes) {
		this._sets.push(new ChangeSet(source, changes));
	},
	addTruncated: function (fn, filter, once) {
		this._addEvent("truncated", fn, filter, once);
	},
	checkpoint: function (title, code) {
		if (this._activeSet && this._sets.some(function (s) { return s.changes().length > 0; })) {
			return this._activeSet.checkpoint(title, code);
		}
	},
	count: function (filter, thisPtr) {
		var result = 0;
		forEach(this._sets, function (set) {
			result += set.count(filter, thisPtr);
		}, this);
		return result;
	},
	lastChange: function () {
		for (var i = this._sets.length - 1; i >= 0; i--) {
			var set = this._sets[i];
			var change = set.lastChange();
			if (change !== null && change !== undefined) {
				return change;
			}
		}

		return null;
	},
	serialize: function (filter, thisPtr) {
		// Serializes the log and it's sets, including
		// those changes that pass the given filter.

		return this._sets.map(function (set) {
			return set.serialize(filter, thisPtr);
		});
	},
	set: function (index) {
		if (index === null || index === undefined || Object.prototype.toString.call(index) !== "[object Number]") {
			throw Error("The set method expects a numeric index argument.");
		}

		var idx = index < 0 ? (this._sets.length + index) : index;
		return this._sets[idx];
	},
	sets: function () {
		// Returns the current list of sets.

		return this._sets;
	},
	start: function (source) {
		// Starts a new change set, which means that new changes will
		// be added to the new set from this point forward.

		if (!source || source.constructor !== String) {
			throw ExoWeb.trace.logError("changeLog", "ChangeLog.start requires a string source argument.");
		}

		var set = new ChangeSet(source);
		var idx = this._sets.push(set) - 1;
		this._activeSet = set;

		this._raiseEvent("changeSetStarted", [set, idx, this]);

		return set;
	},
	truncate: function (checkpoint, filter, thisPtr) {
		// Removes all change sets where all changes match the given
		// filter.  If a set contains one or more changes that do NOT
		// match, the set is left intact with those changes.

		// Allow calling as function(filter, thisPtr)
		if (checkpoint && Object.prototype.toString.call(checkpoint) === "[object Function]") {
			thisPtr = filter;
			filter = checkpoint;
			checkpoint = null;
		}

		var numRemoved = 0;
		var foundCheckpoint = false;

		for (var i = 0; i < this._sets.length; i++) {
			if (checkpoint) {
				foundCheckpoint = this._sets[i].changes().some(function (c) {
					return c.type === "Checkpoint" && c.code === checkpoint;
				});
			}

			numRemoved += this._sets[i].truncate(checkpoint, filter, thisPtr);

			// If all changes have been removed (or all but the given checkpoint) then discard the set
			if (this._sets[i].changes().length === 0) {
				this._sets.splice(i--, 1);
				if (this._sets[i] === this._activeSet) {
					this._activeSet = null;
				}
			}

			if (foundCheckpoint)
				break;
		}

		// Start a new change set
		this.start("client");

		this._raiseEvent("truncated", [numRemoved, this]);
		return numRemoved;
	},
	undo: function () {
		if (!this._activeSet) {
			ExoWeb.trace.throwAndLog("server", "The change log is not currently active.");
		}

		var currentSet = this._activeSet,
			currentSetIndex = this._sets.indexOf(currentSet);

		while (currentSet.changes().length === 0) {
			// remove the set from the log
			this._sets.splice(currentSetIndex, 1);

			if (--currentSetIndex < 0) {
				return null;
			}

			currentSet = this._sets[currentSetIndex];
			this._activeSet = currentSet;
		}

		var idx = currentSet.changes().length - 1;
		var change = currentSet.undo();

		this._raiseEvent("changeUndone", [change, idx, currentSet, this]);

		return change;
	}
});
exports.ChangeLog = ChangeLog; // IGNORE
