// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");
var arrays = require("../../../src/base/core/Array");

var contains = arrays.contains;
var distinct = arrays.distinct;
var intersect = arrays.intersect;
var purge = arrays.purge;
var first = arrays.first;
var fill = arrays.fill;
var map = arrays.map;
var indexOf = arrays.indexOf;
var reduce = arrays.reduce;

jasmine.jasmine.debug = true;

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;

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
		expect("\n\n" + arr1.join("\n") + "\n\n").toBe("\n\n" + arr2.join("\n") + "\n\n");
	}
}

// Test Suites
///////////////////////////////////////
describe("purge", function() {
	function testPurge(original, expected, filterFn) {
		purge(original, filterFn);
		arrayEquals(original, expected);
	}

	it("removes elements from the array that match the given filter callback", function() {
		testPurge([4, 6, 2, 6, 7, 2], [4, 2, 2], function(item) {
			return item >= 6;
		});
	});

	it("uses removeAt if exists", function() {
		var arr = [4, 6, 2, 6, 7, 2];

		var removeAtCalls = 0;

		arr.removeAt = function(idx) {
			removeAtCalls++;
			this.splice(idx, 1);
		};

		testPurge(arr, [4, 2, 2], function(item) {
			return item >= 6;
		});

		expect(removeAtCalls).toBe(3);
	});

	it("returns the indices where items where removed from the original array", function() {
		arrayEquals(purge([parseInt("x"), parseInt("y"), 6, 7, parseInt("z"), 2], isNaN), [0, 1, 4]);
	});

	it("returns nothing if no items are removed", function() {
		expect(purge([4, 6, 2, 6, 7, 2], isNaN)).toEqual(undefined);
	});
});

describe("contains", function () {
	it("returns true if an element exists in the array", function () {
		var arr = ["A", "B", "C"];

		expect(contains(arr, "B")).toBe(true);
		expect(arr.contains("B")).toBe(true);
	});

	it("returns false if an element does not exist in the array", function () {
		var arr = ["A", "B", "C"];

		expect(contains(arr, "D")).toBe(false);
		expect(arr.contains("D")).toBe(false);
	});
});

describe("distinct", function () {
	it("removes duplicates from a list", function() {
		arrayEquals(distinct([0, 1, 4, 1, 5]), [0, 1, 4, 5]);
	});

	it("removes multiple duplicates", function() {
		arrayEquals(distinct([0, 1, 4, 1, 4, 5]), [0, 1, 4, 5]);
		arrayEquals(distinct([0, 1, 5, 4, 1, 4, 5]), [0, 1, 5, 4]);
	});
	
	it("removes back-to-back duplicates", function() {
		arrayEquals(distinct([0, 0, 1, 4, 1, 4, 5]), [0, 1, 4, 5]);
	});
	
	it("preserves first encountered item", function() {
		arrayEquals(distinct([0, 1, 0, 1, 4, 1, 4, 5]), [0, 1, 4, 5]);
	});
});

describe("intersect", function() {
	it("produces the set intersection of two arrays, using strict equality", function() {
		arrayEquals(intersect([], []), [], true);
		arrayEquals(intersect([0, 1], [1, 2]), [1], true);
		arrayEquals(intersect([0, 1, 2, 3, 4], [4, 3, 2, 1]), [3, 1, 4, 2], true);
	});
	
	it("returns distinct results", function() {
		arrayEquals(intersect([0, 1], [1, 2]), [1], true);
		arrayEquals(intersect([0, 1, 2, 4, 3, 4, 1], [4, 3, 2, 1]), [3, 1, 4, 2], true);
	});
});

describe("first", function() {
	it("returns the first item in the list that passes the given filter", function() {
		var arr = [0, 54, 23, 5];

		expect(first(arr, function(i) { return i > 5; })).toBe(54);
		expect(first(arr, function(i) { return i > 54; })).toBe(null);
		expect(first(arr, function(i) { return i > 0 && i < 10; })).toBe(5);
		expect(first(arr)).toBe(0);

		expect(arr.first(function(i) { return i > 5; })).toBe(54);
		expect(arr.first(function(i) { return i > 54; })).toBe(null);
		expect(arr.first(function(i) { return i > 0 && i < 10; })).toBe(5);
		expect(arr.first()).toBe(0);
	});
});

describe("map", function () {
	it("maps items in the array using the callback function provided", function () {
		arrayEquals(map(["A", "B", "C"], function (item, index) {
			return item.toLowerCase();
		}), ["a", "b", "c"], true);
	});
});

describe("indexOf", function () {
	it("returns the index of a given element in the array", function () {
		var arr = ["A", "B", "C"];

		expect(indexOf(arr, "B")).toBe(1);
		expect(arr.indexOf("B")).toBe(1);
	});
});

describe("fill", function () {
	it("pushes a given number of items into the array with the given value", function () {
		var arr = ["A", "B", "C"];
		arr.fill("D", 3);
		expect(arr[3]).toBe("D");
		expect(arr[4]).toBe("D");
		expect(arr[5]).toBe("D");
		expect(arr[6]).toBe(undefined);
	});
});

describe("reduce", function () {
	it("accumulates values in the array into a single value", function () {
		var arr = [5, 2, 3, -4];

		var total = reduce(arr, function(previousValue, currentValue, index, array) {
			return previousValue + currentValue;
		});

		expect(total).toBe(6);

		total = reduce(arr, function(previousValue, currentValue, index, array) {
			return previousValue + currentValue;
		}, 0);

		expect(total).toBe(6);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

