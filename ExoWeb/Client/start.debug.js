; (function() {
	Type.registerNamespace("ExoWeb");

	var exoScripts = document.getElementsByTagName("script");
	var exoStartUrl = exoScripts[exoScripts.length - 1].src;
	var exoBasePath = exoStartUrl.slice(0, exoStartUrl.lastIndexOf("/") + 1);
	Sys.loader.defineScripts(null, [
		{
			releaseUrl: exoBasePath + "exoweb.js",
			debugUrl: exoBasePath + "exoweb.js",
			name: "ExoWeb",
			executionDependencies: ["Core"],
			isLoaded: !!(ExoWeb && ExoWeb.Functor)
		},
		{
			releaseUrl: exoBasePath + "ExoWeb.axd/Script",
			debugUrl: exoBasePath + "ExoWeb.axd/Script",
			name: "ExoWebHandler",
			executionDependencies: ["Core", "WebServices", "ExoWeb"],
			isLoaded: !!(ExoWeb && ExoWeb.Load)
		},
		{
			releaseUrl: exoBasePath + "exoweb.model.js",
			debugUrl: exoBasePath + "exoweb.model.js",
			name: "ExoWebModel",
			executionDependencies: ["Core", "ExoWeb"],
			isLoaded: !!(ExoWeb && ExoWeb.Model)
		},
		{
			releaseUrl: exoBasePath + "exoweb.mapper.js",
			debugUrl: exoBasePath + "exoweb.mapper.js",
			name: "ExoWebMapper",
			executionDependencies: ["Core", "ExoWeb", "ExoWebHandler", "ExoWebModel"],
			isLoaded: !!(ExoWeb && ExoWeb.Mapper)
		},
		{
			releaseUrl: exoBasePath + "exoweb.view.js",
			debugUrl: exoBasePath + "exoweb.view.js",
			name: "ExoWebView",
			executionDependencies: ["Core", "Templates", "ExoWeb", "ExoWebModel"],
			isLoaded: !!(ExoWeb && ExoWeb.View)
		},
		{
			releaseUrl: exoBasePath + "exoweb.ui.js",
			debugUrl: exoBasePath + "exoweb.ui.js",
			name: "ExoWebUi",
			executionDependencies: ["Core", "Templates", "jQuery", "ExoWeb"],
			isLoaded: !!(ExoWeb && ExoWeb.UI)
		},
		{
			releaseUrl: exoBasePath + "exoweb.mock.js",
			debugUrl: exoBasePath + "exoweb.mock.js",
			name: "ExoWebMock",
			executionDependencies: ["Core", "ExoWeb", "ExoWebMapper", "ExoWebModel"],
			isLoaded: !!(ExoWeb && ExoWeb.Mock)
		},
		{
			releaseUrl: exoBasePath + "exoweb.jquery.js",
			debugUrl: exoBasePath + "exoweb.jquery.js",
			name: "ExoWebJquery",
			executionDependencies: ["Core", "Templates", "jQuery", "ExoWeb"],
			isLoaded: !!(window.jQuery && window.jQuery.fn.validated)
		}
	]);

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
