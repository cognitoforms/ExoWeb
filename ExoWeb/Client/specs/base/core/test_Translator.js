// Imports
///////////////////////////////////////
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");

window = {};
ExoWeb = window.ExoWeb = {};

var functions = require("../../../src/base/core/Function");
var arrays = require("../../../src/base/core/Array");
var translator = require("../../../src/base/core/Translator");
var trace = require("../../../src/base/core/Trace");

// References
///////////////////////////////////////
var Translator = ExoWeb.Translator;
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;

// Test Suites
///////////////////////////////////////
describe("translator", function() {
	var t = new Translator();

	console.log(">> adding \"+c0\" <--> \"?1\"");
	t.add("Ids", "+c0", "?1");

	it("keeps forward and reverse entries", function() {
		expect(t.forward("Ids", "+c0")).toBe("?1");
		expect(t.reverse("Ids", "?1")).toBe("+c0");
	});

	it("allows you to suppress the reverse entry", function() {
		console.log(">> adding \"f14f2678-6481-43bd-9a53-682f1fa8d45e\" <--> \"?1\"");
		t.add("Ids", "f14f2678-6481-43bd-9a53-682f1fa8d45e", "?1", true);

		expect(t.forward("Ids", "f14f2678-6481-43bd-9a53-682f1fa8d45e")).toBe("?1");
		expect(t.reverse("Ids", "?1")).toBe("+c0");
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

