window = {};
ExoWeb = {};

// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");

jasmine.jasmine.debug = true;

var arrays = require("../../../src/base/core/Array");
var functions = require("../../../src/base/core/Function");
var functionChain = require("../../../src/base/core/FunctionChain");
var trace = require("../../../src/base/core/Trace");
var utilities = require("../../../src/base/core/Utilities");

$format = window.$format;

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;
var beforeEach = jasmine.beforeEach;
var FunctionChain = functionChain.FunctionChain;

// Test Suites
///////////////////////////////////////
describe("Function Chain", function() {
	beforeEach(function() {
		var result = "";
		this.chain = new FunctionChain([
			function(callback, thisPtr) {
				console.log("step 1");
				result += "H";
				callback.call(thisPtr || this);
			},
			function(callback, thisPtr) {
				console.log("step 2");
				result += "ello ";
				callback.call(thisPtr || this);
			},
			function(callback, thisPtr) {
				console.log("step 3");
				result += "World!";
				callback.call(thisPtr || this);
			}
		]);

		this.getResult = function() {
			return result;
		};
	});

	it("invokes each step in sequence, then the given callback", function() {
		this.chain.invoke();
		expect(this.getResult()).toBe("Hello World!");
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

