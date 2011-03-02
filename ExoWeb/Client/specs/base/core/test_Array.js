// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");
var arrays = require("../../../src/base/core/Array");

var distinct = arrays.distinct;
var intersect = arrays.intersect;

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
describe("removeAll", function() {
	function testRemoveAll(original, expected, filterFn) {
		original.removeAll(filterFn);
		arrayEquals(original, expected);
	}

	it("removes elements from the array that match the given filter callback", function() {
		testRemoveAll([4, 6, 2, 6, 7, 2], [4, 2, 2], function(item) {
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

		testRemoveAll(arr, [4, 2, 2], function(item) {
			return item >= 6;
		});

		expect(removeAtCalls).toBe(3);
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

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

