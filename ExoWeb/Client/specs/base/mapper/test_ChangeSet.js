// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");

jasmine.jasmine.debug = true;

window = {};
ExoWeb = {
//	config: {
//		signalDebug: true
//	}
};

var functions = require("../../../src/base/core/Function");
var arrays = require("../../../src/base/core/Array");
//var query = require("../../../src/base/mapper/Query");
var trace = require("../../../src/base/core/Trace");
//var activity = require("../../../src/base/core/Activity");
//var signal = require("../../../src/base/core/Signal");
var utilities = require("../../../src/base/core/Utilities");

//ExoWeb.Signal = signal.Signal;
//ExoWeb.registerActivity = activity.registerActivity;
//var batch = require("../../../src/base/core/Batch");
//var internals = require("../../../src/base/mapper/Internals");
//var pathTokens = require("../../../src/base/model/PathTokens");
//var context = require("../../../src/base/mapper/Context");

//ObjectLazyLoader = require("../../../src/base/mapper/ObjectLazyLoader").ObjectLazyLoader;
//Model = require("../../../src/base/model/Model").Model;

//logError = ExoWeb.trace.logError;
//log = ExoWeb.trace.log;
$format = window.$format;
//fetchTypes = internals.fetchTypes;

//ExoWeb.trace.flags.query = true;

// References
///////////////////////////////////////
ChangeSet = require("../../../src/base/mapper/ChangeSet").ChangeSet;

var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;
var beforeEach = jasmine.beforeEach;

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

		set.add(5);

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
	beforeEach(function() {
		var set = new ChangeSet("client");
		set.add(1);
		set.add(2);
		set.add(3);

		this.set = set;
	});

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

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
