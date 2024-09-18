// Test setup
///////////////////////////////////////

var specs = require("../../SpecHelpers");

//specs.debug();
specs.ensureWindow();

// Imports
///////////////////////////////////////

var arrayMethods = specs.require("core.Array");

// Test Suites
///////////////////////////////////////

describe("purge", function() {
	function testPurge(original, expected, filterFn) {
		purge(original, filterFn);
		specs.arrayEquals(original, expected);
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
		specs.arrayEquals(purge([parseInt("x"), parseInt("y"), 6, 7, parseInt("z"), 2], isNaN), [0, 1, 4]);
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
		specs.arrayEquals(distinct([0, 1, 4, 1, 5]), [0, 1, 4, 5]);
	});

	it("removes multiple duplicates", function() {
		specs.arrayEquals(distinct([0, 1, 4, 1, 4, 5]), [0, 1, 4, 5]);
		specs.arrayEquals(distinct([0, 1, 5, 4, 1, 4, 5]), [0, 1, 5, 4]);
	});
	
	it("removes back-to-back duplicates", function() {
		specs.arrayEquals(distinct([0, 0, 1, 4, 1, 4, 5]), [0, 1, 4, 5]);
	});
	
	it("preserves first encountered item", function() {
		specs.arrayEquals(distinct([0, 1, 0, 1, 4, 1, 4, 5]), [0, 1, 4, 5]);
	});
});

describe("intersect", function() {
	it("produces the set intersection of two arrays, using strict equality", function() {
		specs.arrayEquals(intersect([], []), [], true);
		specs.arrayEquals(intersect([0, 1], [1, 2]), [1], true);
		specs.arrayEquals(intersect([0, 1, 2, 3, 4], [4, 3, 2, 1]), [3, 1, 4, 2], true);
	});
	
	it("returns distinct results", function() {
		specs.arrayEquals(intersect([0, 1], [1, 2]), [1], true);
		specs.arrayEquals(intersect([0, 1, 2, 4, 3, 4, 1], [4, 3, 2, 1]), [3, 1, 4, 2], true);
	});
});

describe("find", function () {
	it("returns the first element in the provided array that satisfies the provided testing function", function () {
		var arr = [5, 12, 8, 130, 44];
		expect(arrayMethods.find(arr, function(element) { return element > 10; })).toBe(12);
	});
	it("returns undefined if no values satisfy the testing function", function () {
		var arr = [5, 12, 8, 130, 44];
		expect(arrayMethods.find(arr, function(element) { return element < 0; })).toBe(undefined);
	});
});

describe("findIndex", function () {
	it("returns the index of the first element in the array that satisfies the provided testing function", function () {
		var arr = [5, 12, 8, 130, 44];
		expect(arrayMethods.findIndex(arr, function (element) { return element > 13; })).toBe(3);
	});
	it("returns -1 if no element in the array satisfies the provided testing function", function () {
		var arr = [5, 12, 8, 130, 44];
		expect(arrayMethods.findIndex(arr, function (element) { return element > 1000; })).toBe(-1);
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

describe("flat", function () {
	it("creates a new array with all sub-array elements concatenated into it recursively up to the specified depth", function () {
		var arr1 = [0, 1, 2, [3, 4]];
		expect(arrayMethods.flat(arr1)).toEqual([0, 1, 2, 3, 4]);

		var arr2 = [0, 1, 2, [[[3, 4]]]];
		expect(arrayMethods.flat(arr2, 2)).toEqual([0, 1, 2, [3, 4]]);
	});
});

describe("flatMap", function () {
	it("returns a new array formed by applying a given callback function to each element of the array, and then flattening the result by one level", function () {
		var arr1 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
		expect(arrayMethods.flatMap(arr1, function (e) { return [e, e * e]; })).toEqual([0, 0, 1, 1, 2, 4, 3, 9, 4, 16, 5, 25, 6, 36, 7, 49, 8, 64, 9, 81]);
	});
});

describe("map", function () {
	it("maps items in the array using the callback function provided", function () {
		specs.arrayEquals(map(["A", "B", "C"], function (item, index) {
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

describe("lastIndexOf", function () {
	it("returns the last index of a given element in the array", function () {
		var arr = ["A", "B", "C", "A"];

		expect(lastIndexOf(arr, "A")).toBe(3);
	});
});


describe("fill", function () {
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fill#try_it
	it("fills from position x until position y", function () {
		var arr = [1, 2, 3, 4];
		arrayMethods.fill(arr, 0, 2, 4);
		expect(arr).toEqual([1, 2, 0, 0]);
	});
	it("fills from position x", function () {
		var arr = [1, 2, 3, 4];
		arrayMethods.fill(arr, 5, 1);
		expect(arr).toEqual([1, 5, 5, 5]);
	});
	it("fills all positions", function () {
		var arr = [1, 2, 3, 4];
		arrayMethods.fill(arr, 6);
		expect(arr).toEqual([6, 6, 6, 6]);
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
		specs.arrayEquals(filter(arr, function(i) { return i >= 0; }), [5, 2, 3, 0]);
	});

	it("filter function result can be truthy", function () {
		var arr = [5, 2, 3, -4, 0];
		specs.arrayEquals(filter(arr, function(i) { return i; }), [5, 2, 3, -4]);
	});
});

describe("from", function () {
	it("creates a new, shallow-copied Array instance from an array-like or iterable object", function () {
		var args = (function () {
			return arguments;
		}).apply(this, [5, 2, 3, -4, 0]);
		expect(Array.isArray(args)).toBe(false);
		var fromArgs = arrayMethods.from(args);
		specs.arrayEquals(fromArgs, [5, 2, 3, -4, 0]);
		expect(Array.isArray(fromArgs)).toBe(true);
	});
});

describe("isArray", function () {
	it("determines whether the passed value is an Array", function () {
		var args = (function () {
			return arguments;
		}).apply(this, [5, 2, 3, -4, 0]);
		expect(arrayMethods.isArray(args)).toBe(false);
		expect(arrayMethods.isArray([0, 1, 2])).toBe(true);
	});
});

describe("single", function () {
	it("returns the single item in the array if no filter function is specified", function () {
		var arr = [5];
		expect(single(arr)).toBe(5);
	});

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

	it("throws an error if there are no items and no filter function is specified", function () {
		var arr = [5, 2, 3, -4, 0];
		expect(function () {
			single(arr, function (i) { return i < -4; });
		}).toThrow("Expected a single item, but did not find a match.");
	});

	it("throws an error if no items match the given filter function", function () {
		var arr = [];
		expect(function() {
			single(arr);
		}).toThrow("Expected a single item, but did not find a match.");
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
		specs.arrayEquals(target, [0, 2]);
	});
});

describe("removeAt", function() {
	it("removes a single item from an array at the given index", function() {
		var target = [0, 1, 2];
		removeAt(target, 0);
		specs.arrayEquals(target, [1, 2]);
	});
});

describe("removeRange", function() {
	it("removes a number of items from an array at the given index", function() {
		var target = [0, 1, 2, 3, 4];
		removeRange(target, 2, 2);
		specs.arrayEquals(target, [0, 1, 4]);
	});
});

describe("insert", function() {
	it("adds a single item to an array at the given index", function() {
		var target = [0, 1, 2];
		insert(target, 1, 0.5);
		specs.arrayEquals(target, [0, 0.5, 1, 2]);
	});
});

describe("insertRange", function() {
	it("adds a number of items to an array at the given index", function() {
		var target = [0, 1, 2];
		insertRange(target, 1, [0.5, 0.75, 0.9]);
		specs.arrayEquals(target, [0, 0.5, 0.75, 0.9, 1, 2]);
	});
});

describe("of", function () {
	it("creates a new Array instance from a variable number of arguments, regardless of number or type of the arguments", function () {
		specs.arrayEquals(arrayMethods.of(1), [1]);
		specs.arrayEquals(arrayMethods.of(1, 2, 3), [1, 2, 3]);
		specs.arrayEquals(arrayMethods.of(undefined), [undefined]);
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
		specs.arrayEquals(source, target);
		expect(insert).toHaveBeenCalledWith(4, 4);
		
		source = [0, 1, 3, 4];
		source.insert = insert;

		update(source, target);
		specs.arrayEquals(source, target);
		expect(insert).toHaveBeenCalledWith(2, 2);

		source = [1, 2, 3, 4];
		source.insert = insert;

		update(source, target);
		specs.arrayEquals(source, target);
		expect(insert).toHaveBeenCalledWith(0, 0);
	});

	it("turns multiple added items into a single insertRange", function() {
		var source = [2, 3, 4];
		var target = [0, 1, 2, 3, 4];

		var insertRange = jasmine.spyOn(spies, "insertRange").andCallThrough();
		source.insertRange = insertRange;

		update(source, target);
		specs.arrayEquals(source, target);
		expect(insertRange).toHaveBeenCalledWith(0, [0, 1]);

		source = [0, 1, 4];
		source.insertRange = insertRange;

		update(source, target);
		specs.arrayEquals(source, target);
		expect(insertRange).toHaveBeenCalledWith(2, [2, 3]);

		source = [0, 1, 2];
		source.insertRange = insertRange;

		update(source, target);
		specs.arrayEquals(source, target);
		expect(insertRange).toHaveBeenCalledWith(3, [3, 4]);
	});

	it("turns a single removed item into a removeAt", function() {
		var source = [0, 1, 2, 3, 4];
		var target = [1, 2, 3, 4];

		var removeAt = jasmine.spyOn(spies, "removeAt").andCallThrough();
		source.removeAt = removeAt;

		update(source, target);
		specs.arrayEquals(source, target);
		expect(removeAt).toHaveBeenCalledWith(0);

		source = [0, 1, 2, 3, 4];
		source.removeAt = removeAt;
		target = [0, 1, 2, 3];

		update(source, target);
		specs.arrayEquals(source, target);
		expect(removeAt).toHaveBeenCalledWith(4);

		source = [0, 1, 2, 3, 4];
		source.removeAt = removeAt;
		target = [0, 1, 3, 4];

		update(source, target);
		specs.arrayEquals(source, target);
		expect(removeAt).toHaveBeenCalledWith(2);
	});

	it("turns multiple removed items into a removeRange", function() {
		var source = [0, 1, 2, 3, 4];
		var target = [2, 3, 4];

		var removeRange = jasmine.spyOn(spies, "removeRange").andCallThrough();
		source.removeRange = removeRange;

		update(source, target);
		specs.arrayEquals(source, target);
		expect(removeRange).toHaveBeenCalledWith(0, 2);

		source = [0, 1, 2, 3, 4];
		source.removeRange = removeRange;
		target = [0, 1, 2];

		update(source, target);
		specs.arrayEquals(source, target);
		expect(removeRange).toHaveBeenCalledWith(3, 2);

		source = [0, 1, 2, 3, 4];
		source.removeRange = removeRange;
		target = [0, 1, 4];

		update(source, target);
		specs.arrayEquals(source, target);
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
		specs.arrayEquals(source, target);
		expect(removeAt).toHaveBeenCalledWith(2);
		expect(insert).toHaveBeenCalledWith(2, 3);

		source = [0, 1, 2];
		target = [-1, 1, 2];
		source.removeAt = removeAt;
		source.insert = insert;

		update(source, target);
		specs.arrayEquals(source, target);
		expect(removeAt).toHaveBeenCalledWith(0);
		expect(insert).toHaveBeenCalledWith(0, -1);
	});

	it("turns a swap into an add and a remove", function() {
		var source = [6, 4];
		var target = [4, 6];

		update(source, target);
		specs.arrayEquals(source, target);
	});

	it("turns entirely unmatched arrays into a removeRange and insertRange", function() {
		var source = [0, 1, 2, 3];
		var target = [4, 5, 6];

		var removeRange = jasmine.spyOn(spies, "removeRange").andCallThrough();
		source.removeRange = removeRange;
		var insertRange = jasmine.spyOn(spies, "insertRange").andCallThrough();
		source.insertRange = insertRange;

		update(source, target);
		specs.arrayEquals(source, target);
		expect(removeRange).toHaveBeenCalledWith(0, 4);
		expect(insertRange).toHaveBeenCalledWith(0, [4, 5, 6]);
	});

	it("handles miscellaneous combinations of add and remove in arrays with varying degrees of divergences", function() {
		var source = [6, 7, 8, 2, 4, 6];
		var target = [4, 6, 7, 8];
		update(source, target);
		specs.arrayEquals(source, target);

		source = [6, 2, 4];
		target = [4, 6];
		update(source, target);
		specs.arrayEquals(source, target);

		source = [1, 7, 5, 6];
		target = [1, 2, 3, 4, 5, 6];
		update(source, target);
		specs.arrayEquals(source, target);

		source = [0, 1, 5, 6];
		target = [1, 2, 3, 4, 5, 6];
		update(source, target);
		specs.arrayEquals(source, target);
	});
});

// Run Tests
///////////////////////////////////////

jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
