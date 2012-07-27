// Imports
///////////////////////////////////////
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");

jasmine.jasmine.debug = true;

global.window = global;
global.ExoWeb = {};

var random = require("../../../src/base/core/Random");
var randomText = global.randomText = random.randomText;

var typeChecking = require("../../../src/base/core/TypeChecking");
var isNatural = global.isNatural = typeChecking.isNatural;
var isInteger = global.isInteger = typeChecking.isInteger;

var activity = require("../../../src/base/core/Activity");
global.registerActivity = activity.registerActivity;

var functions = require("../../../src/base/core/Function");
var functor = require("../../../src/base/core/Functor");
global.Functor = functor.Functor;

var arrays = require("../../../src/base/core/Array");
var trace = require("../../../src/base/core/Trace");
var utilities = require("../../../src/base/core/Utilities");
var strings = require("../../../src/base/core/String");

global.forEach = arrays.forEach;

var changeSet = require("../../../src/base/mapper/ChangeSet");
global.ChangeSet = changeSet.ChangeSet;

var changeLog = require("../../../src/base/mapper/ChangeLog");
global.ChangeLog = changeLog.ChangeLog;

var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;
var beforeEach = jasmine.beforeEach;

function setup() {
	var log = new ChangeLog();
	log.start("test");
	log.add(1);
	log.add(2);
	log.start("test2");
	log.add(3);

	this.log = log;
}

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
		}).toThrow("[changeLog, error]: ChangeLog.start requires a string source argument.");

		expect(function() {
			(new ChangeLog()).start(5);
		}).toThrow("[changeLog, error]: ChangeLog.start requires a string source argument.");
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
	beforeEach(setup);

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
				source: "server",
				changes: [2]
			},
			{
				source: "server",
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

	it("returns the checkpoint if it is the next change", function() {
		var checkpoint = { type: "Checkpoint", code: "abc" };
		this.log.add(checkpoint);
		expect(this.log.undo()).toBe(checkpoint);
	});
});

describe("ChangeLog.truncate", function() {
	beforeEach(setup);

	it("discards all sets and changes when truncated, creating a new \"client\" set", function() {
		var numRemoved = this.log.truncate();

		expect(numRemoved).toBe(3);
		expect(this.log.sets().length).toBe(1);
		expect(this.log.sets()[0].source()).toBe("client");
		expect(this.log.sets()[0].changes().length).toBe(0);
	});

	it("discards all sets and changes that meet the given filter when truncated", function() {
		var numRemoved = this.log.truncate(function(c) {
			return c > 1;
		});

		expect(numRemoved).toBe(2);
		expect(this.log.sets().length).toBe(2);
		expect(this.log.sets()[0].source()).toBe("test");
		expect(this.log.sets()[0].changes().length).toBe(1);
		expect(this.log.sets()[0].changes()[0]).toBe(1);
		expect(this.log.sets()[1].source()).toBe("client");
		expect(this.log.activeSet().source()).toBe("client");
		expect(this.log.activeSet().changes().length).toBe(0);
	});
	
	it("checkpoint returns undefined if there is not an active set, but adds the checkpoint if there are no changes", function() {
		var log = new ChangeLog();
		expect(log.checkpoint()).toBe(undefined);

		log.start("test");
		expect(log.checkpoint()).not.toBe(undefined);
		log.start("test2");
		expect(log.checkpoint()).not.toBe(undefined);

		log.add(1);
		expect(log.checkpoint()).not.toBe(undefined);
	});

	it("discards all changes and sets up to the given checkpoint", function() {
		var checkpoint = this.log.checkpoint();

		expect(checkpoint).not.toBe(undefined);

		this.log.start("test3");
		this.log.add(4);
		this.log.add(5);

		var numRemoved = this.log.truncate(checkpoint);

		// Checkpoint should be gone in this case since nothing precedes it.
		expect(numRemoved).toBe(3);

		expect(this.log.sets().length).toBe(3);
		expect(this.log.sets()[0].source()).toBe("test2");
		expect(this.log.sets()[0].changes().length).toBe(1);
		expect(this.log.sets()[1].source()).toBe("test3");
		expect(this.log.sets()[1].changes().length).toBe(2);
		expect(this.log.sets()[2].source()).toBe("client");
		expect(this.log.sets()[2].changes().length).toBe(0);
	});
});

describe("ChangeLog.checkpoint", function() {
	beforeEach(setup);

	it("accepts an optional title", function () {
		var checkpoint = this.log.checkpoint("title");
		expect(this.log.sets()
				.mapToArray(function(set) { return set.changes(); })
				.filter(function(c) { return c.type === "Checkpoint" && c.code === checkpoint })[0].title
			).toBe("title");
	});

	it("accepts an optional code", function () {
		var checkpoint = this.log.checkpoint("title", "abcdef");
		expect(checkpoint).toBe("abcdef");
		expect(this.log.sets()
				.mapToArray(function(set) { return set.changes(); })
				.filter(function(c) { return c.type === "Checkpoint" && c.title === "title" })[0].code
			).toBe(checkpoint);
	});
});

describe("ChangeLog.addSet", function() {
	it("allows a set to be added to an active change log", function() {
		var log = new ChangeLog();
		log.start("test");
		expect(log.activeSet().source()).toBe("test");

		var active = log.activeSet();

		log.addSet("test2", [1, 2]);
		expect(log.sets().length).toBe(2);
		expect(log.activeSet()).toBe(active);
	});

	it("adds a non-active set to the change log", function() {
		var changes = [1, 2, 3];
		var log = new ChangeLog();
		log.addSet("test", changes);

		var active = log.activeSet();

		expect(log.sets().length).toBe(1);
		expect(log.sets()[0].changes().length).toBe(3);
		expect(log.sets()[0].changes()).not.toBe(changes);
		expect(log.activeSet()).toBe(active);
	});
});

describe("ChangeLog.count", function() {
	beforeEach(setup);

	it("returns the number of changes in the log", function () {
		expect(this.log.count()).toBe(3);
	});

	it("returns the number of changes that match a given filter", function () {
		expect(this.log.count(function(v) { return v > 2; })).toBe(1);
	});
	
	it("uses thisPtr if provided", function () {
		this.log.val = 1;
		expect(this.log.count(function(v) { return v > this.log.val; }, this)).toBe(2);
	});
});

describe("ChangeLog.set", function() {
	beforeEach(setup);

	it("retrieves the change set at the given index", function() {
		expect(this.log.set(0).source()).toBe("test");
		expect(this.log.set(1).source()).toBe("test2");
	});

	it("raises an error if a valid index is not given", function() {
		var log = this.log;

		expect(function() {
			log.set();
		}).toThrow("The set method expects a numeric index argument.");

		expect(function() {
			log.set("bad");
		}).toThrow("The set method expects a numeric index argument.");
	});

	it("supports negative indices", function() {
		expect(this.log.set(-1).source()).toBe("test2");
		expect(this.log.set(-2).source()).toBe("test");
	});

	it("does not support wrapping", function() {
		expect(this.log.set(-3)).toBe(undefined);
		expect(this.log.set(4)).toBe(undefined);
	});
});

describe("ChangeSet events", function() {
	beforeEach(setup);

	it("exposes an add event which is raised when a new change is added:  fn(change, index, set, log)", function() {
		var onChangeAdded = jasmine.jasmine.createSpy("changeAdded");
		this.log.addChangeAdded(onChangeAdded);
		this.log.add(42);

		expect(onChangeAdded).toHaveBeenCalledWith(42, 1, this.log._activeSet, this.log);
	});

	it("exposes an undo event which is raised when a change is undone:  fn(change, index, set, log)", function() {
		var onChangeUndone = jasmine.jasmine.createSpy("changeUndone");
		this.log.addChangeUndone(onChangeUndone);
		var set = this.log.activeSet();
		this.log.undo();

		expect(onChangeUndone).toHaveBeenCalledWith(3, 0, set, this.log);
	});
	
	it("exposes a set started event which is raised when a new changeset is started:  fn(set, index, log)", function() {
		var onChangeSetStarted = jasmine.jasmine.createSpy("changeSetStarted");
		this.log.addChangeSetStarted(onChangeSetStarted);
		var set = this.log.start("foo");

		expect(onChangeSetStarted).toHaveBeenCalledWith(set, 2, this.log);
	});

	it("exposes a truncated event which is raised when the log is truncated:  fn(numRemoved, log)", function() {
		var onTruncated = jasmine.jasmine.createSpy("truncated");
		this.log.addTruncated(onTruncated);
		this.log.truncate();

		expect(onTruncated).toHaveBeenCalledWith(3, this.log);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
