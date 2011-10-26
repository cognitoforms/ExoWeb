// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");

ExoWeb = {};
window = global;

var utilities = require("../../../src/base/core/Utilities");
var functions = require("../../../src/base/core/Function");
var timeSpan = require("../../../src/base/core/TimeSpan");

ExoWeb.Model = {};

var format = require("../../../src/base/model/Format");

ConditionType = function() { };
var formatError = require("../../../src/base/model/FormatError");

FormatError = ExoWeb.Model.FormatError;

Format = ExoWeb.Model.Format;

var formats = require("../../../src/base/model/Formats");

jasmine.jasmine.debug = true;

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;

// Test Suites
///////////////////////////////////////
describe("Date.$json", function() {
	it("converts to and from the JSON representation of a date", function() {
//		var date = new Date();
//		var json = Date.formats.$json.convert(date);
//		expect(json).toBe(JSON.stringify(date));
//		expect(Date.formats.$json.convertBack(json)).toEqual(date);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

