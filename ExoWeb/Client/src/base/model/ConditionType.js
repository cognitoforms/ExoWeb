function ConditionType(code, category, message, sets, origin) {
	// So that sub types can use it's prototype.
	if (arguments.length === 0) {
		return;
	}

	if (allConditionTypes[code]) {
		throw new Error("A condition type with the code \"" + code + "\" has already been created.");
	}

	Object.defineProperty(this, "code", { value: code });
	Object.defineProperty(this, "category", { value: category });
	Object.defineProperty(this, "message", { value: message });
	Object.defineProperty(this, "sets", { value: sets || [] });
	Object.defineProperty(this, "rules", { value: [] });
	Object.defineProperty(this, "conditions", { value: [] });
	Object.defineProperty(this, "origin", { value: origin });

	if (sets && sets.length > 0) {
		Array.forEach(sets, function(s) {
			s.types.push(this);
		}, this);
	}

	allConditionTypes[code] = this;
}

var allConditionTypes = ConditionType.allConditionTypes = {};

ConditionType.all = function ConditionType$all() {
	/// <summary>
	/// Returns an array of all condition types that have been created.
	/// Note that the array is created each time the function is called.
	/// </summary>
	/// <returns type="Array" />

	var all = [];
	for (var name in allConditionTypes) {
		all.push(allConditionTypes[name]);
	}
	return all;
}

ConditionType.get = function ConditionType$get(code) {
	/// <summary>
	/// Returns the condition type with the given code, if it exists.
	/// </summary>
	/// <param name="code" type="String" />
	/// <returns type="ConditionTypeSet" />

	return allConditionTypes[code];
};

ConditionType.prototype = {

	// adds or removes a condition from the model for the specified target if necessary
	when: function ConditionType$when(condition, target, properties, message) {

		// get the current condition if it exists
		var conditionTarget = target.meta.getCondition(this);

		// add the condition on the target if it does not exist yet
		if (condition) {

			// if the message is a function, invoke to get the actual message
			message = message instanceof Function ? message(target) : message;

			// create a new condition if one does not exist
			if (!conditionTarget) {
				return new Condition(this, message, target, properties, "client");
			}

			// replace the condition if the message has changed
			else if (message && message != conditionTarget.condition.message) {

				// destroy the existing condition
				conditionTarget.condition.destroy();

				// create a new condition with the updated message
				return new Condition(this, message, target, properties, "client");
			}

			// otherwise, just return the existing condition
			else {
				return conditionTarget.condition;
			}
		}

		// Destroy the condition if it exists on the target and is no longer valid
		if (conditionTarget != null)
			conditionTarget.condition.destroy();

		// Return null to indicate that no condition was created
		return null;
	},
	extend: function ConditionType$extend(data) {
		for (var prop in data) {
			if (prop !== "type" && prop !== "rule" && !this["get_" + prop]) {
				var fieldName = "_" + prop;
				this[fieldName] = data[prop];
				this["get" + fieldName] = function ConditionType$getter() {
					return this[fieldName];
				}
			}
		}
	},
	
	addConditionsChanged: function ConditionType$addConditionsChanged(handler) {

		// subscribe to the event
		this._addEvent("conditionsChanged", handler);

		// Return the condition type to support method chaining
		return this;
	},

	removeConditionsChanged: function ConditionType$removeConditionsChanged(handler) {
		this._removeEvent("conditionsChanged", handler);
	}
}

ConditionType.mixin(Functor.eventing);

ExoWeb.Model.ConditionType = ConditionType;

(function() {
	//////////////////////////////////////////////////////////////////////////////////////
	function Error(code, message, sets, origin) {
		ConditionType.call(this, code, "Error", message, sets, origin);
	}

	Error.prototype = new ConditionType();

	ExoWeb.Model.ConditionType.Error = Error;

	//////////////////////////////////////////////////////////////////////////////////////
	function Warning(code, message, sets, origin) {
		ConditionType.call(this, code, "Warning", message, sets, origin);
	}

	Warning.prototype = new ConditionType();

	ExoWeb.Model.ConditionType.Warning = Warning;

	//////////////////////////////////////////////////////////////////////////////////////
	function Permission(code, message, sets, permissionType, isAllowed, origin) {
		ConditionType.call(this, code, "Permission", message, sets, origin);
		Object.defineProperty(this, "permissionType", { value: permissionType });
		Object.defineProperty(this, "isAllowed", { value: isAllowed });
	}

	Permission.prototype = new ConditionType();

	ExoWeb.Model.ConditionType.Permission = Permission;
})();
