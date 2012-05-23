var jasmine = require("../ref/jasmine/jasmine");
global.jasmine = jasmine;

global.describe = jasmine.describe;
global.it = jasmine.it;
global.expect = jasmine.expect;
global.beforeEach = jasmine.beforeEach;

var jasmineConsole = require("../ref/jasmine/jasmine.console");
global.jasmineConsole = jasmineConsole;

global.log = function(category, message, args) {
	console.log(message);
};

global.logError = function(category, message, args) {
	console.log("Error: " + message);
};

var dependencies;

exports.require = function() {
	if (!dependencies) {
		dependencies = require("./SpecDependencies");
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
	require("../ref/aspnetajax/MicrosoftAjax.debug");
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
