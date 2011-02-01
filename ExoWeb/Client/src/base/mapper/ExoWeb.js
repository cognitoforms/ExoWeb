var activateDom = false;

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