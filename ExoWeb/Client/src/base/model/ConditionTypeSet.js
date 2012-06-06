function ConditionTypeSet(name) {
	if (allConditionTypeSets[name]) {
		ExoWeb.trace.throwAndLog("conditions", "A set with the name \"{0}\" has already been created.", [name]);
	}

	Object.defineProperty(this, "name", { value: name });
	Object.defineProperty(this, "types", { value: [] });
	Object.defineProperty(this, "active", { value: false, writable: true });


	allConditionTypeSets[name] = this;
}

var allConditionTypeSets = {};

ConditionTypeSet.all = function ConditionTypeSet$all() {
	/// <summary>
	/// Returns an array of all condition type sets that have been created.
	/// Note that the array is created each time the function is called.
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
	activate: function ConditionTypeSet$activate(value) {
		if (!this.active) {
			this.active = true;
			this._raiseEvent("activated");
		}
	},
	deactivate: function ConditionTypeSet$deactivate() {
		if (this.active) {
			this.active = false;
			this._raiseEvent("deactivated");
		}
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
