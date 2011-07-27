function ObjectMeta(type, obj) {
	this._obj = obj;
	this.type = type;
	this._conditions = [];
	this._executedRules = [];
	this._propertyConditions = {};
}

ObjectMeta.mixin({
	get_entity: function() {
		return this._obj;
	},
	ensureValidation: function ObjectMeta$ensureValidation(prop) {
		// TODO: if isNew can be reliably determined then it could shortcut this method.

		var rules = prop.rules(true);

		// Exclude non-validation rules, rules that have previously been executed or their
		// conditions have been attached, and allowed values rules (since if the property has
		// not been interacted with there is no value and the rule does not apply).
		rules.purge(function(rule) {
			return !Rule.isValidation(rule) || this._executedRules.contains(rule) || rule instanceof AllowedValuesRule;
		}, this);

		if (rules.length > 0) {
			this.executeRulesImpl(prop, rules);
		}
	},
	executeRules: function ObjectMeta$executeRules(prop) {
		this.executeRulesImpl(prop, prop.rules(true));
	},
	executeRulesImpl: function ObjectMeta$executeRulesImpl(prop, rules) {
		this.type.get_model()._validatedQueue.push({ sender: this, property: prop.get_name() });
		this._raisePropertyValidating(prop.get_name());
		this.type.executeRules(this._obj, rules);
	},
	markRuleExecuted: function ObjectMeta$markRuleExecuted(rule) {
		if (!this._executedRules.contains(rule)) {
			this._executedRules.push(rule);
		}
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

		if ((idx < 0 && when) || (idx >= 0 && !when)) {
			if (idx >= 0) {
				this._removeCondition(idx);
			}

			if (when) {
				this._addCondition(condition);
			}

			this._raisePropertiesValidated(condition.get_properties());
		}
	},

	_addCondition: function (condition) {
		condition.get_targets().add(this);
		this._conditions.push(condition);

		// make sure the rule that drives the condition is marked as executed
		condition._type._rules.forEach(this.markRuleExecuted.bind(this));

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

		this._raiseEvent("conditionsChanged", [this, { condition: condition, add: true, remove: false }]);
	},

	_removeCondition: function (idx) {
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

		this._raiseEvent("conditionsChanged", [this, { condition: condition, add: false, remove: true }]);
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

	conditions: function ObjectMeta$conditions(propOrOptions) {
		if (!propOrOptions) return this._conditions;

		// backwards compatible with original property-only querying
		var options = (propOrOptions instanceof Property || propOrOptions instanceof PropertyChain) ?
			{ property: propOrOptions } :
			propOrOptions;

		return filter(this._conditions, function(condition) {
			return (!options.property || condition.get_properties().some(function(p) { return p.equals(options.property); })) &&
				(!options.set || condition.get_type().get_sets().indexOf(options.set) >= 0) &&
				(!options.target || condition.get_targets().some(function(t) { return t.get_entity() === options.target; })) &&
				(!options.type || condition.get_type() === options.type);
		});
	},

	_raisePropertiesValidated: function (properties) {
		var queue = this.type.get_model()._validatedQueue;
		for (var i = 0; i < properties.length; ++i) {
			queue.push({ sender: this, property: properties[i].get_name() });
		}
	},
	addPropertyValidated: function (propName, handler) {
		this._addEvent("propertyValidated:" + propName, handler);
	},
	_raisePropertyValidating: function (propName) {
		var queue = this.type.get_model()._validatingQueue;
		queue.push({ sender: this, propName: propName });
	},
	addPropertyValidating: function (propName, handler) {
		this._addEvent("propertyValidating:" + propName, handler);
	},
	destroy: function () {
		this.type.unregister(this.obj);
	},
	// starts listening for change events on the conditions array. Use obj argument to
	// optionally filter the events to a specific condition type by passing either
	// the condition type code or type itself.
	addConditionsChanged: function ObjectMeta$addConditionsChanged(handler, obj) {
		var filter;
		if (obj) {
			//check for condition type code.
			if (obj.constructor === String)
				obj = ConditionType.get(obj);

			if (!obj)
				throw obj + " not found";

			filter = function (target, args) {
				if (args.condition._type === obj) {
					handler.apply(this, arguments);
				}
			};
		}

		this._addEvent("conditionsChanged", handler, filter); ;

		// Return the object meta to support method chaining
		return this;
	},
	removeConditionsChanged: function ObjectMeta$removeConditionsChanged(handler) {
		this._removeEvent("conditionsChanged", handler);
	}
});

ObjectMeta.mixin(ExoWeb.Functor.eventing);
ExoWeb.Model.ObjectMeta = ObjectMeta;
ObjectMeta.registerClass("ExoWeb.Model.ObjectMeta");
