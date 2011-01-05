// Imports
///////////////////////////////////////
var jasmine = require("../jasmine");
var jasmineConsole = require("../jasmine.console");

window = {};
ExoWeb = window.ExoWeb = {};
ExoWeb.Model = {};

var functions = require("../../lib/core/Function");
var arrays = require("../../lib/core/Array");

var pathTokens = require("../../lib/model/PathTokens");

// References
///////////////////////////////////////
var PathTokens = ExoWeb.Model.PathTokens;
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;

// Test Suites
///////////////////////////////////////
describe("PathTokens", function() {
	it("can parse a simple path", function() {
		var path = new PathTokens("a.b.c");
		expect(path.steps.length).toBe(3);
		expect(path.steps[0].property).toBe("a");
		expect(path.steps[1].property).toBe("b");
		expect(path.steps[2].property).toBe("c");
	});
	
	it("can interpret casts", function() {
		var path = new PathTokens("a.b<B>.c");
		expect(path.steps[1].cast).toBe("B");
	});
	
	it("can handle alphanum, underscore, and period in casts", function() {
		var path = new PathTokens("a.b<B4>.c<C._4>.d");
		expect(path.steps.length).toBe(4);
		expect(path.steps[1].cast).toBe("B4");
		expect(path.steps[2].cast).toBe("C._4");
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

