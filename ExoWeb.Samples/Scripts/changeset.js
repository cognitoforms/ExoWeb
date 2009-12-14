function ChangeSet() {
}
ChangeSet.prototype = {
	_add: function(change) {
		if (!this._changes || !(this._changes instanceof Array))
			this._changes = [];

		this._changes.push(change);
	},
	_isNew: function(id) {
		return /\+c[0-9]+/.test(id);
	},
	_instanceJson: function(type, id) {
		return {
			id: id,
			isNew: this._isNew(id),
			type: type
		};
	},
	build: function() {
		if (!this._changes || !(this._changes instanceof Array))
			this._changes = [];
		return this._changes;
	},
	commit: function commit(change) {
		var item = {
			__type: "Commit:#ExoGraph",
			idChanges: null
		};

		item.idChanges = Array.clone(change);
		
		this._add(item);

		return this;
	},
	init: function CreateInstance(type, id) {
		this._add({
			__type: "InitNew:#ExoGraph",
			instance: this._instanceJson(type, id)
		});

		return this;
	},
	ref: function AddReferenceChange(type, id, propName, refType, originalRefId, currentRefId) {
		this._add({
			__type: "ReferenceChange:#ExoGraph",
			instance: this._instanceJson(type, id),
			property: propName,
			oldValue: originalRefId ? this._instanceJson(refType, originalRefId) : null,
			currentValue: currentRefId ? this._instanceJson(refType, currentRefId) : null
		});

		return this;
	},
	val: function AddValueChange(type, id, propName, originalVal, currentVal) {
		this._add({
			__type: "ValueChange:#ExoGraph",
			instance: this._instanceJson(type, id),
			property: propName,
			currentValue: currentVal,
			oldValue: originalVal
		});

		return this;
	},
	addRef: function(type, id, propName, propType, itemId) {
		this._add({
			__type: "ListChange:#ExoGraph",
			Instance: this._instanceJson(type, id),
			Added: [this._instanceJson(propType, itemId)],
			Property: propName,
			Removed: []
		});

		return this;
	},
	delRef: function(type, id, propName, propType, itemId) {
		this._add({
			__type: "ListChange:#ExoGraph",
			Instance: this._instanceJson(type, id),
			Added: [],
			Property: propName,
			Removed: [this._instanceJson(propType, itemId)]
		});

		return this;
	}
}
