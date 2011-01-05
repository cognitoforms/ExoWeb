function RequiredRule(mtype, options, ctype) {
	this.prop = mtype.property(options.property, true);

	if (!ctype) {
		ctype = Rule.ensureError("required", this.prop);
	}

	this.err = new Condition(ctype, this.prop.get_label() + " is required", [ this.prop ], this);

	Rule.register(this, [ this.prop ]);
}

RequiredRule.hasValue = function RequiredRule$hasValue(obj, prop) {
	var val = arguments.length === 1 ? obj : prop.value(obj);

	if (val instanceof Array) {
		return val.length > 0;
	}
	else if (val === undefined || val === null) {
		return false;
	}
	else if (val.constructor === String) {
		return $.trim(val) !== "";
	}
	else {
		return true;
	}
};

RequiredRule.prototype = {
	execute: function(obj) {
		obj.meta.conditionIf(this.err, !RequiredRule.hasValue(obj, this.prop));
	},
	toString: function() {
		return $format("{0}.{1} is required", [this.prop.get_containingType().get_fullName(), this.prop.get_name()]);
	}
};

Rule.required = RequiredRule;
