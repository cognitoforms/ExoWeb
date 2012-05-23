// Imports
///////////////////////////////////////
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");

jasmine.jasmine.debug = true;

global.window = {};
global.ExoWeb = global.window.ExoWeb = {};

var utilities = require("../../../src/base/core/Utilities");
var getValue = utilities.getValue;
var $format = global.window.$format;
var isNullOrUndefined = utilities.isNullOrUndefined;

var typeChecking = require("../../../src/base/core/TypeChecking");
var isObject = global.isObject = typeChecking.isObject;

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;
var beforeEach = jasmine.beforeEach;

// Test Suites
///////////////////////////////////////
describe("$format", function() {
	it("it accepts a format string and an array of format arguments", function() {
		expect($format("{0},{1}|{2}{0}", ["A", "B", "C"])).toBe("A,B|CA");
	});

	it("it accepts a format string and any number of format argument objects", function() {
		expect($format("{0},{1}|{2}{0}", "A", "B", "C")).toBe("A,B|CA");
	});

	it("if single argument is passed it uses \"params mode\" when format string uses only zero-index, argument object otherwise", function() {
		expect($format("{0}-{0}", "AAA")).toBe("AAA-AAA");
	});

	it("if single array argument is passed it uses the array as arguments", function() {
		expect($format("{0}-{0}", ["ABC"])).toBe("ABC-ABC");
	});
});

describe("getValue", function() {
	it("returns the value of the given property of the given object", function() {
		expect(getValue("foo", 0)).toBe("f");
		expect(getValue("foo", "length")).toBe(3);
	});
	
	it("uses getter methods", function() {
		var o = new Object();
		o.get_TheMeaningOfLife = function() { return 42; };
		expect(getValue(o, "TheMeaningOfLife")).toBe(42);
	});

	it("returns undefined if a property doesn't exist", function() {
		var o = new Object();
		expect(getValue(o, "foo")).toBe(undefined);
	});

	it("returns null if a property exists but is undefined", function() {
		var o = new Object();
		o.foo = undefined;
		expect(getValue(o, "foo")).toBe(null);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
