/// <reference path="Errors.js" />

var logWarningProvider = function (message) {
	// if the console is defined then log the message
	if (typeof (console) !== "undefined") {
		if (console.warn) {
			console.warn(message);
		}
	}
};

function setLogWarningProvider(fn) {
	/// <summary>
	/// Provide an implementation of the logWarning provider.
	/// </summary>
	/// <remarks>
	///
	/// The event handler's argument(s)
	/// ===============================
	///
	/// The function is called with a single value, the warning message.
	//
	/// </remarks>
	/// <param name="fn" type="Function">The warning provider function.</param>

	if (arguments.length !== 1) throw new ArgumentsLengthError(1, arguments.length);
	if (fn == null) throw new ArgumentNullError("fn");
	if (typeof(fn) !== "function") throw new ArgumentTypeError("fn", "function", fn);

	logWarningProvider = fn;
}

exports.setLogWarningProvider = setLogWarningProvider;

function logWarning(message) {
	if (logWarningProvider) {
		// Log the warning.
		logWarningProvider(message);
	}
}

exports.logWarning = logWarning;
