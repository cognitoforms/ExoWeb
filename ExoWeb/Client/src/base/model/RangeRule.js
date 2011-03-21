function RangeRule(mtype, options, ctype) {
	this.prop = mtype.property(options.property, true);
	var properties = [ this.prop ];

	if (!ctype)
		ctype = Rule.ensureError("range", this.prop);

	this.ctype = ctype;

	this.min = options.min;
	this.max = options.max;

	var hasMin = (this.min !== undefined && this.min !== null);
	var hasMax = (this.max !== undefined && this.max !== null);

	if (hasMin && hasMax) {
		this._formatString = "{0} must be between {1} and {2}";
		this._formatArgs = function() { return [this.prop.format(this.min), this.prop.format(this.max)]; };
		this._test = this._testMinMax;
	}
	else if (hasMin) {
		this._formatString = "{0} must be at least {1}";
		this._formatArgs = function() { return [this.prop.format(this.min)]; };
		this._test = this._testMin;
	}
	else if (hasMax) {
		this._formatString = "{0} must be no more than {1}";
		this._formatArgs = function() { return [this.prop.format(this.max)]; };
		this._test = this._testMax;
	}

	Rule.register(this, properties);
}

RangeRule.prototype = {
	err: function() {
		return new Condition(this.ctype, $format(this._formatString, [this.prop.get_label()].concat(this._formatArgs.call(this))), [this.prop], this);
	},
	execute: function(obj) {
		var val = this.prop.value(obj);
		obj.meta.conditionIf(this.err(), this._test(val));
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
