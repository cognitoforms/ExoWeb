// Imports
///////////////////////////////////////
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");

window = {};
ExoWeb = window.ExoWeb = {};

var functions = require("../../../src/base/core/Function");
var arrays = require("../../../src/base/core/Array");
var activity = require("../../../src/base/core/Activity");
var trace = require("../../../src/base/core/Trace");
var batch = require("../../../src/base/core/Batch");

// References
///////////////////////////////////////
var Batch = batch.Batch;
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;

// Test Suites
///////////////////////////////////////
describe("current batch", function() {
	it("is no longer active after ending", function() {
		var batch0 = Batch.start("0");
		Batch.end(batch0);
		expect(Batch.all().length).toBe(0);
	});
});

describe("callback for batch", function() {
	var batch1;
	var wasInvoked = false;

	it("is not invoked while the batch is active", function() {
		batch1 = Batch.start("1");

		Batch.whenDone(function () {
			wasInvoked = true;
		});

		expect(wasInvoked).toBe(false);
	});

	it("is invoked once the batch has ended", function() {
		Batch.end(batch1);
		expect(wasInvoked).toBe(true);
	});
});

describe("batch that is suspended", function() {
	var batch2;
	it("should be returned when suspend is called", function() {
		batch2 = Batch.start("2");
		expect(Batch.suspendCurrent()).toBe(batch2);
	});

	it("is no longer current", function() {
		expect(Batch.current()).not.toBe(batch2);
	});

	if("should be the current batch when resumed if there is no current batch", function() {
		Batch.resume(batch2);
		expecte(Batch.current()).toBe(batch2);
		Batch.end(batch2);
	});
});

describe("batch that is resumed when a current batch exists", function() {
	var batch3;
	var batch4;
	var batch3Invoked = false;

	it("should *NOT* be the current batch", function() {
		batch3 = Batch.start("4");
		Batch.whenDone(function () {
			batch3Invoked = true;
		});

		Batch.suspendCurrent();

		batch4 = Batch.start("4");

		// Resuming b (b2) will cause b3 to be transferred to it, since b3 is currently active.
		Batch.resume(batch3);

		expect(Batch.current()).not.toBe(batch3);
	});

	it("callbacks should *NOT* be invoked when the current batch is ended", function() {
		Batch.end(batch4);
		expect(batch3Invoked).toBe(false);
	});

	it("callbacks should be invoked when the resumed batch is ended", function() {
		Batch.end(batch3);
		expect(batch3Invoked).toBe(true);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

