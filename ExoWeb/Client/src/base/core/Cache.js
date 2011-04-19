// Setup Caching
if (window.localStorage) {

	// Cache
	ExoWeb.cache = function (key, value) {
		if (arguments.length == 1) {
			value = window.localStorage.getItem(key);
			return value ? JSON.parse(value) : null;
		}
		else if (arguments.length == 2) {
			var json = JSON.stringify(value);
			try{
				window.localStorage.setItem(key, json);
			}
			catch(e) {
				ExoWeb.trace.logError("cache", e);
			}
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

var scriptTag = document.getElementsByTagName("script");
var referrer = scriptTag[scriptTag.length - 1].src;

var cacheHash;

var match = /[?&]cachehash=([^&]*)/i.exec(referrer);
if (match) {
	cacheHash = match[1];

	// Flush the local storage cache if the cache hash has changed
	if (ExoWeb.cache("cacheHash") != cacheHash) {
		ExoWeb.clearCache();
		ExoWeb.cache("cacheHash", cacheHash);
	}
}

ExoWeb.cacheHash = cacheHash;
