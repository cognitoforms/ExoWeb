// Test setup
///////////////////////////////////////

var specs = require("../../SpecHelpers");

specs.debug();
specs.ensureWindow();

// Imports
///////////////////////////////////////

specs.requireMsAjax();
specs.requireJQueryExtend();

var modelModule = specs.require("model.Model");
var typeModule = specs.require("model.Type");
var propertyModule = specs.require("model.Property");
var propertyChainModule = specs.require("model.PropertyChain");
var objectMetaModule = specs.require("model.ObjectMeta");

// Test Suites
///////////////////////////////////////

describe("PropertyChain", function() {

	describe("isInited", function() {

		it("returns true if all property values are initialized", function() {
			var model = new modelModule.Model();
			var fooType = new typeModule.Type(model, "Foo");
			var barType = new typeModule.Type(model, "Bar");

			barType.addProperty({ name: "Name", type: String });
			fooType.addProperty({ name: "Bars", type: Bar, isList: true });

			var foo = new Foo();
			var bar1 = new Bar({ Name: "A" });
			foo.get_Bars().add(bar1);
			var bar2 = new Bar({ Name: "B" });
			foo.get_Bars().add(bar2);

			var chain = modelModule.Model.property("this.Bars.Name", fooType);
			var handler = jasmine.jasmine.createSpy();
			chain.addChanged(handler);

			bar2.set_Name("b");
			expect(handler).toHaveBeenCalledWith(foo, {
				wasInited: true,
				originalSender: bar2,
				property: chain,
				triggeredBy: Bar.$Name,
				oldValue: "B",
				newValue: "b"
			});
		});

	});

});

// Run Tests
///////////////////////////////////////

jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
