function ListLengthRule(mtype, options, ctype, callback, thisPtr) {
	this.prop = mtype.property(options.property, true);
	var properties = [this.prop];

	if (!ctype) {
		ctype = Rule.ensureError($format("listLength {0} {1}", [options.compareOperator, options.staticLength > 0 ? options.staticLength : options.compareSource]), this.prop);
	}

	this.ctype = ctype;

	this._comparePath = options.compareSource;
	this._compareOp = options.compareOperator;
	this._staticLength = options.staticLength

	this._inited = false;

	// Function to register this rule when its containing type is loaded.
	var register = (function ListLengthRule$register(ctype) {
		ListLengthRule.load(this, ctype, mtype, callback, thisPtr);
	}).bind(this);

	// If the type is already loaded, then register immediately.
	if (LazyLoader.isLoaded(this.prop.get_containingType())) {
		ListLengthRule.load(this, this.prop.get_containingType().get_jstype(), mtype, callback, thisPtr);
	}
	// Otherwise, wait until the type is loaded.
	else {
		$extend(this.prop.get_containingType().get_fullName(), register);
	}
}

ListLengthRule.load = function ListLengthRule$load(rule, loadedType, mtype, callback, thisPtr) {
	if (!loadedType.meta.baseType || LazyLoader.isLoaded(loadedType.meta.baseType)) {
		var inputs = [];

		var targetInput = new RuleInput(rule.prop);
		targetInput.set_isTarget(true);
		if (rule.prop.get_origin() === "client")
			targetInput.set_dependsOnInit(true);
		inputs.push(targetInput);

		//no need to register the rule with the comparePath if you are using a static length
		if (rule._comparePath != "") {
			Model.property(rule._comparePath, rule.prop.get_containingType(), true, function (chain) {
				rule._compareProperty = chain;

				var compareInput = new RuleInput(rule._compareProperty);
				inputs.push(compareInput);

				rule._inited = true;

				if (chain.get_jstype() === Boolean && rule._compareOp == "NotEqual" && (rule._compareValue === undefined || rule._compareValue === null)) {
					rule._compareOp = "Equal";
					rule._compareValue = true;
				}

				Rule.register(rule, inputs, false, mtype, callback, thisPtr);
			});
		}
		else {
			//register the rule without reference to compareSource
			rule._inited = true;
			Rule.register(rule, inputs, false, mtype, callback, thisPtr);
		}
	}
	else {
		$extend(loadedType.meta.baseType.get_fullName(), function (baseType) {
			ListLengthRule.load(rule, baseType, mtype, callback, thisPtr);
		});
	}
};

ListLengthRule.prototype = {
	satisfies: function Compare$satisfies(obj) {
		if (!this._compareProperty && this._staticLength < 0) {
			return true;
		}

		var srcValue = this.prop.value(obj);
		var cmpValue = this._staticLength >= 0 ? this._staticLength : this._compareProperty.value(obj);

		//if the src value is not a list we are not comparing a valid object
		if (!isArray(srcValue))
			return true;

		//if the value we are comparing against is not numeric, this is not a valid comparison
		if (!isWhole(parseInt(cmpValue)))
			return true;

		return CompareRule.compare(srcValue.length, this._compareOp, parseInt(cmpValue), true);
	},
	execute: function ListLengthRule$execute(obj) {
		if (this._inited === true) {

			var isValid = this.satisfies(obj);

			var message = isValid ? '' : $format("{0} length must be {1}{2} {3}", [
					this.prop.get_label(),
					ExoWeb.makeHumanReadable(this._compareOp).toLowerCase(),
					(this._compareOp === "GreaterThan" || this._compareOp == "LessThan") ? "" : " to",
					this._staticLength >= 0 ? this._staticLength : this._compareProperty.get_label()
				]);
			this.err = new Condition(this.ctype, message, [this.prop], this);

			obj.meta.conditionIf(this.err, !isValid);
		}
		else {
			ExoWeb.trace.logWarning("rule", "List Length rule on type \"{0}\" has not been initialized.", [this.prop.get_containingType().get_fullName()]);
		}
	}
};

Rule.listLength = ListLengthRule;