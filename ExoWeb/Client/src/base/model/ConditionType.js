function ConditionType(code, category, message, sets) {
	// So that sub types can use it's prototype.
	if (arguments.length === 0) {
		return;
	}

	if (allConditionTypes[code]) {
		ExoWeb.trace.throwAndLog("conditions", "A condition type with the code \"{0}\" has already been created.", [code]);
	}

	this._code = code;
	this._category = category;
	this._message = message;
	this._sets = (sets === undefined || sets === null) ? [] : sets;
	this._rules = [];

	if (sets && sets.length > 0) {
		Array.forEach(sets, function(s) {
			s._types.push(this);
		}, this);
	}

	allConditionTypes[code] = this;
}

var allConditionTypes = {};

ConditionType.all = function ConditionType$all() {
	/// <summary>
	/// Returns an array of all condition types that have been created.
	/// Not that the array is created each time the function is called.
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
	get_code: function ConditionType$get_code() {
		return this._code;
	},
	get_category: function ConditionType$get_category() {
		return this._category;
	},
	get_message: function ConditionType$get_message() {
		return this._message;
	},
	get_sets: function ConditionType$get_sets() {
		return this._sets;
	},
	rules: function() {
		return Array.prototype.slice.call(this._rules);
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
	}
}

ExoWeb.Model.ConditionType = ConditionType;

(function() {
	//////////////////////////////////////////////////////////////////////////////////////
	function Error(code, message, sets) {
		ConditionType.call(this, code, "Error", message, sets);
	}

	Error.prototype = new ConditionType();

	ExoWeb.Model.ConditionType.Error = Error;

	//////////////////////////////////////////////////////////////////////////////////////
	function Warning(code, message, sets) {
		ConditionType.call(this, code, "Warning", message, sets);
	}

	Warning.prototype = new ConditionType();

	ExoWeb.Model.ConditionType.Warning = Warning;

	//////////////////////////////////////////////////////////////////////////////////////
	function Permission(code, message, sets, permissionType, isAllowed) {
		ConditionType.call(this, code, "Permission", message, sets);
		this._permissionType = permissionType;
		this._isAllowed = isAllowed;
	}

	Permission.prototype = new ConditionType();

	Permission.mixin({
		get_permissionType: function Permission$get_permissionType() {
			return this._permissionType;
		},
		get_isAllowed: function Permission$get_isAllowed() {
			return this._isAllowed;
		}
	});

	ExoWeb.Model.ConditionType.Permission = Permission;
})();
