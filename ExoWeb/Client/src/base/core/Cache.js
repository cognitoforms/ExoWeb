var cacheInited = false;


// Setup Caching
if (window.localStorage) {

	// Cache
	ExoWeb.cache = function (key, value) {
		// defer init of the cache so that the appInstanceId can be set
		if (!cacheInited) {
			cacheInited = true;

			// if there's an older version of caching, clear the entire cache (the old way)
			if (window.localStorage["cacheHash"])
				window.localStorage.clear();

			// Flush the local storage cache if the cache hash has changed
			if (ExoWeb.cache("cacheHash") != cacheHash) {
				ExoWeb.clearCache();
				ExoWeb.cache("cacheHash", cacheHash);
			}
		}

		// scope the cache to ExoWeb and to a particular app if there are multiple apps hosted at the same domain.
		key = "ExoWeb:cache:" + ExoWeb.config.appInstanceId + ":" + key;

		if (arguments.length == 1) {
			value = window.localStorage.getItem(key);
			return value ? JSON.parse(value) : null;
		}
		else if (arguments.length == 2) {
			var json = JSON.stringify(value);
			try {
				window.localStorage.setItem(key, json);
			}
			catch (e) {
				ExoWeb.trace.logError("cache", e);
			}
			return value;
		}
	};

	// Clear
	ExoWeb.clearCache = function () {
		// There's a bug in IE 8 that causes localStorage to appear like its been
		// cleared but the quota to not decrease.  Attempt to delete one key at a time rather than
		// use the clear() method in an attempt to work around the bug.
		for (var i = localStorage.length-1; i>=0; i--) {
			var key = localStorage.key(i);

			// Only clear ExoWeb keys. Clear them across all application instances
			// to prevent leaked data if/when an appInstanceId changes.
			if (key.substring(0, "ExoWeb:cache".length) == "ExoWeb:cache") {
				window.localStorage.removeItem(key);
			}
		}
	};
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
}

ExoWeb.cacheHash = cacheHash;
