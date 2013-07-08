/// <reference path="../core/Cache.js" />
/// <reference path="../core/Array.js" />
/// <reference path="../core/Batch.js" />
/// <reference path="../core/Utilities.js" />

/*global exports, Batch, copy, purge, eachProp */

var typeProviderFn = function typeProviderFn() {
	"use strict";
	throw new Error("Type provider has not been implemented. Call ExoWeb.Mapper.setTypeProvider(fn);");
};

function typeProviderImpl(types, callback, thisPtr) {
	"use strict";

	var batch = Batch.suspendCurrent("typeProvider"),
		typesToLoad = copy(types),
		cachedTypes = [],
		typesJson = {};

	purge(typesToLoad, function (type) {
		var cachedType = window.ExoWeb.cache(type);

		if (!cachedType) {
			return false;
		}
		else if (window.ExoWeb.cacheHash && cachedType.cacheHash !== window.ExoWeb.cacheHash) {
			// the cached type definition is out of date, so remove it and continue
			window.ExoWeb.cache(type, null);
			return false;
		}

		cachedTypes.push(type);
		return true;
	});

	// If some (or all) of the types are currently cached, go ahead and call the success function.
	if (cachedTypes.length > 0) {
		cachedTypes.forEach(function (type) {
			typesJson[type] = window.ExoWeb.cache(type).types[type];
		});
	}

	if (typesToLoad.length > 0) {
		typeProviderFn(typesToLoad,
			function (result) {
				Batch.resume(batch);

				var resultsJson = result.types;

				// Add the resulting json and cache each type.
				eachProp(resultsJson, function (type) {

					// construct a json object, with the cachehash, for cacheing
					var json = { cacheHash: window.ExoWeb.cacheHash, types: {} };

					// extract the type definition
					json.types[type] = typesJson[type] = resultsJson[type];

					// cache the type
					window.ExoWeb.cache(type, json);

				});

				callback.call(thisPtr || null, true, typesJson);
			},
			function () {
				Batch.resume(batch);

				var args = copy(arguments);
				args.splice(0, 0, false);
				callback.apply(thisPtr || null, args);
			});
	}
	else {
		Batch.resume(batch);
		callback.call(thisPtr || null, true, typesJson);
	}
}

function deleteTypeJson(originalArgs, invocationArgs, callbackArgs) {
	"use strict";

	// If type request was handled by another caller, then assume that typesFromJson will be called
	if (callbackArgs[0]) {
		callbackArgs.splice(1, 1, {}, callbackArgs[1]);
	}
}

var typeProvider = typeProviderImpl.dontDoubleUp({ callbackArg: 1, partitionedArg: 0, partitionedFilter: deleteTypeJson, memoize: true });

exports.setTypeProvider = function setTypeProvider(fn) {
	"use strict";
	typeProviderFn = fn;
};

exports.typeProvider = typeProvider; // IGNORE
