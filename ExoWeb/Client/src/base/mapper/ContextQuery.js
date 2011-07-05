function ContextQuery(context, options) {
	this.context = context;
	this.options = options;
	this.batch = null;
	this.state = {};
}

ContextQuery.mixin({
	execute: ExoWeb.FunctionChain.prepare(

	// Starts a batch so that others will not respond to changes that are
	// broadcast during querying, i.e. instance loading.
	///////////////////////////////////////////////////////////////////////////////
		function ContextQuery$setup(callback, thisPtr) {
			// start a batch to represent all of the pending work
			ExoWeb.trace.log("context", "Starting context query batch.");
			this.batch = ExoWeb.Batch.start("context query");

			// store init changes as early as possible
			if (this.options.changes)
				ServerSync$storeInitChanges.call(this.context.server, this.options.changes);

			if (this.options.serverinfo)
				this.context.server.set_ServerInfo(this.options.serverinfo);

			callback.call(thisPtr || this);
		},

	// Perform pre-processing of model queries and their paths.
	///////////////////////////////////////////////////////////////////////////////
		function ContextQuery$initModels(callback, thisPtr) {
			if (this.options.model) {
				this.context.onBeforeModel();
				ExoWeb.trace.log("context", "Running init step for model queries.");
				ExoWeb.eachProp(this.options.model, function (varName, query) {
					// Assert that the necessary properties are provided
					if (!query.hasOwnProperty("from") || (!query.hasOwnProperty("id") && !query.hasOwnProperty("ids")))
						ExoWeb.trace.throwAndLog("types", "The model query \"{0}\" requires a from and id or ids clause.", [varName]);
					if (query.hasOwnProperty("id") && query.hasOwnProperty("ids"))
						ExoWeb.trace.throwAndLog("types", "The model query \"{0}\" specifies both id or ids.", [varName]);

					// common initial setup of state for all model queries
					this.state[varName] = { signal: new ExoWeb.Signal("createContext." + varName), isArray: false };
					allSignals.pending(null, this, true);

					// normalize id(s) property and determine whether the result should be an array
					if (query.hasOwnProperty("ids") && !(query.ids instanceof Array)) {
						query.ids = [query.ids];
					}
					else if (query.hasOwnProperty("id") && !(query.id instanceof Array)) {
						query.ids = [query.id];
						delete query.id;
					}
					else {
						// we know that either id or ids is specified, so if neither
						// one is NOT an array, then the query must be an array
						this.state[varName].isArray = true;

						// pre-initialize array queries
						var arr = [];
						Sys.Observer.makeObservable(arr);
						this.context.model[varName] = arr;
					}

					// get rid of junk (null/undefined/empty) ids
					query.ids = filter(query.ids, not(isNullOrEmpty));

					// remove new ids for later processing
					query.newIds = purge(query.ids, equals($newId()));

					// Store the paths for later use in lazy loading
					query.normalized = ExoWeb.Model.PathTokens.normalizePaths(query.include);
					ObjectLazyLoader.addPaths(query.from, query.normalized);

					// use temporary config setting to enable/disable scope-of-work functionality
					if (query.inScope !== false) {
						if (query.ids.length > 0) {
							this.state[varName].scopeQuery = {
								from: query.from,
								ids: query.ids,
								// TODO: this will be subset of paths interpreted as scope-of-work
								include: query.include ? query.include.filter(function (p) { return p.startsWith("this."); }) : [],
								inScope: true,
								forLoad: false
							};
						}
					}
				}, this);
			}

			callback.call(thisPtr || this);
		},

	// Process embedded data as if it had been recieved from the server in
	// the form of a web service response. This should enable flicker-free
	// page loads by embedded data, changes, etc.
	///////////////////////////////////////////////////////////////////////////////
		function ContextQuery$processEmbedded(callback, thisPtr) {
			ExoWeb.trace.log("context", "Processing embedded data in query.");

			if (this.options.instances || this.options.conditions || (this.options.types && !(this.options.types instanceof Array))) {
				var handler = new ResponseHandler(this.context.model.meta, this.context.server, {
					instances: this.options.instances,
					conditions: this.options.conditions,
					types: this.options.types,
					changes: this.options.changes,
					source: "init"
				});

				handler.execute(function () {
					// Update 'isNew' for objects that show up in InitNew changes.
					if (this.options.changes) {
						this.options.changes.forEach(function (change) {
							tryGetJsType(this.context.server._model, change.instance.type, null, false, function (jstype) {
								var obj = jstype.meta.get(change.instance.id);
								if (obj) {
									obj.meta.isNew = true;
								}
							}, this);
						}, this);
					}

					callback.call(thisPtr || this);
				}, this);
			}
			else {
				callback.call(thisPtr || this);
			}
		},

	// Detect batch query candidates and send batch request, if batching is
	// enabled (true by default).
	///////////////////////////////////////////////////////////////////////////////
		function ContextQuery$doBatchRequest(callback, thisPtr) {
			if (this.options.model && ExoWeb.config.individualQueryLoading !== true) {
				var pendingQueries = [];
				var batchQuerySignal;

				ExoWeb.trace.log("context", "Looking for potential loading requests in query.");

				ExoWeb.eachProp(this.options.model, function (varName, query) {
					if (!query.load && query.ids.length > 0) {
						var jstype = ExoWeb.Model.Model.getJsType(query.from, true);

						// get a list of ids that should be batch-requested
						var batchIds = filter(query.ids, function (id, index) {
							// if the type doesn't exist, include the id in the batch query
							if (!jstype) return true;

							// check to see if the object already exists, i.e. because of embedding
							var obj = jstype.meta.get(translateId(this.context.server._translator, query.from, id));

							// if it doesn't exist, include the id in the batch query
							if (obj === undefined) return true;

							// otherwise, include it in the model
							if (this.state[varName].isArray) {
								this.context.model[varName][index] = obj;
							}
							else {
								this.context.model[varName] = obj;
							}
						}, this);

						if (batchIds.length > 0) {
							if (batchQuerySignal === undefined) {
								batchQuerySignal = new ExoWeb.Signal("batch query");
								batchQuerySignal.pending(null, this, true);
							}

							// complete the individual query signal after the batch is complete
							batchQuerySignal.waitForAll(this.state[varName].signal.pending(null, this, true), this, true);

							pendingQueries.push({
								from: query.from,
								ids: batchIds,
								include: query.include || [],
								inScope: true,
								forLoad: true
							});
						}
					}
				}, this);

				if (pendingQueries.length > 0) {
					// perform batch query
					queryProvider(pendingQueries, null,
						function context$objects$callback(result) {
							objectsFromJson(this.context.model.meta, result.instances, function () {
								if (result.conditions) {
									conditionsFromJson(this.context.model.meta, result.conditions, function () {
										batchQuerySignal.oneDone();
									});
								}
								else {
									batchQuerySignal.oneDone();
								}
							}, this);
						},
						function context$objects$callback(error) {
							ExoWeb.trace.logError("objectInit", "Failed to load batch query (HTTP: {_statusCode}, Timeout: {_timedOut})", error);
							batchQuerySignal.oneDone();
						}, this);
				}
			}

			callback.call(thisPtr || this);
		},

	// Send individual requests and simulate for "load" option.
	///////////////////////////////////////////////////////////////////////////////
		function ContextQuery$doIndividualRequests(callback, thisPtr) {
			if (this.options.model) {
				// 2) Start loading instances individually
				ExoWeb.eachProp(this.options.model, function (varName, query) {
					if (query.load) {
						// bypass all server callbacks if data is embedded
						this.state[varName].objectJson = query.load.instances;
						this.state[varName].conditionsJson = query.load.conditions;
					}
					// need to load data from server
					// fetch object state if an id of a persisted object was specified
					else if (ExoWeb.config.individualQueryLoading === true) {
						tryGetJsType(this.context.model.meta, query.from, null, true, function (type) {
							// TODO: eliminate duplication!!!
							// get the list of ids that should be individually loaded
							var individualIds = filter(query.ids, function (id, index) {
								// check to see if the object already exists, i.e. because of embedding
								var obj = type.meta.get(translateId(this.context.server._translator, query.from, id));

								// if it doesn't exist, include the id in the batch query
								if (obj === undefined) return true;

								// otherwise, include it in the model
								if (this.state[varName].isArray) {
									this.context.model[varName][index] = obj;
								}
								else {
									this.context.model[varName] = obj;
								}
							}, this);

							if (individualIds.length > 0) {
								// for individual queries, include scope queries for all *BUT* the query we are sending
								var scopeQueries = [];
								var currentVarName = varName;
								ExoWeb.eachProp(this.options.model, function (varName, query) {
									if (varName !== currentVarName && this.state[varName].scopeQuery) {
										scopeQueries.push(this.state[varName].scopeQuery);
									}
								}, this);

								objectProvider(query.from, individualIds, query.include || [], true, null, scopeQueries,
									this.state[varName].signal.pending(function context$objects$callback(result) {
										this.state[varName].objectJson = result.instances;
										this.state[varName].conditionsJson = result.conditions;
									}, this, true),
									this.state[varName].signal.orPending(function context$objects$callback(error) {
										ExoWeb.trace.logError("objectInit",
											"Failed to load {query.from}({query.ids}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
											{ query: query, error: error });
									}, this, true), this);
							}
						}, this);
					}
				}, this);
			}

			callback.call(thisPtr || this);
		},

	// Load static paths for queries that don't otherwise require loading.
	///////////////////////////////////////////////////////////////////////////////
		function ContextQuery$doStaticRequests(callback, thisPtr) {
			if (this.options.model) {
				ExoWeb.eachProp(this.options.model, function (varName, query) {
					if (!query.load && query.ids.length === 0) {
						// Remove instance paths when an id is not specified
						var staticPaths = query.include ? query.include.filter(function (p) { return !p.startsWith("this."); }) : null;

						// Only call the server if paths were specified
						if (staticPaths && staticPaths.length > 0) {
							objectProvider(null, null, staticPaths, false, null,
								allSignals.pending(function context$objects$callback(result) {
									// load the json. this may happen asynchronously to increment the signal just in case
									objectsFromJson(this.context.model.meta, result.instances, allSignals.pending(function () {
										if (result.conditions) {
											conditionsFromJson(this.context.model.meta, result.conditions, allSignals.pending());
										}
									}), this);
								}, this, true),
								allSignals.orPending(function context$objects$callback(error) {
									ExoWeb.trace.logError("objectInit",
										"Failed to load {query.from}({query.ids}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
										{ query: query, error: error });
								}, this, true)
							);
						}
					}
				}, this);
			}

			callback.call(thisPtr || this);
		},

	// Only fetch the types if they are not embedded. If the types are
	// embedded then fetching the types from server will cause a signal to
	// be created that will never be processed.
	///////////////////////////////////////////////////////////////////////////////
		function ContextQuery$fetchPathTypes(callback, thisPtr) {
			if (this.options.model && (!this.options.types || this.options.types instanceof Array)) {
				ExoWeb.eachProp(this.options.model, function (varName, query) {
					fetchTypes(this.context.model.meta, query.from, query.normalized, this.state[varName].signal.pending(null, this, true));
				}, this);
			}

			callback.call(thisPtr || this);
		},

	// Process instances data for queries as they finish loading.
	///////////////////////////////////////////////////////////////////////////////
		function ContextQuery$processResults(callback, thisPtr) {
			if (this.options.model) {
				ExoWeb.eachProp(this.options.model, function (varName, query) {
					this.state[varName].signal.waitForAll(function context$model() {
						// make sure everything isn't considered complete until new objects are also created
						if (query.newIds) allSignals.pending();

						// check to see if the root(s) have already been established
						if ((!this.state[varName].isArray && this.context.model[varName]) ||
							(this.state[varName].isArray && !query.ids.some(function (id, index) { return !this.context.model[varName][index]; }))) {

							allSignals.oneDone();
							return;
						}
						// otherwise, loading is required to establish roots if there are any server ids
						else if (query.ids.length > 0) {
							var processResponse = new Signal("processing response");

							if (this.state[varName].objectJson) {
								// load the json. this may happen asynchronously so increment the signal just in case
								objectsFromJson(this.context.model.meta, this.state[varName].objectJson, processResponse.pending(null, this), this, true);

								// indicate that instance data is already being loaded
								delete this.state[varName].objectJson;
							}

							processResponse.waitForAll(this.state[varName].signal.pending(function context$model$callback() {
								var mtype = this.context.model.meta.type(query.from);

								if (!mtype) {
									ExoWeb.trace.throwAndLog("context", $format("Could not get type {0} required to process query results.", [query.from]));
								}

								// establish roots for each id
								forEach(query.ids, function (id, index) {
									// TODO: resolve translator access
									var clientId = translateId(this.context.server._translator, query.from, id);
									var obj = mtype.get(clientId);

									// if it doesn't exist, raise an error
									if (obj === undefined)
										ExoWeb.trace.throwAndLog("context", "Could not get {0} with id = {1}{2}.", [query.from, clientId, (id !== clientId ? "(" + id + ")" : "")]);

									// otherwise, include it in the model
									if (!this.state[varName].isArray && !this.context.model[varName]) {
										this.context.model[varName] = obj;
									}
									else if (this.state[varName].isArray && !this.context.model[varName][index]) {
										this.context.model[varName][index] = obj;
									}
								}, this);

								if (this.state[varName].conditionsJson) {
									conditionsFromJson(this.context.model.meta, this.state[varName].conditionsJson, function () {
										// model object has been successfully loaded!
										allSignals.oneDone();
									}, this);
								}
								else {
									// model object has been successfully loaded!
									allSignals.oneDone();
								}
							}, this), this);
						}
						else {
							// model object has been successfully loaded!
							allSignals.oneDone();
						}

						if (this.state[varName].objectJson) {
							// ensure that instance data is loaded (even if not needed to establish roots) just in case
							// root object was satisfied because it happened to be a part of the graph of another root object
							objectsFromJson(this.context.model.meta, this.state[varName].objectJson, allSignals.pending());
						}

						// construct a new object(s) if a new id(s) was specified
						if (query.newIds) {
							// if json must be processed, signal will have been incremented again
							this.state[varName].signal.waitForAll(function () {
								if (this.state[varName].isArray) {
									foreach(query.newIds, function (index) {
										this.context.model[varName][index] = new (this.context.model.meta.type(query.from).get_jstype())();
									}, this);
								}
								else {
									this.context.model[varName] = new (this.context.model.meta.type(query.from).get_jstype())();
								}
							}, this);

							// model object has been successfully loaded!
							allSignals.oneDone();
						}
					}, this);
				}, this, true);
			}

			callback.call(thisPtr || this);
		},

	// Load type data from query.
	///////////////////////////////////////////////////////////////////////////////
		function ContextQuery$fetchTypes(callback, thisPtr) {
			// load types if they are in array format.  This is for the full server/client model of ExoWeb
			// to load the types and isntance data async
			if (this.options.types && this.options.types instanceof Array) {
				// allow specifying types and paths apart from instance data
				for (var i = 0; i < this.options.types.length; i++) {
					var typeQuery = this.options.types[i];

					// store the paths for later use
					typeQuery.normalized = ExoWeb.Model.PathTokens.normalizePaths(typeQuery.include);
					ObjectLazyLoader.addPaths(typeQuery.from, typeQuery.normalized);

					fetchTypes(this.context.model.meta, typeQuery.from, typeQuery.normalized, allSignals.pending(null, this, true));

					var staticPaths = typeQuery.include ? typeQuery.include.filter(function (p) { return !p.startsWith("this."); }) : null;

					if (staticPaths && staticPaths.length > 0) {
						objectProvider(typeQuery.from, null, staticPaths, false, null,
							allSignals.pending(function context$objects$callback(result) {
								// load the json. this may happen asynchronously to increment the signal just in case
								objectsFromJson(this.context.model.meta, result.instances, allSignals.pending(function () {
									if (result.conditions) {
										conditionsFromJson(this.context.model.meta, result.conditions, allSignals.pending());
									}
								}), this);
							}, this, true),
							allSignals.orPending(function context$objects$callback(error) {
								ExoWeb.trace.logError("objectInit",
									"Failed to load {query.from}({query.ids}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
									{ query: typeQuery, error: error });
							}, this, true), this);
					}
				}
			}

			callback.call(thisPtr || this);
		},

	// Perform pre-processing of model queries and their paths.
	///////////////////////////////////////////////////////////////////////////////
		function ContextQuery$postQueries(callback, thisPtr) {
			if (this.options.model) {
				ExoWeb.trace.log("context", "Running post query step for model queries.");
				ExoWeb.eachProp(this.options.model, function (varName, query) {
					if (this.state[varName].scopeQuery) {
						ServerSync$addScopeQuery.call(this.context.server, this.state[varName].scopeQuery);
					}
				}, this);
			}

			callback.call(thisPtr || this);
		},

	// Setup lazy loading on the context object to control lazy evaluation.
	// Loading is considered complete at the same point model.ready() fires.
	///////////////////////////////////////////////////////////////////////////////
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
		},

	// Final cleanup step. Allow rules to run initially, end the batch,
	// and allow the server sync to start capturing existing objects in
	// order to attach a lazy loader.
	///////////////////////////////////////////////////////////////////////////////
		function ContextQuery$cleanup(callback, thisPtr) {
			allSignals.waitForAll(function () {
				// allows previously defered rules to run
				this.context.model.meta.notifyBeforeContextReady();

				ExoWeb.Batch.end(this.batch);
			}, this, true);

			callback.call(thisPtr || this);
		}
	)
});
