function evalPath(obj, path, nullValue, undefinedValue) {
	var steps = path.split(".");

	if (obj === null) {
		return arguments.length >= 3 ? nullValue : null;
	}
	if (obj === undefined) {
		return arguments.length >= 4 ? undefinedValue : undefined;
	}

	for (var i = 0; i < steps.length; ++i) {
		var name = steps[i];
		obj = ExoWeb.getValue(obj, name);

		if (obj === null) {
			return arguments.length >= 3 ? nullValue : null;
		}
		if (obj === undefined) {
			return arguments.length >= 4 ? undefinedValue : undefined;
		}
	}

	if (obj === null) {
		return arguments.length >= 3 ? nullValue : null;
	}
	if (obj === undefined) {
		return arguments.length >= 4 ? undefinedValue : undefined;
	}

	return obj;
}

ExoWeb.evalPath = evalPath;

function getLastTarget(target, propertyPath) {
	var path = propertyPath;
	var finalTarget = target;

	if (path.constructor == String) {
		path = path.split(".");
	}
	else if (!(path instanceof Array)) {
		ExoWeb.trace.throwAndLog(["$lastTarget", "core"], "invalid parameter propertyPath");
	}

	for (var i = 0; i < path.length - 1; i++) {
		if (finalTarget) {
			finalTarget = getValue(finalTarget, path[i]);
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
	var getter = target["get_" + property];
	if (getter) {
		var value = getter.call(target);
		return value === undefined ? null : value;
	}
	else {
		if (property in target) {
			var value = target[property];
			return value === undefined ? null : value;
		}
		else if (/\./.test(property)) {
			ExoWeb.trace.logWarning("", "Possible incorrect usage of \"getValue()\", the path \"{0}\" does not exist on the target and appears to represent a multi-hop path.", [property]);
		}
	}
}

ExoWeb.getValue = getValue;

var ctorProviders = ExoWeb._ctorProviders = {};

function addCtorProvider(type, provider) {
	var key;

	// given type is a string, then use it as the dictionary key
	if (isType(type, String)) {
		key = type;
	}
	// given type is a function, then parse the name
	else if (isType(type, Function)) {
		key = parseFunctionName(type);
	}
	else {
		// TODO
	}

	if (!isType(provider, Function)) {
		// TODO
	}

	if (key !== undefined && key !== null) {
		ctorProviders[key] = provider;
	}
}

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
			else {
				// Look for a registered provider for the argument's type.
				// TODO:  account for inheritance when determining provider?
				var providerKey = parseFunctionName(type.constructor);
				var provider = ctorProviders[providerKey];

				if (provider !== undefined && provider !== null) {
					// invoke the provider to obtain the constructor
					ctor = provider(type);
				}
			}

			// warn (and implicitly return undefined) if the result is not a javascript function
			if (ctor !== undefined && ctor !== null && !isType(ctor, Function)) {
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

function objectToArray(obj) {
	var list = [];
	for (var key in obj) {
		if (obj.hasOwnProperty(key)) {
			list.push(obj[key]);
		}
	}
	return list;
}

ExoWeb.objectToArray = objectToArray;

function $format(str, values) {
	if (!values) {
		return str;
	}

	return str.replace(/{([a-z0-9_.]+)}/ig, function $format$token(match, expr) {
		return evalPath(values, expr, "", match).toString();
	});
}

window.$format = $format;

function makeHumanReadable(text) {
	return text.replace(/([^A-Z]+)([A-Z])/g, "$1 $2");
}

ExoWeb.makeHumanReadable = makeHumanReadable;
