// Imports
///////////////////////////////////////
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");

jasmine.jasmine.debug = true;

window = {};
ExoWeb = window.ExoWeb = {};
ExoWeb.Model = {};

var functions = require("../../../src/base/core/Function");
var arrays = require("../../../src/base/core/Array");

var PathTokens = require("../../../src/base/model/PathTokens").PathTokens;

// References
///////////////////////////////////////
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;

// Test Suites
///////////////////////////////////////
describe("PathTokens", function() {
	it("can parse a simple path", function() {
		var path = new PathTokens("a.b.c");
		expect(path.steps.length).toBe(3);
		expect(path.steps[0].property).toBe("a");
		expect(path.steps[1].property).toBe("b");
		expect(path.steps[2].property).toBe("c");
	});
	
	it("can interpret casts", function() {
		var path = new PathTokens("a.b<B>.c");
		expect(path.steps[1].cast).toBe("B");
	});
	
	it("can handle alphanum, underscore, and period in casts", function() {
		var path = new PathTokens("a.b<B4>.c<C._4>.d");
		expect(path.steps.length).toBe(4);
		expect(path.steps[1].cast).toBe("B4");
		expect(path.steps[2].cast).toBe("C._4");
	});

	function arrayEquals(arr1, arr2) {
		expect(arr1.length).toBe(arr2.length);
		expect("\n\n" + arr1.join("\n") + "\n\n").toBe("\n\n" + arr2.join("\n") + "\n\n");
	}

	it("can normalize condensed paths", function() {
		function normalizePaths(input, expected) {
			var tokens = PathTokens.normalizePaths(input);

			var actual = tokens.map(function(t) {
				return t.buildExpression();
			});

			arrayEquals(expected, actual);
		}

		normalizePaths([], []);

		normalizePaths(["this.Student"], ["this.Student"]);

		normalizePaths(["this.Student", "this.Parent"],
		[
			"this.Student",
			"this.Parent"
		]);

		normalizePaths(["this.Student{Prop1}"],
		[
			"this.Student.Prop1",
		]);

		normalizePaths(["this.Student{Prop1, Prop2}"],
		[
			"this.Student.Prop1",
			"this.Student.Prop2",
		]);

		normalizePaths(["this{Student{Prop1, Prop2}}"],
		[
			"this.Student.Prop1",
			"this.Student.Prop2",
		]);

		normalizePaths(["this.Student{Prop1, Prop2{PropA, PropB}, Prop3}}"],
		[
			"this.Student.Prop1",
			"this.Student.Prop2.PropA",
			"this.Student.Prop2.PropB",
			"this.Student.Prop3",
		]);

		normalizePaths(["this.Student<Type>{Prop1, Prop2}}"],
		[
			"this.Student<Type>.Prop1",
			"this.Student<Type>.Prop2",
		]);

		normalizePaths(["this.ItemDef{ItemType.IsRootItemType, IsVersioned, ItemOutcomes.NextStatus, DocumentDefinitions{Inputs, FinalizeType}}"],
		[
			"this.ItemDef.ItemType.IsRootItemType",
			"this.ItemDef.IsVersioned",
			"this.ItemDef.ItemOutcomes.NextStatus",
			"this.ItemDef.DocumentDefinitions.Inputs",
			"this.ItemDef.DocumentDefinitions.FinalizeType"
		]);
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();

