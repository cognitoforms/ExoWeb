// Imports
///////////////////////////////////////
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");

jasmine.jasmine.debug = true;

global.window = global;
var ExoWeb = global.ExoWeb = { Model: {} };

Array.dequeue = function Array$dequeue(array) { return array.shift(); };
Array.insert = function Array$dequeue(array, index, value) { return array.splice(index, 0, value); };

var functions = require("../../../src/base/core/Function");
var arrays = require("../../../src/base/core/Array");

// utilities are attached to ExoWeb object
var typeChecking = require("../../../src/base/core/TypeChecking");
global.isObject = typeChecking.isObject;

var utilities = require("../../../src/base/core/Utilities");

// PathTokens is referenced directly
var PathTokens = global.PathTokens = require("../../../src/base/model/PathTokens").PathTokens;

var LazyLoader = require("../../../src/base/model/LazyLoader").LazyLoader;

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;
var beforeEach = jasmine.beforeEach;

// Test Suites
///////////////////////////////////////
describe("eval", function() {
	beforeEach(function() {
		var district = {
			Name: "Some District"
		};

		this.data = {
			context: "123",
			Student: {
				Name: "John Doe",
				School: {
					Name: "Spring Valley High",
					District: district
				}
			}
		};

		global.context = {
			district: district
		};
		global.foo = {
			bar: true
		};
	});

	it("calls the success function with the path value", function() {
		var success = jasmine.jasmine.createSpy();
		var failure = jasmine.jasmine.createSpy();
		LazyLoader.eval(this.data, "Student.Name", success, failure);
		expect(success).toHaveBeenCalledWith("John Doe", false, this.data);
		expect(failure).not.toHaveBeenCalled();
	});
	
	it("falls back to the global (window) object", function() {
		var success = jasmine.jasmine.createSpy();
		var failure = jasmine.jasmine.createSpy();
		LazyLoader.eval(this.data, "foo.bar", success, failure);
		expect(success).toHaveBeenCalledWith(true, false, global);
		expect(failure).not.toHaveBeenCalled();
	});

	it("falls back to the global (window) object even if part of the path was evaluated", function() {
		var success = jasmine.jasmine.createSpy();
		var failure = jasmine.jasmine.createSpy();
		LazyLoader.eval(this.data, "context.district.Name", success, failure);
		expect(success).toHaveBeenCalledWith("Some District", false, global);
		expect(failure).not.toHaveBeenCalled();
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

