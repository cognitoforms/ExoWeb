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
	ref: function AddReferenceChange(type, id, propName, refType, oldRefId, newRefId) {
		this._add({
			__type: "ReferenceChange:#ExoGraph",
			instance: this._instanceJson(type, id),
			property: propName,
			oldValue: oldRefId ? this._instanceJson(refType, oldRefId) : null,
			newValue: newRefId ? this._instanceJson(refType, newRefId) : null
		});

		return this;
	},
	val: function AddValueChange(type, id, propName, oldValue, newValue) {
		this._add({
			__type: "ValueChange:#ExoGraph",
			instance: this._instanceJson(type, id),
			property: propName,
			newValue: newValue,
			oldValue: oldValue
		});

		return this;
	},
	addRef: function(type, id, propName, propType, itemId) {
		this._add({
			__type: "ListChange:#ExoGraph",
			instance: this._instanceJson(type, id),
			added: [this._instanceJson(propType, itemId)],
			property: propName,
			removed: []
		});

		return this;
	},
	delRef: function(type, id, propName, propType, itemId) {
		this._add({
			__type: "ListChange:#ExoGraph",
			instance: this._instanceJson(type, id),
			added: [],
			property: propName,
			removed: [this._instanceJson(propType, itemId)]
		});

		return this;
	}
}
