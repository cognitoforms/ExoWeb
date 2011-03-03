// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");
var arrays = require("../../../src/base/core/Array");
var functions = require("../../../src/base/core/Function");

ExoWeb = { config: {} };
var signal = require("../../../src/base/core/Signal");
Signal = ExoWeb.Signal;

var mergeFunctions = functions.mergeFunctions;
var objectEquals = functions.objectEquals;

jasmine.jasmine.debug = true;

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;

// Test Suites
///////////////////////////////////////
describe("dontDoubleUp", function() {
	it("ensures that a function is only called once with a set of arguments", function() {
		
	});
});

describe("cached", function() {
	it("stores the value of an operation so that it is performed only once", function() {
		var numCalls = 0;

		var toLower = (function(str) {
			numCalls++;
			return str.toLowerCase();
		}).cached({ key: function(str) { return str; } });

		expect(toLower("TEST")).toBe("test");
		expect(numCalls).toBe(1);

		expect(toLower("TEST")).toBe("test");
		expect(numCalls).toBe(1);
	});
});

describe("mixin", function() {
	it("adds each member of the argument to the function's prototype", function() {
		function Foo() { }

		function f1() { }

		Foo.mixin({
			prop1: f1,
			prop2: "test"
		});

		var foo = new Foo();
		expect(foo.prop1).toBe(f1);
		expect(foo.prop2).toBe("test");
	});

	it("retains the function's current prototype", function() {
		function Foo() { }

		Foo.prototype.bar = true;

		var f0 = new Foo();
		expect(f0.bar).toBe(true);

		Foo.mixin({ newProp: false });

		var f1 = new Foo();
		expect(f0.bar).toBe(true);
	});

	it("overwrites existing members", function() {
		function Foo() { }

		Foo.prototype.bar = true;

		Foo.mixin({ bar: false });

		var foo = new Foo();
		expect(foo.bar).toBe(false);
	});
});

describe("setScope", function() {
	it("ensures that the function is called with the argument as the this pointer", function() {
		function getFirstChar() {
			return this[0];
		}

		console.log(">> setting scope to \"yes\"");
		var callback = getFirstChar.setScope("yes");

		console.log(">> applying function with \"no\" as this pointer");
		var result = callback.call("no");

		console.log(">> result: " + result);
		expect(result).toBe("y");
	});
});

describe("prepare", function() {
	it("calls the given function with a this pointer and arguments", function() {
		function getOpinion (thing, statement) {
			return this + " thinks that " + thing + " is " + statement;
		}
 
		console.log(">> setting scope to \"bryan\" and arguments to [\"javascript\", \"cool\"]");
		var opinion = getOpinion.prepare("bryan", ["javascript", "cool"]);

		console.log(">> calling function on \"john elway\" with arguments [\"basketball\", \"lame\"]");
		var result = opinion.apply("john elway", ["basketball", "lame"]);

		console.log(">> result: " + result);
		expect(result).toBe("bryan thinks that javascript is cool");
	});
});

describe("prependArguments", function() {
	it("prepends the given arguments to any function call", function()  {
		function commaDelimited() {
			var args = Array.prototype.slice.call(arguments);
			return args.join(",");
		}

		console.log(">> prepending arguments \"a\", \"b\"");
		var getResult = commaDelimited.prependArguments("a", "b");

		console.log(">> calling with arguments \"c\", \"d\"");
		var result = getResult("c", "d");

		console.log(">> result: " + result);
		expect(result).toBe("a,b,c,d");
	});

	it("should not share arguments between invocations", function() {
		function numArgs() {
			return arguments.length;
		}

		console.log(">> prepending arguments \"a\", \"b\"");
		var getResult = numArgs.prependArguments("a", "b");

		console.log(">> calling with arguments \"c\", \"d\"");
		var result = getResult("c", "d");

		console.log(">> result: " + result);
		expect(result).toBe(4);

		console.log(">> calling with arguments \"e\", \"f\"");
		var result = getResult("e", "f");

		console.log(">> result: " + result);
		expect(result).toBe(4);
	});
});

describe("appendArguments", function() {
	it("appends the given arguments to any function call", function()  {
		function commaDelimited() {
			var args = Array.prototype.slice.call(arguments);
			return args.join(",");
		}

		console.log(">> appending arguments \"c\", \"d\"");
		var getResult = commaDelimited.appendArguments("c", "d");

		console.log(">> calling with arguments \"a\", \"b\"");
		var result = getResult("a", "b");

		console.log(">> result: " + result);
		expect(result).toBe("a,b,c,d");
	});
});

describe("spliceArguments", function() {

});

describe("sliceArguments", function() {

});

describe("mergeFunctions", function() {
	it("return undefined if neither function is defined", function() {
		expect(mergeFunctions(null, null)).toBe();
		expect(mergeFunctions()).toBe();
	});

	it("returns either function if the other is not defined", function() {
		var fn = function() {};
		expect(mergeFunctions(fn)).toBe(fn);
		expect(mergeFunctions(fn, null)).toBe(fn);
		expect(mergeFunctions(null, fn)).toBe(fn);
	});

	it("takes two functions as input and returns a function that will in turn call both", function() {
		var mocks = {
			fn1: function fn1() { },
			fn2: function fn2() { }
		};

		var fn1 = jasmine.spyOn(mocks, "fn1").andCallThrough();
		var fn2 = jasmine.spyOn(mocks, "fn2").andCallThrough();

		var fn3 = mergeFunctions(fn1, fn2);

		// invoke the joined function
		fn3();

		expect(fn1).toHaveBeenCalled();
		expect(fn2).toHaveBeenCalled();
	});
	
	it("invokes functions with the given \"this\" and arguments", function() {
		var mocks = {
			fn1: function fn1(arg1, arg2) {
				expect(this).toBe(jasmine);
				expect(arguments.length).toBe(2);
				expect(arg1).toBe(0);
				expect(arg2).toBe(1);
			},
			fn2: function fn2(arg1, arg2) {
				expect(this).toBe(jasmine);
				expect(arguments.length).toBe(2);
				expect(arg1).toBe(0);
				expect(arg2).toBe(1);
			}
		};

		var fn1 = jasmine.spyOn(mocks, "fn1").andCallThrough();
		var fn2 = jasmine.spyOn(mocks, "fn2").andCallThrough();

		var fn3 = mergeFunctions(fn1, fn2);

		// invoke the joined function
		fn3.call(jasmine, 0, 1);

		expect(fn1).toHaveBeenCalled();
		expect(fn2).toHaveBeenCalled();
	});

	it("wraps async functions and only executes merged callback after both have been executed", function() {
		var innerCallback;

		var mocks = {
			fn1: function fn1(arg, callback, thisPtr) {
				expect(this).toBe(jasmine);
				expect(arguments.length).toBe(3);
				expect(arg).toBe(0);
				callback.call(thisPtr || this);
			},
			fn2: function fn2(arg, callback, thisPtr) {
				expect(this).toBe(jasmine);
				expect(arguments.length).toBe(3);
				expect(arg).toBe(0);

				// don't invoke the callback immediately
				mocks.innerCallback = callback;
				innerCallback = jasmine.spyOn(mocks, "innerCallback").andCallThrough();
			},
			outerCallback: function() {
				expect(this).toBe(functions);
			}
		};

		var fn1 = jasmine.spyOn(mocks, "fn1").andCallThrough();
		var fn2 = jasmine.spyOn(mocks, "fn2").andCallThrough();
		var outerCallback = jasmine.spyOn(mocks, "outerCallback").andCallThrough();

		var fn3 = mergeFunctions(fn1, fn2, {
			async: true,
			callbackIndex: 1,
			thisPtrIndex: 2
		});

		// invoke the joined function
		fn3.call(jasmine, 0, outerCallback, functions);

		expect(fn1).toHaveBeenCalled();
		expect(fn2).toHaveBeenCalled();

		// second callback and outer callback have not been called yet
		expect(innerCallback).not.toHaveBeenCalled();
		expect(outerCallback).not.toHaveBeenCalled();

		innerCallback();
		
		// callbacks should now have been called
		expect(innerCallback).toHaveBeenCalled();
		expect(outerCallback).toHaveBeenCalled();
	});
});

describe("objectEquals", function() {
	it("returns a function that will compare it's input to the given object for equality", function() {
		var obj = {};
		var fn = objectEquals(obj);

		expect(fn({})).toEqual(false);
		expect(fn("fail")).toEqual(false);
		expect(fn(obj)).toEqual(true);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

