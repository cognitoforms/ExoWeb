// Imports
///////////////////////////////////////
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");

jasmine.jasmine.debug = true;

var random = require("../../../src/base/core/Random");
var typeChecking = require("../../../src/base/core/TypeChecking");

isInteger = typeChecking.isInteger;
isNatural = typeChecking.isNatural;

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;

var randomInteger = random.randomInteger;
var randomText = random.randomText;

var rand = 0;
var onRandom = null;
Math.random = function() {
	if (onRandom) {
		onRandom();
	}
	return rand;
};

// Test Suites
///////////////////////////////////////
describe("randomInteger", function() {
	it("returns a random integer from 0 to 9 if no arguments are given", function() {
		var exp = 0;
		for (rand = 0.01; rand < 1; rand += 0.1, exp++) {
			expect(randomInteger()).toBe(exp);
		}
	});

	it("returns a random integer from 0 to the argument if one positive argument is given", function() {
		var exp = 0;
		for (rand = 0.01; rand < 1; rand += 0.2, exp++) {
			expect(randomInteger(5)).toBe(exp);
		}
	});

	it("returns a random integer from the argument to zero if one negative argument is given", function() {
		var exp = -5;
		for (rand = 0.01; rand < 1; rand += 0.2, exp++) {
			expect(randomInteger(-5)).toBe(exp);
		}
	});

	it("returns a random integer from the first argument to the second argument if both are given", function() {
		var exp = 2;
		for (rand = 0.01; rand < 1; rand += 0.2, exp++) {
			expect(randomInteger(2, 7)).toBe(exp);
		}

		exp = -2;
		for (rand = 0.01; rand < 1; rand += 0.2, exp++) {
			expect(randomInteger(-2, 3)).toBe(exp);
		}
	});

	it("throws an error if the first argument is greater than or equal to the second argument", function() {
		expect(function() { randomInteger(5, 2); }).toThrow("Minimum argument must be less than maximum argument.");
	});

	it("throws an error if either argument is not an integer", function() {
		expect(function() { randomInteger(0.2); }).toThrow("Minimum argument must be an integer.");
		expect(function() { randomInteger(0.2, 1); }).toThrow("Minimum argument must be an integer.");
		expect(function() { randomInteger(0, 5.5); }).toThrow("Maximum argument must be an integer.");
	});
});

describe("randomText", function() {
	it("returns a random string of characters of the given length", function() {
		var chars = "abc", i = 0;
		rand = 0;
		var i = 0;
		onRandom = function() {
			rand = i++ / 26;
		};

		expect(randomText(3)).toBe("abc");
	});

	it("throws an error if the length argument is not given or is not a natural number", function() {
		expect(function() { randomText(); }).toThrow("Length argument is required.");
		expect(function() { randomText(-5); }).toThrow("Length argument must be a natural number.");
		expect(function() { randomText(3.2); }).toThrow("Length argument must be a natural number.");
		expect(function() { randomText(0); }).toThrow("Length argument must be a natural number.");
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
