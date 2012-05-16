/// <reference path="../SpecDependencies.js" />
/// <reference path="../SpecHelpers.js" />

// Test setup
///////////////////////////////////////
var specs = require("../../SpecHelpers");

specs.debug();
specs.ensureWindow();
specs.ensureNamespace("ExoWeb.Model");
specs.ensureNamespace("ExoWeb.Mapper");

// Imports
///////////////////////////////////////
var ObjectLazyLoader = specs.require("mapper.ObjectLazyLoader").ObjectLazyLoader;

specs.require("core.Trace");

// Constants
///////////////////////////////////////
var logCategories = ["objectInit", "lazyLoad"];

// Test Suites
///////////////////////////////////////
describe("ObjectLazyLoader", function() {
	it("verifies that an object is of a server-origin type when registered", function() {
		var logError = ExoWeb.trace.logError;
		var newLogError = jasmine.jasmine.createSpy();
		ExoWeb.trace.logError = newLogError;

		var mockObj = {
			meta: {
				id: "1",
				type: {
					get_fullName: function() { return "Foo"; },
					get_origin: function() { return "client"; }
				}
			}
		};

		ObjectLazyLoader.register(mockObj);

		expect(newLogError).toHaveBeenCalledWith(logCategories, "Cannot lazy load instance of non-server-origin type: {0}({1})", "Foo", "1");

		ExoWeb.trace.logError = logError;
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
