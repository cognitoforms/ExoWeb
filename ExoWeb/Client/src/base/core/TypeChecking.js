var typeExpr = /\s([a-z|A-Z]+)/;

function type(obj) {
	if (obj === undefined) {
		return "undefined";
	}
	else if (obj === null) {
		return "null";
	}
	else {
		return Object.prototype.toString.call(obj).match(typeExpr)[1].toLowerCase();
	}
}
exports.type = type;

function isNullOrUndefined(obj) {
	return obj === null || obj === undefined;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isArray(obj) {
	return type(obj) === "array";
}
exports.isArray = isArray;

function isString(obj) {
	return type(obj) === "string";
}
exports.isString = isString;

function isNumber(obj) {
	return type(obj) === "number";
}
exports.isNumber = isNumber;

var integerExpr = /^-?[0-9]{1,10}$/;

function isInteger(obj) {
	return isNumber(obj) && !isNaN(obj) && integerExpr.test(obj.toString()) && (obj >= -2147483648 && obj <= 2147483647);
}
exports.isInteger = isInteger;

function isNatural(obj) {
	return isInteger(obj) && obj > 0;
}
exports.isNatural = isNatural;

function isWhole(obj) {
	return isInteger(obj) && obj >= 0;
}
exports.isWhole = isWhole;

var decimalExpr = /^-?[0-9]+\.[0-9]+$/;

function isDecimal(obj) {
	return isNumber(obj) && !isNaN(obj) && decimalExpr.test(obj.toString());
}
exports.isDecimal = isDecimal;

function isFunction(obj) {
	return type(obj) === "function";
}
exports.isFunction = isFunction;

function isBoolean(obj) {
	return type(obj) === "boolean";
}
exports.isBoolean = isBoolean;

function isDate(obj) {
	return type(obj) === "date";
}
exports.isDate = isDate;

function isObject(obj) {
	return type(obj) === "object" || (obj && obj instanceof Object);
}
exports.isObject = isObject;
