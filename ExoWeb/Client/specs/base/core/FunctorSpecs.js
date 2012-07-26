// Test setup
///////////////////////////////////////

var specs = require("../../SpecHelpers");

// Imports
///////////////////////////////////////

var functorModule = specs.require("core.Functor");

// Test Suites
///////////////////////////////////////

describe("Functor", function () {
	it("is initially empty", function () {
		var functor = Functor();
		expect(functor.isEmpty()).toBe(true);
	});

	it("is no longer empty after add is called", function () {
		var functor = Functor();
		expect(functor.isEmpty()).toBe(true);
		functor.add(function () { });
		expect(functor.isEmpty()).toBe(false);
	});

	it("becomes empty empty again after remove is called", function () {
		var functor = Functor();
		expect(functor.isEmpty()).toBe(true);
		var f = function () { };
		functor.add(f);
		expect(functor.isEmpty()).toBe(false);
		functor.remove(f);
		expect(functor.isEmpty()).toBe(true);
	});

	it("invokes the added function when it is itself invoked", function () {
		var functor = Functor();
		expect(functor.isEmpty()).toBe(true);
		var f = jasmine.jasmine.createSpy();
		functor.add(f);
		expect(f).not.toHaveBeenCalled();
		var e = {};
		functor(this, e);
		expect(f).toHaveBeenCalledWith(this, e);
	});

	it("only invokes the function if the filter is satisfied", function () {
		var functor = Functor();
		expect(functor.isEmpty()).toBe(true);
		var f = jasmine.jasmine.createSpy();
		functor.add(f, function (sender, args) { return args >= 42; });
		expect(f).not.toHaveBeenCalled();
		var e = 41;
		functor(this, e);
		expect(f).not.toHaveBeenCalled();
		e = 42;
		functor(this, e);
		expect(f).toHaveBeenCalledWith(this, e);
	});

	describe("eventing", function () {
		it("supports adding named events", function() {
			var type = function () { };
			type.prototype = Functor.eventing;
			var t = new type();
			var f = jasmine.jasmine.createSpy();
			t._addEvent("foo", f);
			t._raiseEvent("foo", [42]);
			expect(f).toHaveBeenCalledWith(42);
		});

		it("supports removing named events", function() {
			var type = function () { };
			type.prototype = Functor.eventing;
			var t = new type();
			var f = jasmine.jasmine.createSpy();
			t._addEvent("foo", f);
			t._removeEvent("foo", f);
			t._raiseEvent("foo", [42]);
			expect(f).not.toHaveBeenCalled();
		});
	});
});

// Run Tests
///////////////////////////////////////

jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
