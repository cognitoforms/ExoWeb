// original code grabbed from http://oranlooney.com/functional-javascript/
//modified to be utilized off Object instead of the owl library for consistency
//has deep copy/shallow copy/and clone.

//this copy function is kept for backwards compatibility.
//not sure what changes to this would affect in TestView
//There are new functions for deepCopy, shallowCopy, and Clone below
//Keith La Force
Object.copy = function Object$Copy(obj, options/*, level*/) {

	var undefined;

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
				if (ExoWeb.Model && obj instanceof ExoWeb.Model.Entity) {
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

Object.shallowCopy = function Object$ShallowCopy(target) {
	return owl.copy(target);
}

Object.deepCopy = function Object$DeepCopy(target) {
	return owl.deepCopy(target);
}

Object.clone = function Object$Clone(target) {
	return owl.clone(target);
}