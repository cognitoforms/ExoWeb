function ObjectMeta(type, obj) {
	this._obj = obj;
	this.type = type;
	this._conditions = [];
	this._propertyConditions = {};
}

ObjectMeta.prototype = {
	executeRules: function ObjectMeta$executeRules(prop) {
		this.type.get_model()._validatedQueue.push({ sender: this, property: prop.get_name() });
		this._raisePropertyValidating(prop.get_name());

		this.type.executeRules(this._obj, prop);
	},
	property: function ObjectMeta$property(propName, thisOnly) {
		return this.type.property(propName, thisOnly);
	},
	clearConditions: function ObjectMeta$clearConditions(origin) {
		var conditions = this._conditions;

		for (var i = conditions.length - 1; i >= 0; --i) {
			var condition = conditions[i];

			if (!origin || condition.get_origin() == origin) {
				this._removeCondition(i);
				this._raisePropertiesValidated(condition.get_properties());
			}
		}
	},

	conditionIf: function ObjectMeta$conditionIf(condition, when) {
		// always remove and re-add the condition to preserve order
		var idx = -1;
		for (var i = 0; i < this._conditions.length; i++) {
			if (this._conditions[i].get_type() === condition.get_type()) {
				idx = i;
				break;
			}
		}

		if (idx >= 0) {
			this._removeCondition(idx);
		}

		if (when) {
			this._addCondition(condition);
		}

		if ((idx < 0 && when) || (idx >= 0 && !when)) {
			this._raisePropertiesValidated(condition.get_properties());
		}
	},

	_addCondition: function(condition) {
		condition.get_targets().add(this);
		this._conditions.push(condition);

		// update _propertyConditions
		var props = condition.get_properties();
		for (var i = 0; i < props.length; ++i) {
			var propName = props[i].get_name();
			var pi = this._propertyConditions[propName];

			if (!pi) {
				pi = [];
				this._propertyConditions[propName] = pi;
			}

			pi.push(condition);
		}
	},

	_removeCondition: function(idx) {
		var condition = this._conditions[idx];
		condition.get_targets().remove(this);
		this._conditions.splice(idx, 1);

		// update _propertyConditions
		var props = condition.get_properties();
		for (var i = 0; i < props.length; ++i) {
			var propName = props[i].get_name();
			var pi = this._propertyConditions[propName];

			var piIdx = $.inArray(condition, pi);
			pi.splice(piIdx, 1);
		}
	},

	_isAllowedOne: function ObjectMeta$_isAllowedOne(code) {
		var conditionType = ConditionType.get(code);

		if (conditionType !== undefined) {
			if (!(conditionType instanceof ConditionType.Permission)) {
				ExoWeb.trace.throwAndLog(["conditions"], "Condition type \"{0}\" should be a Permission.", [code]);
			}

			for (var i = 0; i < this._conditions.length; i++) {
				var condition = this._conditions[i];
				if (condition.get_type() == conditionType) {
					return conditionType.get_isAllowed();
				}
			}

			return !conditionType.get_isAllowed();
		}

		return undefined;
	},

	isAllowed: function ObjectMeta$isAllowed(/*codes*/) {
		if (arguments.length === 0) {
			return undefined;
		}

		for (var i = 0; i < arguments.length; i++) {
			var allowed = this._isAllowedOne(arguments[i]);
			if (!allowed) {
				return allowed;
			}
		}

		return true;
	},

	conditions: function ObjectMeta$conditions(prop) {
		if (!prop) {
			return this._conditions;
		}

		var ret = [];

		for (var i = 0; i < this._conditions.length; ++i) {
			var condition = this._conditions[i];
			var props = condition.get_properties();

			for (var p = 0; p < props.length; ++p) {
				if (props[p].equals(prop)) {
					ret.push(condition);
					break;
				}
			}
		}

		return ret;
	},

	_raisePropertiesValidated: function(properties) {
		var queue = this.type.get_model()._validatedQueue;
		for (var i = 0; i < properties.length; ++i) {
			queue.push({ sender: this, property: properties[i].get_name() });
		}
	},
	addPropertyValidated: function(propName, handler) {
		this._addEvent("propertyValidated:" + propName, handler);
	},
	_raisePropertyValidating: function(propName) {
		var queue = this.type.get_model()._validatingQueue;
		queue.push({ sender: this, propName: propName });
	},
	addPropertyValidating: function(propName, handler) {
		this._addEvent("propertyValidating:" + propName, handler);
	},
	destroy: function() {
		this.type.unregister(this.obj);
	}
};

ObjectMeta.mixin(ExoWeb.Functor.eventing);
ExoWeb.Model.ObjectMeta = ObjectMeta;
ObjectMeta.registerClass("ExoWeb.Model.ObjectMeta");
