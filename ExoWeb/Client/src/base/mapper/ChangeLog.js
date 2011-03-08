function ChangeLog() {
	this._activeSet = null;
	this._sets = [];
}

ChangeLog.mixin({
	activeSet: function() {
		// Returns the active change set.

		return this._activeSet;
	},
	add: function(change) {
		// Adds a new change to the log.

		if (this._activeSet === null) {
			ExoWeb.trace.throwAndLog("server", "The change log is not currently active.");
		}

		this._activeSet.add(change);
	},
	addSet: function(source, changes) {
		this._sets.push(new ChangeSet(source, changes));
	},
	lastChange: function() {
		for (var i = this._sets.length - 1; i >= 0; i--) {
			var set = this._sets[i];
			var change = set.lastChange();
			if (change !== null && change !== undefined) {
				return change;
			}
		}

		return null;
	},
	serialize: function(filter, thisPtr) {
		// Serializes the log and it's sets, including
		// those changes that pass the given filter.

		return this._sets.map(function(set) {
			return set.serialize(filter, thisPtr);
		});
	},
	sets: function() {
		// Returns the current list of sets.

		return this._sets;
	},
	start: function(source) {
		// Starts a new change set, which means that new changes will
		// be added to the new set from this point forward.

		if (!source || source.constructor !== String) {
			ExoWeb.trace.throwAndLog("changeLog", "ChangeLog.start requires a string source argument.");
		}

		var set = new ChangeSet(source);
		this._sets.push(set);
		this._activeSet = set;
		return set;
	},
	truncate: function(filter, thisPtr) {
		// Removes all change sets where all changes match the given
		// filter.  If a set contains one or more changes that do NOT
		// match, the set is left intact with those changes.

		for (var i = 0; i < this._sets.length; i++) {
			this._sets[i].truncate(filter, thisPtr);

			// If all changes have been removed then discard the set
			if (this._sets[i].changes().length === 0) {
				this._sets.splice(i--, 1);
				if (this._sets[i] === this._activeSet) {
					this._activeSet = null;
				}
			}
		}

		// Start a new change set
		this.start("client");
	},
	undo: function() {
		if (!this._activeSet) {
			ExoWeb.trace.throwAndLog("server", "The change log is not currently active.");
		}
		
		var currentSet = this._activeSet,
			currentSetIndex = this._sets.indexOf(currentSet);

		while(currentSet.changes().length === 0) {
			// remove the set from the log
			this._sets.splice(currentSetIndex, 1);

			if (--currentSetIndex < 0) {
				return null;
			}

			currentSet = this._sets[currentSetIndex];
			this._activeSet = currentSet;
		}

		return currentSet.undo();
	}
});
exports.ChangeLog = ChangeLog; // IGNORE
