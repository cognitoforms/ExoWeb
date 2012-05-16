var jasmine = require("../ref/jasmine/jasmine");
global.jasmine = jasmine;

global.describe = jasmine.describe;
global.it = jasmine.it;
global.expect = jasmine.expect;
global.beforeEach = jasmine.beforeEach;

var jasmineConsole = require("../ref/jasmine/jasmine.console");
global.jasmineConsole = jasmineConsole;

var dependencies;

exports.require = function() {
	if (!dependencies) {
		dependencies = require("./SpecDependencies");
		dependencies.setHelper(exports);
		dependencies.init();
	}
	return dependencies.require.apply(dependencies, arguments);
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
