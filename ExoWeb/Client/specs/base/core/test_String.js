// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");
var strings = require("../../../src/base/core/String");

var isNullOrEmpty = strings.isNullOrEmpty;

jasmine.jasmine.debug = true;

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;

// Test Suites
///////////////////////////////////////
describe("isNullOrEmpty", function() {
	it("checks if the given argument is a null[, undefined], or empty string", function() {
		var undefined;
		expect(isNullOrEmpty()).toEqual(true);
		expect(isNullOrEmpty(undefined)).toEqual(true);
		expect(isNullOrEmpty(null)).toEqual(true);
		expect(isNullOrEmpty("")).toEqual(true);
		expect(isNullOrEmpty(" ")).toEqual(false);
		expect(isNullOrEmpty({})).toEqual(false);
		expect(isNullOrEmpty([])).toEqual(false);
		expect(isNullOrEmpty(5)).toEqual(false);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
