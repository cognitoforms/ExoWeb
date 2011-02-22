// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");

jasmine.jasmine.debug = true;

global.window = {};
global.ExoWeb = global.window.ExoWeb = {};

var utilities = require("../../../src/base/core/Utilities");
var $format = global.window.$format;
var isObject = utilities.isObject;
var hasProperty = utilities.hasProperty;

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

	it("it accepts a format string and an format argument object", function() {
		expect($format("{a},{b.val}|{c}{a}", { a: "A", b: { val: "B" }, c: "C" })).toBe("A,B|CA");
	});

	it("it accepts a format string and any number of format argument objects", function() {
		expect($format("{0},{1}|{2}{0}", "A", "B", "C")).toBe("A,B|CA");
	});

	it("if single argument is passed it uses \"params mode\" when format string uses only zero-index, argument object otherwise", function() {
		expect($format("{a}-{b}", { a: "A", b: "B", c: "C"})).toBe("A-B");
		expect($format("{0}-{0}", "AAA")).toBe("AAA-AAA");
		expect($format("{0}-{b}", "AAA")).toBe("A-{b}");
	});

	it("if single array argument is passed it uses the array as arguments", function() {
		expect($format("{0}-{0}", ["ABC"])).toBe("ABC-ABC");
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

