var allSignals = new ExoWeb.Signal("createContext allSignals");

ExoWeb.registerActivity(function() {
	return allSignals.isActive();
});

function createContext(options, context) {
	
	var model = context ? context.model.meta : new ExoWeb.Model.Model();

	var ret = context ? context :  {
		model: {
			meta: model
		},
		ready: function context$model$ready(callback) { allSignals.waitForAll(callback); },
		server: new ServerSync(model)
	};

	var state = {};

	var batch = ExoWeb.Batch.start("init context");

	if (options.model) {
		// start loading the instances first, then load type data concurrently.
		// this assumes that instances are slower to load than types due to caching
		for (var varNameLoad in options.model) {
			(function(varName) {
				state[varName] = { signal: new ExoWeb.Signal("createContext." + varName) };
				allSignals.pending();

				var query = options.model[varName];

				query.and = ExoWeb.Model.PathTokens.normalizePaths(query.and);

				// store the paths for later use
				ObjectLazyLoader.addPaths(query.from, query.and);

				// only send properties to server
				query.serverPaths = query.and.map(function(path) {
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

				if(query.load) {
					// bypass all server callbacks if data is embedded
					state[varName].objectJson = query.load.instances;
					state[varName].conditionsJson = query.load.conditions;
				}
				else {
					// need to load data from server
					// fetch object state if an id of a persisted object was specified
					if (query.id !== $newId() && query.id !== null && query.id !== undefined && query.id !== "") {
						objectProvider(query.from, [query.id], query.serverPaths, null,
							state[varName].signal.pending(function context$objects$callback(result) {
								state[varName].objectJson = result.instances;
								state[varName].conditionsJson = result.conditions;
							}),
							state[varName].signal.orPending(function context$objects$callback(error) {
								ExoWeb.trace.logError("objectInit",
									"Failed to load {query.from}({query.id}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
									{ query: query, error: error });
							})
						);
					}
					else {
						
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
							objectProvider(null, null, query.serverPaths, null,
								allSignals.pending(function context$objects$callback(result) {
									// load the json. this may happen asynchronously to increment the signal just in case
									objectsFromJson(model, result.instances, allSignals.pending(function() {
										if (result.conditions) {
											conditionsFromJson(model, result.conditions);
										}
									}));
								}),
								allSignals.orPending(function context$objects$callback(error) {
									ExoWeb.trace.logError("objectInit",
										"Failed to load {query.from}({query.id}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
										{ query: query, error: error });
								})
							);
						}
					}
				}
			})(varNameLoad);
		}

		// load types
		for (var varNameTypes in options.model) {
			fetchTypes(model, options.model[varNameTypes], state[varNameTypes].signal.pending());
		}

		// process instances as they finish loading
		for (var varNameFinish in options.model) {
			(function(varName) {
				state[varName].signal.waitForAll(function context$model() {

					var query = options.model[varName];

					// construct a new object if a "newId" was specified
					if (query.id === $newId()) {
						ret.model[varName] = new (model.type(query.from).get_jstype())();

						// model object has been successfully loaded!
						allSignals.oneDone();
					}

					// otherwise, load the object from json if an id was specified
					else if (query.id !== null && query.id !== undefined && query.id !== "") {
						// load the json. this may happen asynchronously so increment the signal just in case
						objectsFromJson(model, state[varName].objectJson, state[varName].signal.pending(function context$model$callback() {
							var query = options.model[varName];
							var mtype = model.type(query.from);

							var obj = mtype.get(query.id);

							if (obj === undefined) {
								throw new ReferenceError($format("Could not get {0} with id = {1}.", [mtype.get_fullName(), query.id]));
							}

							ret.model[varName] = obj;

							if (state[varName].conditionsJson) {
								conditionsFromJson(model, state[varName].conditionsJson, function() {
									// model object has been successfully loaded!
									allSignals.oneDone();
								});
							}
							else {
								// model object has been successfully loaded!
								allSignals.oneDone();
							}
						}));
					}

					else {
						// model object has been successfully loaded!
						allSignals.oneDone();
					}
				});
			})(varNameFinish);
		}
	}

	
	if (options.types) {
		// allow specifying types and paths apart from instance data
		for (var i = 0; i < options.types.length; i++) {
			var typeQuery = options.types[i];

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

			fetchTypes(model, typeQuery, allSignals.pending());

			if (typeQuery.serverPaths.length > 0) {
				objectProvider(typeQuery.from, null, typeQuery.serverPaths, null,
					allSignals.pending(function context$objects$callback(result) {
						// load the json. this may happen asynchronously to increment the signal just in case
						objectsFromJson(model, result.instances, allSignals.pending(function() {
							if (result.conditions) {
								conditionsFromJson(model, result.conditions);
							}
						}));
					}),
					allSignals.orPending(function context$objects$callback(error) {
						ExoWeb.trace.logError("objectInit",
							"Failed to load {query.from}({query.id}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
							{ query: typeQuery, error: error });
					})
				);
			}
		}
	}
	// setup lazy loading on the container object to control
	// lazy evaluation.  loading is considered complete at the same point
	// model.ready() fires
	ExoWeb.Model.LazyLoader.register(ret, {
		load: function context$load(obj, propName, callback) {
//					ExoWeb.trace.log(["context", "lazyLoad"], "caller is waiting for createContext.ready(), propName={1}", arguments);

			// objects are already loading so just queue up the calls
			allSignals.waitForAll(function context$load$callback() {
//						ExoWeb.trace.log(["context", "lazyLoad"], "raising createContext.ready()");

				ExoWeb.Model.LazyLoader.unregister(obj, this);
				callback();
			});
		}
	});

	allSignals.waitForAll(function() {
		model.notifyBeforeContextReady();

		ExoWeb.Batch.end(batch);

		// begin watching for existing objects that are created
		ret.server.beginCapturingRegisteredObjects();
	});

	return ret;
}

Sys.activateDom = false;

// object constant to single to mapper to create a new instance rather than load one
var newId = "$newId";
window.$newId = function $newId() {
	return newId;
};

var activated = false;

// Global method for initializing ExoWeb on a page
var pendingOptions;

window.$exoweb = function (options) {

	// Support initialization function as parameter
	if (options instanceof Function)
		options = { init: options };

	// Merge options if necessary
	if (pendingOptions) {

		// Merge init functions
		if (pendingOptions.init) {
			if (options.init) {
				var init1 = pendingOptions.init;
				var init2 = options.init;
				pendingOptions.init = function () {
					init1();
					init2();
				};
			}
		}
		else {
			pendingOptions.init = options.init;
		}
		
		// Merge extendContext functions
		if (pendingOptions.extendContext) {
			if (options.extendContext) {
				var extendContext1 = pendingOptions.extendContext;
				var extendContext2 = options.extendContext;
				pendingOptions.extendContext = function (context, callback) {
					var signal = new ExoWeb.Signal("combined extendContext");
					extendContext1.call(this, context, signal.pending());
					extendContext2.call(this, context, signal.pending());
					signal.waitForAll(callback);
				};
			}
		}
		else {
			pendingOptions.extendContext = options.extendContext;
		}

		// Merge contextReady functions
		if (pendingOptions.contextReady) {
			if (options.contextReady) {
				var contextReady1 = pendingOptions.contextReady;
				var contextReady2 = options.contextReady;
				pendingOptions.contextReady = function () {
					contextReady1.apply(this, arguments);
					contextReady2.apply(this, arguments);
				};
			}
		}
		else {
			pendingOptions.contextReady = options.contextReady;
		}

		// Merge domReady functions
		if (pendingOptions.domReady) {
			if (options.domReady) {
				var domReady1 = pendingOptions.domReady;
				var domReady2 = options.domReady;
				pendingOptions.domReady = function () {
					domReady1.apply(this, arguments);
					domReady2.apply(this, arguments);
				};
			}
		}
		else {
			pendingOptions.domReady = options.domReady;
		}

		// Merge types 
		pendingOptions.types = pendingOptions.types ? (options.types ? pendingOptions.types.concat(options.types) : pendingOptions.types) : options.types;

		// Merge model
		pendingOptions.model = pendingOptions.model ? $.extend(pendingOptions.model, options.model) : options.model;
	}
	else {
		pendingOptions = options;
	}

	// Exit immediately if no model or types are pending
	if (!(pendingOptions.model || pendingOptions.types))
		return;

	var currentOptions = pendingOptions;
	pendingOptions = null;

	// Perform initialization
	if (currentOptions.init)
		currentOptions.init();

	// Initialize the context
	window.context = createContext({ model: currentOptions.model, types: currentOptions.types }, window.context);

	// Perform initialization once the context is ready
	window.context.ready(function () {

		function contextReady() {
			if (currentOptions.contextReady)
				currentOptions.contextReady(window.context);

			$(function ($) {
				// Activate the document if this is the first context to load
				if (!activated) {
					activated = true;
					Sys.Application.activateElement(document.documentElement);
				}

				// Invoke dom ready notifications
				if (currentOptions.domReady)
					currentOptions.domReady(window.context);
			});
		}

		if (currentOptions.extendContext) {
			currentOptions.extendContext(window.context, contextReady);
		}
		else {
			contextReady();
		}

	});
};