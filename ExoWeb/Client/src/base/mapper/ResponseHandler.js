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
		function ResponseHandler$startResponseBatch(callback, thisPtr) {
			/// <summary>
			/// Start a new response batch.
			/// </summary>

			this._batch = Batch.start("ResponseHandler");
			callback.call(thisPtr || this);
		},
		function ResponseHandler$setServerInfo(callback, thisPtr) {
			/// <summary>
			/// Set server info from JSON
			/// </summary>

			if (this._options.serverInfo) {
				this._serverSync.set_ServerInfo(this._options.serverInfo);
			}

			callback.call(thisPtr || this);
		},

		function ResponseHandler$loadTypes(callback, thisPtr) {
			/// <summary>
			/// Load types from JSON
			/// </summary>
			if (this._options.types) {
				for (var typeName in this._options.types) {
					var mtype = this._model.type(typeName);

					// If this type has not already been loaded, laod from JSON
					if (!mtype || !ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
						var typesToUse = {};
						typesToUse[typeName] = this._options.types[typeName];
						typesFromJson(this._model, typesToUse);

						mtype = this._model.type(typeName);

						// Remove lazy-loader
						TypeLazyLoader.unregister(mtype);

						// Raise jQuery.extends for the type
						raiseExtensions(mtype);
					}
				}
			}

			callback.call(thisPtr || this);
		},

		function ResponseHandler$startQueueingEvents(callback, thisPtr) {
			/// <summary>
			/// Start queueing model events
			/// </summary>

			this._eventScope = new EventScope();
			callback.call(thisPtr || this);
		},

		function ResponseHandler$applyChanges(callback, thisPtr) {
			/// <summary>
			/// Apply changes from JSON
			/// </summary>

			if (this._options.changes) {
				if (this._options.changes) {
					this._serverSync.applyChanges(this._options.checkpoint, this._options.changes, this._options.source, null, this._options.beforeApply, this._options.afterApply, callback, thisPtr);
				}
				else {
					if (this._options.source) {
						// no changes, so record empty set
						this._serverSync._changeLog.start(this._options.source);
						this._serverSync._changeLog.start("client");
					}
					callback.call(thisPtr || this);
				}
			}
			else {
				callback.call(thisPtr || this);
			}
		},

		function ResponseHandler$loadInstances(callback, thisPtr) {
			/// <summary>
			/// Load instance data from JSON
			/// </summary>

			if (this._options.instances) {
				objectsFromJson(this._model, this._options.instances, function (instancesPendingInit) {
					this.instancesPendingInit = instancesPendingInit;
					callback.apply(thisPtr || this, arguments);
				}, this);
			}
			else {
				callback.call(thisPtr || this);
			}
		},

		function ResponseHandler$registerRules(callback, thisPtr) {
			/// <summary>
			/// Register all rules pending registration with the model
			/// </summary>

			this._model.registerRules();
			callback.call(thisPtr || this);
		},

		function ResponseHandler$stopQueueingEvents(callback, thisPtr) {
			/// <summary>
			/// Stop queueing model events
			/// </summary>

			this._eventScope.exit();
			callback.call(thisPtr || this);
		},

		function ResponseHandler$initInstances(callback, thisPtr) {
			/// <summary>
			/// Initialize all instances loaded by the response
			/// </summary>

			// Raise init events for existing instances loaded by the response
			if (this.instancesPendingInit) {
				this.instancesPendingInit.forEach(function (obj) {
					for (var t = obj.meta.type; t; t = t.baseType) {
						var handler = t._getEventHandler("initExisting");
						if (handler)
							handler(obj, {});
					}
				});
			}

			callback.call(thisPtr || this);
		},

		function ResponseHandler$loadConditions(callback, thisPtr) {
			/// <summary>
			/// Load conditions from JSON
			/// </summary>

			if (this._options.conditions) {
				conditionsFromJson(this._model, this._options.conditions, this.instancesPendingInit, callback, thisPtr);
			}
			else {
				callback.call(thisPtr || this);
			}
		},

		function ResponseHandler$endResponseBatch(callback, thisPtr) {
			/// <summary>
			/// End the response batch.
			/// </summary>

			Batch.end(this._batch);
			callback.call(thisPtr || this);
		}
	)
});

exports.ResponseHandler = ResponseHandler;
