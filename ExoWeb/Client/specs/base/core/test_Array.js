// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");
var arrays = require("../../../src/base/core/Array");

var distinct = arrays.distinct;

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;

function arrayEquals(arr1, arr2) {
	expect(arr1.length).toBe(arr2.length);
	expect("\n\n" + arr1.join("\n") + "\n\n").toBe("\n\n" + arr2.join("\n") + "\n\n");
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
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

