var typeProviderFn = function typeProviderFn(types, onSuccess, onFailure) {
	throw "Type provider has not been implemented.  Call ExoWeb.Mapper.setTypeProvider(fn);";
};

function typeProviderImpl(types, callback, thisPtr) {
	var batch = ExoWeb.Batch.suspendCurrent("typeProvider");

	var typesToLoad = copy(types);
	var cachedTypes = [];
	purge(typesToLoad, function(type) {
		var cachedType = ExoWeb.cache(type);

		if (!cachedType) {
			return false;
		}
		else if (ExoWeb.cacheHash && cachedType.cacheHash !== ExoWeb.cacheHash) {
			// the cached type definition is out of date, so remove it and continue
			ExoWeb.cache(type, null);
			return false;
		}

		cachedTypes.push(type);
		return true;
	});

	var typesJson = {};

	// If some (or all) of the types are currently cached, go ahead and call the success function.
	if (cachedTypes.length > 0) {
		cachedTypes.forEach(function(type) {
			typesJson[type] = ExoWeb.cache(type).types[type];
		});
	}

	if (typesToLoad.length > 0) {
		typeProviderFn.call(this, typesToLoad,
			function typeProviderSuccess(result) {
				ExoWeb.Batch.resume(batch);

				var resultsJson = result.types;

				// Add the resulting json and cache each type.
				eachProp(resultsJson, function(type) {

					// construct a json object, with the cachehash, for cacheing
					var json = { cacheHash: ExoWeb.cacheHash, types: {} };

					// extract the type definition
					json.types[type] = typesJson[type] = resultsJson[type];

					// cache the type
					ExoWeb.cache(type, json);

				});

				callback.call(thisPtr || this, true, typesJson);
			},
			function typeProviderFailure() {
				ExoWeb.Batch.resume(batch);

				var args = copy(arguments);
				args.splice(0, 0, false);
				callback.apply(thisPtr || this, args);
			});
	}
	else {
		callback.call(thisPtr || this, true, typesJson);
	}
}

function deleteTypeJson(originalArgs, invocationArgs, callbackArgs) {
	// If type request was handled by another caller, then assume that typesFromJson will be called
	if (callbackArgs[0]) {
		callbackArgs.splice(1, 1, {}, callbackArgs[1]);
	}
}

var typeProvider = typeProviderImpl.dontDoubleUp({ callbackArg: 1, partitionedArg: 0, partitionedFilter: deleteTypeJson });

ExoWeb.Mapper.setTypeProvider = function setTypeProvider(fn) {
	typeProviderFn = fn;
};
