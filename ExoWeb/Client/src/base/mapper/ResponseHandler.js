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
		function setServerInfo(callback, thisPtr) {
			/// <summary>
			/// Set server info from JSON
			/// </summary>

			if (this._options.serverInfo) {
				this._serverSync.set_ServerInfo(this._options.serverInfo);
			}

			callback.call(thisPtr || this);
		},

		function loadTypes(callback, thisPtr) {
			/// <summary>
			/// Load types from JSON
			/// </summary>

			if (this._options.types) {
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

		function applyChanges(callback, thisPtr) {
			/// <summary>
			/// Apply changes from JSON
			/// </summary>

			if (this._options.changes) {
				if (this._options.changes) {
					this._serverSync.applyChanges(this._options.checkpoint, this._options.changes, this._options.source, null, this._options.beforeApply, this._options.afterApply);
				}
				else if (this._options.source) {
					// no changes, so record empty set
					this._serverSync._changeLog.start(this._options.source);
					this._serverSync._changeLog.start("client");
				}
				callback.call(thisPtr);
			}
			else {
				callback.call(thisPtr || this);
			}
		},

		function loadInstances(callback, thisPtr) {
			/// <summary>
			/// Load instance data from JSON
			/// </summary>

			if (this._options.instances) {
				var batch = ExoWeb.Batch.start();
				objectsFromJson(this._model, this._options.instances, function() {
					ExoWeb.Batch.end(batch);
					callback.apply(this, arguments);
				}, thisPtr);
			}
			else {
				callback.call(thisPtr || this);
			}
		},

		function loadConditions(callback, thisPtr) {
			/// <summary>
			/// Load conditions from JSON
			/// </summary>

			if (this._options.conditions) {
				conditionsFromJson(this._model, this._options.conditions, callback, thisPtr);
			}
			else {
				callback.call(thisPtr || this);
			}
		}
	)
});

exports.ResponseHandler = ResponseHandler;
