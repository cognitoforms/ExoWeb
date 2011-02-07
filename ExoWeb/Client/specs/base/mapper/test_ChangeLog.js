// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");

jasmine.jasmine.debug = true;

window = {};
ExoWeb = {};

var functions = require("../../../src/base/core/Function");
var arrays = require("../../../src/base/core/Array");
var trace = require("../../../src/base/core/Trace");
var utilities = require("../../../src/base/core/Utilities");

$format = window.$format;

// References
///////////////////////////////////////
ChangeLog = require("../../../src/base/mapper/ChangeLog").ChangeLog;
ChangeSet = require("../../../src/base/mapper/ChangeSet").ChangeSet;

var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;
var beforeEach = jasmine.beforeEach;

// Test Suites
///////////////////////////////////////
describe("ChangeLog", function() {
	it("initially has no sets", function() {
		expect((new ChangeLog()).sets().length).toBe(0);
	});

	it("throws an error if a change is added before starting", function() {
		expect(function() {
			(new ChangeLog()).add(5);
		}).toThrow("The change log is not currently active.");
	});

	it("requires a string source when calling start", function() {
		expect(function() {
			(new ChangeLog()).start();
		}).toThrow("ChangeLog.start requires a string source argument.");

		expect(function() {
			(new ChangeLog()).start(5);
		}).toThrow("ChangeLog.start requires a string source argument.");
	});

	it("allows a change to be added after calling start", function() {
		var log = new ChangeLog();
		log.start("test");
		log.add(5);
		
		expect(log.sets().length).toBe(1);
		expect(log.sets()[0].changes().length).toBe(1);
		expect(log.sets()[0].changes()[0]).toBe(5);
	});
});

describe("ChangeLog", function() {
	beforeEach(function() {
		var log = new ChangeLog();
		log.start("test");
		log.add(1);
		log.add(2);
		log.start("test2");
		log.add(3);

		this.log = log;
	});

	it("pushes new changes onto the new set after calling start a second time", function() {
		expect(this.log.sets().length).toBe(2);
		expect(this.log.sets()[0].changes().length).toBe(2);
		expect(this.log.sets()[1].changes().length).toBe(1);
		expect(this.log.sets()[1].changes()[0]).toBe(3);
		expect(this.log.activeSet().source()).toBe("test2");
	});

	it("serializes only changes that pass a given filter", function() {
		expect(this.log.serialize(function(c) {
			return c > 1;
		})).toEqual([
			{
				source: "test",
				changes: [2]
			},
			{
				source: "test2",
				changes: [3]
			}
		]);
	});
	
	it("returns the last change added", function() {
		expect(this.log.lastChange()).toBe(3);
	});
	
	it("returns null if undo is called and there are no changes", function() {
		var log = new ChangeLog();
		log.start("test");
		expect(log.undo()).toEqual(null);
	});

	it("cannot undo if the log is not active", function() {
		expect(function() {
			(new ChangeLog()).undo();
		}).toThrow("The change log is not currently active.");
	});

	it("undo removes and returns the last change", function() {
		var lastChange = this.log.lastChange();
		var change = this.log.undo();
		expect(this.log.sets().length).toBe(2);
		expect(this.log.activeSet().source()).toBe("test2");
		expect(this.log.activeSet().changes().length).toBe(0);
		expect(change).toBe(lastChange);
	});

	it("undo steps over empty sets", function() {
		// create an empty set
		this.log.start("test3");

		var change = this.log.undo();
		expect(this.log.sets().length).toBe(2);
		expect(this.log.activeSet().source()).toBe("test2");
		expect(this.log.activeSet().changes().length).toBe(0);
		expect(change).toBe(3);
	});

	it("discards all sets and changes when truncated, creating a new \"client\" set", function() {
		this.log.truncate();

		expect(this.log.sets().length).toBe(1);
		expect(this.log.sets()[0].source()).toBe("client");
		expect(this.log.sets()[0].changes().length).toBe(0);
	});

	it("discards all sets and changes that meet the given filter when truncated", function() {
		this.log.truncate(function(c) {
			return c > 1;
		});

		expect(this.log.sets().length).toBe(2);
		expect(this.log.sets()[0].source()).toBe("test");
		expect(this.log.sets()[0].changes().length).toBe(1);
		expect(this.log.sets()[0].changes()[0]).toBe(1);
		expect(this.log.sets()[1].source()).toBe("client");
		expect(this.log.activeSet().source()).toBe("client");
		expect(this.log.activeSet().changes().length).toBe(0);
	});
});

describe("ChangeLog.addSet", function() {
	it("will throws an error when the log is active", function() {
		var log = new ChangeLog();
		log.start("test");

		expect(function() {
			log.addSet([1, 2], "test2");
		}).toThrow("Cannot store init changes in an active change log.");
	});

	it("adds a non-active set to the change log", function() {
		var changes = [1, 2, 3];
		var log = new ChangeLog();
		log.addSet("test", changes);

		expect(log.sets().length).toBe(1);
		expect(log.sets()[0].changes().length).toBe(3);
		expect(log.sets()[0].changes()).not.toBe(changes);
		expect(log.activeSet()).toBe(null);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
