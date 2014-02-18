// Don't activate the DOM automatically, instead delay until after context initialization
Sys.activateDom = false;

// Object constant to signal to mapper to create a new instance rather than load one
var $newId = function $newId() {
	return "$newId";
};

window.$newId = $newId;

// Indicates whether or not the DOM has been activated
var activated = false;

var serverInfo;

var pendingTypeQueries = [];

// Callback(s) to execute as soon as a context query begins.
var initFns = new ExoWeb.Functor();

// Signal to gate context completion via extendContext options.
var globalReadySignal = new Signal();

var extendContextFn = null;

var contextReadyFns = new ExoWeb.Functor();

var domReadyFns = new ExoWeb.Functor();

function modelReadyHandler() {
	if (extendContextFn) {
		extendContextFn(window.context, globalReadySignal.pending());
		extendContextFn = null;
	}

	globalReadySignal.waitForAll(function () {
		if (!contextReadyFns.isEmpty()) {
			window.context.beginContextReady();
			contextReadyFns(window.context);
			window.context.endContextReady();
		}

		jQuery(function () {
			// Activate the document if this is the first context to load
			if (!activated && ExoWeb.config.autoActivation) {
				activated = true;
				Sys.Application.activateElement(document.documentElement);
			}

			// Invoke dom ready notifications
			if (!domReadyFns.isEmpty()) {
				if (ExoWeb.config.debug) {
					domReadyFns(window.context);
				} else {
					try {
						domReadyFns(window.context);
					} catch (e) {
						ExoWeb.logError(e, true);
					}
				}
			}
		});
	});
}

// Global method for initializing ExoWeb on a page

function $exoweb(options) {

	// Support initialization function argument
	if (options instanceof Function) {
		options = { init: options };
	}

	if (options.init) {
		// Register the init function ONCE.
		initFns.add(options.init, null, true);
		delete options.init;
	}

	if (options.extendContext) {
		// Merge the extendContext function so that the callback argument is invoked after ALL have invoked the callback.
		extendContextFn = mergeFunctions(extendContextFn, options.extendContext, { async: true, callbackIndex: 1 });
		delete options.extendContext;
	}

	if (options.contextReady) {
		// Register the contextReady function ONCE.
		contextReadyFns.add(options.contextReady, null, true);
		delete options.contextReady;
	}

	if (options.domReady) {
		// Register the domReady function ONCE.
		domReadyFns.add(options.domReady, null, true);
		delete options.domReady;
	}

	// The server info object will be maintained here and constantly set each time a
	// context query is created. It shouldn't be publicly set for any other reason.
	if (options.serverInfo) {
		// Merge any additional serverInfo options.
		serverInfo = jQuery.extend(serverInfo, options.serverInfo);
		delete options.serverInfo;
	}

	if (options.types && options.types instanceof Array) {
		// Store type queries for later use, since only embedded data or a model query triggers immediate querying.
		pendingTypeQueries = pendingTypeQueries.concat(options.types);
		delete options.types;
	}

	// A model query or embedded data will trigger a context query immediately.
	var triggerQuery = false;
	var queryObject = {};

	if (options.model) {
		triggerQuery = true;
		queryObject.model = options.model;
		delete options.model;
	}

	if (options.types) {
		triggerQuery = true;
		queryObject.types = options.types;
		delete options.types;
	}

	if (options.instances) {
		triggerQuery = true;
		queryObject.instances = options.instances;
		delete options.instances;
	}

	if (options.conditions) {
		triggerQuery = true;
		queryObject.conditions = options.conditions;
		delete options.conditions;
	}

	if (options.changes) {
		triggerQuery = true;
		queryObject.changes = options.changes;
		delete options.changes;
	}

	if (triggerQuery) {

		// Ensure that a context is created if it hasn't been already.
		ensureContext();

		// Perform initialization immediately
		initFns(window.context);

		// Include server info if present.
		if (serverInfo) {
			// The server info object will be maintained here and constantly set each time a
			// context query is created. It shouldn't be publicly set for any other reason.
			queryObject.serverInfo = serverInfo;
		}

		// Send pending type queries with the query if types were not embedded.
		if (pendingTypeQueries.length > 0 && !queryObject.types) {
			queryObject.types = pendingTypeQueries;
			pendingTypeQueries = [];
		}

		// Start the new query
		Context.query(window.context, queryObject);

		if (pendingTypeQueries.length > 0) {
			// Send a seperate query for type queries if they couldn't be send with the primary query.
			Context.query(window.context, { types: pendingTypeQueries });
			pendingTypeQueries = [];
		}

		// Perform context initialization when the model is ready
		window.context.addReady(modelReadyHandler);

	} else if (window.context) {

		// Ensure that the context variable has not been used for some other purpose.
		if (!(window.context instanceof Context)) {
			throw new Error("The window object has a context property that is not a valid context.");
		}

		// Context has already been created, so perform initialization immediately
		initFns(window.context);

		// If the context has already completed, then fire the ready handler. It is safe to fire more than once.
		if (!window.context.isPending()) {
			allSignals.waitForAll(modelReadyHandler);
		}
	}

}

window.$exoweb = $exoweb;
