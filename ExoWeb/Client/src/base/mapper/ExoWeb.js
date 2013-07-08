// Don't activate the DOM automatically, instead delay until after context initialization
Sys.activateDom = false;

// Object constant to signal to mapper to create a new instance rather than load one
var $newId = function $newId() {
	return "$newId";
};

window.$newId = $newId;

// Indicates whether or not the DOM has been activated
var activated = false;

var modelReadyHandler = function modelReadyHandler(contextReady, extendContext, domReady) {
	return function () {
		var readySignal = new Signal();

		if (extendContext) {
			extendContext(window.context, readySignal.pending());
		}

		readySignal.waitForAll(function modelReadyHandler$signalReady() {
			if (contextReady) {
				window.context.beginContextReady();
				contextReady(window.context);
				window.context.endContextReady();
			}

			jQuery(function modelReadyHandler$documentReady() {
				// Activate the document if this is the first context to load
				if (!activated && ExoWeb.config.autoActivation) {
					activated = true;
					Sys.Application.activateElement(document.documentElement);
				}

				// Invoke dom ready notifications
				if (domReady) {
					if (ExoWeb.config.debug) {
						domReady(window.context);
					} else {
						try {
							domReady(window.context);
						} catch (e) {
							ExoWeb.logError(e, true);
						}
					}
				}
			});
		});
	};
};

// The (combined) set of options that are pending execution
// Options will stack up until something is encountered that triggers loading to occur
var pendingOptions = null;

var updatePendingOptionsWith = function updatePendingOptionsWith(newOptions) {
	if (pendingOptions !== null) {
		pendingOptions.init = mergeFunctions(pendingOptions.init, newOptions.init);
		pendingOptions.extendContext = mergeFunctions(pendingOptions.extendContext, newOptions.extendContext, { async: true, callbackIndex: 1 });
		pendingOptions.contextReady = mergeFunctions(pendingOptions.contextReady, newOptions.contextReady);
		pendingOptions.domReady = mergeFunctions(pendingOptions.domReady, newOptions.domReady);
		pendingOptions.types = pendingOptions.types ? (newOptions.types ? pendingOptions.types.concat(newOptions.types) : pendingOptions.types) : newOptions.types;
		pendingOptions.model = pendingOptions.model ? jQuery.extend(pendingOptions.model, newOptions.model) : newOptions.model;
		pendingOptions.changes = pendingOptions.changes ? (newOptions.changes ? pendingOptions.changes.concat(newOptions.changes) : pendingOptions.changes) : newOptions.changes;
		pendingOptions.conditions = pendingOptions.conditions ? jQuery.extend(pendingOptions.conditions, newOptions.conditions) : newOptions.conditions;
		pendingOptions.instances = pendingOptions.instances ? jQuery.extend(pendingOptions.instances, newOptions.instances) : newOptions.instances;
		pendingOptions.serverInfo = pendingOptions.serverInfo ? jQuery.extend(pendingOptions.serverInfo, newOptions.serverInfo) : newOptions.serverInfo;
	}
	else {
		pendingOptions = newOptions;
	}
};

var flushPendingOptions = function flushPendingOptions() {
	var includesEmbeddedData, executingOptions, init, contextReady, extendContext, domReady;

	includesEmbeddedData = pendingOptions.model ||
		(pendingOptions.types && !(pendingOptions.types instanceof Array)) ||
		pendingOptions.instances ||
		pendingOptions.conditions ||
		pendingOptions.changes;

	if (includesEmbeddedData) {
		executingOptions = pendingOptions;
		pendingOptions = null;

		ensureContext();

		// Perform context initialization when the model is ready
		if (executingOptions.contextReady || executingOptions.extendContext || executingOptions.domReady || !activated) {
			window.context.addReady(modelReadyHandler(executingOptions.contextReady, executingOptions.extendContext, executingOptions.domReady));
		}

		// Perform initialization immediately
		if (executingOptions.init) {
			executingOptions.init(window.context);
		}

		// Start the new query
		Context.query(window.context, {
			model: executingOptions.model,
			types: executingOptions.types,
			changes: executingOptions.changes,
			conditions: executingOptions.conditions,
			instances: executingOptions.instances,
			serverInfo: executingOptions.serverInfo
		});
	}
	else if (window.context) {
		if (!(window.context instanceof Context)) {
			throw new Error("The window object has a context property that is not a valid context.");
		}

		if (pendingOptions.init) {
			// Context has already been created, so perform initialization and remove it so that we don't double-up
			init = pendingOptions.init;
			pendingOptions.init = null;
			init(window.context);
		}

		if (pendingOptions.contextReady || pendingOptions.extendContext || pendingOptions.domReady) {
			contextReady = pendingOptions.contextReady;
			extendContext = pendingOptions.extendContext;
			domReady = pendingOptions.domReady;
			pendingOptions.contextReady = pendingOptions.extendContext = pendingOptions.domReady = null;
			window.context.addReady(modelReadyHandler(contextReady, extendContext, domReady));
		}
	}
};

// Global method for initializing ExoWeb on a page
var $exoweb = function $exoweb(newOptions) {
	// Support initialization function argument
	if (newOptions instanceof Function) {
		newOptions = { init: newOptions };
	}

	updatePendingOptionsWith(newOptions);
	flushPendingOptions();
};

window.$exoweb = $exoweb;
