// original code grabbed from http://oranlooney.com/functional-javascript/
Object.copy = function Object$Copy(obj, options/*, level*/) {
	if (!options) {
		options = {};
	}

	// initialize max level to default value
	if (!options.maxLevel) {
		options.maxLevel = 25;
	}

	// initialize level to default value
	var level = arguments.length > 2 ? arguments[2] : 0;

	if (level >= options.maxLevel || typeof obj !== 'object' || obj === null || obj === undefined) {
		return obj;  // non-object have value sematics, so obj is already a copy.
	}
	else {
		if (obj instanceof Array) {
			var result = [];
			for (var i = 0; i < obj.length; i++) {
				result.push(Object.copy(obj[i]));
			}
			return result;
		}
		else {
			var value = obj.valueOf();
			if (obj != value) {
				// the object is a standard object wrapper for a native type, say String.
				// we can make a copy by instantiating a new object around the value.
				return new obj.constructor(value);
			} else {
				// don't clone entities
				if (typeof(Entity) !== "undefined" && obj instanceof Entity) {
					return obj;
				}
				else {
					// ok, we have a normal object. copy the whole thing, property-by-property.
					var c = {};
					for (var property in obj) {
						// Optionally copy property values as well
						if (options.copyChildren) {
							c[property] = Object.copy(obj[property], options, level + 1);
						}
						else {
							c[property] = obj[property];
						}

					}
					return c;
				}
			}
		}
	}
};

// Based on https://vanillajstoolkit.com/polyfills/objectassign/
function assign(target, varArgs) {
	if (target == null) { // TypeError if undefined or null
		throw new TypeError('Cannot convert undefined or null to object');
	}

	var to = Object(target);

	for (var index = 1; index < arguments.length; index++) {
		var nextSource = arguments[index];

		if (nextSource != null) { // Skip over if undefined or null
			for (var nextKey in nextSource) {
				// Avoid bugs when hasOwnProperty is shadowed
				if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
					to[nextKey] = nextSource[nextKey];
				}
			}
		}
	}
	return to;
}

// Based on https://vanillajstoolkit.com/polyfills/objectentries/
function entries(obj) {
	var ownProps = Object.keys(obj),
		i = ownProps.length,
		resArray = new Array(i); // preallocate the Array

	while (i--)
		resArray[i] = [ownProps[i], obj[ownProps[i]]];

	return resArray;
}

if (!Object.assign)
	Object.assign = assign;
if (!Object.entries)
	Object.entries = entries;

exports.assign = assign; // IGNORE
exports.entries = entries; // IGNORE

