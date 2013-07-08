/// <reference path="../../../src/base/mapper/ChangeSet.js" />
/// <reference path="../../SpecDependencies.js" />
/// <reference path="../../SpecHelpers.js" />

/*globals require, jasmine, describe, it, beforeEach, expect */
/*globals ChangeSet */

// Test setup
///////////////////////////////////////

var specs = require("../../SpecHelpers");

specs.announce("ChangeSet");

//specs.debug();
specs.ensureWindow();

// Imports
///////////////////////////////////////

var functionModule = specs.require("mapper.ChangeSet");

// Test Suites
///////////////////////////////////////

function setup() {
	var set = new ChangeSet("client");
	set.add(1);
	set.add(2);
	set.add(3);

	this.set = set;
}

describe("ChangeSet", function() {
	it("throws an error if a string source is not given", function() {
		expect(function() {
			(new ChangeSet());
		}).toThrow("Argument 'source' cannot be null or undefined.");

		expect(function() {
			(new ChangeSet(5));
		}).toThrow("Argument 'source' must be of type string: 5.");
	});

	it("initially has no changes", function() {
		expect((new ChangeSet("client", "test")).changes.length).toBe(0);
	});

	it("stores an added change and returns it with a call to changes", function() {
		var set = new ChangeSet("client", "test");

		expect(set.changes.length).toBe(0);

		var result = set.add(5);

		expect(result).toBe(0);
		expect(set.changes.length).toBe(1);
		expect(set.changes[0]).toBe(5);
	});

	it("accepts initial set of changes", function() {
		var changes = [0, 1, 2];
		var set = new ChangeSet("client", "test", null, changes);
		expect(set.changes).not.toBe(changes);
		expect(set.changes.length).toBe(3);
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
	
	it("serializes source verbatim", function() {
		var set = new ChangeSet("client");
		set.add(2);
		set.add(3);
		debugger;
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

		set = new ChangeSet("server");
		set.add(2);
		set.add(3);

		expect(set.serialize()).toEqual({
			source: "server",
			changes: [2, 3]
		});
	});
	
	it("returns the last change added", function() {
		expect(this.set.lastChange()).toBe(3);
	});
	
	it("returns null if undo is called and there are no changes", function() {
		var set = new ChangeSet("client", "test");
		expect(set.undo()).toEqual(null);
	});

	it("undo removes and returns the last change", function() {
		var lastChange = this.set.lastChange();
		var change = this.set.undo();
		expect(this.set.changes.length).toBe(2);
		expect(change).toBe(lastChange);
	});
});

describe("ChangeSet.truncate", function() {
	beforeEach(setup);

	it("discards all changes", function() {
		this.set.truncate();
		expect(this.set.changes.length).toBe(0);
	});

	it("discards all changes that meet the given filter", function() {
		this.set.truncate(function(c) {
			return c > 1;
		});

		expect(this.set.changes.length).toBe(1);
		expect(this.set.changes[0]).toBe(1);
	});

	it("discards all changes up to the given checkpoint", function() {
		var checkpoint = this.set.checkpoint();

		// Add another item and then truncate, up to the checkpoint.
		this.set.add(4);
		this.set.truncate(checkpoint);

		expect(this.set.changes.length).toBe(2);
		expect(this.set.changes[0].code).toBe(checkpoint);
		expect(this.set.changes[1]).toBe(4);
	});

	it("uses combination of filter and checkpoint if both are given", function() {
		var checkpoint = this.set.checkpoint();

		// Add another item and then truncate, up to the checkpoint.
		this.set.add(4);
		this.set.truncate(checkpoint, function(c) {
			return c > 1;
		});

		expect(this.set.changes.length).toBe(3);
		expect(this.set.changes[0]).toBe(1);
		expect(this.set.changes[1].code).toBe(checkpoint);
		expect(this.set.changes[2]).toBe(4);
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
		this.set.onChangeAdded.add(onChangeAdded);
		this.set.add(42);

		expect(onChangeAdded).toHaveBeenCalledWith(42, 3, this.set);
	});

	it("exposes an undo event which is raised when a change is undone:  fn(change, index, set)", function() {
		var onChangeUndone = jasmine.jasmine.createSpy("changeUndone");
		this.set.onChangeUndone.add(onChangeUndone);
		this.set.undo();

		expect(onChangeUndone).toHaveBeenCalledWith(3, 2, this.set);
	});

	it("exposes a truncated event which is raised when the set is truncated:  fn(numRemoved, set)", function() {
		var onTruncated = jasmine.jasmine.createSpy("truncated");
		this.set.onTruncated.add(onTruncated);
		this.set.truncate();

		expect(onTruncated).toHaveBeenCalledWith(3, this.set);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
