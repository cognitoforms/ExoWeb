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

describe("getDayOfWeek", function() {
	it("returns the index of the day of the week based on the given number or string", function() {
		// anything other than a string or number will result in null
		expect(date.getDayOfWeek(false)).toBe(null);
		
		// an invalid string will result in null
		expect(date.getDayOfWeek("???")).toBe(null);

		// an invalid number will result in null
		expect(date.getDayOfWeek(12)).toBe(null);

		// a valid number will simply be returned
		expect(date.getDayOfWeek(0)).toBe(0);

		// a valid string (regardless of case) will be result in the expected index
		expect(date.getDayOfWeek("Sunday")).toBe(0);
		expect(date.getDayOfWeek("monday")).toBe(1);
	});
});

describe("startOfWeek", function() {
	it("assumes a week starts on Sunday and returns the date of Monday of the week of the specified Date", function() {
		var date = new Date(2011, 5, 15); // Jun 15, 2011
		expect(date.startOfWeek().valueOf()).toBe((new Date(2011, 5, 13)).valueOf());
	});
});

describe("weekOfYear", function() {
	it("returns the week (number) for the given date", function() {
		expect((new Date(2011, 5, 20)).weekOfYear()).toBe(25);	// Jun 20th
		expect((new Date(2011, 0, 1)).weekOfYear()).toBe(0);	// Jan 1st
		expect((new Date(2011, 0, 3)).weekOfYear()).toBe(1);	// Jan 3rd
		expect((new Date(2011, 11, 25)).weekOfYear()).toBe(51);	// Dec 25th
	});
});

describe("weekDifference", function() {
	it("returns the number of weeks between two dates", function() {
		expect((new Date(2011, 5, 20)).weekDifference(new Date(2011, 5, 22), "monday")).toBe(0);	// Jun 20th, Jun 22nd
		expect((new Date(2011, 0, 1)).weekDifference(new Date(2011, 0, 3), "monday")).toBe(1);	// Jan 1st, Jan 3rd
		expect((new Date(2011, 10, 25)).weekDifference(new Date(2011, 11, 25), "monday")).toBe(4);	// Nov 25th, Dec 25th
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();