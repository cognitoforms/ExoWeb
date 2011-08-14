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

var ctorProviders = ExoWeb._ctorProviders = {};

function addCtorProvider(type, provider) {
	var key;

	// given type is a string, then use it as the dictionary key
	if (ExoWeb.isType(type, String)) {
		key = type;
	}
	// given type is a function, then parse the name
	else if (ExoWeb.isType(type, Function)) {
		key = parseFunctionName(type);
	}
	/* TODO
	else {
	}*/

	/* TODO
	if (!ExoWeb.isType(provider, Function)) {
	}*/

	if (key !== undefined && key !== null) {
		ctorProviders[key] = provider;
	}
}

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
	for (var prop in obj)
		if (obj.hasOwnProperty(prop))
			if (callback.apply(thisPtr || this, [prop, obj[prop]]) === false)
				break;
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
	if (!values) return str;

	var source = null,
		arrayMode = false;

	if (arguments.length > 2) {
		// use arguments passed to function as array
		source = Array.prototype.slice.call(arguments, 1);
		arrayMode = true;
	}
	else {
		source = values;
		if (values && values instanceof Array) {
			// if the values are already an array there is no need to transform
			// them into an array later on, in fact this would be unexpected behavior
			arrayMode = true;
		}
	}

	return str.replace(/\{([a-z0-9_.]+)\}/ig, function $format$token(match, expr) {
		// Attempt to determine that single arg was passed, but
		// "arguments mode" was intended based on the format string.
		if (arrayMode === false && expr === "0") {
			var allOneIndex = true;
			str.replace(/\{([a-z0-9_.]+)\}/ig, function $format$token(match, expr) {
				if (expr !== "0") {
					allOneIndex = false;
				}
			});
			if (allOneIndex === true) {
				source = [values];
				arrayMode = true;
			}
		}

		return evalPath(source, expr, "", match).toString();
	});
}

window.$format = $format;

function makeHumanReadable(text) {
	return text.replace(/([^A-Z]+)([A-Z])/g, "$1 $2");
}

ExoWeb.makeHumanReadable = makeHumanReadable;
