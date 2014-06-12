function Format(options) {
	if (!options.hasOwnProperty("specifier") || !isString(options.specifier)) {
		throw new Error("Format specifier string must be provided.");
	}
	this._specifier = options.specifier;
	this._paths = options.paths;
	this._convert = options.convert;
	this._convertBack = options.convertBack;
	this._compile = options.compile;
	this._description = options.description;
	this._nullString = options.nullString || "";
	this._undefinedString = options.undefinedString || "";

	// function to perform additional post formatting
	this._formatEval = options.formatEval;
}

var formatTemplateParser = /\[([a-z_][a-z0-9_.]*)(\:(.+?))?\]/ig;
var metaPathParser = /^(.*\.|)meta(\..*|)$/;

Format.fromTemplate = function Format$fromTemplate(type, template, formatEval) {

	return new Format({
		specifier: template,

		compile: function compile() {

			if (!this._tokens) {
				this._paths = [];
				this._tokens = [];

				// Replace escaped \, [ or ] characters with placeholders
				template = template.replace(/\\\\/g, '\u0000').replace(/\\\[/g, '\u0001').replace(/\\\]/g, '\u0002');
				var index = 0;
				formatTemplateParser.lastIndex = 0;
				var match = formatTemplateParser.exec(template);

				// Process each token match
				while (match) {
					var path = match[1];
					var propertyPath = path;

					// See if the path represents a property path in the model
					var defaultFormat = null;
					try {
						// Detect property path followed by ".meta..."
						propertyPath = propertyPath.replace(metaPathParser, "$1");
						var isMetaPath = propertyPath.length > 0 && propertyPath.length < path.length;
						var allowFormat = !isMetaPath;
						if (isMetaPath) {
							propertyPath = propertyPath.substring(0, propertyPath.length - 1);
						}

						// If a property path remains, then attempt to find a default format and paths for the format
						if (propertyPath) {
							var property = Model.property(propertyPath, type);
							if (property) {
								// Only allow formats for a property path that is not followed by ".meta..."
								if (allowFormat) {
									// Determine the default property format
									defaultFormat = property.get_format();
		
									// If the path references one or more entity properties, include paths for the property format. Otherwise, just add the path.
									var lastIndex = formatTemplateParser.lastIndex;
									if (defaultFormat && defaultFormat.constructor === Format && defaultFormat !== this && defaultFormat.getPaths().length > 0)
										this._paths.addRange(defaultFormat.getPaths().map(function(p) { return propertyPath + "." + p; }));
									else
										this._paths.push(propertyPath);
									formatTemplateParser.lastIndex = lastIndex;
								}
								// Formats are not allowed, so just add the path
								else {
									this._paths.push(propertyPath);
								}
							}
						}
					}
					catch (e) { }

					// Create a token for the current match, including the prefix, path and format
					this._tokens.push({
						prefix: template.substring(index, formatTemplateParser.lastIndex - match[0].length).replace(/\u0000/g, '\\').replace(/\u0001/g, '[').replace(/\u0002/g, ']'),
						path: path,
						format: match[3] ? match[3].replace(/\u0000/g, '\\').replace(/\u0001/g, '[').replace(/\u0002/g, ']') : defaultFormat
					});

					// Track the last index and find the next match
					index = formatTemplateParser.lastIndex;
					match = formatTemplateParser.exec(template);
				}

				// Capture any trailing literal text as a token without a path
				if (index < template.length) {
					this._tokens.push({
						prefix: template.substring(index).replace(/\u0000/g, '\\').replace(/\u0001/g, '[').replace(/\u0002/g, ']')
					});
				}
			}
		},

		convert: function convert(obj) {
			if (obj === null || obj === undefined) {
				return "";
			}

			// Ensure the format has been compiled
			this._compile();

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
						value = token.format.convert(value);
						if (this._formatEval)
							value = this._formatEval(value);
					}
					result = result + value;
				}
			}
			return result;
		},

		formatEval: formatEval
	});
};

Format.mixin({
	getPaths: function () {
		if (this._compile)
			this._compile();
		return this._paths || [];
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

ExoWeb.Model.Format = Format;
