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
			}
		}

		// Start a new change set
		this.start("client");
	}
});
exports.ChangeLog = ChangeLog; // IGNORE
