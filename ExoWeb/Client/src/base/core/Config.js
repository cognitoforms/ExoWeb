var config = {
	// General debug setting that can encompose the purpose of other more focused settings.
	// Determines whether parts of the framework attempt to handle errors and throw more descriptive errors.
	debug: false,

	// Indicates that signal should use window.setTimeout when invoking callbacks. This is
	// done in order to get around problems with browser complaining about long-running script.
	signalTimeout: false,

	// Causes the query processing to load model roots in the query individually. By default they are batch-loaded.
	individualQueryLoading: false,

	// Uniquely identifies this application if more than one app is hosted under the same domain name.
	appInstanceId: "?"
};

exports.config = config;
