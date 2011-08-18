// Imports
///////////////////////////////////////
var jasmine = require("../../jasmine");
var jasmineConsole = require("../../jasmine.console");

jasmine.jasmine.debug = true;

window = global;
ExoWeb = {
	registerActivity: function() { },
	Model: {
		LazyLoader: {
			eval: function(source, path, callback) {
				callback(null);
			}
		}
	}
};

Function.prototype.initializeBase = function() { };
Function.prototype.registerClass = function() { };
Function.prototype.callBaseMethod = function() { };
Sys = {
	Component: null,
	UI: {
		ITemplateContextConsumer: null
	}
};

var functions = require("../../../src/base/core/Function");
var binding = require("../../../src/base/view/Binding");
var evalWrapper = require("../../../src/base/core/EvalWrapper");
var transform = require("../../../src/base/core/Transform");
var typeChecking = require("../../../src/base/core/typeChecking");
var utilities = require("../../../src/base/core/Utilities");
var batch = require("../../../src/base/core/Batch");

global.getValue = ExoWeb.getValue;
global.isObject = typeChecking.isObject;
global.isArray = typeChecking.isArray;
global.isNullOrUndefined = typeChecking.isNullOrUndefined;
global.Batch = batch.Batch;

// References
///////////////////////////////////////
var Binding = binding.Binding;
var beforeEach = jasmine.beforeEach;
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;

function onBeforeEach() {
	var self = this;

	self.isDomElement = false;

	Sys = {
		UI: {
			DomElement: {
				isDomElement: function() { return self.isDomElement; }
			}
		},
		Observer: {
			addPathChanged: function() {},
			addCollectionChanged: function() {},
			makeObservable: function() {},
			raisePropertyChanged: function() {},
			setValue: function() {}
		},
		Application: {
			_clearContent: function() { }
		}
	};

	self.evalResult = null;

	ExoWeb.Model.LazyLoader.eval = function(source, path, callback) {
		callback(self.evalResult);
	};

	self.getResult = null;
	self.getResultFn = null;

	get = function() {
		return self.getResultFn ? self.getResultFn.apply(this, arguments) : self.getResult;
	};
}

// Test Suites
///////////////////////////////////////
describe("Basic behavior", function() {

	describe("Binding", function() {

		beforeEach(onBeforeEach);

		it("watches for a path change if a source path is provided", function() {
			var pathChangedSpy = jasmine.spyOn(Sys.Observer, "addPathChanged").andCallThrough();

			var source = {};
			this.evalResult = "value";
			var adapter = new Binding(null, source, "property");

			expect(pathChangedSpy).toHaveBeenCalledWith(source, "property", adapter._pathChangedHandler, true);
		});

		it("does not watch for a path change if a source path is not provided", function() {
			var pathChangedSpy = jasmine.spyOn(Sys.Observer, "addPathChanged").andCallThrough();

			var source = {};
			this.evalResult = source;
			var adapter = new Binding(null, source, null);

			expect(pathChangedSpy).not.toHaveBeenCalled();
		});

		it("sets the target to the source value if no path is specified", function() {
			var setTargetSpy = jasmine.spyOn(Binding.prototype, "_setTarget").andCallThrough();

			var source = {};
			this.evalResult = source;
			var adapter = new Binding(null, source, null);

			expect(setTargetSpy).toHaveBeenCalledWith(source);
		});

		it("sets the target to the source path's initial value if no transformations are specified", function() {
			var setTargetSpy = jasmine.spyOn(Binding.prototype, "_setTarget").andCallThrough();

			var source = {};
			var value = "value";
			this.evalResult = value;
			var adapter = new Binding(null, source, "value");

			expect(setTargetSpy).toHaveBeenCalledWith(value);
		});

	});

});

describe("Transform option", function() {

	beforeEach(onBeforeEach);

	describe("Binding", function() {

		it("sets the target to the source path's transformed value if a transformation is specified", function() {
			var list;
			var setTargetSpy = jasmine.spyOn(Binding.prototype, "_setTarget").andCallFake(function(value) {
				list = value;
			});

			var source = {};
			var value = [{ val: 2 }, { val: 3 }, { val: 4 }];
			this.evalResult = value;

			var adapter = new Binding({ index: 0, dataItem: source }, source, "value", { get_element: function() { } }, "value", { transform: "where('val>2')" });

			expect(setTargetSpy).toHaveBeenCalled();
			expect(list.length).toBe(2);
			expect(list[0].val).toBe(3);
			expect(list[1].val).toBe(4);
		});

	});

});

describe("Format option", function() {

	beforeEach(onBeforeEach);

	describe("Binding", function() {

		it("sets the target to the source path's formatted value if a format is specified", function() {
			var formattedValue;
			var setTargetSpy = jasmine.spyOn(Binding.prototype, "_setTarget").andCallFake(function(value) {
				formattedValue = value;
			});

			var source = {};
			var value = new Date(2011, 1, 1);
			this.evalResult = value;

			Date.formats = {
				fake: {
					convert: function(obj) {
						return obj.getMonth() + "/" + obj.getDate() + "/" + obj.getFullYear();
					}
				}
			};

			var adapter = new Binding({ index: 0, dataItem: source }, source, "value", { get_element: function() { } }, "value", { format: "fake" });

			expect(setTargetSpy).toHaveBeenCalled();
			expect(formattedValue).toBe("1/1/2011");

			delete Date.formats;
		});

	});

});

describe("IfNull option", function() {

	beforeEach(onBeforeEach);

	describe("Binding", function() {

		it("sets the target to the given value if the source value is null or undefined", function() {
			var setTargetSpy = jasmine.spyOn(Binding.prototype, "_setTarget").andCallThrough();
			var adapter = new Binding({ index: 0, dataItem: {} }, {}, "value", { get_element: function() { } }, "value", { ifNull: "n/a" });
			expect(setTargetSpy).toHaveBeenCalledWith("n/a");
		});

	});

});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
