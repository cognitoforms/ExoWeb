; (function() {
	Type.registerNamespace("ExoWeb");

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
		}

		return scripts;
	}

	var scriptTag = document.getElementsByTagName("script");
	var startUrl = scriptTag[scriptTag.length - 1].src;
	var basePath = startUrl.slice(0, startUrl.lastIndexOf("/") + 1);

	Sys.loader.defineScripts(null, addCacheHash([
		{
			releaseUrl: basePath + "exoweb.js",
			debugUrl: basePath + "exoweb.js",
			name: "ExoWeb",
			executionDependencies: ["Core"],
			isLoaded: !!(ExoWeb && ExoWeb.Functor)
		},
		{
			releaseUrl: basePath + "ExoWeb.axd/Script",
			debugUrl: basePath + "ExoWeb.axd/Script",
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
})();
