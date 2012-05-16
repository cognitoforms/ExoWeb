// Test setup
///////////////////////////////////////
var specs = require("../../SpecHelpers");

specs.debug();
specs.ensureWindow();
specs.ensureNamespace("ExoWeb.Model");
specs.ensureNamespace("ExoWeb.Mapper");

// Imports
///////////////////////////////////////
var serverSync = specs.require("mapper.ServerSync");

// Test Suites
///////////////////////////////////////
describe("ServerSync", function() {
	it("throws an error if the model argument is not provided", function() {
		expect(function() {
			var server = new ExoWeb.Mapper.ServerSync();
		}).toThrow("[server, error]: A model must be specified when constructing a ServerSync object.");

		expect(function() {
			var server = new ExoWeb.Mapper.ServerSync("junk");
		}).toThrow("[server, error]: A model must be specified when constructing a ServerSync object.");
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
