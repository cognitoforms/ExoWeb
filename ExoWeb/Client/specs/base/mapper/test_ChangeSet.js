// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");

jasmine.jasmine.debug = true;

global.window = global;
global.ExoWeb = {};

var activity = require("../../../src/base/core/Activity");
var functions = require("../../../src/base/core/Function");
var functor = require("../../../src/base/core/Functor");
global.Functor = ExoWeb.Functor;

var arrays = require("../../../src/base/core/Array");
var trace = require("../../../src/base/core/Trace");
var utilities = require("../../../src/base/core/Utilities");

var changeSet = require("../../../src/base/mapper/ChangeSet");
global.ChangeSet = changeSet.ChangeSet;

var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;
var beforeEach = jasmine.beforeEach;

function setup() {
	var set = new ChangeSet("client");
	set.add(1);
	set.add(2);
	set.add(3);

	this.set = set;
}

// Test Suites
///////////////////////////////////////
describe("ChangeSet", function() {
	it("throws an error if a string source is not given", function() {
		expect(function() {
			(new ChangeSet());
		}).toThrow("Creating a change set requires a string source argument.");

		expect(function() {
			(new ChangeSet(5));
		}).toThrow("Creating a change set requires a string source argument.");
	});

	it("initially has no changes", function() {
		expect((new ChangeSet("test")).changes().length).toBe(0);
	});

	it("stores an added change and returns it with a call to changes", function() {
		var set = new ChangeSet("test");

		expect(set.changes().length).toBe(0);

		var result = set.add(5);

		expect(result).toBe(0);
		expect(set.changes().length).toBe(1);
		expect(set.changes()[0]).toBe(5);
	});

	it("accepts initial set of changes", function() {
		var changes = [0, 1, 2];
		var set = new ChangeSet("test", changes);
		expect(set.changes()).not.toBe(changes);
		expect(set.changes().length).toBe(3);
	});
});

describe("ChangeSet", function() {
	beforeEach(setup);

	it("serializes only changes that pass a given filter", function() {
		expect(this.set.serialize(function(c) {
			return c > 1;
		})).toEqual({
			source: "client",
			changes: [2, 3]
		});
	});
	
	it("serializes source as server unless it is client or init", function() {
		var set = new ChangeSet("client");
		set.add(2);
		set.add(3);

		expect(set.serialize()).toEqual({
			source: "client",
			changes: [2, 3]
		});
		
		set = new ChangeSet("init");
		set.add(2);
		set.add(3);

		expect(set.serialize()).toEqual({
			source: "init",
			changes: [2, 3]
		});
		
		function rand(num) {
			var result = "";
			for (var i = 0; i < num; i++) {
				result += String.fromCharCode(65 + Math.floor(Math.random()*26));
			}
			return result;
		}

		for (var i = 0; i < 10; i++) {
			set = new ChangeSet(rand(5));
			set.add(2);
			set.add(3);

			expect(set.serialize()).toEqual({
				source: "server",
				changes: [2, 3]
			});
		}
	});
	
	it("returns the last change added", function() {
		expect(this.set.lastChange()).toBe(3);
	});
	
	it("returns null if undo is called and there are no changes", function() {
		var set = new ChangeSet("test");
		expect(set.undo()).toEqual(null);
	});

	it("undo removes and returns the last change", function() {
		var lastChange = this.set.lastChange();
		var change = this.set.undo();
		expect(this.set.changes().length).toBe(2);
		expect(change).toBe(lastChange);
	});

	it("discards all sets and changes when truncated", function() {
		this.set.truncate();
		expect(this.set.changes().length).toBe(0);
	});

	it("discards all sets and changes that meet the given filter when truncated", function() {
		this.set.truncate(function(c) {
			return c > 1;
		});

		expect(this.set.changes().length).toBe(1);
		expect(this.set.changes()[0]).toBe(1);
	});
});

describe("ChangeSet.count", function() {
	beforeEach(setup);

	it("returns the number of changes in the set", function () {
		expect(this.set.count()).toBe(3);
		
	});

	it("returns the number of changes that match a given filter", function () {
		expect(this.set.count(function(v) { return v > 2; })).toBe(1);
	});
	
	it("uses thisPtr if provided", function () {
		this.set.val = 1;
		expect(this.set.count(function(v) { return v > this.set.val; }, this)).toBe(2);
	});
});

describe("ChangeSet events", function() {
	beforeEach(setup);

	it("exposes an add event which is raised when a new change is added:  fn(change, index, set)", function() {
		var onChangeAdded = jasmine.jasmine.createSpy("changeAdded");
		this.set.addChangeAdded(onChangeAdded);
		this.set.add(42);

		expect(onChangeAdded).toHaveBeenCalledWith(42, 3, this.set);
	});

	it("exposes an undo event which is raised when a change is undone:  fn(change, index, set)", function() {
		var onChangeUndone = jasmine.jasmine.createSpy("changeUndone");
		this.set.addChangeUndone(onChangeUndone);
		this.set.undo();

		expect(onChangeUndone).toHaveBeenCalledWith(3, 2, this.set);
	});

	it("exposes a truncated event which is raised when the set is truncated:  fn(numRemoved, set)", function() {
		var onTruncated = jasmine.jasmine.createSpy("truncated");
		this.set.addTruncated(onTruncated);
		this.set.truncate();

		expect(onTruncated).toHaveBeenCalledWith(3, this.set);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
