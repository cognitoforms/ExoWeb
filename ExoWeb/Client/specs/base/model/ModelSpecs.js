// Test setup
///////////////////////////////////////
var specs = require("../../SpecHelpers");

//specs.debug();
specs.ensureWindow();
specs.ensureNamespace("ExoWeb.Model");

//require("../../../src/base/core/Activity");
//require("../../../src/base/core/Function");
//require("../../../src/base/core/Functor");
//require("../../../src/base/core/Array");
//require("../../../src/base/core/Utilities");
//require("../../../src/base/core/EventQueue");

// Imports
///////////////////////////////////////
var typeChecking = specs.require("core.TypeChecking");
specs.require("core.Utilities");
specs.require("model.Model");

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;
var beforeEach = jasmine.beforeEach;

// Test Suites
///////////////////////////////////////
describe("Model", function() {
	it("tracks a collection of types, which is initially empty", function() {
		// TODO: change to "types()"
		var model = new Model();

		expect(typeChecking.type(model._types)).toBe("object");
		expect(objectToArray(model._types).length).toBe(0);

		expect(typeChecking.type(model.get_types())).toBe("array");
		expect(model.get_types().length).toBe(0);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

