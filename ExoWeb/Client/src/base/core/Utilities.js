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
		value = ExoWeb.getValue(source, name);

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

ExoWeb.evalPath = evalPath;

function getLastTarget(target, propertyPath) {
	var i, path = propertyPath, finalTarget = target;

	if (path.constructor == String) {
		path = path.split(".");
	}
	else if (!(path instanceof Array)) {
		ExoWeb.trace.throwAndLog(["$lastTarget", "core"], "invalid parameter propertyPath");
	}

	for (i = 0; i < path.length - 1; i++) {
		if (finalTarget) {
			finalTarget = ExoWeb.getValue(finalTarget, path[i]);
		}
	}

	return finalTarget;
}

ExoWeb.getLastTarget = getLastTarget;
window.$lastTarget = getLastTarget;

// If a getter method matching the given property name is found on the target it is invoked and returns the 
// value, unless the the value is undefined, in which case null is returned instead.  This is done so that 
// calling code can interpret a return value of undefined to mean that the property it requested does not exist.
// TODO: better name
function getValue(target, property) {
	var value;
	var getter = target["get_" + property];
	if (getter) {
		value = getter.call(target);
		if (value === undefined) {
			value = null;
		}
	}
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
			ExoWeb.trace.logWarning("", "Possible incorrect usage of \"getValue()\", the path \"{0}\" does not exist on the target and appears to represent a multi-hop path.", [property]);
		}
	}

	return value;
}

ExoWeb.getValue = getValue;

function getCtor(type) {

	// Only return a value if the argument is defined
	if (type !== undefined && type !== null) {

		// If the argument is a function then return it immediately.
		if (ExoWeb.isType(type, Function)) {
			return type;

		}
		else {
			var ctor;

			if (ExoWeb.isType(type, String)) {
				// remove "window." from the type name since it is implied
				type = type.replace(/(window\.)?(.*)/, "$2");

				// evaluate the path
				ctor = evalPath(window, type);
			}

			// warn (and implicitly return undefined) if the result is not a javascript function
			if (ctor !== undefined && ctor !== null && !ExoWeb.isType(ctor, Function)) {
				ExoWeb.trace.logWarning("", "The given type \"{0}\" is not a function.", [type]);
			}
			else {
				return ctor;
			}
		}
	}
}

ExoWeb.getCtor = getCtor;

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

ExoWeb.isType = isType;

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

ExoWeb.eachProp = eachProp;

function objectToArray(obj) {
	var list = [];
	eachProp(obj, function(prop, value) {
		list.push(value);
	});
	return list;
}

ExoWeb.objectToArray = objectToArray;

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

ExoWeb.makeHumanReadable = makeHumanReadable;
