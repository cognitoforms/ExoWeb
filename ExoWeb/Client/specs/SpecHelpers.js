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
