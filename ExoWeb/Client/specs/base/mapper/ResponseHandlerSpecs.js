// Imports
///////////////////////////////////////
var jasmine = require("../../../ref/jasmine/jasmine");
var jasmineConsole = require("../../../ref/jasmine/jasmine.console");

jasmine.jasmine.debug = true;

window = {};
ExoWeb = {};

var functions = require("../../../src/base/core/Function");
var functionChain = require("../../../src/base/core/FunctionChain");
var arrays = require("../../../src/base/core/Array");

var config = require("../../../src/base/core/Config");
global.config = config.config;

var activity = require("../../../src/base/core/Activity");
global.registerActivity = activity.registerActivity;

var functor = require("../../../src/base/core/Functor");
global.Functor = functor.Functor;

var signal = require("../../../src/base/core/Signal");
global.Signal = signal.Signal;

var utilities = require("../../../src/base/core/Utilities");
var eventScopeModule = require("../../../src/base/core/EventScope");
global.EventScope = eventScopeModule.EventScopeCtor;

ExoWeb.config = config.config;
ExoWeb.config.signalDebug = true;

//ExoWeb.Signal = signal.Signal;
//ExoWeb.registerActivity = activity.registerActivity;
var Batch = global.Batch = require("../../../src/base/core/Batch").Batch;
//var internals = require("../../../src/base/mapper/Internals");
//var pathTokens = require("../../../src/base/model/PathTokens");
//var context = require("../../../src/base/mapper/Context");

//ObjectLazyLoader = require("../../../src/base/mapper/ObjectLazyLoader").ObjectLazyLoader;
//Model = require("../../../src/base/model/Model").Model;

$format = window.$format;
ExoWeb.FunctionChain = functionChain.FunctionChain;
//fetchTypes = internals.fetchTypes;

var responseHandler = require("../../../src/base/mapper/ResponseHandler");

// References
///////////////////////////////////////
var ResponseHandler = responseHandler.ResponseHandler;
var describe = jasmine.describe;
var it = jasmine.it;
var expect = jasmine.expect;

global.raiseExtensions = function() { };

function arrayEquals(arr1, arr2, unordered) {
	expect(arr1.length).toBe(arr2.length);

	if (unordered) {
		arr1 = Array.prototype.slice.call(arr1);
		arr2 = Array.prototype.slice.call(arr2);

		while (arr1.length > 0) {
			var idx = arr2.indexOf(arr1[0]);
			expect(arr1[0]).toBe(arr2[idx]);
			arr1.splice(0, 1);
			arr2.splice(idx, 1);
		}
	}
	else {
		expect("\n\n" + arr1.join("\n") + "\n\n").toBe("\n\n" + arr2.join("\n") + "\n\n");
	}
}

// Test Suites
///////////////////////////////////////
describe("ResponseHandler", function () {
	it("requires an options argument", function () {
		expect(function () {
			new ResponseHandler();
		}).toThrow(new Error("Options cannot be null or undefined."));
	});

	it("loads types, [init] changes, instances, [non-init] changes, and conditions in the correct order", function () {
		var objs = {
			Person: {
				"?1": [null, "Doe", { type: "Person", id: "1"}],
				"1": ["John", "Doe", null]
			}
		};

		var types = {
			Person: {
				properties: {
					FirstName: { type: "String", index: 0 },
					LastName: { type: "String", index: 1 }
				}
			}
		};

		var changes = [
			{
				type: "InitNew",
				instance: { type: "Person", id: "?1" }
			},
			{
				type: "ReferenceChange",
				instance: { type: "Person", id: "?1" },
				property: "LegalGuardian",
				oldValue: null,
				newValue: { type: "Person", id: "1" }
			}
		];

		var conditions = {
			"Person.FirstNameRequired": [
				{
					targets: [
						{
							instance: { type: "Person", id: "?1" },
							properties: ["FirstName"]
						}
					]
				}
			]
		};

		var mocks = {
			typesFromJson: function (model, json) {
				expect(model).toBe(modelObj);
				expect(json.Person).toBe(types.Person);
				expect(objSpy).not.toHaveBeenCalled();
				expect(changeSpy).not.toHaveBeenCalled();
			},
			objectsFromJson: function (model, json, callback, thisPtr) {
				expect(model).toBe(modelObj);
				expect(json).toBe(objs);
				expect(typeSpy).toHaveBeenCalled();
				expect(changeSpy).toHaveBeenCalled();

				callback.call(thisPtr || this);
			},
			conditionsFromJson: function (model, json, forInstances, callback, thisPtr) {
				expect(model).toBe(modelObj);
				expect(json).toBe(conditions);
				expect(typeSpy).toHaveBeenCalled();
				expect(changeSpy).toHaveBeenCalled();
				expect(objSpy).toHaveBeenCalled();

				callback.call(thisPtr || this);
			},
			applyChanges: function (checkpoint, changesArg, source, serverSync, beforeApply, afterApply, callback, thisPtr) {
				expect(typeSpy).toHaveBeenCalled();
				expect(source).toBe("init");
				arrayEquals(changesArg, changes);
				expect(objSpy).not.toHaveBeenCalled();

				callback.call(thisPtr || this);
			}
		};

		var typeSpy = jasmine.spyOn(mocks, "typesFromJson").andCallThrough();
		var objSpy = jasmine.spyOn(mocks, "objectsFromJson").andCallThrough();
		var changeSpy = jasmine.spyOn(mocks, "applyChanges").andCallThrough();
		var conditionsSpy = jasmine.spyOn(mocks, "conditionsFromJson").andCallThrough();

		var modelObj = {
			type: function() {
				return {
					eachBaseType: function() {
						return;
					}
				};
			},
			registerRules: jasmine.jasmine.createSpy()
		};

		ExoWeb.Model = { LazyLoader: { load: function() { } } };
		var lazyLoadSpy = jasmine.spyOn(ExoWeb.Model.LazyLoader, "load").andCallThrough();

		global.TypeLazyLoader = { unregister: function() { } };

		var serverSyncObj = { applyChanges: changeSpy };

		typesFromJson = typeSpy;
		objectsFromJson = objSpy;
		conditionsFromJson = conditionsSpy;

		var handler = new ResponseHandler(modelObj, serverSyncObj, {
			types: types,
			instances: objs,
			conditions: conditions,
			changes: changes,
			source: "init"
		});

		handler.execute();

		expect(typeSpy).toHaveBeenCalled();
		expect(objSpy).toHaveBeenCalled();
		expect(changeSpy).toHaveBeenCalled();
		expect(conditionsSpy).toHaveBeenCalled();
	});
});

// Run Tests
///////////////////////////////////////
jasmine.jasmine.getEnv().addReporter(new jasmineConsole.Reporter());
jasmine.jasmine.getEnv().execute();
