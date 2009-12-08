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
			Id: id,
			IsNew: this._isNew(id),
			Type: type
		};
	},
	build: function() {
		if (!this._changes || !(this._changes instanceof Array))
			this._changes = [];
		return this._changes;
	},
	commit: function commit(idMap) {
		var item = {
			__type: "Commit:#ExoGraph",
			IdMap: null
		};

		item.IdMap = Array.clone(idMap);
		
		this._add(item);

		return this;
	},
	init: function CreateInstance(type, id) {
		this._add({
			__type: "Init:#ExoGraph",
			Instance: this._instanceJson(type, id)
		});

		return this;
	},
	ref: function AddReferenceChange(type, id, propName, refType, originalRefId, currentRefId) {
		this._add({
			__type: "ReferenceChange:#ExoGraph",
			Instance: this._instanceJson(type, id),
			Property: propName,
			OriginalValue: originalRefId ? this._instanceJson(refType, originalRefId) : null,
			CurrentValue: currentRefId ? this._instanceJson(refType, currentRefId) : null
		});

		return this;
	},
	val: function AddValueChange(type, id, propName, originalVal, currentVal) {
		this._add({
			__type: "ValueChange:#ExoGraph",
			Instance: this._instanceJson(type, id),
			Property: propName,
			CurrentValue: currentVal,
			OriginalValue: originalVal
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
