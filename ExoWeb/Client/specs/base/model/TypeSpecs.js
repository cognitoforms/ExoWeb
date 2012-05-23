// Test setup
///////////////////////////////////////

var specs = require("../../SpecHelpers");

specs.debug();
specs.ensureWindow();

// Imports
///////////////////////////////////////

var eventQueueModule = specs.require("model.Type");

// Test Suites
///////////////////////////////////////

describe("Type", function() {
	var model = new Model();
	var foo = new Type(model, "Foo");
	var expectedNewIdPrefix = "c";
	var expectedNewId = 0;

	it("has a name that is determined by the name argument", function() {
		var bar = new Type(model, "Bar");
		expect(bar.get_fullName()).toBe("Bar");
	});

	describe("new id", function() {
		it("starts at zero and increments with each call", function() {
			for (var i = 0; i < 10; i++) {
				expect(foo.newId()).toBe("+" + expectedNewIdPrefix + expectedNewId++);
			}
		});

		describe("prefix", function() {
			describe("access", function() {
				it("returns the current prefix (without \"+\")", function() {
					expect(Type.getNewIdPrefix()).toBe(expectedNewIdPrefix);
				});
	
				it("throws an error if arguments are supplied in order to discourage bugs", function() {
					expect(function() { Type.getNewIdPrefix("y"); }).toThrow("The method getNewIdPrefix does not accept arguments");
				});
			});

			describe("configuration", function() {
				it("can be done at any time and more than once", function() {
					expectedNewIdPrefix = "abc";
					Type.setNewIdPrefix(expectedNewIdPrefix);
					expect(Type.getNewIdPrefix()).toBe(expectedNewIdPrefix);

					expectedNewIdPrefix = "def";
					Type.setNewIdPrefix(expectedNewIdPrefix);
					expect(Type.getNewIdPrefix()).toBe(expectedNewIdPrefix);
				});

				it("throws an error if the argument is null or undefined and leaves the current prefix intact", function() {
					expect(function() { Type.setNewIdPrefix(); }).toThrow("The new id prefix argument is required");
					expect(Type.getNewIdPrefix()).toBe(expectedNewIdPrefix);
				});

				it("throws an error if the argument is not a string and leaves the current prefix intact", function() {
					expect(function() { Type.setNewIdPrefix(5); }).toThrow("The new id prefix must be a string, found 5");
					expect(function() { Type.setNewIdPrefix(false); }).toThrow("The new id prefix must be a string, found false");
					expect(function() { Type.setNewIdPrefix({}); }).toThrow("The new id prefix must be a string, found [object Object]");
					expect(Type.getNewIdPrefix()).toBe(expectedNewIdPrefix);
				});

				it("throws an error if the argument is empty string and leaves the current prefix intact", function() {
					expect(function() { Type.setNewIdPrefix(""); }).toThrow("The new id prefix cannot be empty string");
					expect(Type.getNewIdPrefix()).toBe(expectedNewIdPrefix);
				});

				it("takes effect for subsequent calls to .newId()", function() {
					expectedNewIdPrefix = "z";
					Type.setNewIdPrefix(expectedNewIdPrefix);
					for (var i = 0; i < 10; i++) {
						expect(foo.newId()).toBe("+" + expectedNewIdPrefix + expectedNewId++);
					}
				});
			});
		});
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

