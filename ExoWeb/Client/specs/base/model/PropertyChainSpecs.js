// Test setup
///////////////////////////////////////

var specs = require("../../SpecHelpers");

//specs.debug();
specs.ensureWindow();

// Imports
///////////////////////////////////////

specs.requireMsAjax();
specs.requireJQueryExtend();
specs.require("model.PropertyChain");

// Test Suites
///////////////////////////////////////

describe("PropertyChain", function() {

	beforeEach(function() {
		var model = new Model();
		this.model = model;

		var fooType = new Type(model, "Foo");
		var barType = new Type(model, "Bar");
		var barTypeType = new Type(model, "BarType");

		barType.addProperty({ name: "Type", type: BarType });
		barTypeType.addProperty({ name: "Name", type: String });
		fooType.addProperty({ name: "Bars", type: Bar, isList: true });

		var foo = new Foo();
		this.foo = foo;

		var aType = new BarType({ Name: "A" });
		this.aType = aType;

		var bar1 = new Bar({ Type: aType });
		foo.get_Bars().add(bar1);
		this.bar1 = bar1;

		var bType = new BarType({ Name: "B" });
		this.bType = bType;

		var bar2 = new Bar({ Type: bType });
		foo.get_Bars().add(bar2);
		this.bar2 = bar2;

		var barsChain = fooType.property("Bars");
		this.barsChain = barsChain;

		var barsTypeChain = Model.property("this.Bars.Type", fooType);
		this.barsTypeChain = barsTypeChain;

		var nameChain = barTypeType.property("Name");
		this.nameChain = nameChain;

		var typeNameChain = Model.property("this.Type.Name", barType);
		this.typeNameChain = typeNameChain;

		var barsTypeNameChain = Model.property("this.Bars.Type.Name", fooType);
		this.barsTypeNameChain = barsTypeNameChain;
	});

	afterEach(function() {
		delete global.Foo;
		delete global.Bar;
		delete global.BarType;
	});

	describe("each", function() {

		it("callback is given the target, target index, target array, property, property index, and property array", function() {
			var nameSpy = jasmine.jasmine.createSpy();
			this.nameChain.each(this.aType, nameSpy);
			expect(nameSpy).toHaveBeenCalledWith(this.aType, -1, null, BarType.$Name, 0, [BarType.$Name]);

			var barsSpy = jasmine.jasmine.createSpy();
			this.barsChain.each(this.foo, barsSpy);
			expect(barsSpy).toHaveBeenCalledWith(this.foo, -1, null, Foo.$Bars, 0, [Foo.$Bars]);

			var barsTypeSpy = jasmine.jasmine.createSpy();
			this.barsTypeChain.each(this.foo, barsTypeSpy);
			expect(barsTypeSpy).toHaveBeenCalledWith(this.foo, -1, null, Foo.$Bars, 0, [Foo.$Bars, Bar.$Type]);
		});

		it("iterates over each property in the chain", function() {
			var spy = jasmine.jasmine.createSpy();
			this.typeNameChain.each(this.bar1, spy);
			expect(spy).toHaveBeenCalled();
			expect(spy.callCount).toBe(2);
		});

		it("also iterates over each target in the chain when one or more properties are an array", function() {
			var spy = jasmine.jasmine.createSpy();
			this.barsTypeNameChain.each(this.foo, spy);
			expect(spy).toHaveBeenCalled();
			expect(spy.callCount).toBe(5);
		});

	});

	describe("isInited", function() {

		it("returns true if all property values are initialized", function() {
			expect(this.barsTypeNameChain.isInited(this.foo, true)).toBe(true);
		});

		it("returns false if the path is not complete", function() {
			this.bar2.set_Type(null);
			expect(this.barsTypeNameChain.isInited(this.foo, true)).toBe(false);
		});

		it("returns true if the path is not complete but enforceCompleteness is not specified", function() {
			this.bar2.set_Type(null);
			expect(this.barsTypeNameChain.isInited(this.foo)).toBe(true);
		});

	});

	describe("addChanged", function() {

		it("executes if all property values are initialized", function() {
			debugger;
			var handler = jasmine.jasmine.createSpy();
			this.barsTypeNameChain.addChanged(handler);

			this.bar2.get_Type().set_Name("b");
			expect(handler).toHaveBeenCalledWith(this.foo, {
				wasInited: true,
				originalSender: this.bType,
				property: this.barsTypeNameChain,
				triggeredBy: BarType.$Name,
				oldValue: "B",
				newValue: "b"
			});
		});

		it("does not execute if one of the paths is not complete", function() {
			var handler = jasmine.jasmine.createSpy();
			this.barsTypeNameChain.addChanged(handler);

			this.bar2.set_Type(null);
			expect(handler).not.toHaveBeenCalled();
		});

		it("executes if one of the paths is not complete and tolerate partials is set to true", function() {
			var handler = jasmine.jasmine.createSpy();
			this.barsTypeNameChain.addChanged(handler, null, false, true);

			this.bar2.set_Type(null);
			expect(handler).toHaveBeenCalledWith(this.foo, {
				wasInited: true,
				originalSender: this.bar2,
				property: this.barsTypeNameChain,
				triggeredBy: Bar.$Type,
				oldValue: this.bType,
				newValue: null
			});
		});

	});

});

// Run Tests
///////////////////////////////////////

jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
