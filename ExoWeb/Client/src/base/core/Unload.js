// Attach to the unload event and change the page state so that scripts can
// toggle their behavior and not do things that will fail during unload. 
ExoWeb.windowIsUnloading = false;
if (window.addEventListener) {
	window.addEventListener("unload", function () {
		ExoWeb.windowIsUnloading = true;
	}, false);
} else if (window.attachEvent) {
	window.attachEvent("onunload", function () {
		ExoWeb.windowIsUnloading = true;
	});
}
