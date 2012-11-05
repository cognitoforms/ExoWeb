/// <reference path="Errors.js" />

// determine whether Object.defineProperty is supported and add legacy support is necessary/possible
var definePropertySupported = false;
var defineProperty;

function defineLegacyProperty() {
	Object.defineProperty = function (obj, prop, desc) {

		// assume getter will only need to calculate once following the constructor
		if ("get" in desc) {
			if (!desc.init) throw new Error("Getters are not supported by the current browser.  Use definePropertySupported to check for full support.");

			// assume objects with prototypes are instances and go ahead and initialize the property using the getter
			if (obj.prototype) {
				obj[prop] = desc.get.call(obj, obj);
			}

			// otherwise, configure the prototype to initialize the property when the constructor is called
			else if (obj.constructor) {
				var initProperties = obj.constructor.__initProperties;
				if (!initProperties) {
					obj.constructor.__initProperties = initProperties = {};
				}
				initProperties[prop] = desc.get;
			}
		}

		// assume it is just a data property
		else {
			obj[prop] = desc.value;
		}

		// throw an exception if the property has a setter, which is definitely not supported
		if ("set" in desc) throw new Error("Setters are not supported by the current browser.  Use definePropertySupported to check for full support.");
	}
}

try {
	// emulate ES5 getter/setter API using legacy APIs
	if (Object.prototype.__defineGetter__ && !Object.defineProperty) {
		Object.defineProperty = function (obj, prop, desc) {

			// property with getter
			if ("get" in desc) obj.__defineGetter__(prop, desc.get);

			// property with setter
			if ("set" in desc) obj.__defineSetter__(prop, desc.set);

			// data only property
			if (!("get" in desc || "set" in desc)) {

				// read/write property
				if (desc.writable) {
					var value = desc.value;
					obj.__defineGetter__(prop, function () { return value; });
					obj.__defineSetter__(prop, function (val) { value = val; });
				}

				// read only property
				else {
					var value = desc.value;
					obj.__defineGetter__(prop, function () { return value; });
				}
			}
		}
		definePropertySupported = true;
	}

	// otherwise, ensure defineProperty actually works
	else if (Object.defineProperty && Object.defineProperty({}, "x", { get: function () { return true } }).x) {
		definePropertySupported = true;
	}

	// enable legacy support
	else {
		defineLegacyProperty();
	}
} 

// no getter/setter support
catch (e) {

	// enable legacy support
	defineLegacyProperty();
};

// classes that call define property should
function initializeLegacyProperties(obj) {
	if (definePropertySupported) return;
	var initProperties = obj.constructor.__initProperties;
	if (initProperties) {
		for (var p in initProperties) {
			obj[p] = initProperties[p].call(obj, obj);
		}
	}
}

// evalPath internal utility function
function evalPath(obj, path, nullValue, undefinedValue) {
	var i, name, steps = path.split("."), source, value = obj;

	if (value === null) {
		return arguments.length >= 3 ? nullValue : null;
	}
	if (value === undefined) {
		return arguments.length >= 4 ? undefinedValue : undefined;
	}

	for (i = 0; i < steps.length; ++i) {
		name = steps[i];
		source = value;
		value = getValue(source, name);

		if (value === null) {
			return arguments.length >= 3 ? nullValue : null;
		}
		if (value === undefined) {
			return arguments.length >= 4 ? undefinedValue : undefined;
		}
	}

	if (value === null) {
		return arguments.length >= 3 ? nullValue : null;
	}
	if (value === undefined) {
		return arguments.length >= 4 ? undefinedValue : undefined;
	}

	return value;
}

exports.evalPath = evalPath;

function getLastTarget(target, propertyPath) {
	var i, pathArray, finalTarget = target;

	if (propertyPath == null) throw new ArgumentNullError("propertyPath");

	if (propertyPath.constructor == String) {
		pathArray = propertyPath.split(".");
	}
	else {
		if (!(propertyPath instanceof Array)) throw ArgumentTypeError("propertyPath", "string|array", propertyPath);
		pathArray = propertyPath;
	}

	for (i = 0; i < pathArray.length - 1; i++) {
		if (finalTarget) {
			finalTarget = getValue(finalTarget, pathArray[i]);
		}
	}

	return finalTarget;
}

exports.getLastTarget = getLastTarget;
window.$lastTarget = getLastTarget;

// If a getter method matching the given property name is found on the target it is invoked and returns the 
// value, unless the the value is undefined, in which case null is returned instead.  This is done so that 
// calling code can interpret a return value of undefined to mean that the property it requested does not exist.
// TODO: better name
function getValue(target, property) {
	var value;

	// the see if there is an explicit getter function for the property
	var getter = target["get_" + property];
	if (getter) {
		value = getter.call(target);
		if (value === undefined) {
			value = null;
		}
	}

	// otherwise search for the property
	else {
		if ((isObject(target) && property in target) ||
			Object.prototype.hasOwnProperty.call(target, property) ||
			(target.constructor === String && /^[0-9]+$/.test(property) && parseInt(property, 10) < target.length)) {
			value = target[property];
			if (value === undefined) {
				value = null;
			}
		}
		else if (/\./.test(property)) {
			logWarning("Possible incorrect usage of \"getValue()\", the path \"" + property + "\" does not exist on the target and appears to represent a multi-hop path.");
		}
	}

	return value;
}

exports.getValue = getValue;

function getCtor(type) {

	// Only return a value if the argument is defined
	if (type !== undefined && type !== null) {

		// If the argument is a function then return it immediately.
		if (isType(type, Function)) {
			return type;

		}
		else {
			var ctor;

			if (isType(type, String)) {
				// remove "window." from the type name since it is implied
				type = type.replace(/(window\.)?(.*)/, "$2");

				// evaluate the path
				ctor = evalPath(window, type);
			}

			// warn (and implicitly return undefined) if the result is not a javascript function
			if (ctor !== undefined && ctor !== null && !isType(ctor, Function)) {
				logWarning("The given type \"" + type + "\" is not a function.");
			}
			else {
				return ctor;
			}
		}
	}
}

exports.getCtor = getCtor;

function isType(val, type) {

	// Exit early for checking function type
	if (val !== undefined && val !== null && val === Function && type !== undefined && type !== null && type === Function) {
		return true;
	}

	var ctor = getCtor(type);

	// ensure a defined value and constructor
	return val !== undefined && val !== null &&
			ctor !== undefined && ctor !== null &&
			// accomodate objects (instanceof) as well as intrinsic value types (String, Number, etc)
			(val instanceof ctor || val.constructor === ctor);
}

exports.isType = isType;

function eachProp(obj, callback, thisPtr) {
	var prop;
	for (prop in obj) {
		if (obj.hasOwnProperty(prop)) {
			if (callback.apply(thisPtr || this, [prop, obj[prop]]) === false) {
				break;
			}
		}
	}
}

exports.eachProp = eachProp;

function objectToArray(obj) {
	var list = [];
	eachProp(obj, function(prop, value) {
		list.push(value);
	});
	return list;
}

exports.objectToArray = objectToArray;

function $format(str, values) {
	var source = null, arrayMode = false;

	if (!values) return str;

	if (arguments.length > 2) {
		// use arguments passed to function as array
		source = Array.prototype.slice.call(arguments, 1);
	}
	else {
		source = !(values instanceof Array) ? [values] : values
	}

	return str.replace(/\{([0-9]+)\}/ig, function $format$token(match, indexStr) {
		var index = parseInt(indexStr, 10);
		var result = source[index];

		if (result !== null && result !== undefined && result.constructor !== String) {
			result = result.toString();
		}

		return result;
	});
}

window.$format = $format;

function makeHumanReadable(text) {
	return text.replace(/([^A-Z]+)([A-Z])/g, "$1 $2");
}

exports.makeHumanReadable = makeHumanReadable;
