// Imports
///////////////////////////////////////
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");
var stringMethods = require("../../../src/base/core/String");
const { arrayEquals } = require("../../SpecHelpers");

var isNullOrEmpty = stringMethods.isNullOrEmpty;

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

describe("endsWith", function () {
	it("determines whether a string ends with the characters of a specified string", function () {
		var str = "truthfully";
		expect(stringMethods.endsWith(str, "ly")).toBe(true);
		expect(stringMethods.endsWith(str, "lee")).toBe(false);
	});
	it("takes an optional length argument", function () {
		var str = "Cats are the best!";
		expect(stringMethods.endsWith(str, "best")).toBe(false);
		expect(stringMethods.endsWith(str, "best", 17)).toBe(true);
	});
});

describe("includes", function () {
	it("performs a case-sensitive search to determine whether one string may be found within another string", function () {
		var str = "The quick brown fox jumps over the lazy dog.";
		expect(stringMethods.includes(str, "fox")).toBe(true);
		expect(stringMethods.includes(str, "Fox")).toBe(false);
	});
	it("takes an optional start position argument", function () {
		var str = "The quick brown fox jumps over the lazy dog.";
		expect(stringMethods.includes(str, "The")).toBe(true);
		expect(stringMethods.includes(str, "The", 10)).toBe(false);
	});
});

describe("matchAll", function () {
	it("returns an iterator of all results matching a string against a regular expression, including capturing groups", function () {
		var str = "test1test2";
		var results = stringMethods.matchAll(str, /t(e)(st(\d?))/g);
		expect(results.length).toBe(2);
		arrayEquals(results[0], ["test1", "e", "st1", "1"]);
		arrayEquals(results[1], ["test2", "e", "st2", "2"]);
	});
	it("implicitly converted to a RegExp if a string argument is passed", function () {
		var str = "This is a test";
		var results = stringMethods.matchAll(str, "[a-f]+");
		expect(results.length).toBe(2);
		arrayEquals(results[0], ["a"]);
		arrayEquals(results[1], ["e"]);
	});
});

describe("padEnd", function () {
	it("pads the current string with a given string (repeated, if needed) so that the resulting string reaches a given length", function () {
		var str1 = 'Breaded Mushrooms';
		expect(stringMethods.padEnd(str1, 25, '.')).toBe("Breaded Mushrooms........");
	});
	it("uses a default pad string of ' '", function () {
		var str2 = '200';
		expect(stringMethods.padEnd(str2, 5)).toBe("200  ");
	});
});

describe("padStart", function () {
	it("pads the current string with another string (multiple times, if needed) until the resulting string reaches the given length", function () {
		var str1 = "7";
		expect(stringMethods.padStart(str1, 3, '0')).toBe("007");
	});
	it("uses a default pad string of ' '", function () {
		var str2 = 'Test:';
		expect(stringMethods.padStart(str2, 10)).toBe("     Test:");
	});
});

describe("repeat", function () {
	it("constructs and returns a new string which contains the specified number of copies of the string on which it was called, concatenated together", function () {
		var str = "abc";
		expect(stringMethods.repeat(str, 3)).toBe("abcabcabc");
	});
});

describe("replaceAll", function () {
	it("returns a new string with all matches of a pattern replaced by a replacement", function () {
		var str = "This is a test";
		expect(stringMethods.replaceAll(str, 'i', 'I')).toBe("ThIs Is a test");
	});
});

describe("startsWith", function () {
	it("determines whether a string begins with the characters of a specified string", function () {
		var str = "Testing 123";
		expect(stringMethods.startsWith(str, "Test")).toBe(true);
		expect(stringMethods.startsWith(str, "test")).toBe(false);
	});
});

describe("trimEnd", function () {
	it("removes whitespace from the end of a string", function () {
		var str = "abc   ";
		expect(stringMethods.trimEnd(str)).toBe("abc");
	});
});

describe("trimStart", function () {
	it("removes whitespace from the beginning of a string", function () {
		var str = "   abc";
		expect(stringMethods.trimStart(str)).toBe("abc");
	});
});



// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

