(function () {
	Type.registerNamespace("ExoWeb");

	if (!("config" in ExoWeb)) {
		ExoWeb.config = {};
	}

	// Setup Caching
	if (window.localStorage) {

		// Cache
		ExoWeb.cache = function (key, value) {
			if (arguments.length == 1) {
				var value = window.localStorage.getItem(key);
				return value ? JSON.parse(value) : null;
			}
			else if (arguments.length == 2) {
				window.localStorage.setItem(key, JSON.stringify(value));
				return value;
			}
		};

		// Clear
		ExoWeb.clearCache = function () { window.localStorage.clear(); };
	}

	// Caching Not Supported
	else {
		ExoWeb.cache = function (key, value) { return null; };
		ExoWeb.clearCache = function () { };
	}

	function addCacheHash(scripts) {
		var scriptTag = document.getElementsByTagName("script");
		var referrer = scriptTag[scriptTag.length - 1].src;

		var match = /[?&]cachehash=([^&]*)/.exec(referrer);
		if (match) {
			var cachehash = match[1];

			for (var i = 0; i < scripts.length; i++) {
				var script = scripts[i];
				if (script.releaseUrl)
					script.releaseUrl += (script.releaseUrl.indexOf('?') >= 0 ? "&cachehash=" : "?cachehash=") + cachehash;
				if (script.debugUrl)
					script.debugUrl += (script.debugUrl.indexOf('?') >= 0 ? "&cachehash=" : "?cachehash=") + cachehash;
			}

			// Flush the local storage cache if the cache hash has changed
			if (ExoWeb.cache("cacheHash") != cachehash) {
				ExoWeb.clearCache();
				ExoWeb.cache("cacheHash", cachehash);
			}
		}

		return scripts;
	}

	var scriptTag = document.getElementsByTagName("script");
	var startUrl = scriptTag[scriptTag.length - 1].src;
	var basePath = startUrl.slice(0, startUrl.lastIndexOf("/") + 1);
	var handlerPath =
		typeof (window['$exoHandlerPath']) == "undefined" ?
		basePath : $exoHandlerPath;

	Sys.loader.defineScripts(null, addCacheHash([
		{
			releaseUrl: basePath + "exoweb.js",
			debugUrl: basePath + "exoweb.js",
			name: "ExoWeb",
			executionDependencies: ["Core"],
			isLoaded: !!(ExoWeb && ExoWeb.Functor)
		},
		{
			releaseUrl: handlerPath + "ExoWeb.axd/Script",
			debugUrl: handlerPath + "ExoWeb.axd/Script",
			name: "ExoWebHandler",
			executionDependencies: ["Core", "WebServices", "ExoWeb"],
			isLoaded: !!(ExoWeb && ExoWeb.Load)
		},
		{
			releaseUrl: basePath + "exoweb.model.js",
			debugUrl: basePath + "exoweb.model.js",
			name: "ExoWebModel",
			executionDependencies: ["Core", "Globalization", "ExoWeb"],
			isLoaded: !!(ExoWeb && ExoWeb.Model)
		},
		{
			releaseUrl: basePath + "exoweb.mapper.js",
			debugUrl: basePath + "exoweb.mapper.js",
			name: "ExoWebMapper",
			executionDependencies: ["Core", "ExoWeb", "ExoWebHandler", "ExoWebModel"],
			isLoaded: !!(ExoWeb && ExoWeb.Mapper)
		},
		{
			releaseUrl: basePath + "exoweb.view.js",
			debugUrl: basePath + "exoweb.view.js",
			name: "ExoWebView",
			executionDependencies: ["Core", "Templates", "ExoWeb", "ExoWebModel"],
			isLoaded: !!(ExoWeb && ExoWeb.View)
		},
		{
			releaseUrl: basePath + "exoweb.ui.js",
			debugUrl: basePath + "exoweb.ui.js",
			name: "ExoWebUi",
			executionDependencies: ["Core", "Templates", "jQuery", "ExoWeb"],
			isLoaded: !!(ExoWeb && ExoWeb.UI)
		},
		{
			releaseUrl: basePath + "exoweb.mock.js",
			debugUrl: basePath + "exoweb.mock.js",
			name: "ExoWebMock",
			executionDependencies: ["Core", "ExoWeb", "ExoWebMapper", "ExoWebModel"],
			isLoaded: !!(ExoWeb && ExoWeb.Mock)
		},
		{
			releaseUrl: basePath + "exoweb.jquery.js",
			debugUrl: basePath + "exoweb.jquery.js",
			name: "ExoWebJquery",
			executionDependencies: ["Core", "Templates", "jQuery", "ExoWeb"],
			isLoaded: !!(window.jQuery && window.jQuery.fn.validated)
		}
	]));

	ExoWeb.AllScripts = [
		Sys.scripts.ExoWeb,
		Sys.scripts.ExoWebHandler,
		Sys.scripts.ExoWebModel,
		Sys.scripts.ExoWebMapper,
		Sys.scripts.ExoWebView,
		Sys.scripts.ExoWebUi,
		Sys.scripts.ExoWebJquery
	];

	Sys.activateDom = false;

	// object constant to single to mapper to create a new instance rather than load one
	var newId = "$newId";
	window.$newId = function $newId() {
		return newId;
	}

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

		Sys.require(ExoWeb.AllScripts,
			function () {

				if (!pendingOptions)
					return;

				var currentOptions = pendingOptions;
				pendingOptions = null;

				// Perform initialization
				if (currentOptions.init)
					currentOptions.init();

				// Initialize the context
				window.context = ExoWeb.context({ model: currentOptions.model, types: currentOptions.types }, window.context);

				// Perform initialization once the context is ready
				context.ready(function () {

					if (currentOptions.contextReady)
						currentOptions.contextReady(context);

					// Activate the document if this is the first context to load
					if (!activated) {
						activated = true;
						Sys.Application.activateElement(document.documentElement);
					}

					// Invoke dom ready notifications
					if (currentOptions.domReady)
						currentOptions.domReady(context);
				});
			});
	};
})();
