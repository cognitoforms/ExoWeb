function RequiredIfRule(mtype, options, ctype, callback, thisPtr) {
	this.prop = mtype.property(options.property, true);
	var properties = [ this.prop ];

	if (!ctype) {
		ctype = Rule.ensureError("requiredIf", this.prop);
	}

	this._comparePath = options.compareSource;
	this._compareOp = options.compareOperator;
	this._compareValue = options.compareValue;

	if (this._compareOp === undefined || this._compareOp === null) {
		if (this._compareValue !== undefined && this._compareValue !== null) {
			ExoWeb.trace.logWarning("rule",
				"Possible rule configuration error - {0}:  if a compare value is specified, " +
				"then an operator should be specified as well.  Falling back to equality check.",
				[type.get_code()]);
		}
		else {
			this._compareOp = "NotEqual";
		}
	}

	this._inited = false;

	this.err = new Condition(ctype, $format("{0} is required", [this.prop.get_label()]), properties, this);

	// Function to register this rule when its containing type is loaded.
	var register = (function RequiredIfRule$register(ctype) { CompareRule.load(this, ctype, mtype, callback, thisPtr); }).bind(this);

	// If the type is already loaded, then register immediately.
	if (LazyLoader.isLoaded(this.prop.get_containingType())) {
		register(this.prop.get_containingType().get_jstype());
	}
	// Otherwise, wait until the type is loaded.
	else {
		$extend(this.prop.get_containingType().get_fullName(), register);
	}
}

RequiredIfRule.prototype = {
	required: function RequiredIfRule$required(obj) {
		if (!this._compareProperty) {
			ExoWeb.trace.logWarning("rule",
				"Cannot determine requiredness since the property for path \"{0}\" has not been loaded.",
				[this._comparePath]);
			return;
		}

		var cmpValue = this._compareProperty.value(obj);
		if (cmpValue && cmpValue instanceof String) {
			cmpValue = $.trim(cmpValue);
		}

		return CompareRule.compare(cmpValue, this._compareOp, this._compareValue, false);
	},
	satisfies: function RequiredIfRule$satisfies(obj) {
		return !this.required(obj) || RequiredRule.hasValue(obj, this.prop);
	},
	execute: function RequiredIfRule$execute(obj) {
		if (this._inited === true) {
			obj.meta.conditionIf(this.err, !this.satisfies(obj));
		}
		else {
			ExoWeb.trace.logWarning("rule", "RequiredIf rule on type \"{0}\" has not been initialized.", [this.prop.get_containingType().get_fullName()]);
		}
	}
};

Rule.requiredIf = RequiredIfRule;
