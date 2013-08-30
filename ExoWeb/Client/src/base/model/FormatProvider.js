var formatProvider = function formatProvider(type, format) {
	throw new Error("Format provider has not been implemented.  Call ExoWeb.Model.setFormatProvider(fn);");
};

function getFormat(type, format) {

	// return null if a format specifier was not provided
	if (!format || format === '')
		return null;

	// initialize format cache
	if (!type._formats)
		type._formats = {};

	// first see if the requested format is cached
	var f = type._formats[format];
	if (f)
		return f;

	// then see if it is an entity type
	if (type.meta && type.meta instanceof Type)
		type._formats[format] = f = Format.fromTemplate(type, format);

	// otherwise, call the format provider to create a new format
	else
		type._formats[format] = f = formatProvider(type, format);

	return f;
}

function setFormatProvider(fn) {
	formatProvider = fn;
}

ExoWeb.Model.getFormat = getFormat;

exports.getFormat = getFormat; // IGNORE
exports.setFormatProvider = setFormatProvider; // IGNORE
