function Format(options) {
	if (!options.hasOwnProperty("specifier") || !isString(options.specifier)) {
		throw new Error("Format specifier string must be provided.");
	}
	this._specifier = options.specifier;
	this._paths = options.paths;
	this._convert = options.convert;
	this._convertBack = options.convertBack;
	this._parse = options.parse;
	this._compile = options.compile;
	this._description = options.description;
	this._nullString = options.nullString || "";
	this._undefinedString = options.undefinedString || "";
	this._getFormattedValue = function (obj) {
		var result = "";
		for (var index = 0; index < this._tokens.length; index++) {
			var token = this._tokens[index];
			if (token.prefix)
				result = result + token.prefix;
			if (token.path) {
				var value = evalPath(obj, token.path);
				if (value === undefined || value === null)
					value = "";
				else if (token.format) {
					if (token.format.constructor === String) {
						token.format = getFormat(value.constructor, token.format);
					}

					if (value instanceof Array)
						value = value.map(function (v) { return token.format.convert(v); }).join(", ");
					else
						value = token.format.convert(value);

					if (this._formatEval)
						value = this._formatEval(value);
				}
				result = result + value;
			}
		}

		return result;
	};

	// function to perform additional post formatting
	this._formatEval = options.formatEval;
}

Format.fromTemplate = function Format$fromTemplate(type, template, formatEval) {

	return new Format({
		specifier: template,

		parse: createTemplateParser(template),

		compile: createTemplateCompiler(type),

		convert: function convert(obj) {
			if (obj === null || obj === undefined) {
				return "";
			}

			// Ensure the format has been compiled
			this._compile();

			var result = "";
			if (obj instanceof Array)
				for (var i = 0; i < obj.length; i++) {
					var value = this._getFormattedValue(obj[i]);

					if (result !== "" && value !== "")
						result = result + ", " + value;
					else
						result = result + value;
				}
			else
				result = this._getFormattedValue(obj);

			return result;
		},

		formatEval: formatEval
	});
};

Format.mixin({
	getTokens: function () {
		if (this._parse)
			this._parse();
		return this._tokens || [];
	},
	getPaths: function (callback, thisPtr) {
		if (this._compile) {
			if (callback && callback instanceof Function) {
				this._compile.call(this, function () {
					var paths = this._paths || [];
					callback.call(thisPtr || this, paths);
				}, this);
			} else {
				this._compile();
				return this._paths || [];
			}
		} else {
			return this._paths || [];
		}
	},
	convert: function (val) {
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
	convertBack: function (val) {
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
                    Resource.get("format-with-description").replace('{description}', this._description) :
					Resource.get("format-without-description"),
							val);
			}
		}
	},
	toString: function() {
		return this._specifier;
	}	
});

Format.hasTokens = function hasTokens(template) {
	formatTemplateParser.lastIndex = 0;
	return formatTemplateParser.test(template);
}

ExoWeb.Model.Format = Format;
