function Format(options) {
	this._paths = options.paths;
	this._convert = options.convert;
	this._convertBack = options.convertBack;
	this._description = options.description;
	this._nullString = options.nullString || "";
	this._undefinedString = options.undefinedString || "";
}

Format.fromTemplate = (function Format$fromTemplate(convertTemplate) {
	var paths = [];
	convertTemplate.replace(/\{([a-z0-9_.]+)\}/ig, function(match, expr) {
		paths.push(expr);
		return expr;
	});

	return new Format({
		paths: paths,
		convert: function convert(obj) {
			if (obj === null || obj === undefined) {
				return "";
			}

			return $format(convertTemplate, obj);
		}
	});
}).cached();

Format.mixin({
	getPaths: function() {
		return this._paths || [];
	},
	convert: function(val) {
		if (val === undefined) {
			return this._undefinedString;
		}

		if (val === null) {
			return this._nullString;
		}

		if (val instanceof FormatError) {
			return val.get_invalidValue();
		}

		if (!this._convert) {
			return val;
		}

		return this._convert(val);
	},
	convertBack: function(val) {
		if (val === null || val == this._nullString) {
			return null;
		}

		if (val === undefined || val == this._undefinedString) {
			return;
		}

		if (val.constructor == String) {
			val = val.trim();

			if (val.length === 0) {
				return null;
			}
		}

		if (!this._convertBack) {
			return val;
		}

		try {
			return this._convertBack(val);
		}
		catch (err) {
			if (err instanceof FormatError) {
				return err;
			}
			else {
				return new FormatError(this._description ?
							"{value} must be formatted as " + this._description :
							"{value} is not properly formatted",
							val);
			}
		}
	}
});

ExoWeb.Model.Format = Format;
