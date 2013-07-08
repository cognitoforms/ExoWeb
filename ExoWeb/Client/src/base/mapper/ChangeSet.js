/// <reference path="../core/Errors.js" />
/// <reference path="../core/Functor.js" />
/// <reference path="../core/Random.js" />

/*globals exports, Functor, ArgumentError, ArgumentNullError, ArgumentTypeError, randomText */

function ChangeSet(source, title, user, initialChanges, code) {
	"use strict";

	if (source === null || source === undefined) {
		throw new ArgumentNullError("source");
	}
	if (source.constructor !== String) {
		throw new ArgumentTypeError("source", "string", source);
	}
	if (source !== "init" && source !== "server" && source !== "client") {
		throw new ArgumentError("source", source + " must be in the set ['init', 'server', 'client']");
	}
	if (user !== null && user !== undefined && user.constructor !== String) {
		throw new ArgumentTypeError("user", "string", user);
	}

	this.code = code || randomText(8);
	this.source = source;
	this.title = title || null;
	this.user = user || null;
	this.changes = (initialChanges && initialChanges instanceof Array) ? [].concat(initialChanges) : [];
	this.onChangeAdded = new Functor();
	this.onChangeUndone = new Functor();
	this.onTruncated = new Functor();
}

ChangeSet.mixin({
	add: function (change) {
		var idx = this.changes.push(change) - 1;
		this.onChangeAdded(change, idx, this);
		return idx;
	},
	checkpoint: function (title, code) {
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
			return this.changes.length;
		}

		return this.changes.filter(filter, thisPtr).length;
	},
	lastChange: function () {
		return this.changes.length > 0 ? this.changes[this.changes.length - 1] : null;
	},
	serialize: function (forServer, filter, thisPtr) {
		if (arguments.length === 0) {
			forServer = true;
		} else if (forServer instanceof Function) {
			thisPtr = filter;
			filter = forServer;
			forServer = true;
		}

		var result = {
			source: this.source,
			changes: filter ? this.changes.filter(filter, thisPtr) : Array.prototype.slice.call(this.changes)
		};

		if (!forServer) {
			result.title = this.title;
			result.code = this.code;
			if (this.user) {
				result.user = this.user;
			}
		}

		return result;
	},
	truncate: function (checkpoint, filter, thisPtr) {
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
				if (change.type === "Checkpoint" && change.code === checkpoint) {
					foundCheckpoint = true;
				}

				// Stop truncating when the checkpoint is found.
				if (foundCheckpoint === true) {
					return false;
				}

				// Delegate to custom filter if one is given.
				return customFilter ? customFilter.apply(this, arguments) : true;
			};
		}

		// Discard all changes that match the given filter
		var numRemoved;
		if (filter) {
			var removedAt = this.changes.purge(filter, thisPtr);
			numRemoved = removedAt ? removedAt.length : 0;
		} else {
			numRemoved = this.changes.length;
			this.changes.clear();
		}

		this.onTruncated(numRemoved, this);
		return numRemoved;
	},
	undo: function() {
		if (this.changes.length > 0) {
			var lastIdx = this.changes.length - 1;
			var change = this.changes[lastIdx];
			this.changes.splice(lastIdx, 1);
			this.onChangeUndone(change, lastIdx, this);
			return change;
		}

		return null;
	}
});

exports.ChangeSet = ChangeSet; // IGNORE
