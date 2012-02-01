function StringFormatRule(mtype, options, ctype, callback, thisPtr) {
	this.prop = mtype.property(options.property, true);
	var properties = [ this.prop ];

	if (!ctype) {
		ctype = Rule.ensureError("stringFormat", this.prop);
	}
	 
	this.ctype = ctype; 
	 
	this.description = options.description; 
	this.expression = new RegExp(options.expression);
	this.reformat = options.reformat;

	this.err = new Condition(ctype, $format("{0} must be formatted as {1}.", [this.prop.get_label(), this.description]), properties, this);
	 
	Rule.register(this, properties, false, mtype, callback, thisPtr);
}

StringFormatRule.prototype = {
	execute: function (obj) {
		var val = this.prop.value(obj);
		var isValid = true;
		if (val && val != "") {
			this.expression.lastIndex = 0;
			isValid = this.expression.test(val);
			if (isValid && this.reformat) {
				this.expression.lastIndex = 0;
				this.prop.value(obj, val.replace(this.expression, this.reformat));
			}
		}
		obj.meta.conditionIf(this.err, !isValid);
	},
	toString: function () {
		return $format("{0}.{1} formatted as {2}",
			[this.prop.get_containingType().get_fullName(),
			this.prop.get_name(),
			this.description]);
	}
};

Rule.stringFormat = StringFormatRule;
