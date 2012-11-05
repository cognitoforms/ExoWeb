/// <reference path="../SpecDependencies.js" />
/// <reference path="../SpecHelpers.js" />

// Test setup
///////////////////////////////////////
var specs = require("../../SpecHelpers");

//specs.debug();
specs.ensureWindow();
specs.ensureNamespace("ExoWeb.Model");
specs.ensureNamespace("ExoWeb.Mapper");

// Imports
///////////////////////////////////////
var objectLazyLoader = specs.require("mapper.ObjectLazyLoader");
var ObjectLazyLoader = objectLazyLoader.ObjectLazyLoader;
var instance = objectLazyLoader.instance;

// Test Suites
///////////////////////////////////////
describe("ObjectLazyLoader.register", function() {
	it("verifies that an object is of a server-origin type", function() {
		var mockObj = {
			meta: {
				id: "1",
				type: {
					get_fullName: function() { return "Foo"; },
					get_origin: function() { return "client"; }
				}
			}
		};

		expect(function() {
			ObjectLazyLoader.register(mockObj);
		}).toThrow("Cannot lazy load instance of non-server-origin type: Foo|1");
	});
});

describe("ObjectLazyLoader.getRelativePathsForType", function() {
	it("returns an empty array if no arguments are passed", function() {
		specs.arrayEquals(ObjectLazyLoader.getRelativePathsForType(), []);
	});

	it("returns an empty array if type argument is null or undefined", function() {
		specs.arrayEquals(ObjectLazyLoader.getRelativePathsForType(null), []);
		specs.arrayEquals(ObjectLazyLoader.getRelativePathsForType(undefined), []);
	});

	it("returns an empty array if no type paths have been added", function() {
		specs.arrayEquals(ObjectLazyLoader.getRelativePathsForType({}), []);
	});

	it("returns paths that have been added for a type", function() {
		// Mock type path information
		instance._typePaths["Foo"] = [{ expression: "this.Prop1" }];
		Model = {
			property: function(path, mtype) {
				return {
					path: path,
					get_isStatic: function() { return false; },
					rootedPath: function(type) { return this.path; }
				};
			},
			getJsType: function(name) {
				return { meta: {} };
			}
		};

		// Perform assertions
		specs.arrayEquals(ObjectLazyLoader.getRelativePathsForType({}), ["this.Prop1"]);

		// Remove mocked data
		instance._typePaths["Foo"] = [{ expression: "this.Prop1" }];
		Model = null;
		instance._typePaths = {};
	});

	it("does not return duplicate paths", function() {
		// Mock type path information
		instance._typePaths["Foo"] = [{ expression: "this.Prop1" }, { expression: "this.Prop1" }];
		Model = {
			property: function(path, mtype) {
				return {
					path: path,
					get_isStatic: function() { return false; },
					rootedPath: function(type) { return this.path; }
				};
			},
			getJsType: function(name) {
				return { meta: {} };
			}
		};

		// Perform assertions
		specs.arrayEquals(ObjectLazyLoader.getRelativePathsForType({}), ["this.Prop1"]);

		// Remove mocked data
		Model = null;
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
