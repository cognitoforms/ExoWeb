Type.registerNamespace("ExoWeb");

Sys.loader.defineScripts(null, [
	{
		releaseUrl: "%/../exoweb/exoweb.js",
		debugUrl: "%/../exoweb/exoweb.js",
		name: "ExoWeb",
		executionDependencies: ["Core"],
		isLoaded: !!(ExoWeb && ExoWeb.Functor)
	},
	{
		releaseUrl: "ExoWeb.axd/Script",
		debugUrl: "ExoWeb.axd/Script",
		name: "ExoWebHandler",
		executionDependencies: ["Core", "ExoWeb"],
		isLoaded: !!(ExoWeb && ExoWeb.Load)
	},
	{
		releaseUrl: "%/../exoweb/exoweb.model.js",
		debugUrl: "%/../exoweb/exoweb.model.js",
		name: "ExoWebModel",
		executionDependencies: ["Core", "ExoWeb"],
		isLoaded: !!(ExoWeb && ExoWeb.Model)
	},
	{
		releaseUrl: "%/../exoweb/exoweb.mapper.js",
		debugUrl: "%/../exoweb/exoweb.mapper.js",
		name: "ExoWebMapper",
		executionDependencies: ["Core", "ExoWeb", "ExoWebHandler", "ExoWebModel"],
		isLoaded: !!(ExoWeb && ExoWeb.Mapper)
	},
	{
		releaseUrl: "%/../exoweb/exoweb.view.js",
		debugUrl: "%/../exoweb/exoweb.view.js",
		name: "ExoWebView",
		executionDependencies: ["Core", "Templates", "ExoWeb", "ExoWebModel"],
		isLoaded: !!(ExoWeb && ExoWeb.View)
	},
	{
		releaseUrl: "%/../exoweb/exoweb.ui.js",
		debugUrl: "%/../exoweb/exoweb.ui.js",
		name: "ExoWebUi",
		executionDependencies: ["Core", "Templates", "jQuery", "ExoWeb"],
		isLoaded: !!(ExoWeb && ExoWeb.UI)
	},
	{
		releaseUrl: "%/../exoweb/exoweb.mock.js",
		debugUrl: "%/../exoweb/exoweb.mock.js",
		name: "ExoWebMock",
		executionDependencies: ["Core", "ExoWeb", "ExoWebMapper", "ExoWebModel"],
		isLoaded: !!(ExoWeb && ExoWeb.Mock)
	},
	{
		releaseUrl: "%/../exoweb/exoweb.jquery.js",
		debugUrl: "%/../exoweb/exoweb.jquery.js",
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

// use the msajax path as the base path since the ajax scripts are expected to reside there
Sys.loader.basePath = "../vc3web_client/msajax";

Sys.activateDom = false;
