function ArgumentTypeError(argumentName, expectedType, actualValue) {
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

function ArgumentsLengthError(expected, actual) {
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

function ArgumentNullError(argumentName, reason) {
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

function ArgumentError(argumentName, reason) {
	/// <summary locid="M:J#ArgumentNullError.#ctor">
	/// An error type that is raised when an argument has an invalid value.
	/// </summary>
	/// <param name="argumentName" type="String">The name of the argument that was null.</param>
	/// <param name="reason" type="String">The reason that the argument cannot be null.</param>

	if (arguments.length !== 2) throw new ArgumentsLengthError(2, arguments.length);
	if (argumentName == null) throw new ArgumentNullError("argumentName");
	if (typeof (argumentName) !== "string") throw new ArgumentTypeError("argumentName", "string", argumentName);
	if (reason == null) throw new ArgumentNullError("reason");
	if (typeof (reason) !== "string") throw new ArgumentTypeError("reason", "string", reason);

	this.name = "ArgumentError";
	this.argumentName = argumentName;
	this.reason = reason;
	this.message = "Argument '" + argumentName + "' has an invalid value" + (reason ? ": " + reason + "." : ".");
}

ArgumentError.prototype = new Error();
ArgumentError.prototype.constructor = ArgumentError;

exports.ArgumentError = ArgumentError;
window.ArgumentError = ArgumentError;

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
	/// of the global error handler (message, url, lineNumber, colNumber, errorObj), as well as the "errorData"
	/// object, which will ultimately be passed to the "log error" provider. The event
	/// handler may choose to modified any of the errorData object's properties.
	/// 
	/// </remarks>
	/// <param name="fn" type="Function">The error event function. Signature: f (message, url, lineNumber, colNumber, errorObj, errorData).</param>

	if (fn == null) throw new ArgumentNullError("fn");
	if (typeof(fn) !== "function") throw new ArgumentTypeError("fn", "function", fn);

	errorEventFns.push(fn);
}

exports.addError = addError;

function removeError(fn) {
	/// <summary>
	/// Removes an event handler to the global error event.
	/// </summary>
	/// <param name="fn" type="Function">The error event function.</param>

	if (fn == null) throw new ArgumentNullError("fn");
	if (typeof (fn) !== "function") throw new ArgumentTypeError("fn", "function", fn);

	var idx = errorEventFns.indexOf(fn);
	if (idx < 0) {
		throw new ArgumentError("fn", "The given function was not found in the list of error handlers.");
	}
	errorEventFns.splice(idx, 1);
}

exports.removeError = removeError;

/*
* Handles an error that 
*/
function handleError(message, url, lineNumber, colNumber, errorObj, customErrorData, raiseEvents, onSuccess, onFailure) {

	// Initialize the default error data based on the error.
	var cancelled = false,
		errorData = jQuery.extend({
			message: message,
			type: "Error",
			url: window.location.href,
			refererUrl: document.referrer,
			stackTrace: errorObj ? errorObj.stack : "",
			additionalInfo: {
				url: url,
				lineNumber: lineNumber,
				columnNumber: colNumber
			}
		}, customErrorData);

	if (raiseEvents) {
		// The error was not handled, so raise the error event.
		errorEventFns.forEach(function (fn) {
			// Skip if the event has been cancelled.
			if (cancelled) {
				return;
			}

			var result = fn(message, url, lineNumber, colNumber, errorObj, errorData);
			if (result === true) {
				// Cancel the event if the result indicates that the event was handled.
				cancelled = true;
			}
		});
	}

	if (!cancelled && logErrorProvider) {
		// Log the error.
		logErrorProvider(errorData, onSuccess, onFailure);
	}

}

/*
* Explicitly logs an error without throwing.
* Raising the 'error' event is optional.
*/
function logError(message, url, lineNumber, colNumber, errorObj, errorData, raiseEvents, onSuccess, onFailure) {
	/// <summary>
	/// Logs an error.
	/// 
	/// Signature:
	/// ExoWeb.logError(message or error[, url, lineNumber][, errorData][, raiseEvents][, onSuccess][, onFailure]);
	/// 
	/// Examples:
	/// 
	/// ExoWeb.logError(e);
	/// ExoWeb.logError('Message', 'http://...', 14);
	/// ExoWeb.logError('Message', 'http://...', 14, 12);
	/// ExoWeb.logError('Message', 'http://...', 14, 12, e);
	/// ExoWeb.logError(e, { foo: "bar" }, function () { /* on success */ });
	/// ExoWeb.logError('Message', 'http://...', 14, 12, true, function () { /* on success */ }, function () { /* on failure */ });
	/// ExoWeb.logError('Message', 'http://...', 14, 12, { foo: "bar" }, true);
	/// </summary>
	/// <param name="message" type="String">The error message.</param>
	/// <param name="url" type="String" optional="true">The url where the error occurred.</param>
	/// <param name="lineNumber" type="Number" integer="true" optional="true">The line number where the error occurred.</param>
	/// <param name="colNumber" type="Number" integer="true" optional="true">The column number where the error occurred.</param>
	/// <param name="errorObj" type="Error" optional="true">Native Error object.</param>
	/// <param name="errorData" type="Object" optional="true">Custom data to include with the error.</param>
	/// <param name="raiseEvents" type="Boolean" optional="true">
	/// Whether or not to raise the error event when handling the error. When called via internal framework
	/// methods (e.g. the global error event handler) the events will be raised, but when called externally
	/// the caller must specify that they want events to be raised to avoid unwanted side-effects.
	/// </param>
	/// <param name="onSuccess" type="Function" optional="true">The callback to invoke when logging the error succeeds.</param>
	/// <param name="onFailure" type="Function" optional="true">The callback to invoke when logging the error fails.</param>

	// Ensure that the message (or error) argument was passed in
	if (message == null) throw new ArgumentNullError("message");

	if (arguments.length > 9) {
		throw new ArgumentsLengthError(9, arguments.length);
	}

	var args = Array.prototype.slice.call(arguments),
		successCallback = null,
		failureCallback = null,
		error = null,
		raiseErrorEvents = false,
		customErrorData = null;

	if (isFunction(args[args.length - 1])) {
		successCallback = args.pop();
		if (isFunction(args[args.length - 1])) {
			failureCallback = successCallback;
			successCallback = args.pop();
		}
	}

	if (isBoolean(args[args.length - 1])) {
		raiseErrorEvents = args.pop();
	}

	if (args.length > 1 && args[args.length - 1] instanceof Object && !(args[args.length - 1] instanceof Error)) {
		customErrorData = args.pop();
	}

	// An Error or string was passed in
	if (args.length === 1) {
		if (message instanceof Error) {
			// Rewrite arguments
			error = message;

			// Pass along the information from the error
			handleError(error.message, error.fileName, error.lineNumber, error.columnNumber, message, customErrorData, raiseErrorEvents, successCallback, failureCallback);
		}
		else {
			// Pass along the message and simulate the other information
			handleError(message.toString(), "?", "-1", "-1", null, customErrorData, raiseErrorEvents, successCallback, failureCallback);
		}
	}
	// Check for {message, url, lineNumber} mode
	else if (args.length >= 3) {
		// Validate args
		if (!(message.constructor === String)) throw new ArgumentTypeError("message", "string", message);
		if (url.constructor !== String) throw new ArgumentTypeError("url", "string", url);
		if (lineNumber != null && typeof (lineNumber) !== "number") throw new ArgumentTypeError("lineNumber", "number", lineNumber);

		// Pass along the information
		handleError(message, url, lineNumber, typeof colNumber === "number" ? colNumber : -1, errorObj instanceof Error ? errorObj : null, customErrorData, raiseErrorEvents, successCallback, failureCallback);
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
window.onerror = function (message, url, lineNumber, colNumber, errorObj) {

	if (!window.ExoWeb || ExoWeb.windowIsUnloading) {
		return false;
	}

	// Call previous handler.
	if (oldOnError && oldOnError.apply(this, arguments) === true) {
		// Previous handler has handled the error, so exit now and prevent propogation.
		return true;
	}

	// Pass the error along to event subscribers and then log.
	handleError(message, url, lineNumber, colNumber, errorObj, null, true);

	// Let default handler run.
	return false;

};
