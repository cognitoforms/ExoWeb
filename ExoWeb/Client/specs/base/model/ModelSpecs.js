// Imports
///////////////////////////////////////
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");

jasmine.jasmine.debug = true;

global.window = global;
var ExoWeb = global.ExoWeb = { Model: {} };

require("../../../src/base/core/Activity");
require("../../../src/base/core/Function");
require("../../../src/base/core/Functor");
require("../../../src/base/core/Array");
require("../../../src/base/core/Utilities");
require("../../../src/base/core/EventQueue");

var typeChecking = require("../../../src/base/core/TypeChecking");

require("../../../src/base/model/Model");

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;
var beforeEach = jasmine.beforeEach;

// Test Suites
///////////////////////////////////////
describe("Model", function() {
	it("contains a dictionary of types, which is initially empty", function() {
		var model = new ExoWeb.Model.Model();
		expect(typeChecking.type(model._types)).toBe("object");
		expect(ExoWeb.objectToArray(model._types).length).toBe(0);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

