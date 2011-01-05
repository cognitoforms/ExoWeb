function ConditionTypeSet(name) {
	if (allConditionTypeSets[name]) {
		ExoWeb.trace.throwAndLog("conditions", "A set with the name \"{0}\" has already been created.", [name]);
	}

	this._name = name;
	this._types = [];
	this._active = false;

	allConditionTypeSets[name] = this;
}

var allConditionTypeSets = {};

ConditionTypeSet.all = function ConditionTypeSet$all() {
	/// <summary>
	/// Returns an array of all condition type sets that have been created.
	/// Not that the array is created each time the function is called.
	/// </summary>
	/// <returns type="Array" />

	var all = [];
	for (var name in allConditionTypeSets) {
		all.push(allConditionTypeSets[name]);
	}
	return all;
};

ConditionTypeSet.get = function ConditionTypeSet$get(name) {
	/// <summary>
	/// Returns the condition type set with the given name, if it exists.
	/// </summary>
	/// <param name="name" type="String" />
	/// <returns type="ConditionTypeSet" />

	return allConditionTypeSets[name];
};

ConditionTypeSet.prototype = {
	get_name: function ConditionTypeSet$get_name() {
		return this._name;
	},
	get_types: function ConditionTypeSet$get_types() {
		return this._types;
	},
	get_active: function ConditionTypeSet$get_active() {
		return this._active;
	},
	set_active: function ConditionTypeSet$set_active(value) {
		if (value === true && !this._active) {
			this._raiseEvent("activated");
		}
		else if (value === false && this._active === true) {
			this._raiseEvent("deactivated");
		}

		this._active = value;
	},
	addActivated: function ConditionTypeSet$addActivated(handler) {
		this._addEvent("activated", handler);
	},
	removeActivated: function ConditionTypeSet$removeActivated(handler) {
		this._removeEvent("activated", handler);
	},
	addDeactivated: function ConditionTypeSet$addDeactivated(handler) {
		this._addEvent("deactivated", handler);
	},
	removeDeactivated: function ConditionTypeSet$removeDeactivated(handler) {
		this._removeEvent("deactivated", handler);
	}
};

ConditionTypeSet.mixin(ExoWeb.Functor.eventing);

ExoWeb.Model.ConditionTypeSet = ConditionTypeSet;
ConditionTypeSet.registerClass("ExoWeb.Model.ConditionTypeSet");
