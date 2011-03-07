Sys.activateDom = false;

// Object constant to signal to mapper to create a new instance rather than load one
window.$newId = function() { return "$newId"; };

// Indicates whether or not the DOM has been activated
var activated = false;

// The (combined) set of options that are pending
// execution. Options will stack up until something
// is encountered that triggers loading to occur.
var pendingOptions;

function modelReadyHandler(contextReady, extendContext, domReady) {
	return function () {
		var readySignal = new Signal();
		
		if (extendContext)
			extendContext(window.context, readySignal.pending());

		readySignal.waitForAll(function() {
			if (contextReady)
				contextReady(window.context);

			$(function() {
				// Activate the document if this is the first context to load
				if (!activated) {
					activated = true;
					Sys.Application.activateElement(document.documentElement);
				}

				// Invoke dom ready notifications
				if (domReady)
					domReady(window.context);
			});
		});
	};
}

// Global method for initializing ExoWeb on a page
window.$exoweb = function (options) {
	// Support initialization function as parameter
	if (options instanceof Function)
		options = { init: options };

	if (!pendingOptions)
		// No pending options to merge
		pendingOptions = options;
	else {
		// Merge options as necessary
		pendingOptions.init = mergeFunctions(pendingOptions.init, options.init);
		pendingOptions.extendContext = mergeFunctions(pendingOptions.extendContext, options.extendContext, { async: true, callbackIndex: 1 });
		pendingOptions.contextReady = mergeFunctions(pendingOptions.contextReady, options.contextReady);
		pendingOptions.domReady = mergeFunctions(pendingOptions.domReady, options.domReady);
		pendingOptions.types = pendingOptions.types ? (options.types ? pendingOptions.types.concat(options.types) : pendingOptions.types) : options.types;
		pendingOptions.model = pendingOptions.model ? $.extend(pendingOptions.model, options.model) : options.model;
		pendingOptions.changes = pendingOptions.changes ? (options.changes ? pendingOptions.changes.concat(options.changes) : pendingOptions.changes) : options.changes;
		pendingOptions.conditions = pendingOptions.conditions ? $.extend(pendingOptions.conditions, options.conditions) : options.conditions;
		pendingOptions.instances = pendingOptions.instances ? $.extend(pendingOptions.instances, options.instances) : options.instances;
	}

	// Exit immediately if no model or types are pending
	if (!(pendingOptions.model || pendingOptions.types || pendingOptions.instances || pendingOptions.conditions || pendingOptions.changes)) {
		if (window.context && pendingOptions.init) {

			// Context has already been created, so perform initialization and remove it so that we don't double-up
			pendingOptions.init(window.context);
			pendingOptions.init = null;
		}

		if (window.context && window.context.isModelReady() &&
			(pendingOptions.contextReady || pendingOptions.extendContext || pendingOptions.domReady)) {

			// The context is already ready, so invoke handlers and remove so that we don't double-up
			window.context.addModelReady(modelReadyHandler(pendingOptions.contextReady, pendingOptions.extendContext, pendingOptions.domReady));
			pendingOptions.contextReady = null;
			pendingOptions.extendContext = null;
			pendingOptions.domReady = null;
		}

		return;
	}

	var currentOptions = pendingOptions;
	pendingOptions = null;

	// Create a context if needed
	window.context = window.context || new Context();
	
	// Perform initialization
	if (currentOptions.init)
		currentOptions.init(window.context);

	// Start the new query
	Context$query.call(window.context, {
		model: currentOptions.model,
		types: currentOptions.types,
		changes: currentOptions.changes,
		conditions: currentOptions.conditions,
		instances: currentOptions.instances
	});

	// Perform initialization once the context is ready
	if (currentOptions.contextReady || currentOptions.extendContext || currentOptions.domReady || !activated)
		window.context.addModelReady(modelReadyHandler(currentOptions.contextReady, currentOptions.extendContext, currentOptions.domReady));
};