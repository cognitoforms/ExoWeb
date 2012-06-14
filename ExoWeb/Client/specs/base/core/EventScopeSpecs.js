// Test setup
///////////////////////////////////////

var specs = require("../../SpecHelpers");

//specs.debug();
specs.ensureWindow();

// Imports
///////////////////////////////////////

var eventScopeModule = specs.require("core.EventScope");

// Test Suites
///////////////////////////////////////

describe("EventScope", function() {
	afterEach(function() {
		eventScopeModule.reset();
	});

	it("executes immediately if no event scope is in effect", function() {
		// Create a spy function
		var spy = jasmine.jasmine.createSpy("on exit");

		// Invoke the spy on exit
		EventScope.onExit(spy);

		// Assert that the spy was called
		expect(spy).toHaveBeenCalled();
	});

	it("executes in the original context if no context argument is specified", function() {
		// Create a spy function
		var spy = jasmine.jasmine.createSpy("on exit");

		// Invoke the spy on exit
		EventScope.onExit(spy);

		// Assert that the spy was called as an unbound function
		expect(spy).toHaveBeenCalledFor(global);
	});

	it("executes in the context of the context argument if specified", function() {
		// Create a spy function
		var context = {};
		var spy = jasmine.jasmine.createSpy("on exit");

		// Invoke the spy on exit
		EventScope.onExit(spy, context);

		// Assert that the spy was called as an unbound function
		expect(spy).toHaveBeenCalledFor(context);
	});

	it("defers executing callbacks until the event scope exits", function() {
		try {
			// Create spy functions
			var spy1 = jasmine.jasmine.createSpy("on exit #1");
			var spy2 = jasmine.jasmine.createSpy("on exit #2");

			// Create a new event scope
			var scope = new EventScopeCtor();

			// Register spies as exit callbacks
			EventScope.onExit(spy1);
			EventScope.onExit(spy2);

			// Assert that the spies were not called
			expect(spy1).not.toHaveBeenCalled();
			expect(spy2).not.toHaveBeenCalled();
		}
		finally {
			// Exit the event scope
			scope.exit();

			// Assert that the spies were called
			expect(spy1).toHaveBeenCalled();
			expect(spy2).toHaveBeenCalled();
		}
	});

	it("throws an error if exit is called more than once for the same scope", function() {
		// Create a new event scope
		var scope = new EventScopeCtor();

		// Call exit the first time (valid)
		scope.exit();

		// Call exit a second time (not valid)
		expect(function() { scope.exit(); }).toThrow("The event scope has already exited.");
	});

	it("does not invoke the callback until the outer-most event scope is exited", function() {
		try {
			// Create a spy function
			var outerSpy = jasmine.jasmine.createSpy("outer spy");

			// Create a new event scope
			var outerScope = new EventScopeCtor();

			// Register the outer spy
			EventScope.onExit(outerSpy);

			// Assert that the spy was not called
			expect(outerSpy).not.toHaveBeenCalled();

			try {
				// Create a spy function
				var innerSpy = jasmine.jasmine.createSpy("inner spy");

				// Create another event scope
				var innerScope = new EventScopeCtor();

				// Register the inner spy
				EventScope.onExit(innerSpy);

				// Assert that neither spies have been called
				expect(outerSpy).not.toHaveBeenCalled();
				expect(innerSpy).not.toHaveBeenCalled();
			}
			finally {
				// Exit the inner event scope
				innerScope.exit();

				// Assert that neither spies have been called
				expect(innerSpy).not.toHaveBeenCalled();
				expect(outerSpy).not.toHaveBeenCalled();
			}
		}
		finally {
			// Exit the outer event scope
			outerScope.exit();

			// Assert that both spies were called
			expect(innerSpy).toHaveBeenCalled();
			expect(outerSpy).toHaveBeenCalled();
		}
	});

	it("non-outer scope is repositioned as the outer-most scope if nested scopes are exited out of order", function() {
		try {
			// Create a spy function
			var outerSpy = jasmine.jasmine.createSpy("outer");

			// Create a new event scope
			var outerScope = new EventScopeCtor();

			// Register the outer spy
			EventScope.onExit(outerSpy);

			// Assert that the spy was not called
			expect(outerSpy).not.toHaveBeenCalled();

			try {
				// Create a spy function
				var innerSpy = jasmine.jasmine.createSpy("inner");

				// Create another event scope
				var innerScope = new EventScopeCtor();

				// Register the inner spy
				EventScope.onExit(innerSpy);

				// Assert that neither spies have been called
				expect(outerSpy).not.toHaveBeenCalled();
				expect(innerSpy).not.toHaveBeenCalled();
			}
			finally {
				// Exit the outer event scope
				outerScope.exit();

				// Assert that the outer spy was called and reset
				expect(outerSpy).toHaveBeenCalled();
				outerSpy.reset();

				// Assert that the inner spy was not called
				expect(innerSpy).not.toHaveBeenCalled();
			}
		}
		finally {
			// Exit the inner event scope
			innerScope.exit();

			// Assert that the inner spy was called
			expect(innerSpy).toHaveBeenCalled();

			// Assert that the outer spy was not called
			expect(outerSpy).not.toHaveBeenCalled();
		}
	});

	describe(".perform", function() {

		it("creates a new event scope, performs the given action, then exits the scope", function() {
			// Create spy functions
			var exitSpy = jasmine.jasmine.createSpy("on exit");
			var performSpy = jasmine.jasmine.createSpy("perform").andCallFake(function() {
				// Register the exitSpy as an exit callback
				EventScope.onExit(exitSpy);

				// Assert that the spy has not been called
				expect(exitSpy).not.toHaveBeenCalled();
			});

			// Create a new event scope
			EventScope.perform(performSpy);

			// Assert that the spy was called after exiting the callback
			expect(performSpy).toHaveBeenCalled();

			// Assert that the spy was called after exiting the callback
			expect(exitSpy).toHaveBeenCalled();
		});

		it("callback executes in the original context if no context argument is specified", function() {
			// Create spy functions
			var exitSpy = jasmine.jasmine.createSpy("on exit");
			var performSpy = jasmine.jasmine.createSpy("perform").andCallFake(function() {
				// Register the exitSpy as an exit callback
				EventScope.onExit(exitSpy);

				// Assert that the spy has not been called
				expect(exitSpy).not.toHaveBeenCalled();
			});

			// Create a new event scope
			EventScope.perform(performSpy);

			// Assert that the spy was called after exiting the callback
			expect(performSpy).toHaveBeenCalledFor(global);

			// Assert that the spy was called after exiting the callback
			expect(exitSpy).toHaveBeenCalled();
		});

		it("callback executes in the context of the context argument if specified", function() {
			// Create a callback context object
			var context = {};

			// Create spy functions
			var exitSpy = jasmine.jasmine.createSpy("on exit");
			var performSpy = jasmine.jasmine.createSpy("perform").andCallFake(function() {
				// Register the exitSpy as an exit callback
				EventScope.onExit(exitSpy);

				// Assert that the spy has not been called
				expect(exitSpy).not.toHaveBeenCalled();
			});

			// Create a new event scope
			EventScope.perform(performSpy, context);

			// Assert that the spy was called after exiting the callback
			expect(performSpy).toHaveBeenCalledFor(context);

			// Assert that the spy was called after exiting the callback
			expect(exitSpy).toHaveBeenCalled();
		});

	});

});

// Run Tests
///////////////////////////////////////

jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
