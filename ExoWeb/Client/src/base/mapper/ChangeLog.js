/// <reference path="../core/Errors.js" />
/// <reference path="../core/Functor.js" />
/// <reference path="ChangeSet.js" />

/*globals Functor, ChangeSet */

function ChangeLog(defaultUser) {
	this._defaultUser = defaultUser;
	this.activeSet = null;
	this.sets = [];
	this.onChangeAdded = new Functor();
	this.onChangeSetStarted = new Functor();
	this.onChangeUndone = new Functor();
	this.onTruncated = new Functor();
}

ChangeLog.mixin({
	add: function (change) {
		// Adds a new change to the log.

		if (this.activeSet === null) {
			throw new Error("The change log is not currently active.");
		}

		var idx = this.activeSet.add(change);

		this.onChangeAdded(change, idx, this.activeSet, this);

		return idx;
	},
	addSet: function (source, title, user, changes, code) {
		var changeSet = new ChangeSet(source, title, user, changes, code);
		this.sets.push(changeSet);
		return changeSet;
	},
	batchChanges: function (title, user, action, removeIfEmpty) {
		/// <summary>
		/// Ensures that the set of changes that result from invoking
		/// `action` are placed in a dedicated change set with the given
		/// `title` (or description) and `user` and no other changes.
		/// </summary>

		if (!title || title.constructor !== String || title.length === 0) {
			throw new Error("The first argument to batchChanges must be a non-empty string which specifies a title for the changes.");
		}
		if (user !== null && user !== undefined && (user.constructor !== String || user.length === 0)) {
			throw new Error("The second argument to batchChanges must be a non-empty string which specifies the user who is initiating the changes.");
		}
		if (!action || !(action instanceof Function)) {
			throw new Error("The third argument to batchChanges must be a function which performs the changes.");
		}

		var newBatchSetIndex,
			newBatchSet,
			changeSetStartedHandler,
			previousActiveSet = this.activeSet;

		// Start a new set for the batch if there isn't a current active set. If there is a current active set it can be
		// re-used if it has no pre-existing changes and has the same source, title, and user.
		if (!previousActiveSet || (previousActiveSet.changes.length > 0 || previousActiveSet.source !== "client" || previousActiveSet.title !== title || previousActiveSet.user !== user)) {
			newBatchSet = new ChangeSet("client", title, user || this._defaultUser);
			this.sets.push(newBatchSet);
			this.activeSet = newBatchSet;
		}

		// Raise an error if a change set is started while the batch is being performed.
		changeSetStartedHandler = function () {
			throw new Error("Nested change batches are not currently supported.");
		};

		// Attach the event
		this.onChangeSetStarted.add(changeSetStartedHandler);

		try {
			// Invoke the action callback.
			action();
		} finally {
			// Remove the event
			if (!this.onChangeSetStarted.remove(changeSetStartedHandler)) {
				throw new Error("Could not unsubscribe from change set started event.");
			}

			if (newBatchSet) {
				newBatchSetIndex = this.sets.indexOf(newBatchSet);

				// Remove the new batch set if the caller specified that it should be removed if empty and there were no changes.
				if (removeIfEmpty && newBatchSet === this.activeSet && newBatchSet !== previousActiveSet && newBatchSet.changes.length === 0) {
					this.sets.splice(newBatchSetIndex, 1);
					this.activeSet = previousActiveSet;
					return null;
				}

				this.onChangeSetStarted(newBatchSet, previousActiveSet, newBatchSetIndex, this);
			}

			// If there was previously an active set, start a new
			// set in order to collect changes that follow separately.
			if (previousActiveSet) {
				// Use the previous title and user for the new set.
				this.start({ title: previousActiveSet.title, user: previousActiveSet.user });
			} else if (this.activeSet.changes.length > 0) {
				// If there wasn't an active set before, then start a new set
				// without a title only if there are changes in the active
				// set. This is a last-resort to ensure that following changes
				// are not included with the changes that were just batched.
				this.start("unknown");
			}
		}

		return newBatchSet;
	},
	checkpoint: function (title, code) {
		if (!this.activeSet) {
			return null;
		}

		return this.activeSet.checkpoint(title, code);
	},
	compress: function () {
		if (arguments.length > 0) {
			throw new ArgumentsLengthError(0, arguments.length);
		}
		for (var i = this.sets.length - 1; i >= 0; i--) {
			var set = this.sets[i];
			if (set.changes.length === 0) {
				if (set === this.activeSet) {
					this.activeSet = null;
				}
				this.sets.splice(i, 1);
			}
		}
	},
	count: function (filter, thisPtr) {
		var result = 0;
		forEach(this.sets, function (set) {
			result += set.count(filter, thisPtr);
		}, this);
		return result;
	},
	lastChange: function () {
		for (var i = this.sets.length - 1; i >= 0; i--) {
			var set = this.sets[i];
			var change = set.lastChange();
			if (change !== null && change !== undefined) {
				return change;
			}
		}

		return null;
	},
	serialize: function (forServer, filter, thisPtr) {
		// Serializes the log and it's sets, including
		// those changes that pass the given filter.

		if (arguments.length === 0) {
			forServer = true;
		} else if (forServer instanceof Function) {
			thisPtr = filter;
			filter = forServer;
			forServer = true;
		}

		return this.sets.map(function (set) {
			return set.serialize(forServer, filter, thisPtr);
		});
	},
	start: function (titleOrOptions, continueLast) {
		// Starts a new change set, which means that new changes will
		// be added to the new set from this point forward.
		var title, user, code;

		if (titleOrOptions == null) throw new ArgumentNullError("titleOrOptions");
		if (titleOrOptions.constructor !== String && !(titleOrOptions instanceof Object)) throw new ArgumentTypeError("titleOrOptions", "string|object", titleOrOptions);

		if (continueLast != null && continueLast.constructor !== Boolean) throw new ArgumentTypeError("continueLast", "boolean", continueLast);

		if (titleOrOptions.constructor === String) {
			title = titleOrOptions;
			user = null;
			code = null;
		} else {
			title = titleOrOptions.title || null;
			user = titleOrOptions.user || null;
			code = titleOrOptions.code || null;
		}

		var previousActiveSet = this.activeSet;

		if (continueLast) {
			var candidateSet = previousActiveSet;
			if (!candidateSet && this.sets.length > 0) {
				candidateSet = this.sets[this.sets.length - 1];
			}
			if (candidateSet && candidateSet.source === "client" && candidateSet.user === user && candidateSet.title === title) {
				if (previousActiveSet) {
					return null;
				} else {
					this.activeSet = candidateSet;
					this.onChangeSetStarted(candidateSet, previousActiveSet, this.sets.length - 1, this);
					return candidateSet;
				}
			}
		}

		var set = new ChangeSet("client", title, user || this._defaultUser, null, code);
		var idx = this.sets.push(set) - 1;
		this.activeSet = set;
		this.onChangeSetStarted(set, previousActiveSet, idx, this);
		return set;
	},
	stop: function () {
		if (!this.activeSet) {
			throw new Error("The change log is not currently active.");
		}

		this.activeSet = null;
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

		for (var i = 0; i < this.sets.length; i++) {
			if (checkpoint) {
				foundCheckpoint = this.sets[i].changes.some(function (c) {
					return c.type === "Checkpoint" && c.code === checkpoint;
				});
			}

			numRemoved += this.sets[i].truncate(checkpoint, filter, thisPtr);

			// If all changes have been removed (or all but the given checkpoint) then discard the set
			if (this.sets[i].changes.length === 0) {
				var currentSet = this.sets[i];
				this.sets.splice(i--, 1);
				if (currentSet === this.activeSet) {
					this.activeSet = null;
				}
			}

			if (foundCheckpoint)
				break;
		}

		this.onTruncated(numRemoved, this);
		return numRemoved;
	},
	undo: function () {
		if (!this.activeSet) {
			throw new Error("The change log is not currently active.");
		}

		var currentSet = this.activeSet,
			currentSetIndex = this.sets.indexOf(currentSet);

		while (currentSet.changes.length === 0) {
			// remove the set from the log
			this.sets.splice(currentSetIndex, 1);

			if (--currentSetIndex < 0) {
				return null;
			}

			currentSet = this.sets[currentSetIndex];
			this.activeSet = currentSet;
		}

		var idx = currentSet.changes.length - 1;
		var change = currentSet.undo();

		this.onChangeUndone(change, idx, currentSet, this);

		return change;
	}
});

exports.ChangeLog = ChangeLog; // IGNORE
