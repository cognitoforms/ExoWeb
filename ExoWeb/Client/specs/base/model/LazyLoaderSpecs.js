// Imports
///////////////////////////////////////
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");

jasmine.jasmine.debug = true;

global.window = global;
var ExoWeb = global.ExoWeb = { Model: {} };

Array.insert = function Array$dequeue(array, index, value) { return array.splice(index, 0, value); };

var config = require("../../../src/base/core/Config");
global.config = config.config;

var activity = require("../../../src/base/core/Activity");
global.registerActivity = activity.registerActivity;
var functions = require("../../../src/base/core/Function");
var functor = require("../../../src/base/core/Functor");
global.Functor = functor.Functor;
var arrays = require("../../../src/base/core/Array");

var signal = require("../../../src/base/core/Signal");
global.Signal = signal.Signal;

// utilities are attached to ExoWeb object
var typeChecking = require("../../../src/base/core/TypeChecking");
global.isObject = typeChecking.isObject;

var utilities = require("../../../src/base/core/Utilities");
global.isType = utilities.isType;
global.getValue = utilities.getValue;

// PathTokens is referenced directly
var Property = global.Property = require("../../../src/base/model/Property").Property;
var PropertyChain = global.PropertyChain = require("../../../src/base/model/PropertyChain").PropertyChain;
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
		var success = jasmine.jasmine.createSpy("success");
		var failure = jasmine.jasmine.createSpy("failure").andCallFake(function(e) {
			console.log(e);
		});
		LazyLoader.eval(this.data, "Student.Name", success, failure);
		expect(failure).not.toHaveBeenCalled();
		expect(success).toHaveBeenCalledWith("John Doe", false, this.data);
	});
	
	it("falls back to the global (window) object", function() {
		var success = jasmine.jasmine.createSpy("success");
		var failure = jasmine.jasmine.createSpy("failure").andCallFake(function(e) {
			console.log(e);
		});
		LazyLoader.eval(this.data, "foo.bar", success, failure);
		expect(failure).not.toHaveBeenCalled();
		expect(success).toHaveBeenCalledWith(true, false, global);
	});

	it("falls back to the global (window) object even if part of the path was evaluated", function() {
		var success = jasmine.jasmine.createSpy("success");
		var failure = jasmine.jasmine.createSpy("failure").andCallFake(function(e) {
			console.log(e);
		});
		LazyLoader.eval(this.data, "context.district.Name", success, failure);
		expect(failure).not.toHaveBeenCalled();
		expect(success).toHaveBeenCalledWith("Some District", false, global);
	});
});

describe("evalAll", function() {
	beforeEach(function() {
		this.data = {
			context: "123",
			Students: [{
				Name: "John Doe"
			}, {
				Name: "Jane Doe"
			}],
			Districts: [{
				Schools: [{
					Name: "School 1"
				}, {
					Name: "School 2"
				}]
			}, {
				Schools: [{
					Name: "School 3"
				}, {
					Name: "School 4"
				}]
			}]
		};
	});

	it("is equivalent to eval when no arrays exist on the path", function() {
		var success = jasmine.jasmine.createSpy("success");
		var failure = jasmine.jasmine.createSpy("failure").andCallFake(function(e) {
			console.log(e);
		});
		LazyLoader.evalAll(this.data, "context", success, failure);
		expect(failure).not.toHaveBeenCalled();
		expect(success).toHaveBeenCalledWith("123", false, this.data);
	});

	it("returns all values for the path", function() {
		var success = jasmine.jasmine.createSpy("success");
		var failure = jasmine.jasmine.createSpy("failure").andCallFake(function(e) {
			console.log(e);
		});
		LazyLoader.evalAll(this.data, "Students.Name", success, failure);
		expect(failure).not.toHaveBeenCalled();
		expect(success).toHaveBeenCalledWith(["John Doe", "Jane Doe"], false, this.data);
	});

	it("returns an n-dimensional array depending on the level of nested arrays", function() {
		var success = jasmine.jasmine.createSpy("success");
		var failure = jasmine.jasmine.createSpy("failure").andCallFake(function(e) {
			console.log(e);
		});
		LazyLoader.evalAll(this.data, "Districts.Schools.Name", success, failure);
		expect(failure).not.toHaveBeenCalled();
		expect(success).toHaveBeenCalledWith([["School 1", "School 2"], ["School 3", "School 4"]], false, this.data);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

