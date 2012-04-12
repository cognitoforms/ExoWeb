function ResponseHandler(model, serverSync, options) {
	if (options === undefined || options === null) {
		throw new Error("Options cannot be null or undefined.");
	}

	this._model = model;
	this._serverSync = serverSync;
	this._options = options;
}

ResponseHandler.mixin({
	execute: ExoWeb.FunctionChain.prepare(
	// Load types from JSON
	//////////////////////////////////////////
		function loadTypes(callback, thisPtr) {
			if (this._options.types) {
				ExoWeb.trace.log("responseHandler", "Loading types.");
				for (var typeName in this._options.types) {
					var signal = new ExoWeb.Signal("embeddedType(" + typeName + ")");

					// load type(s)
					var typesToUse = {};
					typesToUse[typeName] = this._options.types[typeName];
					typesFromJson(this._model, typesToUse);

					var mtype = this._model.type(typeName);

					// ensure base classes are loaded too
					mtype.eachBaseType(function(mtype) {
						if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
							ExoWeb.Model.LazyLoader.load(mtype, null, signal.pending());
						}
					});

					signal.waitForAll(function() {
						TypeLazyLoader.unregister(mtype);
						raiseExtensions(mtype);
					});
				}
			}

			callback.call(thisPtr || this);
		},

	// Apply "init new" changes
	//////////////////////////////////////////
		function applyInitChanges(callback, thisPtr) {
			if (this._options.changes) {
				ExoWeb.trace.log("responseHandler", "Applying \"init new\" changes.");

				var changes = Array.prototype.slice.apply(this._options.changes);

				var initChanges = changes.filter(function (change) {
					return change.type === "InitNew";
				});

				this._serverSync.applyChanges(initChanges, this._options.source);

				callback.call(thisPtr);
			}
			else {
				callback.call(thisPtr || this);
			}
		},

	// Load instance data from JSON
	//////////////////////////////////////////
		function loadInstances(callback, thisPtr) {
			if (this._options.instances) {
				ExoWeb.trace.log("responseHandler", "Loading instances.");
				objectsFromJson(this._model, this._options.instances, callback, thisPtr);
			}
			else {
				callback.call(thisPtr || this);
			}
		},

	// Apply non-"init new" changes
	//////////////////////////////////////////
		function applyNonInitChanges(callback, thisPtr) {
			if (this._options.changes) {
				ExoWeb.trace.log("responseHandler", "Applying non-\"init new\" changes.");

				var changes = Array.prototype.slice.apply(this._options.changes);

				var initChanges = changes.filter(function (change) {
					return change.type !== "InitNew";
				});

				this._serverSync.applyChanges(initChanges, this._options.source);

				callback.call(thisPtr);
			}
			else {
				callback.call(thisPtr || this);
			}
		},

	// Load conditions from JSON
	//////////////////////////////////////////
		function loadConditions(callback, thisPtr) {
			if (this._options.conditions) {
				ExoWeb.trace.log("reponseHandler", "Loading conditions.");
				conditionsFromJson(this._model, this._options.conditions, callback, thisPtr);
			}
			else {
				callback.call(thisPtr || this);
			}
		}
	)
});

exports.ResponseHandler = ResponseHandler;
