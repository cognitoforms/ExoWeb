// Imports
///////////////////////////////////////
var jasmine = require("../jasmine");
var jasmineConsole = require("../jasmine.console");

window = {};
ExoWeb = window.ExoWeb = {};

var functions = require("../../lib/core/Function");
var arrays = require("../../lib/core/Array");
var signal = require("../../lib/core/Signal");

// References
///////////////////////////////////////
var Signal = ExoWeb.Signal;
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;

// Test Suites
///////////////////////////////////////
describe("synchronous signal", function() {
	var signal0;
	var callback0;
	var isDone = false;

	it("is *NOT* done before pending callback is invoked", function() {
		signal0 = new Signal("0");
		callback0 = signal0.pending(null, this, true);

		signal0.waitForAll(function() {
			isDone = true;
		}, this, true);

		expect(isDone).toBe(false);
	});

	it("is done after the pending callback is invoked", function() {
		callback0();
		expect(isDone).toBe(true);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

