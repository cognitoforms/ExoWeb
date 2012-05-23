// Test setup
///////////////////////////////////////

var specs = require("../../SpecHelpers");

specs.debug();
specs.ensureWindow();

// Imports
///////////////////////////////////////

var signalModule = specs.require("core.Signal");

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

