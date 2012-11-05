// Test setup
///////////////////////////////////////
var specs = require("../../SpecHelpers");

//specs.debug();
specs.ensureWindow();
specs.ensureNamespace("ExoWeb.Model");
specs.ensureNamespace("ExoWeb.Mapper");

// Imports
///////////////////////////////////////
var property = specs.require("model.Property");
var serverSync = specs.require("mapper.ServerSync");

// Test Suites
///////////////////////////////////////
describe("ServerSync", function() {
	it("throws an error if the model argument is not provided", function() {
		expect(function() {
			var server = new ExoWeb.Mapper.ServerSync();
		}).toThrow("Argument 'model' cannot be null or undefined.");

		expect(function() {
			var server = new ExoWeb.Mapper.ServerSync("junk");
		}).toThrow("Argument 'model' must be of type model: junk.");
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
