/// <reference path="../../../src/base/mapper/ChangeSet.js" />
/// <reference path="../../../src/base/mapper/ChangeLog.js" />
/// <reference path="../../SpecDependencies.js" />
/// <reference path="../../SpecHelpers.js" />

/*globals require, jasmine, describe, it, beforeEach, expect */
/*globals ChangeLog, ChangeSet */

// Test setup
///////////////////////////////////////

var specs = require("../../SpecHelpers.js");

specs.announce("ChangeLog");

//specs.debug();
specs.ensureWindow();

// Imports
///////////////////////////////////////

var changeLogModule = specs.require("mapper.ChangeLog");

// Test Suites
///////////////////////////////////////

function setup() {
	var log = new ChangeLog();
	log.start({ code: "prfpuxdj", title: "test" });
	log.add(1);
	log.add(2);
	log.start({ code: "wqylvmww", title: "test2" });
	log.add(3);

	this.log = log;
}

describe("ChangeLog", function () {
	it("initially has no sets", function () {
		expect((new ChangeLog()).sets.length).toBe(0);
	});

	it("throws an error if a change is added before starting", function () {
		expect(function () {
			(new ChangeLog()).add(5);
		}).toThrow("The change log is not currently active.");
	});

	it("requires a string source when calling start", function () {
		expect(function () {
			(new ChangeLog()).start();
		}).toThrow("Argument 'titleOrOptions' cannot be null or undefined.");

		expect(function () {
			(new ChangeLog()).start(5);
		}).toThrow("Argument 'titleOrOptions' must be of type string|object: 5.");
	});

	it("allows a change to be added after calling start", function () {
		var log = new ChangeLog();
		log.start("test");
		log.add(5);

		expect(log.sets.length).toBe(1);
		expect(log.sets[0].changes.length).toBe(1);
		expect(log.sets[0].changes[0]).toBe(5);
	});

	it("using the last set as the active set when start is called with the continueLast option and the source and user are the same", function () {
		(function () {
			var log = new ChangeLog();
			var _set = log.addSet("client", "test2", null, [1, 2]);
			expect(log.activeSet).toBe(null);
			log.start("test2", null);
			expect(log.activeSet.changes.length).toBe(0);
		}());

		(function () {
			var log = new ChangeLog();
			var _set = log.addSet("client", "test2", null, [1, 2]);
			expect(log.activeSet).toBe(null);
			log.start({ title: "test2", user: "johndoe" }, true);
			expect(log.activeSet.changes.length).toBe(0);
		}());

		(function () {
			var log = new ChangeLog();
			var _set = log.addSet("client", "test2", null, [1, 2], "rvchugxe");
			expect(log.activeSet).toBe(null);
			log.start({ title: "test2", user: "johndoe", code: "rvchugxe" }, true);
			expect(log.activeSet.changes.length).toBe(0);
		}());

		(function () {
			var log = new ChangeLog();
			var _set = log.addSet("client", "test2", null, [1, 2]);
			expect(log.activeSet).toBe(null);
			log.start("test3", true);
			expect(log.activeSet.changes.length).toBe(0);
		}());

		(function () {
			var log = new ChangeLog();
			var _set = log.addSet("client", "test2", null, [1, 2]);
			expect(log.activeSet).toBe(null);
			log.start("test2", true);
			expect(log.activeSet.changes.length).toBe(2);
		}());
	});

	it("allows a user to be specified when a set is started and stopped", function () {
		var log = new ChangeLog();
		log.start({ title: "test", user: "janedoe" });
		log.add(5);

		expect(log.sets.length).toBe(1);
		expect(log.sets[0].changes.length).toBe(1);
		expect(log.sets[0].changes[0]).toBe(5);
		expect(log.sets[0].user).toBe("janedoe");

		log.stop();
		expect(log.activeSet).toBe(null);
		expect(function () {
			log.add(5);
		}).toThrow("The change log is not currently active.");
		expect(function () {
			log.stop();
		}).toThrow("The change log is not currently active.");
	});
});

describe("ChangeLog", function () {
	beforeEach(setup);

	it("pushes new changes onto the new set after calling start a second time", function () {
		expect(this.log.sets.length).toBe(2);
		expect(this.log.sets[0].changes.length).toBe(2);
		expect(this.log.sets[1].changes.length).toBe(1);
		expect(this.log.sets[1].changes[0]).toBe(3);
		expect(this.log.activeSet.title).toBe("test2");
	});
	
	it("serializes only changes that pass a given filter", function () {
		expect(this.log.serialize(function (c) {
			return c > 1;
		})).toEqual([
			{
				source: "client",
				changes: [2]
			},
			{
				source: "client",
				changes: [3]
			}
		]);
	});
	
	it("returns the last change added", function () {
		expect(this.log.lastChange()).toBe(3);
	});

	it("returns null if undo is called and there are no changes", function () {
		var log = new ChangeLog();
		log.start("test");
		expect(log.undo()).toEqual(null);
	});

	it("cannot undo if the log is not active", function () {
		expect(function () {
			(new ChangeLog()).undo();
		}).toThrow("The change log is not currently active.");
	});

	it("undo removes and returns the last change", function () {
		var lastChange = this.log.lastChange();
		var change = this.log.undo();
		expect(this.log.sets.length).toBe(2);
		expect(this.log.activeSet.title).toBe("test2");
		expect(this.log.activeSet.changes.length).toBe(0);
		expect(change).toBe(lastChange);
	});

	it("undo steps over empty sets", function () {
		// create an empty set
		this.log.start("test3");

		var change = this.log.undo();
		expect(this.log.sets.length).toBe(2);
		expect(this.log.activeSet.title).toBe("test2");
		expect(this.log.activeSet.changes.length).toBe(0);
		expect(change).toBe(3);
	});

	it("returns the checkpoint if it is the next change", function () {
		var checkpoint = { type: "Checkpoint", code: "abc" };
		this.log.add(checkpoint);
		expect(this.log.undo()).toBe(checkpoint);
	});
});

describe("ChangeLog.truncate", function () {
	beforeEach(setup);

	it("discards all sets and changes when truncated, creating a new \"client\" set", function () {
		var numRemoved = this.log.truncate();

		expect(numRemoved).toBe(3);
		expect(this.log.sets.length).toBe(0);
	});

	it("discards all sets and changes that meet the given filter when truncated", function () {
		var numRemoved = this.log.truncate(function (c) {
			return c > 1;
		});

		expect(numRemoved).toBe(2);
		expect(this.log.sets.length).toBe(1);
		expect(this.log.sets[0].title).toBe("test");
		expect(this.log.sets[0].changes.length).toBe(1);
		expect(this.log.sets[0].changes[0]).toBe(1);
		expect(this.log.activeSet).toBe(null);
	});

	it("checkpoint returns undefined if there is not an active set, but adds the checkpoint if there are no changes", function () {
		var result, log = new ChangeLog();
		expect(log.checkpoint()).toBe(null);

		log.start("test");
		result = log.checkpoint();
		expect(result).not.toBe(undefined);
		expect(result).not.toBe(null);
		log.start("test2");
		result = log.checkpoint();
		expect(result).not.toBe(undefined);
		expect(result).not.toBe(null);

		log.add(1);
		result = log.checkpoint();
		expect(result).not.toBe(undefined);
		expect(result).not.toBe(null);
	});

	it("discards all changes and sets up to the given checkpoint", function () {
		var checkpoint = this.log.checkpoint();

		expect(checkpoint).not.toBe(undefined);

		this.log.start("test3");
		this.log.add(4);
		this.log.add(5);

		var numRemoved = this.log.truncate(checkpoint);

		// Checkpoint should be gone in this case since nothing precedes it.
		expect(numRemoved).toBe(3);

		expect(this.log.sets.length).toBe(2);
		expect(this.log.sets[0].title).toBe("test2");
		expect(this.log.sets[0].changes.length).toBe(1);
		expect(this.log.sets[1].title).toBe("test3");
		expect(this.log.sets[1].changes.length).toBe(2);
	});
});

describe("ChangeLog.checkpoint", function () {
	beforeEach(setup);

	it("accepts an optional title", function () {
		var checkpoint = this.log.checkpoint("title");
		expect(this.log.sets
				.mapToArray(function (set) { return set.changes; })
				.filter(function (c) { return c.type === "Checkpoint" && c.code === checkpoint })[0].title
			).toBe("title");
	});

	it("accepts an optional code", function () {
		var checkpoint = this.log.checkpoint("title", "abcdef");
		expect(checkpoint).toBe("abcdef");
		expect(this.log.sets
				.mapToArray(function (set) { return set.changes; })
				.filter(function (c) { return c.type === "Checkpoint" && c.title === "title" })[0].code
			).toBe(checkpoint);
	});
});

describe("ChangeLog.addSet", function () {
	it("allows a set to be added to an active change log", function () {
		var log = new ChangeLog();
		log.start("test");
		expect(log.activeSet.title).toBe("test");

		var active = log.activeSet;

		log.addSet("client", "test2", null, [1, 2]);
		expect(log.sets.length).toBe(2);
		expect(log.activeSet).toBe(active);
	});

	it("adds a non-active set to the change log", function () {
		var changes = [1, 2, 3];
		var log = new ChangeLog();
		log.addSet("client", "test", null, changes);

		var active = log.activeSet;

		expect(log.sets.length).toBe(1);
		expect(log.sets[0].changes.length).toBe(3);
		expect(log.sets[0].changes).not.toBe(changes);
		expect(log.activeSet).toBe(active);
	});

	it("stores the user identifier if provided", function () {
		var changes = [1, 2, 3];
		var log = new ChangeLog();
		log.addSet("client", "test", "jondoe", changes);
		expect(log.sets.length).toBe(1);
		expect(log.sets[0].changes.length).toBe(3);
		expect(log.sets[0].changes).not.toBe(changes);
		expect(log.sets[0].user).toBe("jondoe");
	});
});

describe("ChangeLog.compress", function () {
	beforeEach(setup);

	it("throws an error if any arguments are provided", function () {
		expect(function () {
			(new ChangeLog()).compress(1);
		}).toThrow("The number of arguments is not correct, expected 0, actual 1.");
		expect(function () {
			(new ChangeLog()).compress(1, "two", 3);
		}).toThrow("The number of arguments is not correct, expected 0, actual 3.");
	});

	it("removes any empty sets", function () {
		expect(this.log.sets.length).toBe(2);
		this.log.start("empty");
		expect(this.log.sets.length).toBe(3);
		this.log.start("non-empty");
		expect(this.log.sets.length).toBe(4);
		this.log.add(5);
		this.log.compress();
		expect(this.log.sets.length).toBe(3);
	});

	it("removes back to back empty sets", function () {
		expect(this.log.sets.length).toBe(2);
		this.log.start("empty");
		this.log.start("also empty");
		expect(this.log.sets.length).toBe(4);
		this.log.start("non-empty");
		expect(this.log.sets.length).toBe(5);
		this.log.add(5);
		this.log.compress();
		expect(this.log.sets.length).toBe(3);
	});

	it("nulls out the active set if it is removed", function () {
		expect(this.log.sets.length).toBe(2);
		this.log.start("empty");
		this.log.start("also empty");
		expect(this.log.sets.length).toBe(4);
		expect(this.log.activeSet.title).toBe("also empty");
		this.log.compress();
		expect(this.log.sets.length).toBe(2);
		expect(this.log.activeSet).toBe(null);
	});
});

describe("ChangeLog.count", function () {
	beforeEach(setup);

	it("returns the number of changes in the log", function () {
		expect(this.log.count()).toBe(3);
	});

	it("returns the number of changes that match a given filter", function () {
		expect(this.log.count(function (v) { return v > 2; })).toBe(1);
	});
	
	it("uses thisPtr if provided", function () {
		this.log.val = 1;
		expect(this.log.count(function (v) { return v > this.log.val; }, this)).toBe(2);
	});
});

describe("ChangeSet events", function () {
	beforeEach(setup);

	it("exposes an add event which is raised when a new change is added:  fn(change, index, set, log)", function () {
		var onChangeAdded = jasmine.jasmine.createSpy("changeAdded");
		this.log.onChangeAdded.add(onChangeAdded);
		this.log.add(42);

		expect(onChangeAdded).toHaveBeenCalledWith(42, 1, this.log.activeSet, this.log);
	});

	it("exposes an undo event which is raised when a change is undone:  fn(change, index, set, log)", function () {
		var onChangeUndone = jasmine.jasmine.createSpy("changeUndone");
		this.log.onChangeUndone.add(onChangeUndone);
		var activeSet = this.log.activeSet;
		this.log.undo();

		expect(onChangeUndone).toHaveBeenCalledWith(3, 0, activeSet, this.log);
	});
	
	it("exposes a set started event which is raised when a new changeset is started:  fn(set, previousActiveSet, index, log)", function () {
		var activeSet = this.log.activeSet;
		var onChangeSetStarted = jasmine.jasmine.createSpy("changeSetStarted");
		this.log.onChangeSetStarted.add(onChangeSetStarted);
		var set = this.log.start("foo");

		expect(onChangeSetStarted).toHaveBeenCalledWith(set, activeSet, 2, this.log);
	});

	it("exposes a truncated event which is raised when the log is truncated:  fn(numRemoved, log)", function () {
		var onTruncated = jasmine.jasmine.createSpy("truncated");
		this.log.onTruncated.add(onTruncated);
		this.log.truncate();

		expect(onTruncated).toHaveBeenCalledWith(3, this.log);
	});
});

describe("ChangeLog.batchChanges", function () {
	beforeEach(setup);

	it("raises and error if a new set name is not specified", function () {
		var log = this.log;

		expect(function () {
			log.batchChanges();
		}).toThrow("The first argument to batchChanges must be a non-empty string which specifies a title for the changes.");

		expect(function () {
			log.batchChanges(true);
		}).toThrow("The first argument to batchChanges must be a non-empty string which specifies a title for the changes.");

		expect(function () {
			log.batchChanges("");
		}).toThrow("The first argument to batchChanges must be a non-empty string which specifies a title for the changes.");
	});

	it("raises and error if the user argument is not a string or is empty", function () {
		var log = this.log;

		expect(function () {
			log.batchChanges("client", true);
		}).toThrow("The second argument to batchChanges must be a non-empty string which specifies the user who is initiating the changes.");

		expect(function () {
			log.batchChanges("client", "");
		}).toThrow("The second argument to batchChanges must be a non-empty string which specifies the user who is initiating the changes.");
	});

	it("raises and error if an action function is not specified", function () {
		var log = this.log;

		expect(function () {
			log.batchChanges("client");
		}).toThrow("The third argument to batchChanges must be a function which performs the changes.");

		expect(function () {
			log.batchChanges("client", null, "this is not a function");
		}).toThrow("The third argument to batchChanges must be a function which performs the changes.");
	});

	it("starts a new set before performing the action if there are changes in the current active set", function () {
		var log = this.log;

		var batchSet = log.batchChanges("batched", null, function () {
			log.add(4);
		});

		expect(this.log.serialize(false)).toHaveTheSameElementsAs([
			{ source: "client", changes: [1, 2], title: "test", code: "prfpuxdj" },
			{ source: "client", changes: [3], title: "test2", code: "wqylvmww" },
			{ source: "client", changes: [4], title: "batched", code: batchSet.code },
			{ source: "client", changes: [], title: "test2", code: log.activeSet.code }
		]);
	});

	it("specifies the user for the new set if one is specified", function () {
		var log = this.log;

		var batchSet = log.batchChanges("batched", "janedoe", function () {
			log.add(4);
		});

		expect(this.log.serialize(false)).toHaveTheSameElementsAs([
			{ source: "client", changes: [1, 2], title: "test", code: "prfpuxdj" },
			{ source: "client", changes: [3], title: "test2", code: "wqylvmww" },
			{ source: "client", title: "batched", user: "janedoe", changes: [4], code: batchSet.code },
			{ source: "client", changes: [], title: "test2", code: log.activeSet.code }
		]);
	});

	it("starts a new set before performing the action if there is not a current active set", function () {
		var log = new ChangeLog();

		var batchSet = log.batchChanges("batched", null, function () {
			log.add(4);
		});

		expect(log.serialize(false)).toHaveTheSameElementsAs([
			{ source: "client", changes: [4], title: "batched", code: batchSet.code },
			{ source: "client", changes: [], title: "unknown", code: log.activeSet.code }
		]);
	});

	it("does not start a new set before performing the action if the current active set has no changes", function () {
		var log = this.log;

		var emptySet = log.start("empty");

		var batchSet = log.batchChanges("empty", null, function () {
			log.add(4);
		});

		expect(log.serialize(false)).toHaveTheSameElementsAs([
			{ source: "client", changes: [1, 2], title: "test", code: "prfpuxdj" },
			{ source: "client", changes: [3], title: "test2", code: "wqylvmww" },
			{ source: "client", changes: [4], title: "empty", code: emptySet.code },
			// The new set will be "client" because there was an
			// empty "client" change set before calling batchChanges.
			{ source: "client", changes: [], title: "empty", code: log.activeSet.code }
		]);
	});

	it("starts a new set before performing the action if the user of the current active set is not the same as the batch's source", function () {
		var log = this.log;

		var emptySet = log.start({ title: "empty", user: "jondoe" });

		var batchSet = log.batchChanges("empty", "janedoe", function () {
			log.add(4);
		});

		expect(log.serialize(false)).toHaveTheSameElementsAs([
			{ source: "client", changes: [1, 2], title: "test", code: "prfpuxdj" },
			{ source: "client", changes: [3], title: "test2", code: "wqylvmww" },
			{ source: "client", changes: [], user: "jondoe", title: "empty", code: emptySet.code },
			{ source: "client", changes: [4], user: "janedoe", title: "empty", code: batchSet.code },
			// The new set will be "client" because there was an
			// empty "client" change set before calling batchChanges.
			{ source: "client", changes: [], user: "jondoe", title: "empty", code: log.activeSet.code }
		]);
	});

	it("starts a new set before performing the action if the description of the current active set is not the same as the batch's source", function () {
		var log = this.log;

		var emptySet = log.start("test3");

		var batchSet = log.batchChanges("batched", null, function () {
			log.add(4);
			log.add(5);
		});

		expect(log.serialize(false)).toHaveTheSameElementsAs([
			{ source: "client", changes: [1, 2], title: "test", code: "prfpuxdj" },
			{ source: "client", changes: [3], title: "test2", code: "wqylvmww" },
			{ source: "client", changes: [], title: "test3", code: emptySet.code },
			{ source: "client", changes: [4, 5], title: "batched", code: batchSet.code },
			{ source: "client", changes: [], title: "test3", code: log.activeSet.code }
		]);
	});

	it("captures and cleans up after errors", function () {
		var log = this.log,
			emptySet = log.start("test3");

		try {
			log.batchChanges("batched", null, function () {
				log.add(4);
				throw new Error("This error occurred during batching.");
				//log.add(5); -- will never be reached
			});
		} catch (e) {
			//console.log("ERROR: " + e);
		}

		expect(log.serialize(false)).toHaveTheSameElementsAs([
			{ source: "client", changes: [1, 2], title: "test", code: "prfpuxdj" },
			{ source: "client", changes: [3], title: "test2", code: "wqylvmww" },
			{ source: "client", changes: [], title: "test3", code: emptySet.code },
			{ source: "client", changes: [4], title: "batched", code: any(String) },
			{ source: "client", changes: [], title: "test3", code: log.activeSet.code }
		]);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
