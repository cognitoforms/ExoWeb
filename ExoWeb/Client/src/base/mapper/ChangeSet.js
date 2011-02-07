function ChangeSet(source, initialChanges) {
	if (!source || source.constructor !== String) {
		ExoWeb.trace.throwAndLog("changeLog", "Creating a change set requires a string source argument.");
	}

	this._source = source;
	this._changes = (initialChanges && initialChanges instanceof Array) ?
		[].concat(initialChanges) :
		[];
}

ChangeSet.mixin({
	add: function(change) {
		this._changes.push(change);
	},
	changes: function() {
		return this._changes;
	},
	lastChange: function() {
		return this._changes.length > 0 ? this._changes[this._changes.length - 1] : null;
	},
	serialize: function(filter, thisPtr) {
		return {
			source: this._source,
			changes: filter ? 
				this._changes.where(filter, thisPtr) :
				this._changes
		};
	},
	source: function() {
		return this._source;
	},
	truncate: function(filter, thisPtr) {
		// Discard all changes that match the given filter

		for(var i = 0; i < this._changes.length; i++) {
			if (!filter || filter.call(thisPtr || this, this._changes[i]) === true) {
				this._changes.splice(i--, 1);
			}
		}
	},
	undo: function() {
		if (this._changes.length > 0) {
			var change = this._changes[this._changes.length - 1];
			this._changes.splice(this._changes.length - 1, 1);
			return change;
		}

		return null;
	}
});
exports.ChangeSet = ChangeSet; // IGNORE
