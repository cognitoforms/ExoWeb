function ContextQuery(context, options) {
	this.context = context;
	this.options = options;
	this.batch = null;
	this.state = {};
}

/*
=====================================================================
Starts a batch so that others will not respond to changes that are
broadcast during querying, i.e. instance loading.
=====================================================================
*/
function ContextQuery$startBatch(callback, thisPtr) {
	ExoWeb.trace.log("context", "Starting context query batch.");
	this.batch = ExoWeb.Batch.start("context query");
	callback.call(thisPtr || this);
}

/*
=====================================================================
Perform pre-processing of model queries and their paths.
=====================================================================
*/
function ContextQuery$initModels(callback, thisPtr) {
	if (this.options.model) {
		ExoWeb.trace.log("context", "Running init step for model queries.");
		ExoWeb.eachProp(this.options.model, function (varName, query) {
			if (!query.hasOwnProperty("from") || !query.hasOwnProperty("id")) {
				ExoWeb.trace.logWarning("types", "The model query \"{0}\" requires a from and id clause.", [varName]);
			}

			// Common initial setup of state for all model queries
			this.state[varName] = { signal: new ExoWeb.Signal("createContext." + varName) };
			allSignals.pending(null, this, true);

			// Normalize (expand) the query paths
			query.and = ExoWeb.Model.PathTokens.normalizePaths(query.and);

			// Store the paths for later use in lazy loading
			ObjectLazyLoader.addPaths(query.from, query.and);

			// Only send properties (no cast expressions) to the server
			query.serverPaths = query.and.map(function (path) {
				var strPath;
				path.steps.forEach(function (step) {
					if (!strPath) {
						strPath = step.property;
					}
					else {
						strPath += "." + step.property;
					}
				});
				return strPath;
			});

			// use temporary config setting to enable/disable scope-of-work functionality
			if (ExoWeb.config.useChangeSets === true && query.inScope !== false &&
				query.id !== null && query.id !== undefined && query.id !== "" && query.id !== $newId()) {
				this.state[varName].scopeQuery = {
					type: query.from,
					ids: [query.id],
					// TODO: this will be subset of paths interpreted as scope-of-work
					paths: query.serverPaths.where(function(p) { return p.startsWith("this."); }),
					inScope: true,
					forLoad: false
				};
			}
		}, this);
	}

	callback.call(thisPtr || this);
}

/*
=====================================================================
Process embedded data as if it had been recieved from the server in
the form of a web service response. This should enable flicker-free
page loads by embedded data, changes, etc.
=====================================================================
*/
function ContextQuery$processEmbedded(callback, thisPtr) {
	ExoWeb.trace.log("context", "Processing embedded data in query.");

	if (this.options.changes) {
		ServerSync$storeInitChanges.call(this.context.server, this.options.changes);
	}

	if (this.options.instances || this.options.conditions || (this.options.types && !(this.options.types instanceof Array))) {
		var handler = new ResponseHandler(this.context.model.meta, this.context.server, {
			instances: this.options.instances,
			conditions: this.options.conditions,
			types: this.options.types
		});

		// "thisPtr" refers to the function chain in the context of
		// the function chain callback, so reference the query here
		var query = this;

		handler.execute(function () {
		    //begin tracking changes if instances/changes are embedded.
		    if (query.options.instances || query.options.changes) {
		        // begin capturing changes and watching for existing objects that are created
		        query.context.server.beginCapturingChanges();
		    }

		    callback.apply(this, arguments);
		}, thisPtr);
	}
	else {
		// begin capturing changes and watching for existing objects that are created
		this.context.server.beginCapturingChanges();

		callback.call(thisPtr || this);
	}
}

/*
=====================================================================
Detect batch query candidates and send batch request, if batching is
enabled (true by default).
=====================================================================
*/
function ContextQuery$doBatchRequest(callback, thisPtr) {
	if (this.options.model && ExoWeb.config.individualQueryLoading !== true) {
		var pendingQueries = [];
		var batchQuerySignal;

		ExoWeb.trace.log("context", "Looking for potential loading requests in query.");

		ExoWeb.eachProp(this.options.model, function(varName, query) {
			if (!query.load && query.id !== $newId() && query.id !== null && query.id !== undefined && query.id !== "") {
			
				tryGetJsType(this.context.model.meta, query.from, null, true, function(type) {
					var id = translateId(this.context.server._translator, query.from, query.id);
					var obj = type.meta.get(id);

					if (obj !== undefined) {
						this.context.model[varName] = obj;
					}
					else {
						if (batchQuerySignal === undefined) {
							batchQuerySignal = new ExoWeb.Signal("batch query");
							batchQuerySignal.pending(null, this, true);
						}

						// complete the individual query signal after the batch is complete
						batchQuerySignal.waitForAll(this.state[varName].signal.pending(null, this, true), this, true);

						var q = {
							from: query.from,
							id: query.id,
							and: query.serverPaths
						};

						if (ExoWeb.config.useChangeSets) {
							q.inScope = true;
							q.forLoad = true;
						}

						pendingQueries.push(q);
					}
				}, this);
			}
		}, this);

		if (pendingQueries.length > 0) {
			queryProvider(pendingQueries, null,
				function context$objects$callback(result) {
					objectsFromJson(this.context.model.meta, result.instances, function() {
						if (result.conditions) {
							conditionsFromJson(this.context.model.meta, result.conditions);
						}
						batchQuerySignal.oneDone();
					}, this);
				},
				function context$objects$callback(error) {
					ExoWeb.trace.logError("objectInit", "Failed to load batch query (HTTP: {_statusCode}, Timeout: {_timedOut})", error);
					batchQuerySignal.oneDone();
				}, this);
		}
	}

	callback.call(thisPtr || this);
}

/*
=====================================================================
Send individual requests and simulate for "load" option.
=====================================================================
*/
function ContextQuery$doIndividualRequests(callback, thisPtr) {
	if (this.options.model) {
		// 2) Start loading instances individually
		ExoWeb.eachProp(this.options.model, function(varName, query) {
			if(query.load) {
				// bypass all server callbacks if data is embedded
				this.state[varName].objectJson = query.load.instances;
				this.state[varName].conditionsJson = query.load.conditions;
			}
			// need to load data from server
			// fetch object state if an id of a persisted object was specified
			else if (ExoWeb.config.individualQueryLoading === true && 
				query.id !== $newId() && query.id !== null && query.id !== undefined && query.id !== "") {

				tryGetJsType(this.context.model.meta, query.from, null, true, function(type) {
					var id = translateId(this.context.server._translator, query.from, query.id);
					var obj = type.meta.get(id);

					if (obj !== undefined) {
						this.context.model[varName] = obj;
					}
					else {
						// for individual queries, include scope queries for all but the query we are sending
						var scopeQueries = [];
						if (ExoWeb.config.useChangeSets === true) {
							var currentVarName = varName;
							ExoWeb.eachProp(this.options.model, function(varName, query) {
								if (query.id !== $newId() && query.id !== null && query.id !== undefined && query.id !== "" &&
									varName !== currentVarName && this.state[varName].scopeQuery) {
									scopeQueries.push(this.state[varName].scopeQuery);
								}
							}, this);
						}

						objectProvider(query.from, [query.id], query.serverPaths, true, null, scopeQueries,
							this.state[varName].signal.pending(function context$objects$callback(result) {
								this.state[varName].objectJson = result.instances;
								this.state[varName].conditionsJson = result.conditions;
							}, this, true),
							this.state[varName].signal.orPending(function context$objects$callback(error) {
								ExoWeb.trace.logError("objectInit",
									"Failed to load {query.from}({query.id}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
									{ query: query, error: error });
							}, this, true), this);
					}
				}, this);
			}
		}, this);
	}

	callback.call(thisPtr || this);
}

/*
=====================================================================
Load static paths for queries that don't otherwise require loading.
=====================================================================
*/
function ContextQuery$doStaticRequests(callback, thisPtr) {
	if (this.options.model) {
		ExoWeb.eachProp(this.options.model, function(varName, query) {
			if (!query.load && (query.id === $newId() || query.id === null || query.id === undefined || query.id === "")) {
				if (query.serverPaths == null)
					query.serverPaths = [];

				// Remove instance paths when an id is not specified
				for (var i = query.serverPaths.length-1; i >= 0; i--) {
					if (query.serverPaths[i].startsWith("this."))
						query.serverPaths.splice(i, 1);	
				}

				// Only call the server if paths were specified
				if (query.serverPaths.length > 0)
				{
					objectProvider(null, null, query.serverPaths, false, null,
						allSignals.pending(function context$objects$callback(result) {
							// load the json. this may happen asynchronously to increment the signal just in case
							objectsFromJson(this.context.model.meta, result.instances, allSignals.pending(function() {
								if (result.conditions) {
									conditionsFromJson(this.context.model.meta, result.conditions);
								}
							}), this);
						}, this, true),
						allSignals.orPending(function context$objects$callback(error) {
							ExoWeb.trace.logError("objectInit",
								"Failed to load {query.from}({query.id}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
								{ query: query, error: error });
						}, this, true)
					);
				}
			}
		}, this);
	}

	callback.call(thisPtr || this);
}

/*
=====================================================================
Only fetch the types if they are not embedded. If the types are
embedded then fetching the types from server will cause a signal to
be created that will never be processed.
=====================================================================
*/
function ContextQuery$fetchPathTypes(callback, thisPtr) {
	if (this.options.model && (!this.options.types || this.options.types instanceof Array)) {
		ExoWeb.eachProp(this.options.model, function(varName, query) {
			fetchTypes(this.context.model.meta, query, this.state[varName].signal.pending(null, this, true));
		}, this);
	}

	callback.call(thisPtr || this);
}

/*
=====================================================================
Process instances data for queries as they finish loading.
=====================================================================
*/
function ContextQuery$processResults(callback, thisPtr) {
	if (this.options.model) {
		ExoWeb.eachProp(this.options.model, function(varName, query) {
			this.state[varName].signal.waitForAll(function context$model() {
				// construct a new object if a "newId" was specified
				if (query.id === $newId()) {
					this.context.model[varName] = new (this.context.model.meta.type(query.from).get_jstype())();

					// model object has been successfully loaded!
					allSignals.oneDone();
				}
				// otherwise, load the object from json if an id was specified
				else if (query.id !== null && query.id !== undefined && query.id !== "") {
					if (this.context.model[varName]) {
						allSignals.oneDone();
						return;
					}

					// load the json. this may happen asynchronously so increment the signal just in case
					if (!this.state[varName].objectJson) {
						ExoWeb.trace.logError("context", $format("Request failed for type {0} with id = {1}.", [query.from, query.id]));
					}

					objectsFromJson(this.context.model.meta, this.state[varName].objectJson, this.state[varName].signal.pending(function context$model$callback() {
						var mtype = this.context.model.meta.type(query.from);

						if (!mtype) {
							ExoWeb.trace.throwAndLog("context", $format("Could not get type {0} required to process query results.", [query.from]));
						}

						// TODO: resolve translator access
						var id = translateId(this.context.server._translator, query.from, query.id);
						var obj = mtype.get(id);

						if (obj === undefined) {
							ExoWeb.trace.throwAndLog("context", $format("Could not get {0} with id = {1}.", [query.from, query.id]));
						}

						this.context.model[varName] = obj;

						if (this.state[varName].conditionsJson) {
							conditionsFromJson(this.context.model.meta, this.state[varName].conditionsJson, function() {
								// model object has been successfully loaded!
								allSignals.oneDone();
							}, this);
						}
						else {
							// model object has been successfully loaded!
							allSignals.oneDone();
						}
					}), this, true);
				}

				else {
					// model object has been successfully loaded!
					allSignals.oneDone();
				}
			}, this);
		}, this, true);
	}

	callback.call(thisPtr || this);
}

/*
=====================================================================
Load type data from query.
=====================================================================
*/
function ContextQuery$fetchTypes(callback, thisPtr) {
	// load types if they are in array format.  This is for the full server/client model of ExoWeb
	//to load the types and isntance data async
	if (this.options.types && this.options.types instanceof Array) {
		// allow specifying types and paths apart from instance data
		for (var i = 0; i < this.options.types.length; i++) {
			var typeQuery = this.options.types[i];

			typeQuery.and = ExoWeb.Model.PathTokens.normalizePaths(typeQuery.and);

			// store the paths for later use
			ObjectLazyLoader.addPaths(typeQuery.from, typeQuery.and);

			// only send properties to server
			typeQuery.serverPaths = typeQuery.and.map(function(path) {
				var strPath;
				path.steps.forEach(function(step) {
					if (!strPath) {
						strPath = step.property;
					}
					else {
						strPath += "." + step.property;
					}
				});
				return strPath;
			});

			fetchTypes(this.context.model.meta, typeQuery, allSignals.pending(null, this, true));

			if (typeQuery.serverPaths.length > 0) {
				objectProvider(typeQuery.from, null, typeQuery.serverPaths, false, null,
					allSignals.pending(function context$objects$callback(result) {
						// load the json. this may happen asynchronously to increment the signal just in case
						objectsFromJson(this.context.model.meta, result.instances, allSignals.pending(function() {
							if (result.conditions) {
								conditionsFromJson(this.context.model.meta, result.conditions);
							}
						}), this);
					}, this, true),
					allSignals.orPending(function context$objects$callback(error) {
						ExoWeb.trace.logError("objectInit",
							"Failed to load {query.from}({query.id}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
							{ query: typeQuery, error: error });
					}, this, true), this);
			}
		}
	}

	callback.call(thisPtr || this);
}

/*
=====================================================================
Perform pre-processing of model queries and their paths.
=====================================================================
*/
function ContextQuery$postQueries(callback, thisPtr) {
	if (this.options.model) {
		ExoWeb.trace.log("context", "Running post query step for model queries.");
		ExoWeb.eachProp(this.options.model, function(varName, query) {
			if (this.state[varName].scopeQuery) {
				ServerSync$addScopeQuery.call(this.context.server, this.state[varName].scopeQuery);
			}
		}, this);
	}

	callback.call(thisPtr || this);
}

/*
=====================================================================
Setup lazy loading on the context object to control lazy evaluation.
Loading is considered complete at the same point model.ready() fires.
=====================================================================
*/
function ContextQuery$registerLazyLoader(callback, thisPtr) {
	ExoWeb.Model.LazyLoader.register(this.context, {
		load: function context$load(obj, propName, callback, thisPtr) {
			//ExoWeb.trace.log(["context", "lazyLoad"], "caller is waiting for createContext.ready(), propName={1}", arguments);

			// objects are already loading so just queue up the calls
			allSignals.waitForAll(function context$load$callback() {
				//ExoWeb.trace.log(["context", "lazyLoad"], "raising createContext.ready()");

				ExoWeb.Model.LazyLoader.unregister(obj, this);

				if (callback && callback instanceof Function) {
					callback.call(thisPtr || this);
				}
			}, this, true);
		}
	});

	callback.call(thisPtr || this);
}

/*
=====================================================================
Final cleanup step. Allow rules to run initially, end the batch,
and allow the server sync to start capturing existing objects in
order to attach a lazy loader.
=====================================================================
*/
function ContextQuery$cleanup(callback, thisPtr) {
	allSignals.waitForAll(function() {
		// allows previously defered rules to run
		this.context.model.meta.notifyBeforeContextReady();

		ExoWeb.Batch.end(this.batch);
	}, this, true);

	callback.call(thisPtr || this);
}

ContextQuery.mixin({
	execute: ExoWeb.FunctionChain.prepare(
		ContextQuery$startBatch,
		ContextQuery$initModels,
		ContextQuery$processEmbedded,
		ContextQuery$doBatchRequest,
		ContextQuery$doIndividualRequests,
		ContextQuery$doStaticRequests,
		ContextQuery$fetchPathTypes,
		ContextQuery$processResults,
		ContextQuery$fetchTypes,
		ContextQuery$postQueries,
		ContextQuery$registerLazyLoader,
		ContextQuery$cleanup
	)
});
