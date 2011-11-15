// Imports
///////////////////////////////////////
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");

var arrays = require("../../../src/base/core/Array");
forEach = arrays.forEach;

var functions = require("../../../src/base/core/Function");

ExoWeb = {};
ExoWeb.registerActivity = function() { };

var functor = require("../../../src/base/core/Functor");
Functor = ExoWeb.Functor;
//ExoWeb.Functor = Functor = functor.Functor;

var config = require("../../../src/base/core/Config");
ExoWeb.config = config.config;

var signal = require("../../../src/base/core/Signal");
Signal = ExoWeb.Signal;

var mergeFunctions = functions.mergeFunctions;
var equals = functions.equals;
var not = functions.not;
var bind = functions.bind;
var before = functions.before;
var after = functions.after;

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

describe("bind", function() {
	it("ensures that the function is called with the argument as the this pointer", function() {
		function getFirstChar() {
			return this[0];
		}

		console.log(">> binding to \"yes\"");
		var callback = bind.call(getFirstChar, "yes");

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

describe("equals", function() {
	it("returns a function that will compare it's input to the given object for equality", function() {
		var obj = {};
		var fn = equals(obj);

		expect(fn({})).toEqual(false);
		expect(fn("fail")).toEqual(false);
		expect(fn(obj)).toEqual(true);
	});
});

describe("not", function() {
	it("inverts the output of the given function", function() {
		var obj = {};

		function equals(other) {
			return obj === other;
		}

		expect(equals({})).toEqual(false);
		expect(equals(obj)).toEqual(true);

		var notEquals = not(equals);

		expect(notEquals({})).toEqual(true);
		expect(notEquals(obj)).toEqual(false);
	});
});

describe("before", function() {
	it("runs code before the functions is invoked", function() {
		var text = "";
		var fn = function(person) { text += "hello to " + person; };

		fn("bob");
		expect(text).toBe("hello to bob");

		text = "";
		fn = before(fn, function () { text += "I say "; });

		fn("bob");
		expect(text).toBe("I say hello to bob");
	});
});

describe("after", function() {
	it("runs code after the functions is invoked", function() {
		var text = "";
		var fn = function(person) { text += "hello to " + person; };

		fn("bob");
		expect(text).toBe("hello to bob");

		text = "";
		fn = after(fn, function () { text += " from mars"; });

		fn("bob");
		expect(text).toBe("hello to bob from mars");
	});
});

describe("dontDoubleUp", function() {

	var source = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];
	var target = ["d", "e", "r", "k", "u", "t", "s", "c", "n", "b", "z", "v", "h", "q", "w", "x", "m", "o", "y", "i", "j", "a", "l", "g", "p", "f"];

	function lookup(c, sourceArg, targetArg) {
		var i, result, sourceArray, targetArray;
		sourceArray = sourceArg || source;
		targetArray = targetArg || target;
		if (c.length === 1) {
			result = targetArray[sourceArray.indexOf(c)];
		}
		else {
			result = [];
			for (i = 0; i < c.length; i++) {
				result.push(targetArray[sourceArray.indexOf(c[i])]);
			}
		}
		return result;
	}

	function testDontDoubleUp(options) {
		var callbacks = [];

		var spyOn = {
			fn: function() {
				callbacks.push({ key: arguments[0], fn: arguments[options.callbackArg] });
			}
		};

		var implementation = jasmine.spyOn(spyOn, "fn").andCallThrough();
		var proxy = implementation.dontDoubleUp(options);

		return {
			implementation: implementation,
			proxy: proxy,
			add: function() {
				var args = Array.prototype.slice.call(arguments);
				var spy = jasmine.jasmine.createSpy();
				args.splice(options.callbackArg, 0, spy);
				proxy.apply(this, args);
				return spy;
			},
			flush: function(results) {
				for (var i = 0, len = callbacks.length; i < len; i++) {
					var cb = callbacks.shift();
					var args;
					if (results) {
						args = results[cb.key];
					}
					else {
						args = lookup(cb.key);
					}
					cb.fn.apply(this, args);
				}
			},
			reset: function(newOptions) {
				callbacks.length = 0;
				implementation.reset();
				proxy = implementation.dontDoubleUp(newOptions || options);
			}
		};
	}

	var dictionary = "";

	it("has no effect if the proxy function is called with different arguments", function() {

		var test = testDontDoubleUp({ callbackArg: 1 });

		var abc = test.add("abc");
		var def = test.add("def");

		test.flush();

		// tests with different keys will result in the implementation being called multiple times
		expect(test.implementation.callCount).toBe(2);
		expect(abc.callCount).toBe(1);
		expect(abc).toHaveBeenCalledWith(lookup("a"), lookup("b"), lookup("c"));
		expect(def.callCount).toBe(1);
		expect(def).toHaveBeenCalledWith(lookup("d"), lookup("e"), lookup("f"));

	});

	it("ensures that the same function is not called more than once with the same arguments", function() {
	
		var test = testDontDoubleUp({ callbackArg: 1 });

		var test1 = test.add("test");
		var test2 = test.add("test");

		test.flush();

		expect(test.implementation.callCount).toBe(1);
		expect(test1.callCount).toBe(1);
		expect(test1).toHaveBeenCalledWith(lookup("t"), lookup("e"), lookup("s"), lookup("t"));
		expect(test2.callCount).toBe(1);
		expect(test2).toHaveBeenCalledWith(lookup("t"), lookup("e"), lookup("s"), lookup("t"));

	});
	
	it("throws an error when an invalid partitioned argument is specified", function() {
		expect(function() { (function() { }).dontDoubleUp({ groupBy: 0, partitionedArg: 1 })(true, false); }).toThrow("The partitioned argument must be an array.");
		expect(function() { (function() { }).dontDoubleUp({ groupBy: 0, partitionedArg: 1 })(true, [0, 1, 2]); }).toThrow("Invalid partitionedArg option.");
	});

	it("allows for grouping arguments to be specified and only groups calls that use identical values for those arguments", function() {
	
		var test = testDontDoubleUp({ callbackArg: 2, groupBy: [0] });

		var test1 = test.add("test", 5);
		var test2 = test.add("test", 2);

		test.flush();

		expect(test.implementation.callCount).toBe(1);
		expect(test1.callCount).toBe(1);
		expect(test1).toHaveBeenCalledWith(lookup("t"), lookup("e"), lookup("s"), lookup("t"));
		expect(test2.callCount).toBe(1);
		expect(test2).toHaveBeenCalledWith(lookup("t"), lookup("e"), lookup("s"), lookup("t"));

	});
	
	it("allows for partitioning one of the arguments so that calls that include some of the same arguments as a call in progress can share the same result", function() {
	
		var test = testDontDoubleUp({ callbackArg: 2, groupBy: 1, partitionedArg: 1 });

		var abc = test.add("abc", ["a", "b", "c"]);
		var a = test.add("a", ["a"]);
		var b = test.add("b", ["b"]);
		var c = test.add("c", ["c"]);

		test.flush({ "abc": lookup("abc"), "a": lookup("abc"), "b": lookup("abc"), "c": lookup("abc") });

		expect(test.implementation.callCount).toBe(1);
		expect(abc.callCount).toBe(1);
		expect(abc).toHaveBeenCalledWith(lookup("a"), lookup("b"), lookup("c"));
		expect(a.callCount).toBe(1);
		expect(a).toHaveBeenCalledWith(lookup("a"), lookup("b"), lookup("c"));
		expect(b.callCount).toBe(1);
		expect(b).toHaveBeenCalledWith(lookup("a"), lookup("b"), lookup("c"));
		expect(c.callCount).toBe(1);
		expect(c).toHaveBeenCalledWith(lookup("a"), lookup("b"), lookup("c"));

	});
	
	it("allows for filtering the results when partitioned", function() {

		function filter(originalInput, partitionedInput, output) {
			var word = partitionedInput[1];
			for (var i = 0; i < output.length; i++) {
				var outputItem = output[i];
				var inputItem = lookup(outputItem, target, source);
				if (word.indexOf(inputItem) < 0) {
					output.splice(i--, 1);
				}
			}
		}

		var test = testDontDoubleUp({ callbackArg: 2, groupBy: 1, partitionedArg: 1, partitionedFilter: filter });
		
		var abc = test.add("abc", ["a", "b", "c"]);
		var a = test.add("a", ["a"]);
		var b = test.add("b", ["b"]);
		var c = test.add("c", ["c"]);
		
		test.flush({ "abc": lookup("abc"), "a": lookup("abc"), "b": lookup("abc"), "c": lookup("abc") });

		expect(test.implementation.callCount).toBe(1);
		expect(abc.callCount).toBe(1);
		expect(abc).toHaveBeenCalledWith(lookup("a"), lookup("b"), lookup("c"));
		expect(a.callCount).toBe(1);
		expect(a).toHaveBeenCalledWith(lookup("a"));
		expect(b.callCount).toBe(1);
		expect(b).toHaveBeenCalledWith(lookup("b"));
		expect(c.callCount).toBe(1);
		expect(c).toHaveBeenCalledWith(lookup("c"));

	});

});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

