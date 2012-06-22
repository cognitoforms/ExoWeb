/// <reference path="ConditionTarget.js" />

function ObjectMeta(type, obj) {
	this._obj = obj;
	this.type = type;
	this._conditions = {};
	this._pendingInit = {};
	this._pendingInvocation = [];
}

ObjectMeta.mixin({

	get_entity: function () {
		return this._obj;
	},

	// gets the property or property chain for the specified property path
	property: function ObjectMeta$property(propName, thisOnly) {
		return this.type.property(propName, thisOnly);
	},

	// gets and optionally sets the pending initialization status for a property on the current instance
	pendingInvocation: function ObjectMeta$pendingInvocation(rule, value) {
		var indexOfRule = this._pendingInvocation.indexOf(rule);
		if (arguments.length > 1) {
			if (value && indexOfRule < 0) {
				this._pendingInvocation.push(rule);
			}
			else if (!value && indexOfRule >= 0) {
				this._pendingInvocation.splice(indexOfRule, 1);
			}
		}
		return indexOfRule >= 0;
	},

	// gets and optionally sets the pending initialization status for a property on the current instance
	pendingInit: function ObjectMeta$pendingInit(prop, value) {
		var result = this._obj[prop._fieldName] === undefined || this._pendingInit[prop.get_name()] === true;
		if (arguments.length > 1) {
			if (value) {
				this._pendingInit[prop.get_name()] = true;
			}
			else {
				delete this._pendingInit[prop.get_name()];
			}
		}
		return result;
	},

	// gets the condition target with the specified condition type
	getCondition: function ObjectMeta$getCondition(conditionType) {
		return this._conditions[conditionType.code];
	},

	// stores the condition target for the current instance
	setCondition: function ObjectMeta$setCondition(conditionTarget) {
		if (conditionTarget.condition.type != formatConditionType) {
			this._conditions[conditionTarget.condition.type.code] = conditionTarget;
		}
	},

	// clears the condition for the current instance with the specified condition type
	clearCondition: function ObjectMeta$clearCondition(conditionType) {
		delete this._conditions[conditionType.code];
	},

	// determines if the set of permissions are allowed for the current instance
	isAllowed: function ObjectMeta$isAllowed(/*codes*/) {
		if (arguments.length === 0) {
			return undefined;
		}

		// ensure each condition type is allowed for the current instance
		for (var c = arguments.length - 1; c >= 0; c--) {
			var code = arguments[c];
			var conditionType = ConditionType.get(code);

			// return undefined if the condition type does not exist
			if (conditionType === undefined) {
				return undefined;
			}

			// throw an exception if the condition type is not a permission
			if (!(conditionType instanceof ConditionType.Permission)) {
				ExoWeb.trace.throwAndLog(["conditions"], "Condition type \"{0}\" should be a Permission.", [code]);
			}

			// return false if a condition of the current type exists and is a deny permission or does not exist and is a grant permission
			if (this._conditions[conditionType.code] ? !conditionType.isAllowed : conditionType.isAllowed) {
				return false;
			}
		}

		return true;
	},

	// determines whether the instance and optionally the specified property value is loaded
	isLoaded: function ObjectMeta$isLoaded(prop) {

		// first see if the current entity is loaded
		if (!LazyLoader.isLoaded(this._obj))
			return false;

		// immediately return true if a property name was not specified
		if (!prop)
			return true;

		// coerce property names into property instances
		if (isString(prop))
			prop = this.property(prop);

		// otherwise, get the property value and see if it loaded
		var val = prop.value(this._obj);

		// determine whether the value is loaded
		return !(val === undefined || !LazyLoader.isLoaded(val));
	},

	// get some or all of the condition
	conditions: function ObjectMeta$conditions(criteria) {

		// condition type filter
		if (criteria instanceof ConditionType) {
			var conditionTarget = this._conditions[criteria.code];
			return conditionTarget ? [conditionTarget.condition] : [];
		}

		// property filter
		if (criteria instanceof Property || criteria instanceof PropertyChain) {
			criteria = criteria.lastProperty();
			var result = [];
			for (var type in this._conditions) {
				var conditionTarget = this._conditions[type];
				if (conditionTarget.properties.some(function (p) { return p.equals(criteria); })) {
					result.push(conditionTarget.condition);
				}
			}
			return result;
		}

		// otherwise, just return all conditions
		var result = [];
		for (var type in this._conditions) {
			result.push(this._conditions[type].condition);
		}
		return result;
	},
	destroy: function () {
		this.type.unregister(this._obj);
	},
	// starts listening for change events on the conditions array. Use obj argument to
	// optionally filter the events to a specific condition type by passing either
	// the condition type code or type itself.
	addConditionsChanged: function ObjectMeta$addConditionsChanged(handler, criteria) {
		var filter;

		// condition type filter
		if (criteria instanceof ConditionType) {
			filter = function (sender, args) { return args.conditionTarget.condition.type === criteria; };
		}

		// property filter
		else if (criteria instanceof Property || criteria instanceof PropertyChain) {
			criteria = criteria.lastProperty();
			filter = function (sender, args) { return args.conditionTarget.properties.indexOf(criteria) >= 0; };
		}

		// subscribe to the event
		this._addEvent("conditionsChanged", handler, filter);

		// Return the object meta to support method chaining
		return this;
	},
	removeConditionsChanged: function ObjectMeta$removeConditionsChanged(handler) {
		this._removeEvent("conditionsChanged", handler);
	}
});

ObjectMeta.mixin(Functor.eventing);
exports.ObjectMeta = ObjectMeta;
