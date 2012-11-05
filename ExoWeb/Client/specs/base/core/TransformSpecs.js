/// <reference path="../../SpecDependencies.js" />
/// <reference path="../../SpecHelpers.js" />

// Test setup
///////////////////////////////////////

var specs = require("../../SpecHelpers");

specs.announce("Transform");

//specs.debug();
// Simulate global window object and exoweb namespace
specs.ensureWindow();
specs.ensureNamespace("ExoWeb");

// Imports
///////////////////////////////////////

var transformModule = specs.require("core.Transform");

// Test Suites
///////////////////////////////////////

function arrayEquals(arr1, arr2, unordered) {
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
		expect(arr1.join(",")).toBe(arr2.join(","));
	}
}

function getName(i) {
	return i.name;
}

// Test Suites
///////////////////////////////////////
describe("constructor", function() {
	it("throws an error if no array is given", function() {
		expect(function() {
			$transform();
		}).toThrow("Argument 'array' cannot be null or undefined: transform input is required.");
	});

	it("throws an error if a non-array input is given", function() {
		expect(function() {
			$transform("foo");
		}).toThrow("Argument 'array' must be of type array: foo.");
	});
});

describe("orderBy", function() {
	beforeEach(function() {
		this.list = [
			{
				name: "apples",
				count: 5,
				date: new Date(2011, 1, 15)
			},
			{
				name: "Oranges",
				count: 1,
				date: new Date(2011, 1, 1)
			},
			{
				name: "bananas",
				count: 5,
				date: new Date(2010, 11, 22)
			}
		];
	});

	it("sorts based on a string value", function() {
		arrayEquals($transform(this.list).orderBy("name").map(getName), ["apples", "bananas", "Oranges"]);
	});
	
	it("sorts based on a numeric value", function() {
		arrayEquals($transform(this.list).orderBy("count").map(getName), ["Oranges", "apples", "bananas"]);
	});
	
	it("sorts based on a numeric value", function() {
		arrayEquals($transform(this.list).orderBy("count").map(getName), ["Oranges", "apples", "bananas"]);
	});
	
	it("sorts based on a date value", function() {
		arrayEquals($transform(this.list).orderBy("date").map(getName), ["bananas", "Oranges", "apples"]);
	});
	
	it("sorts in descending order", function() {
		arrayEquals($transform(this.list).orderBy("name desc").map(getName), ["Oranges", "bananas", "apples"]);
		arrayEquals($transform(this.list).orderBy("count desc").map(getName), ["apples", "bananas", "Oranges"]);
	});
	
	it("handles nulls", function() {
		arrayEquals($transform([{ name: null }, { name: null }]).orderBy("name").map(getName), [null, null]);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
