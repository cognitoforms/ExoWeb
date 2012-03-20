// Imports
///////////////////////////////////////
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");

jasmine.jasmine.debug = true;

var typeChecking = require("../../../src/base/core/TypeChecking");

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;

var type = typeChecking.type;
var isNullOrUndefined = typeChecking.isNullOrUndefined;
var isArray = typeChecking.isArray;
var isString = typeChecking.isString;
var isNumber = typeChecking.isNumber;
var isInteger = typeChecking.isInteger;
var isNatural = typeChecking.isNatural;
var isWhole = typeChecking.isWhole;
var isDecimal = typeChecking.isDecimal;
var isFunction = typeChecking.isFunction;
var isObject = typeChecking.isObject;

// Test Suites
///////////////////////////////////////
describe("type", function() {
	it("returns \"null\" when the argument is a null value", function() {
		expect(type(null)).toBe("null");
	});
	
	it("returns \"undefined\" when the argument is an undefined value", function() {
		expect(type(global.foo)).toBe("undefined");
	});

	it("returns \"object\" when the argument is an ordinary object", function() {
		expect(type({})).toBe("object");
	});

	it("returns \"function\" when the argument is a function", function() {
		expect(type(function() { })).toBe("function");
	});

	it("returns \"string\" when the argument is a string", function() {
		expect(type("")).toBe("string");
	});

	it("returns \"number\" when the argument is a number", function() {
		expect(type(5)).toBe("number");
		expect(type(1.4)).toBe("number");
	});

	it("returns \"boolean\" when the argument is a boolean", function() {
		expect(type(true)).toBe("boolean");
	});

	it("returns \"array\" when the argument is an array", function() {
		expect(type([])).toBe("array");
	});

	it("returns \"date\" when the argument is a date", function() {
		expect(type(new Date())).toBe("date");
	});

	it("returns \"arguments\" when the argument is an arguments object", function() {
		expect(type(arguments)).toBe("arguments");
	});
	
	it("returns \"error\" when the argument is an error", function() {
		expect(type(new Error())).toBe("error");
	});
	
	it("returns \"regexp\" when the argument is a regular expression", function() {
		expect(type(/\s/)).toBe("regexp");
	});
	
	it("returns \"math\" when the argument is the Math object", function() {
		expect(type(Math)).toBe("math");
	});
});

describe("type-specific functions", function() {
	describe("isNullOrUndefined", function() {
		it("returns true if the argument is null or undefined, otherwise returns false", function() {
			expect(isNullOrUndefined(null)).toBe(true);
			expect(isNullOrUndefined(global.foo)).toBe(true);
			expect(isNullOrUndefined({})).toBe(false);
		});
	});

	describe("isArray", function() {
		it("returns true if the argument is an array, otherwise returns false", function() {
			expect(isArray([])).toBe(true);
			expect(isArray(arguments)).toBe(false);
		});
	});

	describe("isString", function() {
		it("returns true if the argument is a string, otherwise returns false", function() {
			expect(isString("")).toBe(true);
			expect(isString([])).toBe(false);
		});
	});

	describe("isNumber", function() {
		it("returns true if the argument is a number, otherwise returns false", function() {
			expect(isNumber(3)).toBe(true);
			expect(isNumber({})).toBe(false);
		});
	});

	describe("isInteger", function() {
		it("returns true if the argument is an integer number, otherwise returns false", function() {
			expect(isInteger(3)).toBe(true);
			expect(isInteger(0)).toBe(true);
			expect(isInteger(5.2)).toBe(false);
			expect(isInteger(-1)).toBe(true);
			expect(isInteger(parseInt("d", 10))).toBe(false);
			expect(isInteger({})).toBe(false);
		});
	});

	describe("isNatural", function() {
		it("returns true if the argument is a natural number, otherwise returns false", function() {
			expect(isNatural(3)).toBe(true);
			expect(isNatural(0)).toBe(false);
			expect(isNatural(5.2)).toBe(false);
			expect(isNatural(-1)).toBe(false);
			expect(isNatural(parseInt("d", 10))).toBe(false);
			expect(isNatural({})).toBe(false);
		});
	});

	describe("isWhole", function() {
		it("returns true if the argument is a whole number, otherwise returns false", function() {
			expect(isWhole(3)).toBe(true);
			expect(isWhole(0)).toBe(true);
			expect(isWhole(5.2)).toBe(false);
			expect(isWhole(-1)).toBe(false);
			expect(isWhole(parseInt("d", 10))).toBe(false);
			expect(isWhole({})).toBe(false);
		});
	});

	describe("isDecimal", function() {
		it("returns true if the argument is a decimal number, otherwise returns false", function() {
			expect(isDecimal(5.2)).toBe(true);
			expect(isDecimal(3)).toBe(false);
			expect(isDecimal(0)).toBe(false);
			expect(isDecimal(-1.5)).toBe(true);
			expect(isDecimal(-1)).toBe(false);
			expect(isDecimal(parseInt("d", 10))).toBe(false);
			expect(isDecimal({})).toBe(false);
		});
	});

	describe("isFunction", function() {
		it("returns true if the argument is a function, otherwise returns false", function() {
			expect(isFunction(function() { })).toBe(true);
			expect(isFunction(global)).toBe(false);
		});
	});

	describe("isObject", function() {
		it("returns true if the argument is an object, otherwise returns false", function() {
			expect(isObject({})).toBe(true);
			expect(isObject(true)).toBe(false);
		});
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
