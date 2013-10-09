var config = {
	// Avoid patterns that can make debugging more difficult, try/catch for example.
	debug: false,

	// Indicates that signal should use window.setTimeout when invoking callbacks. This is
	// done in order to get around problems with browser complaining about long-running script.
	signalTimeout: false,

	// The maximum number of pending signals to execute as a batch.
	// By default this is null, which means that no maximum is enforced.
	signalMaxBatchSize: null,

	// Causes the query processing to load model roots in the query individually. By default they are batch-loaded.
	individualQueryLoading: false,

	// Uniquely identifies this application if more than one app is hosted under the same domain name.
	appInstanceId: "?",

	// Automatic DOM activation when document.ready fires
	autoActivation: true,

	// Controls different whether lazy loading are allowed. If set to false, an error is raised when lazy loading occurs.
	allowTypeLazyLoading: true,
	allowObjectLazyLoading: true,
	allowListLazyLoading: true,

	// Allows additional scope variables to be introduced for dynamically compiled expressions
	expressionScope: null,

	autoReformat: true
};

exports.config = config;
