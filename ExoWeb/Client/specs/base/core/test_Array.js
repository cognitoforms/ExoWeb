// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");
var arrays = require("../../../src/base/core/Array");

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;


// Test Suites
///////////////////////////////////////
describe("removeAll", function() {
	function arrayEquals(arr1, arr2) {
		expect(arr1.length).toBe(arr2.length);
		expect("\n\n" + arr1.join("\n") + "\n\n").toBe("\n\n" + arr2.join("\n") + "\n\n");
	}

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

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

