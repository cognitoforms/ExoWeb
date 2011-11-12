// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");
var arrays = require("../../../src/base/core/Array");

var contains = arrays.contains;
var distinct = arrays.distinct;
var filter = arrays.filter;
var first = arrays.first;
var fill = arrays.fill;
var indexOf = arrays.indexOf;
var insert = arrays.insert;
var insertRange = arrays.insertRange;
var intersect = arrays.intersect;
var last = arrays.last;
var map = arrays.map;
var purge = arrays.purge;
var reduce = arrays.reduce;
var remove = arrays.remove;
var removeAt = arrays.removeAt;
var removeRange = arrays.removeRange;
var single = arrays.single;
var update = arrays.update;

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
			removeAt(this, idx);
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

describe("filter", function () {
	it("copies elements of the source array that pass the given filter function", function () {
		var arr = [5, 2, 3, -4, 0];
		arrayEquals(filter(arr, function(i) { return i >= 0; }), [5, 2, 3, 0]);
	});

	it("filter function result can be truthy", function () {
		var arr = [5, 2, 3, -4, 0];
		arrayEquals(filter(arr, function(i) { return i; }), [5, 2, 3, -4]);
	});
});

describe("single", function () {
	it("returns a single item from the array that matches the given filter function", function () {
		var arr = [5, 2, 3, -4, 0];
		expect(single(arr, function(i) { return i < 0; })).toBe(-4);
	});

	it("throws an error if more than one item matches the given filter function", function () {
		var arr = [5, 2, 3, -4, 0];
		expect(function() {
			single(arr, function(i) { return i <= 0; });
		}).toThrow("Expected a single item, but found 2.");
	});
});

describe("last", function() {
	it("returns the last item in the list that passes the given filter", function() {
		var arr = [0, 54, 23, 5];

		expect(last(arr, function(i) { return i > 5; })).toBe(23);
		expect(last(arr, function(i) { return i > 54; })).toBe(null);
		expect(last(arr, function(i) { return i > 0 && i < 10; })).toBe(5);
		expect(last(arr, function(i) { return i < 10; })).toBe(5);
		expect(last(arr)).toBe(5);

		expect(arr.last(function(i) { return i > 5; })).toBe(23);
		expect(arr.last(function(i) { return i > 54; })).toBe(null);
		expect(arr.last(function(i) { return i > 0 && i < 10; })).toBe(5);
		expect(arr.last(function(i) { return i < 10; })).toBe(5);
		expect(arr.last()).toBe(5);
	});
});

describe("remove", function() {
	it("removes a single item from an array", function() {
		var target = [0, 1, 2];
		remove(target, 1);
		arrayEquals(target, [0, 2]);
	});
});

describe("removeAt", function() {
	it("removes a single item from an array at the given index", function() {
		var target = [0, 1, 2];
		removeAt(target, 0);
		arrayEquals(target, [1, 2]);
	});
});

describe("removeRange", function() {
	it("removes a number of items from an array at the given index", function() {
		var target = [0, 1, 2, 3, 4];
		removeRange(target, 2, 2);
		arrayEquals(target, [0, 1, 4]);
	});
});

describe("insert", function() {
	it("adds a single item to an array at the given index", function() {
		var target = [0, 1, 2];
		insert(target, 1, 0.5);
		arrayEquals(target, [0, 0.5, 1, 2]);
	});
});

describe("insertRange", function() {
	it("adds a number of items to an array at the given index", function() {
		var target = [0, 1, 2];
		insertRange(target, 1, [0.5, 0.75, 0.9]);
		arrayEquals(target, [0, 0.5, 0.75, 0.9, 1, 2]);
	});
});

describe("update", function() {
	var spies = {
		insert: function(index, item) { return insert(this, index, item); },
		insertRange: function(index, items) { return insertRange(this, index, items); },
		removeAt: function(index) { return removeAt(this, index); },
		removeRange: function(index, count) { return removeRange(this, index, count); }
	};

	it("turns a single added item into an insert", function() {
		var source = [0, 1, 2, 3];
		var target = [0, 1, 2, 3, 4];

		var insert = jasmine.spyOn(spies, "insert").andCallThrough();
		source.insert = insert;

		update(source, target);
		arrayEquals(source, target);
		expect(insert).toHaveBeenCalledWith(4, 4);
		
		source = [0, 1, 3, 4];
		source.insert = insert;

		update(source, target);
		arrayEquals(source, target);
		expect(insert).toHaveBeenCalledWith(2, 2);

		source = [1, 2, 3, 4];
		source.insert = insert;

		update(source, target);
		arrayEquals(source, target);
		expect(insert).toHaveBeenCalledWith(0, 0);
	});

	it("turns multiple added items into a single insertRange", function() {
		var source = [2, 3, 4];
		var target = [0, 1, 2, 3, 4];

		var insertRange = jasmine.spyOn(spies, "insertRange").andCallThrough();
		source.insertRange = insertRange;

		update(source, target);
		arrayEquals(source, target);
		expect(insertRange).toHaveBeenCalledWith(0, [0, 1]);

		source = [0, 1, 4];
		source.insertRange = insertRange;

		update(source, target);
		arrayEquals(source, target);
		expect(insertRange).toHaveBeenCalledWith(2, [2, 3]);

		source = [0, 1, 2];
		source.insertRange = insertRange;

		update(source, target);
		arrayEquals(source, target);
		expect(insertRange).toHaveBeenCalledWith(3, [3, 4]);
	});

	it("turns a single removed item into a removeAt", function() {
		var source = [0, 1, 2, 3, 4];
		var target = [1, 2, 3, 4];

		var removeAt = jasmine.spyOn(spies, "removeAt").andCallThrough();
		source.removeAt = removeAt;

		update(source, target);
		arrayEquals(source, target);
		expect(removeAt).toHaveBeenCalledWith(0);

		source = [0, 1, 2, 3, 4];
		source.removeAt = removeAt;
		target = [0, 1, 2, 3];

		update(source, target);
		arrayEquals(source, target);
		expect(removeAt).toHaveBeenCalledWith(4);

		source = [0, 1, 2, 3, 4];
		source.removeAt = removeAt;
		target = [0, 1, 3, 4];

		update(source, target);
		arrayEquals(source, target);
		expect(removeAt).toHaveBeenCalledWith(2);
	});

	it("turns multiple removed items into a removeRange", function() {
		var source = [0, 1, 2, 3, 4];
		var target = [2, 3, 4];

		var removeRange = jasmine.spyOn(spies, "removeRange").andCallThrough();
		source.removeRange = removeRange;

		update(source, target);
		arrayEquals(source, target);
		expect(removeRange).toHaveBeenCalledWith(0, 2);

		source = [0, 1, 2, 3, 4];
		source.removeRange = removeRange;
		target = [0, 1, 2];

		update(source, target);
		arrayEquals(source, target);
		expect(removeRange).toHaveBeenCalledWith(3, 2);

		source = [0, 1, 2, 3, 4];
		source.removeRange = removeRange;
		target = [0, 1, 4];

		update(source, target);
		arrayEquals(source, target);
		expect(removeRange).toHaveBeenCalledWith(2, 2);
	});

	it("turns a changed item into a removeAt and insert", function() {
		var source = [0, 1, 2];
		var target = [0, 1, 3];

		var removeAt = jasmine.spyOn(spies, "removeAt").andCallThrough();
		source.removeAt = removeAt;
		var insert = jasmine.spyOn(spies, "insert").andCallThrough();
		source.insert = insert;

		update(source, target);
		arrayEquals(source, target);
		expect(removeAt).toHaveBeenCalledWith(2);
		expect(insert).toHaveBeenCalledWith(2, 3);

		source = [0, 1, 2];
		target = [-1, 1, 2];
		source.removeAt = removeAt;
		source.insert = insert;

		update(source, target);
		arrayEquals(source, target);
		expect(removeAt).toHaveBeenCalledWith(0);
		expect(insert).toHaveBeenCalledWith(0, -1);
	});

	it("turns a swap into an add and a remove", function() {
		var source = [6, 4];
		var target = [4, 6];

		update(source, target);
		arrayEquals(source, target);
	});

	it("turns entirely unmatched arrays into a removeRange and insertRange", function() {
		var source = [0, 1, 2, 3];
		var target = [4, 5, 6];

		var removeRange = jasmine.spyOn(spies, "removeRange").andCallThrough();
		source.removeRange = removeRange;
		var insertRange = jasmine.spyOn(spies, "insertRange").andCallThrough();
		source.insertRange = insertRange;

		update(source, target);
		arrayEquals(source, target);
		expect(removeRange).toHaveBeenCalledWith(0, 4);
		expect(insertRange).toHaveBeenCalledWith(0, [4, 5, 6]);
	});

	it("handles miscellaneous combinations of add and remove in arrays with varying degrees of divergences", function() {
		var source = [6, 7, 8, 2, 4, 6];
		var target = [4, 6, 7, 8];
		update(source, target);
		arrayEquals(source, target);

		source = [6, 2, 4];
		target = [4, 6];
		update(source, target);
		arrayEquals(source, target);

		source = [1, 7, 5, 6];
		target = [1, 2, 3, 4, 5, 6];
		update(source, target);
		arrayEquals(source, target);

		source = [0, 1, 5, 6];
		target = [1, 2, 3, 4, 5, 6];
		update(source, target);
		arrayEquals(source, target);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
