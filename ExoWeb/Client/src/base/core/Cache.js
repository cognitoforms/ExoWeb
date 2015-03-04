var cacheInited = false;

var scriptTag = document.getElementsByTagName("script");
var referrer = scriptTag[scriptTag.length - 1].src;

var cacheHash;

var match = /[?&]cachehash=([^&]*)/i.exec(referrer);
if (match) {
	cacheHash = match[1];
}

ExoWeb.cacheHash = cacheHash;

// Determine if local storage is supported, understanding 
var useLocalStorage = false;
try {
	var testLS = "c-localStorage";
	window.localStorage.setItem(testLS, testLS);
	window.localStorage.removeItem(testLS);
	useLocalStorage = true;
}
catch (e)
{ }

if (useLocalStorage) {

	ExoWeb.cache = function (key, value) {
		var localKey = key;

		// defer init of the cache so that the appInstanceId can be set
		if (!cacheInited) {
			cacheInited = true;

			// if there's an older version of caching, clear the entire cache (the old way)
			if (window.localStorage.getItem("cacheHash"))
				window.localStorage.clear();

			// Flush the local storage cache if the cache hash has changed
			if (cacheHash && ExoWeb.cache("cacheHash") != cacheHash) {
				ExoWeb.clearCache();
				ExoWeb.cache("cacheHash", cacheHash);
			}
		}

		// scope the cache to ExoWeb and to a particular app if there are multiple apps hosted at the same domain.
		localKey = "ExoWeb:cache:" + ExoWeb.config.appInstanceId + ":" + localKey;

		if (arguments.length == 1) {
			value = window.localStorage.getItem(localKey);
			return value ? JSON.parse(value) : null;
		}
		else if (arguments.length == 2) {
			var json = JSON.stringify(value);
			try {
				window.localStorage.setItem(localKey, json);
			}
			catch (e) {
				logWarning(e.message);
			}
			return value;
		}
	};

	ExoWeb.clearCache = function () {
		window.localStorage.clear();
	};
}

// Caching Not Supported
else {
	ExoWeb.cache = function (key, value) { return null; };
	ExoWeb.clearCache = function () { };
}
