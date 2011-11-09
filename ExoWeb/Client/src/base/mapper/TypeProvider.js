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

	// If some (or all) of the types are currently cached, go ahead and call the success function.
	if (cachedTypes.length > 0) {
		var json = {};

		cachedTypes.forEach(function(type) {
			json[type] = ExoWeb.cache(type).types[type];
		});

		callback.call(thisPtr || this, true, json);
	}

	if (typesToLoad.length > 0) {
		typeProviderFn.call(this, typesToLoad,
			function typeProviderSuccess(result) {
				ExoWeb.Batch.resume(batch);

				for (var type in result.types) {
					if (result.types.hasOwnProperty(type)) {
						// construct a json object, with the cachehash, for cacheing
						var json = { cacheHash: ExoWeb.cacheHash, types: {} };

						// extract the type definition
						json.types[type] = result.types[type];

						// cache the type
						ExoWeb.cache(type, json);
					}
				}

				if (callback) {
					callback.call(thisPtr || this, true, result.types);
				}
			},
			function typeProviderFailure() {
				ExoWeb.Batch.resume(batch);
				if (callback) {
					var args = copy(arguments);
					args.splice(0, 0, false);
					callback.apply(thisPtr || this, args);
				}
			});
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
