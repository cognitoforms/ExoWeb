/*
* Imports
*/

// Import Jasmine modules
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");

jasmine.jasmine.debug = true;

// Simulate global window object and exoweb namespace
global.window = global;
global.ExoWeb = {};

// Import modules
var functions = require("../../../src/base/core/Function");
var arrays = require("../../../src/base/core/Array");
var utilities = require("../../../src/base/core/Utilities");
var trace = require("../../../src/base/core/Trace");
var messageQueue = require("../../../src/base/core/MessageQueue");

// Declare local shortcuts
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;
var beforeEach = jasmine.beforeEach;

var MessageQueue = messageQueue.MessageQueue;

/*
* Test Suites
*/

describe("MessageQueue", function() {
	it("requires a callback when constructed", function() {
		expect(function() {
			new MessageQueue();
		}).toThrow("A callback must be provided to handle queued messages.");
	});

	it("collects messages that are added via the 'add' function", function() {
		var q = MessageQueue(function() {
			// do nothing
		});

		expect(q.count()).toBe(0);

		q.add("a");
		q.add("b");

		expect(q.count()).toBe(2);
	});

	it("invokes the callback with all messages when flush is called", function() {
		var callback = jasmine.jasmine.createSpy("callback");
		var q = MessageQueue(callback);

		q.add("a");
		q.add("b");

		q.flush();

		expect(callback).toHaveBeenCalledWith(["a", "b"]);
	});

	it("does not invoke the callback if no messages have been queued", function() {
		var callback = jasmine.jasmine.createSpy("callback");
		MessageQueue(callback).flush();
		expect(callback).not.toHaveBeenCalled();
	});

	it("uses thisPtr when invoking the callback if one is provided", function() {
		var callback = jasmine.jasmine.createSpy("callback");
		var ctx = {};

		var q = MessageQueue(function() {
			callback();
			expect(this).toBe(ctx);
		}, ctx);

		q.add("a");

		q.flush();

		expect(callback).toHaveBeenCalled();
	});
});

(function() {
	var timeout = null;

	global.setTimeout = function(fn, duration) {
		timeout = { fn: fn, duration: duration, ticks: 0 };
	};

	global.clearTimeout = function() {
		timeout = null;
	};

	global.tick = function() {
		if (timeout) {
			timeout.ticks++;
			if (timeout.duration === timeout.ticks) {
				timeout.fn();
				timeout = null;
			}
		}
	};
}) ();

describe("MessageQueue.autoFlush", function() {
	beforeEach(function() {
		this.callback = jasmine.jasmine.createSpy("callback");
		this.queue = MessageQueue(this.callback);
		this.next = function(shouldBeCalled) {
			tick();

			if (shouldBeCalled)
				expect(this.callback).toHaveBeenCalledWith(["a", "b"]);
			else
				expect(this.callback).not.toHaveBeenCalled();
		};
	});

	it("flushes the queue N milliseconds after an item is added", function() {
		this.queue.autoFlush(2);
		
		this.next();
		this.next();
		this.queue.add("a");
		this.next();
		this.queue.add("b");

		// 2 milliseconds have passed since item was added
		this.next(true);
	});

	it("resets the queue when new items are added if rolling argument is true", function() {
		this.queue.autoFlush(2, true);
		
		this.queue.add("a");
		this.next();
		this.queue.add("b");
		this.next();
		this.next(true);
	});
});

// Run tests
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
