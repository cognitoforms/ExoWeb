// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");
var date = require("../../../src/base/core/Date");

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;


// Test Suites
///////////////////////////////////////
describe("toDate", function() {
	it("returns a date that represents only the date component", function() {
		var date = new Date(2011, 5, 15, 5, 12);
		expect(date.toDate().valueOf()).toBe((new Date(2011, 5, 15)).valueOf());
	});
});

describe("addYears", function() {
	it("adds the given number of years to the date", function() {
		var date = new Date(2011, 5, 15, 5, 12);
		expect(date.addYears(5).valueOf()).toBe((new Date(2016, 5, 15, 5, 12)).valueOf());
	});
	it("works for a negative value", function() {
		var date = new Date(2011, 5, 15, 5, 12);
		expect(date.addYears(-2).valueOf()).toBe((new Date(2009, 5, 15, 5, 12)).valueOf());
	});
});

describe("addDays", function() {
	it("adds the given number of days to the date", function() {
		var date = new Date(2011, 5, 15, 5, 12);
		expect(date.addDays(3).valueOf()).toBe((new Date(2011, 5, 18, 5, 12)).valueOf());
	});
	it("works for a negative value", function() {
		var date = new Date(2011, 5, 15, 5, 12);
		expect(date.addDays(-3).valueOf()).toBe((new Date(2011, 5, 12, 5, 12)).valueOf());
	});
	it("when adding, if require week day is true and the date would fall on a weekend, moves forward to monday", function() {
		var date = new Date(2011, 5, 15, 5, 12);
		expect(date.addDays(3, true).valueOf()).toBe((new Date(2011, 5, 20, 5, 12)).valueOf());
	});
	it("when subtracting, if require week day is true and the date would fall on a weekend, moves back to friday", function() {
		var date = new Date(2011, 5, 15, 5, 12);
		expect(date.addDays(-3, true).valueOf()).toBe((new Date(2011, 5, 10, 5, 12)).valueOf());
	});
});

describe("startOfWeek", function() {
	it("assumes a week starts on Sunday and returns the date of Monday of the week of the specified Date", function() {
		var date = new Date(2011, 5, 15); // Jun 15, 2011
		expect(date.startOfWeek().valueOf()).toBe((new Date(2011, 5, 13)).valueOf());
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
