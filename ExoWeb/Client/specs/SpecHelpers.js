var jasmine = require("../ref/jasmine/jasmine.js");
global.jasmine = jasmine;

global.describe = jasmine.describe;
global.it = jasmine.it;
global.expect = jasmine.expect;
global.beforeEach = jasmine.beforeEach;
global.afterEach = jasmine.afterEach;
global.any = jasmine.any;

var jasmineConsole = require("../ref/jasmine/jasmine.console.js");
global.jasmineConsole = jasmineConsole;

global.log = function(category, message, args) {
	console.log(message);
};

global.logError = function(category, message, args) {
	console.log("Error: " + message);
};

var dependencies;

exports.announce = function (name) {
	console.log("\r\nSetting up specs for " + name + "\r\n");
};

exports.require = function() {
	if (!dependencies) {
		dependencies = require("./SpecDependencies.js");
		dependencies.setHelper(exports);
		dependencies.init();
	}
	return dependencies.require.apply(dependencies, arguments);
};

exports.requireMsAjax = function() {
	global.Sys = { Res: {} };
	global.document = {
		documentElement: {}
	};
	global.navigator = { userAgent: "" };
	window.addEventListener = function() {};
	require("../ref/aspnetajax/MicrosoftAjax.debug.js");
};

function jQueryExtend() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !jQuery.isFunction(target) ) {
		target = {};
	}

	// extend jQuery itself if only one argument is passed
	if ( length === i ) {
		target = this;
		--i;
	}

	for ( ; i < length; i++ ) {
		// Only deal with non-null/undefined values
		if ( (options = arguments[ i ]) != null ) {
			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy)) ) ) {
					if ( copyIsArray ) {
						copyIsArray = false;
						clone = src && jQuery.isArray(src) ? src : [];

					} else {
						clone = src && jQuery.isPlainObject(src) ? src : {};
					}

					// Never move original objects, clone them
					target[ name ] = jQuery.extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
}

exports.requireJQueryExtend = function() {
	global.$ = {
		extend: jQueryExtend
	};
};

var debugging = false;

exports.debug = function() {
	debugging = true;
	jasmine.jasmine.debug = true;
};

exports.isDebugging = function() {
	return debugging;
};

exports.ensureWindow = function() {
	if (!global.window) {
		global.window = global;
	}
};

exports.ensureNamespace = function(ns) {
	var steps = ns.split(".");
	var target = global;
	steps.forEach(function(step) {
		if (target[step]) {
			target = target[step];
		}
		else {
			target = target[step] = {};
		}
	});
	return target;
};

jasmine.jasmine.Env.prototype.str_ = function (value, hints) {
	var str;
	if (value === null) {
		str = "null";
	} else if (value === undefined) {
		str = "undefined";
	} else if (Object.prototype.toString.call(value) === "[object Object]") {
		str = JSON.stringify(value);
	} else if (hints) {
		if (Object.prototype.toString.call(value) === "[object Date]") {
			if (hints.dateAndTime) {
				str = value.localeFormat("MM/dd/yyyy h:mm tt");
			} else if (hints.dateOnly) {
				str = value.localeFormat("MM/dd/yyyy");
			} else if (hints.timeOnly) {
				str = value.localeFormat("h:mm tt");
			} else {
				str = value.toString();
			}
		} else {
			str = value.toString();
		}
	} else if (Object.prototype.toString.call(value) === "[object String]") {
		str = "'" + value.toString() + "'";
	} else {
		str = value.toString();
	}
	return str;
};

jasmine.jasmine.Env.prototype.indexOf_ = function (arr, item) {
	for (var i = 0, len = arr.length; i < len; i++) {
		if (this.equals_(arr[i], item))
			return i;
	}
	return -1;
};

jasmine.jasmine.Matchers.prototype.toHaveTheSameLengthAs = function (otherArray) {
	var myArray = this.actual,
		actualLength = myArray.length;

	if (!(myArray instanceof Array)) {
		throw new Error("The source of toHaveTheSameLengthAs must be an array.");
	}

	if (!(otherArray instanceof Array)) {
		throw new Error("The input of toHaveTheSameLengthAs must be an array.");
	}

	this.actual = actualLength;
	this.message = function () {
		return "Expected " + otherArray.length + " items but found " + actualLength + " instead.";
	};

	return actualLength === otherArray.length;
};

jasmine.jasmine.Matchers.prototype.toContainTheItemsIn = function (otherArray) {
	if (!(this.actual instanceof Array)) {
		throw new Error("The source object must be an array.");
	}

	if (!(otherArray instanceof Array)) {
		throw new Error("The input object must be an array.");
	}

	var actualArray = Array.prototype.slice.call(this.actual),
		expectedArray = Array.prototype.slice.call(otherArray),
		message = "";

	this.message = function () {
		return message || ("Expected the array to contain the following items: [" + otherArray.map(this.env.str_).join(", ") + "].");
	};

	while (expectedArray.length > 0) {
		var idxInActual = this.env.indexOf_(actualArray, expectedArray[0]);
		if (idxInActual < 0) {
			message = "Expected the array to contain " + this.env.str_(expectedArray[0]) + ".";
			return false;
		}
		expectedArray.splice(0, 1);
		actualArray.splice(idxInActual, 1);
	}

	return true;
};

jasmine.jasmine.Matchers.prototype.toHaveTheSameElementsAs = function (otherArray) {
	if (!(this.actual instanceof Array)) {
		throw new Error("The source object must be an array.");
	}

	if (!(otherArray instanceof Array)) {
		throw new Error("The input object must be an array.");
	}

	var actualArray = Array.prototype.slice.call(this.actual),
		expectedArray = Array.prototype.slice.call(otherArray),
		message = "";

	this.message = function () {
		return message || ("Expected the array to be [" + otherArray.map(this.env.str_).join(", ") + "].");
	};

	if (actualArray.length !== expectedArray.length) {
		message = "Array [" + actualArray.map(this.env.str_).join(", ") + "] does not contain the same number of items as [" + otherArray.map(this.env.str_).join(", ") + "].";
		return false;
	}

	for (var i = 0; i < actualArray.length; i++) {
		if (!this.env.equals_(actualArray[i], expectedArray[i])) {
			message = "Expected " + this.env.str_(expectedArray[i]) + " at position " + i + " but found " + this.env.str_(actualArray[i]) + " instead.";
			return false;
		}
	}

	return true;
};

exports.arrayEquals = function(arr1, arr2, unordered) {
	expect(arr1.length).toBe(arr2.length);

	if (unordered) {
		arr1 = Array.prototype.slice.call(arr1);
		arr2 = Array.prototype.slice.call(arr2);

		while (arr1.length > 0) {
			var idx = arr2.indexOf(arr1[0]);
			expect(arr1[0]).toBe(arr2[idx]);
			arr1.splice(0, 1);
			arr2.splice(idx, 1);
		}
	}
	else {
		expect("\n\n" + arr1.join("\n") + "\n\n").toBe("\n\n" + arr2.join("\n") + "\n\n");
	}
};
