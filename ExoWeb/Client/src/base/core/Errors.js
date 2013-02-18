function ArgumentTypeError (argumentName, expectedType, actualValue) {
	/// <summary locid="M:J#ArgumentTypeError.#ctor">
	/// An error type that is raised when an argument to a function
	/// is of the wrong type.
	/// </summary>
	/// <param name="argumentName" type="String">The name of the argument that was of the wrong type.</param>
	/// <param name="expectedType" type="String">The expected type of the arguments.</param>
	/// <param name="value">The actual number of arguments that were given.</param>

	if (arguments.length !== 3) throw new ArgumentsLengthError(3, arguments.length);
	if (argumentName == null) throw new ArgumentNullError("argumentName");
	if (typeof(argumentName) !== "string") throw new ArgumentTypeError("argumentName", "string", argumentName);
	if (expectedType == null) throw new ArgumentNullError("expectedType");
	if (typeof(expectedType) !== "string") throw new ArgumentTypeError("expectedType", "string", expectedType);

	this.name = "ArgumentTypeError";
	this.argumentName = argumentName;
	this.expectedType = expectedType;
	this.actualValue = actualValue;
	this.message = "Argument '" + argumentName + "' must be of type " + expectedType + ": " + actualValue + ".";
}

ArgumentTypeError.prototype = new Error();
ArgumentTypeError.prototype.constructor = ArgumentTypeError;

exports.ArgumentTypeError = ArgumentTypeError;
window.ArgumentTypeError = ArgumentTypeError;

function ArgumentsLengthError (expected, actual) {
	/// <summary locid="M:J#ArgumentsLengthError.#ctor">
	/// An error type that is raised when the wrong number
	/// of arguments is passed to a function.
	/// </summary>
	/// <param name="expected" type="Number">The expected number of arguments.</param>
	/// <param name="actual" type="Number">The actual number of arguments that were given.</param>

	if (arguments.length !== 2) throw new ArgumentsLengthError(2, arguments.length);
	if (expected == null) throw new ArgumentNullError("expected");
	if (actual == null) throw new ArgumentNullError("actual");
	if (typeof(expected) !== "number") throw new ArgumentTypeError("expected", "number", expected);
	if (typeof(actual) !== "number") throw new ArgumentTypeError("actual", "number", actual);

	this.name = "ArgumentsLengthError";
	this.expected = expected;
	this.actual = actual;
	this.message = "The number of arguments is not correct, expected " + expected + ", actual " + actual + ".";
}

ArgumentsLengthError.prototype = new Error();
ArgumentsLengthError.prototype.constructor = ArgumentsLengthError;

exports.ArgumentsLengthError = ArgumentsLengthError;
window.ArgumentsLengthError = ArgumentsLengthError;

function ArgumentNullError (argumentName, reason) {
	/// <summary locid="M:J#ArgumentNullError.#ctor">
	/// An error type that is raised when an argument is
	/// null or undefined and it must have a value.
	/// </summary>
	/// <param name="argumentName" type="String">The name of the argument that was null.</param>
	/// <param name="reason" type="String">The reason that the argument cannot be null.</param>

	if (arguments.length < 1 && arguments.length > 2) throw new ArgumentsLengthError(2, arguments.length);
	if (argumentName == null) throw new ArgumentNullError("argumentName");
	if (typeof(argumentName) !== "string") throw new ArgumentTypeError("argumentName", "string", argumentName);
	if (reason != null && typeof(reason) !== "string") throw new ArgumentTypeError("reason", "string", reason);

	this.name = "ArgumentNullError";
	this.argumentName = argumentName;
	this.reason = reason;
	this.message = "Argument '" + argumentName + "' cannot be null or undefined" + (reason ? ": " + reason + "." : ".");
}

ArgumentNullError.prototype = new Error();
ArgumentNullError.prototype.constructor = ArgumentNullError;

exports.ArgumentNullError = ArgumentNullError;
window.ArgumentNullError = ArgumentNullError;

var logErrorProvider = null;

function setLogErrorProvider(fn) {
	/// <summary>
	/// Provide an implementation of the LogError provider.
	/// </summary>
	/// <remarks>
	///
	/// Event propogation
	/// =================
	///
	/// When the global error event occurs, the log error handler is called last
	/// before exiting.  This allows existing subscribers to handle the error and
	/// prevent propogation, also preventing the error from being logged. Subscribers
	/// that attach to the error event after the log error handler is subscribed
	/// (i.e. after the framework script has loaded) should execute their logic
	/// first, then call the original event handler.  Unlike other handlers, the
	/// log error handler may NOT signal that the error was handled to prevent
	/// propogation.  The ExoWeb.error event can be used for that purpose. If the
	/// error reaches the logging phase it is assumed that it will not be handled.  
	///
	/// The event handler's argument(s)
	/// ===============================
	///
	/// The function is called with a single object, referred to as "errorData".
	/// The default object that is passed contains the following properties, which
	/// correspond to the format of the ServiceError object:
	///
	///		"message": The error message.
	///		"type": The type of error.  By default this is simply "Error".  A custom event
	///			handler may choose to attempt to infer the error type from the message.
	///		"url": The URL where the error occurred.  By default this is the current URL.
	///		"refererUrl": By default this is the `document.referrer` property.
	///		"additionalInfo": By default this is an object with `url` and `lineNumber`
	///			properties, which correspond to the arguments of that name which were
	///			passed to the global error event.  Custom error	handlers can remove these
	///			properties and/or include custom data.  Additional properties should use
	///			primative types, and should be only one level deep.  In other words,
	///			`errorData["Foo.Bar"] = 1`, not `errorData.Foo = { Bar: 1 }`.
	///
	/// </remarks>
	/// <param name="fn" type="Function">The error provider function.</param>

	if (arguments.length !== 1) throw new ArgumentsLengthError(1, arguments.length);
	if (fn == null) throw new ArgumentNullError("fn");
	if (typeof(fn) !== "function") throw new ArgumentTypeError("fn", "function", fn);

	logErrorProvider = fn;
}

exports.setLogErrorProvider = setLogErrorProvider;

var errorEventFns = [];

function addError (fn) {
	/// <summary>
	/// Attach an event handler to the global error event.
	/// </summary>
	/// <remarks>
	///
	/// Timing of event
	/// ===============
	///
	/// The ExoWeb error event is called when a global error event is raised, immediately
	/// before the "log error" provider is called.
	///
	/// The event handler's argument(s)
	/// ===============================
	///
	/// The event handler is passed four arguments in total: the original three arguments
	/// of the global error handler (message, url, lineNumber), as well as the "errorData"
	/// object, which will ultimately be passed to the "log error" provider.  The event
	/// handler may choose to modified any of the errorData object's properties.
	/// 
	/// </remarks>
	/// <param name="fn" type="Function">The error event function.  Signature: f (message, url, lineNumber)</param>

	if (fn == null) throw new ArgumentNullError("fn");
	if (typeof(fn) !== "function") throw new ArgumentTypeError("fn", "function", fn);

	errorEventFns.push(fn);
}

exports.addError = addError;

/*
* Handles an error that 
*/
function handleError(message, url, lineNumber) {

	// Initialize the default error data based on the error.
	var errorData = {
		message: message,
		type: "Error",
		url: window.location.href,
		refererUrl: document.referrer,
		additionalInfo: {
			url: url,
			lineNumber: lineNumber
		}
	};

	// The error was not handled, so raise the error event.
	errorEventFns.forEach(function(fn) {
		fn(message, url, lineNumber, errorData);
	});

	if (logErrorProvider) {
		// Log the error.
		logErrorProvider(errorData);
	}

}

/*
* Explicitly logs an error without throwing.
* Raising the 'error' event is optional.
*/
function logError(message, url, lineNumber) {
	/// <summary>
	/// Logs an error.
	/// </summary>
	/// <param name="message" type="String">The error message.</param>
	/// <param name="url" type="String">The url where the error occurred.</param>
	/// <param name="lineNumber" type="Number">The line number where the error occurred.</param>

	// Ensure that the message (or error) argument was passed in
	if (message == null) throw new ArgumentNullError("message");

	// Check for {message, url, lineNumber} mode
	if (arguments.length === 3) {

		// Validate arguments
		if (!(message.constructor === String)) throw new ArgumentTypeError("message", "string", message);
		if (url.constructor !== String) throw new ArgumentTypeError("url", "string", url);
		if (lineNumber != null && typeof(lineNumber) !== "number") throw new ArgumentTypeError("lineNumber", "number", lineNumber);

		// Pass along the information
		handleError(message, url, lineNumber);

	}

	// Otherwise, attempt {error} mode
	else if (arguments.length === 1) {

		if (message instanceof Error) {

			// Rewrite arguments
			var error = message;
			message = url = lineNumber = null;

			// Pass along the information from the error
			handleError(error.message, error.fileName, error.lineNumber);

		}
		else {

			// Pass along the message and simulate the other information
			handleError(message.toString(), "?", "-1");

		}

	}

	// Incorrect number of arguments
	else {
		throw new ArgumentsLengthError(3, arguments.length);
	}

}

exports.logError = logError;

/*
* Attaches to the global error event and logs the error if
* logging is implemented and the error is not handled.
*/
var oldOnError = window.onerror;
window.onerror = function (message, url, lineNumber) {

	// Call previous handler.
	if (oldOnError && oldOnError.apply(this, arguments) === true) {
		// Previous handler has handled the error, so exit now and prevent propogation.
		return true;
	}

	// Pass the error along to event subscribers and then log.
	handleError(message, url, lineNumber);

	// Let default handler run.
	return false;

};
