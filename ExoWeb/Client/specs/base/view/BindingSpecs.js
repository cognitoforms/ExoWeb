// Imports
///////////////////////////////////////
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");

jasmine.jasmine.debug = true;

window = global;
global.registerActivity = function() {};
LazyLoader = {
	eval: function (target, path, successCallback, errorCallback, scopeChain, thisPtr) {
		if (thisPtr) {
			successCallback.call(thisPtr, null);
		} else {
			successCallback(null);
		}
	},
	evalAll: function (target, path, successCallback, errorCallback, scopeChain, thisPtr) {
		if (thisPtr) {
			successCallback.call(thisPtr);
		} else {
			successCallback();
		}
	}
};
ExoWeb = {
	Model: {
	},
	Observer: {
		addPathChanged: function () { },
		removePathChanged: function () { },
		makeObservable: function () { },
		disposeObservable: function () { },
		addCollectionChanged: function () { },
		removeCollectionChanged: function () { },
		addPropertyChanged: function () { },
		removePropertyChanged: function () { },
		raisePropertyChanged: function () { },
		setValue: function () { }
	}
};
Observer = ExoWeb.Observer;

Function.prototype.initializeBase = function() { };
Function.prototype.registerClass = function() { };
Function.prototype.callBaseMethod = function () { };
Sys = {
	Component: null,
	UI: {
		ITemplateContextConsumer: null
	}
};

var functions = require("../../../src/base/core/Function");
var arrays = require("../../../src/base/core/Array");
var binding = require("../../../src/base/view/Binding");
var evalWrapper = require("../../../src/base/core/EvalWrapper");
var transform = require("../../../src/base/core/Transform");
var typeChecking = require("../../../src/base/core/typeChecking");
var utilities = require("../../../src/base/core/Utilities");
var batch = require("../../../src/base/core/Batch");
var formatProvider = require("../../../src/base/model/FormatProvider");
var random = require("../../../src/base/core/Random");

ExoWeb.randomText = random.randomText;

global.Transform = transform.Transform;

var getFormat = global.getFormat = formatProvider.getFormat;
var setFormatProvider = global.setFormatProvider = formatProvider.setFormatProvider;
var getValue = global.getValue = utilities.getValue;
var evalPath = global.evalPath = utilities.evalPath;
var isObject = global.isObject = typeChecking.isObject;
var isArray = global.isArray = typeChecking.isArray;
var isNatural = global.isNatural = typeChecking.isNatural;
var isInteger = global.isInteger = typeChecking.isInteger;
var isNullOrUndefined = global.isNullOrUndefined = typeChecking.isNullOrUndefined;
var forEach = global.forEach = arrays.forEach;
var Batch = global.Batch = batch.Batch;

setFormatProvider(function FormatProvider(type, format) {
	return {
		convert: function (val) {
			if (val instanceof Date) {
				return $format("{0}/{1}/{2}", [val.getMonth(), val.getDate(), 1900 + val.getYear()]);
			}
			else {
				return val.toString();
			}
		},
		convertBack: function (str) {
			return str;
		}
	};
});

// References
///////////////////////////////////////
var Binding = binding.Binding;
var beforeEach = jasmine.beforeEach;
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;
var any = jasmine.any;

function onBeforeEach() {
	var self = this;

	self.isDomElement = false;

	Sys = {
		UI: {
			DomElement: {
				isDomElement: function() { return self.isDomElement; }
			}
		},
		Application: {
			_clearContent: function() { }
		}
	};

	self.evalResult = null;

	LazyLoader.eval = function(source, path, callback) {
		callback(self.evalResult, false, source);
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
			var addPathChangedSpy = jasmine.spyOn(ExoWeb.Observer, "addPathChanged").andCallThrough();

			var source = {};
			this.evalResult = "value";
			var binding = new Binding(null, source, "property", {});

			expect(addPathChangedSpy).toHaveBeenCalledWith(source, "property", any(Function), true);
		});

		it("does not watch for a path change if a source path is not provided", function() {
			var addPathChangedSpy = jasmine.spyOn(ExoWeb.Observer, "addPathChanged").andCallThrough();

			var source = {};
			this.evalResult = source;
			var binding = new Binding(null, source, null, {});

			expect(addPathChangedSpy).not.toHaveBeenCalled();
		});

		it("sets the target to the source value if no path is specified", function() {
			var setTargetSpy = jasmine.spyOn(Binding.prototype, "_setTarget").andCallThrough();

			var source = {};
			this.evalResult = source;
			var binding = new Binding(null, source, null, {});

			expect(setTargetSpy).toHaveBeenCalledWith(source);
		});

		it("sets the target to the source path's initial value if no transformations are specified", function() {
			var setTargetSpy = jasmine.spyOn(Binding.prototype, "_setTarget").andCallThrough();

			var source = {};
			var value = "value";
			this.evalResult = value;
			var binding = new Binding(null, source, "value", {});

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

			var binding = new Binding({ index: 0, dataItem: source }, source, "value", { get_element: function() { } }, "value", { transform: "where('val>2')" });

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

			var binding = new Binding({ index: 0, dataItem: source }, source, "value", { get_element: function() { } }, "value", { format: "fake" });

			expect(setTargetSpy).toHaveBeenCalled();
			expect(formattedValue).toBe("1/1/2011");

			delete Date.formats;
		});

	});

});

describe("nullValue option", function () {

	beforeEach(onBeforeEach);

	describe("Binding", function () {

		it("sets the target to the given value if the source value is null or undefined", function () {
			var binding = new Binding({ index: 0, dataItem: {} }, {}, "value", { get_element: function () { } }, "value", { nullValue: "n/a" });
			expect(binding._getValue(null)).toBe("n/a");
		});

	});

});

describe("Required option", function() {

	beforeEach(onBeforeEach);

	describe("Binding", function() {

		it("loads the required path rooted at the result value", function() {
			var evalAllSpy = jasmine.spyOn(LazyLoader, "evalAll").andCallThrough();
			var setTargetSpy = jasmine.spyOn(Binding.prototype, "_setTarget").andCallThrough();

			var value = [{ val: 2 }, { val: 3 }, { val: 4 }];
			var source = { value: value };
			this.evalResult = value;

			var binding = new Binding({ index: 0, dataItem: source }, source, "value", { get_element: function() { } }, "value", { required: "val" });

			expect(evalAllSpy).toHaveBeenCalledWith(value, "val", any(Function), null, null, binding, LazyLoader.evalAll, false, value, [], true);
			expect(setTargetSpy).toHaveBeenCalledWith(value);
		});

		it("watches for changes to the required path", function() {
			var handlers = [];
			var addPathChangedSpy = jasmine.spyOn(ExoWeb.Observer, "addPathChanged").andCallFake(function (source, path, handler) {
				handlers.push(handler);
			});
			var setTargetSpy = jasmine.spyOn(Binding.prototype, "_setTarget").andCallThrough();

			var value = [{ val: 2 }, { val: 3 }, { val: 4 }];
			var source = { value: value };
			this.evalResult = value;

			var binding = new Binding({ index: 0, dataItem: source }, source, "value", { get_element: function() { } }, "value", { required: "val" });

			expect(addPathChangedSpy).toHaveBeenCalledWith(source, "value", any(Function), true);
			expect(addPathChangedSpy).toHaveBeenCalledWith(value[0], "val", any(Function), true);
			expect(addPathChangedSpy).toHaveBeenCalledWith(value[1], "val", any(Function), true);
			expect(addPathChangedSpy).toHaveBeenCalledWith(value[2], "val", any(Function), true);
			expect(setTargetSpy).toHaveBeenCalledWith(value);

			addPathChangedSpy.reset();
			setTargetSpy.reset();

			value[0].val = 0;
			handlers[1].call(binding);
			expect(setTargetSpy).toHaveBeenCalledWith(value);

			setTargetSpy.reset();

			binding._watchedItemPathChangedHandler();
			expect(setTargetSpy).toHaveBeenCalledWith(value);
		});

		it("cleans up path registrations and adds new registrations when resulting value is manipulated (list)", function() {
			var addPathChangedSpy = jasmine.spyOn(ExoWeb.Observer, "addPathChanged").andCallThrough();
			var removePathChangedSpy = jasmine.spyOn(ExoWeb.Observer, "removePathChanged").andCallThrough();
			var addCollectionChangedSpy = jasmine.spyOn(ExoWeb.Observer, "addCollectionChanged").andCallThrough();
			var removeCollectionChangedSpy = jasmine.spyOn(ExoWeb.Observer, "removeCollectionChanged").andCallThrough();
			var setTargetSpy = jasmine.spyOn(Binding.prototype, "_setTarget").andCallThrough();

			var value = [{ val: 2 }, { val: 3 }, { val: 4 }];
			var source = { value: value };
			this.evalResult = value;

			var binding = new Binding({ index: 0, dataItem: source }, source, "value", { get_element: function() { } }, "value", { required: "val" });

			expect(addPathChangedSpy).toHaveBeenCalledWith(source, "value", any(Function), true);
			expect(addPathChangedSpy).toHaveBeenCalledWith(value[0], "val", any(Function), true);
			expect(addPathChangedSpy).toHaveBeenCalledWith(value[1], "val", any(Function), true);
			expect(addPathChangedSpy).toHaveBeenCalledWith(value[2], "val", any(Function), true);
			expect(setTargetSpy).toHaveBeenCalledWith(value);

			setTargetSpy.reset();

			var removed = value[2];
			var added = { val: 0 };
			value.splice(2, 1, added);
			binding._collectionChangedHandler(value, {
				get_changes: function() {
					return [{ newItems: [added], oldItems: [removed] }];
				}
			});

			expect(removePathChangedSpy).toHaveBeenCalledWith(removed, "val", any(Function));
			expect(addPathChangedSpy).toHaveBeenCalledWith(added, "val", any(Function), true);
		});

	});

});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
