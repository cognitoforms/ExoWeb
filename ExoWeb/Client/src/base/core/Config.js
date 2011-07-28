var config = {
	// General debug setting that can encompose the purpose of other more focused settings.
	debug: false,

	// Indicates that signal should use window.setTimeout when invoking callbacks. This is
	// done in order to get around problems with browser complaining about long-running script.
	signalTimeout: false,

	// "Debugging" signal means that signal will not attempt to handle errors that occur
	// as a result of invoking callbacks, which can aid in troubleshooting errors.
	signalDebug: false,

	// Causes the query processing to load model roots in the query individually. By default they are batch-loaded.
	individualQueryLoading: false,

	// Uniquely identifies this application if more than one app is hosted under the same domain name.
	appInstanceId: "?"
};

exports.config = config;
