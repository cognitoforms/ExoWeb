function AllowedValuesRule(mtype, options, ctype, callback, thisPtr) {
	this.prop = mtype.property(options.property, true);
	var properties = [ this.prop ];

	if (!ctype) {
		ctype = Rule.ensureError("allowedValues", this.prop);
	}

	this._allowedValuesPath = options.source;
	this._inited = false;

	this.err = new Condition(ctype, $format("{0} has an invalid value", [this.prop.get_label()]), properties, this);

	var register = (function AllowedValuesRule$register(type) { AllowedValuesRule.load(this, type, mtype, callback, thisPtr); }).bind(this);

	// If the type is already loaded, then register immediately.
	if (LazyLoader.isLoaded(this.prop.get_containingType())) {
		register(this.prop.get_containingType().get_jstype());
	}
	// Otherwise, wait until the type is loaded.
	else {
		$extend(this.prop.get_containingType().get_fullName(), register);
	}
}
AllowedValuesRule.load = function AllowedValuesRule$load(rule, loadedType, mtype, callback, thisPtr) {
	if (!loadedType.meta.baseType || LazyLoader.isLoaded(loadedType.meta.baseType)) {
		var inputs = [];

		var targetInput = new RuleInput(rule.prop);
		targetInput.set_isTarget(true);
		if (rule.prop.get_origin() === "client")
			targetInput.set_dependsOnInit(true);
		inputs.push(targetInput);

		Model.property(rule._allowedValuesPath, rule.prop.get_containingType(), true, function(chain) {
			rule._allowedValuesProperty = chain;

			var allowedValuesInput = new RuleInput(rule._allowedValuesProperty);
			inputs.push(allowedValuesInput);

			Rule.register(rule, inputs, false, mtype, callback, thisPtr);

			rule._inited = true;
		});
	}
	else {
		$extend(loadedType.meta.baseType.get_fullName(), function(baseType) {
			AllowedValuesRule.load(rule, baseType);
		});
	}
};
AllowedValuesRule.prototype = {
	_enforceInited: function AllowedValues$_enforceInited() {
		if (this._inited !== true) {
			ExoWeb.trace.logWarning("rule", "AllowedValues rule on type \"{0}\" has not been initialized.", [this.prop.get_containingType().get_fullName()]);
		}
		return this._inited;
	},
	addChanged: function AllowedValues$addChanged(handler, obj) {
		this._allowedValuesProperty.addChanged(handler, obj);
	},
	execute: function AllowedValuesRule$execute(obj) {
		if (this._enforceInited() === true) {
			// get the current value of the property for the given object
			var val = this.prop.value(obj);
			var allowed = this.values(obj);
			if (allowed !== undefined && LazyLoader.isLoaded(allowed)) {
				obj.meta.conditionIf(this.err, !this.satisfies(obj, val));
			}
		}
	},
	satisfies: function AllowedValuesRule$satisfies(obj, value) {
		this._enforceInited();

		if (value === undefined || value === null) {
			return true;
		}

		// get the list of allowed values of the property for the given object
		var allowed = this.values(obj);

		if (allowed === undefined || !LazyLoader.isLoaded(allowed)) {
			return false;
		}

		// ensure that the value or list of values is in the allowed values list (single and multi-select)				
		if (value instanceof Array) {
			return value.every(function(item) { return Array.contains(allowed, item); });
		}
		else {
			return Array.contains(allowed, value);
		}
	},
	satisfiesAsync: function AllowedValuesRule$satisfiesAsync(obj, value, exitEarly, callback) {
		this._enforceInited();

		this.valuesAsync(obj, exitEarly, function(allowed) {
			if (value === undefined || value === null) {
				callback(true);
			}
			else if (allowed === undefined) {
				callback(false);
			}
			else if (value instanceof Array) {
				callback(value.every(function(item) { return Array.contains(allowed, item); }));
			}
			else {
				callback(Array.contains(allowed, value));
			}
		});

	},
	values: function AllowedValuesRule$values(obj, exitEarly) {
		if (this._enforceInited() && this._allowedValuesProperty && (this._allowedValuesProperty.get_isStatic() || this._allowedValuesProperty instanceof Property || this._allowedValuesProperty.lastTarget(obj, exitEarly))) {

			// get the allowed values from the property chain
			var values = this._allowedValuesProperty.value(obj);

			// ignore if allowed values list is undefined (non-existent or unloaded type) or has not been loaded
			return values;
		}
	},
	valuesAsync: function AllowedValuesRule$valuesAsync(obj, exitEarly, callback) {
		if (this._enforceInited()) {

			var values;

			if (this._allowedValuesProperty.get_isStatic() || this._allowedValuesProperty instanceof Property || this._allowedValuesProperty.lastTarget(obj, exitEarly)) {
				// get the allowed values from the property chain
				values = this._allowedValuesProperty.value(obj);
			}

			if (values !== undefined) {
				LazyLoader.load(values, null, function() {
					callback(values);
				});
			}
			else {
				callback(values);
			}
		}
	},
	toString: function AllowedValuesRule$toString() {
		return $format("{0}.{1} allowed values = {2}", [this.prop.get_containingType().get_fullName(), this.prop.get_name(), this._allowedValuesPath]);
	}
};

Rule.allowedValues = AllowedValuesRule;
