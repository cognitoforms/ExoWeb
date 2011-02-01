function CompareRule(mtype, options, ctype) {
	this.prop = mtype.property(options.property, true);
	var properties = [ this.prop ];

	if (!ctype) {
		ctype = Rule.ensureError("compare", this.prop);
	}

	this._comparePath = options.compareSource;
	this._compareOp = options.compareOperator;

	this._inited = false;

	var message = $format("{0} must be {1}{2} {3}", [
		this.prop.get_label(),
		ExoWeb.makeHumanReadable(this._compareOp).toLowerCase(),
		(this._compareOp === "GreaterThan" || this._compareOp == "LessThan") ? "" : " to",
		ExoWeb.makeHumanReadable(this._comparePath.indexOf(".") >= 0 ? this._comparePath.replace(/^(.*\.)?([^\.]+)$/, "$2") : this._comparePath)
	]);
	this.err = new Condition(ctype, message, properties, this);

	// Function to register this rule when its containing type is loaded.
	var register = (function CompareRule$register(ctype) { CompareRule.load(this, ctype); }).setScope(this);

	// If the type is already loaded, then register immediately.
	if (LazyLoader.isLoaded(this.prop.get_containingType())) {
		CompareRule.load(this, this.prop.get_containingType().get_jstype());
	}
	// Otherwise, wait until the type is loaded.
	else {
		$extend(this.prop.get_containingType().get_fullName(), register);
	}
}

CompareRule.load = function CompareRule$load(rule, loadedType) {
	if (!loadedType.meta.baseType || LazyLoader.isLoaded(loadedType.meta.baseType)) {
		var inputs = [];

		var targetInput = new RuleInput(rule.prop);
		targetInput.set_isTarget(true);
		inputs.push(targetInput);

		Model.property(rule._comparePath, rule.prop.get_containingType(), true, function(chain) {
			rule._compareProperty = chain;

			var compareInput = new RuleInput(rule._compareProperty);
			inputs.push(compareInput);

			Rule.register(rule, inputs);

			rule._inited = true;

			if (chain.get_jstype() === Boolean && rule._compareOp == "NotEqual" && (rule._compareValue === undefined || rule._compareValue === null)) {
				rule._compareOp = "Equal";
				rule._compareValue = true;
			}
		});
	}
	else {
		$extend(loadedType.meta.baseType.get_fullName(), function(baseType) {
			CompareRule.load(rule, baseType);
		});
	}
};

CompareRule.compare = function CompareRule$compare(srcValue, cmpOp, cmpValue, defaultValue) {
	if (cmpValue === undefined || cmpValue === null) {
		switch (cmpOp) {
			case "Equal": return !RequiredRule.hasValue(srcValue);
			case "NotEqual": return RequiredRule.hasValue(srcValue);
		}
	}

	if (srcValue !== undefined && srcValue !== null && cmpValue !== undefined && cmpValue !== null) {
		switch (cmpOp) {
			case "Equal": return srcValue == cmpValue;
			case "NotEqual": return srcValue != cmpValue;
			case "GreaterThan": return srcValue > cmpValue;
			case "GreaterThanEqual": return srcValue >= cmpValue;
			case "LessThan": return srcValue < cmpValue;
			case "LessThanEqual": return srcValue <= cmpValue;
		}
		// Equality by default.
		return srcValue == cmpValue;
	}

	return defaultValue;
};

CompareRule.prototype = {
	satisfies: function Compare$satisfies(obj) {
		if (!this._compareProperty) {
			return true;
		}

		var srcValue = this.prop.value(obj);
		var cmpValue = this._compareProperty.value(obj);
		return CompareRule.compare(srcValue, this._compareOp, cmpValue, true);
	},
	execute: function CompareRule$execute(obj) {
		if (this._inited === true) {
			obj.meta.conditionIf(this.err, !this.satisfies(obj));
		}
		else {
			ExoWeb.trace.logWarning("rule", "Compare rule on type \"{0}\" has not been initialized.", [this.prop.get_containingType().get_fullName()]);
		}
	}
};

Rule.compare = CompareRule;