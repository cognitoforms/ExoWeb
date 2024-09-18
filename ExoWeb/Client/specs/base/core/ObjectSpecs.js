// Test setup
///////////////////////////////////////

var specs = require("../../SpecHelpers");

//specs.debug();
specs.ensureWindow();

// Imports
///////////////////////////////////////

var objectMethods = specs.require("core.Object");

// Test Suites
///////////////////////////////////////

describe("assign", function() {
	it("copies all enumerable own properties from one or more source objects to a target object", function () {
		var obj = { foo: 'bar' };
		objectMethods.assign(obj, { value: 42 });
		expect(obj).toEqual({ foo: 'bar', value: 42 });
	});
});

describe("entries", function () {
	it("returns an array of a given object's own enumerable string-keyed property [key, value] pairs", function () {
		var obj = { foo: 'bar', value: 42 };
		var entries = objectMethods.entries(obj);
		specs.arrayEquals(entries, [['foo', 'bar'], ['value', 42]]);
	});
});

// Run Tests
///////////////////////////////////////

jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

