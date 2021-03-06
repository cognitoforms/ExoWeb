setFormatProvider(function FormatProvider(type, format) {

	// Date
	if (type === Date) {
		// Add support for g and G that are not natively supported by the MSAJAX framework
		if (format === "g")
			format = Date._expandFormat(Sys.CultureInfo.CurrentCulture.dateTimeFormat, "d") + " " + Date._expandFormat(Sys.CultureInfo.CurrentCulture.dateTimeFormat, "t");
		else if (format === "G")
			format = Date._expandFormat(Sys.CultureInfo.CurrentCulture.dateTimeFormat, "d") + " " + Date._expandFormat(Sys.CultureInfo.CurrentCulture.dateTimeFormat, "T");

		return new Format({
			description: "",
			specifier: format,
			convert: function (val) {
				return val.localeFormat(format);
			},
			convertBack: function (str) {
				var date;
				// Time value, set default date to 1/1/1970 to easily compare time values
				if (format === "t") {
					var timeFormat = Date._expandFormat(Sys.CultureInfo.CurrentCulture.dateTimeFormat, "d") + " " + Date._expandFormat(Sys.CultureInfo.CurrentCulture.dateTimeFormat, "t");
					var startDate = new Date(1970, 0, 1).localeFormat("d");
					date = Date.parseLocale(startDate + " " + str, timeFormat);
				}
				else
					date = Date.parseLocale(str, format);

				if (date === null)
					throw new Error("Invalid date format");
				return date;
			}
		});
	}

	// Number
	if (type === Number) {
		var isCurrencyFormat = format.match(/[$c]+/i);
		var isPercentageFormat = format.match(/[%p]+/i);
		var isIntegerFormat = format.match(/[dnfg]0/i);
		var currencyDecimalDigits = Sys.CultureInfo.CurrentCulture.numberFormat.CurrencyDecimalDigits;

		return new Format({
			description: isCurrencyFormat ? Resource["format-currency"] : isPercentageFormat ? Resource["format-percentage"] : isIntegerFormat ? Resource["format-integer"] : Resource["format-decimal"],
			specifier: format,
			convert: function (val) {
				// Default to browser formatting for general format
				if (format.toLowerCase() === "g")
					return val.toString();

				// Otherwise, use the localized format
				return val.localeFormat(format);
			},
			convertBack: function (str) {
				// Handle use of () to denote negative numbers
				var sign = 1;
				if (str.match(/^\(.*\)$/)) {
					str = str.substring(1, str.length - 1);
					sign = -1;
				}
				var result;

				// Remove currency symbols before parsing
				if (isCurrencyFormat) {
					result = Number.parseLocale(str.replace(Sys.CultureInfo.CurrentCulture.numberFormat.CurrencySymbol, "")) * sign;

					// if there is a decimal place, check the precision isnt greater than allowed for currency. 
					// Floating points in js can be skewed under certain circumstances, we are just checking the decimals instead of multiplying results.
					var resultStr = result.toString();
					if (resultStr.indexOf('.') > -1 && (resultStr.length - (resultStr.indexOf('.') + 1)) > currencyDecimalDigits) {
						result = NaN;
					}
				}
					// Remove percentage symbols before parsing and divide by 100
				else if (isPercentageFormat)
					result = Number.parseLocale(str.replace(Sys.CultureInfo.CurrentCulture.numberFormat.PercentSymbol, "")) / 100 * sign;

					// Ensure integers are actual whole numbers
				else if (isIntegerFormat && !isInteger(Number.parseLocale(str)))
					result = NaN;

					// Just parse a simple number
				else
					result = Number.parseLocale(str) * sign;

				if (isNaN(result))
					throw new Error("Invalid format");

				return result;
			}
		});
	}

	// Boolean
	if (type === Boolean) {
		// Format strings used for true, false, and null (or undefined) values
		var trueFormat, falseFormat, nullFormat;

		if (format && format.toLowerCase() === "g") {
			trueFormat = "True";
			falseFormat = "False";
			nullFormat = ""
		}
		else {
			var formats = format.split(';');
			trueFormat = formats.length > 0 ? formats[0] : "";
			falseFormat = formats.length > 1 ? formats[1] : "";
			nullFormat = formats.length > 2 ? formats[2] : "";
		}

		return new Format({
			description: "",
			specifier: format,
			convert: function (val) {
				if (val === true)
					return trueFormat;
				else if (val === false)
					return falseFormat;
				else
					return nullFormat;
			},
			convertBack: function (str) {
				if (str.toLowerCase() === trueFormat.toLowerCase())
					return true;
				else if (str.toLowerCase() === falseFormat.toLowerCase())
					return false;
				else
					return null;
			}
		});
	}

	// Default
	return new Format({
		description: "",
		specifier: "",
		convert: function (val) {
			return val.toString();
		},
		convertBack: function (str) {
			return str;
		}
	});

});