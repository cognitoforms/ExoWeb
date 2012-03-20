// Imports
///////////////////////////////////////
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");

ExoWeb = {};
var eventQueue = require("../../../src/base/core/EventQueue");

jasmine.jasmine.debug = true;

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;
var beforeEach = jasmine.beforeEach;

// Test Suites
///////////////////////////////////////

describe("EventQueue", function() {
	it("raises events immediately if queueing has not been enabled", function() {
		var value = 0;
		var queue = new ExoWeb.EventQueue(function(amount) {
			value += amount;
		});

		queue.push(5);
		expect(value).toBe(5);
	});

	it("defers raising events until queueing is stopped", function() {
		var value = 0;
		var queue = new ExoWeb.EventQueue(function(amount) {
			value += amount;
		});

		queue.startQueueing();
		queue.push(5);
		queue.push(-1);
		expect(value).toBe(0);
		queue.stopQueueing();
		expect(value).toBe(4);
	});

	it("only raises distinct events according to the equality function", function() {
		var value = 0;
		var queue = new ExoWeb.EventQueue(
			function(amount) {
				value += amount;
			},
			function(amount) {
				return amount === amount;
			}
		);

		queue.push(5);
		queue.push(5);
		expect(value).toBe(10);

		value = 0;
		queue.startQueueing();
		queue.push(5);
		queue.push(5);
		queue.stopQueueing();
		expect(value).toBe(5);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
