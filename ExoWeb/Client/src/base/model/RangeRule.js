function RangeRule(mtype, options, ctype) {
	this.prop = mtype.property(options.property, true);
	var properties = [ this.prop ];

	if (!ctype) {
		ctype = Rule.ensureError("range", this.prop);
	}

	this.min = options.min;
	this.max = options.max;

	var hasMin = (this.min !== undefined && this.min !== null);
	var hasMax = (this.max !== undefined && this.max !== null);

	if (hasMin && hasMax) {
		this.err = new Condition(ctype, $format("{0} must be between {1} and {2}", [this.prop.get_label(), this.min, this.max]), properties, this);
		this._test = this._testMinMax;
	}
	else if (hasMin) {
		this.err = new Condition(ctype, $format("{0} must be at least {1}", [this.prop.get_label(), this.min]), properties, this);
		this._test = this._testMin;
	}
	else if (hasMax) {
		this.err = new Condition(ctype, $format("{0} must no more than {1}", [this.prop.get_label()], this.max), properties, this);
		this._test = this._testMax;
	}

	Rule.register(this, properties);
}
RangeRule.prototype = {
	execute: function(obj) {
		var val = this.prop.value(obj);
		obj.meta.conditionIf(this.err, this._test(val));
	},
	_testMinMax: function(val) {
		return val < this.min || val > this.max;
	},
	_testMin: function(val) {
		return val < this.min;
	},
	_testMax: function(val) {
		return val > this.max;
	},
	toString: function() {
		return $format("{0}.{1} in range, min: {2}, max: {3}",
			[this.prop.get_containingType().get_fullName(),
			this.prop.get_name(),
			this.min === undefined ? "" : this.min,
			this.max === undefined ? "" : this.max]);
	}
};

Rule.range = RangeRule;