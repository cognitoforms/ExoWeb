window.ExoWeb = {};
window.ExoWeb.Model = {};
window.ExoWeb.Mapper = {};
window.ExoWeb.UI = {};
window.ExoWeb.View = {};
window.ExoWeb.DotNet = {};

(function(jQuery) {

	// #region ExoWeb.Config
	//////////////////////////////////////////////////

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

		// Specifies the default defaultIfError value for CalculatedPropertyRule instances
		calculationErrorDefault: undefined,

		// Specifies whether the adapter should update a control's value when the display
		// value is updated while being set, for example due to applying a format.
		autoReformat: true,

		// Specifies whether changes should be collected in logical batches.
		enableBatchChanges: true,

		// Specifies whether "runaway" rules should be detected, e.g. the case where a
		// rule causes itself to be re-entered continually (wheter directly or indirectly).
		detectRunawayRules: false,

		// Controls the maximum number of times that a child event scope can transfer events
		// to its parent while the parent scope is exiting. A large number indicates that
		// rules are not reaching steady-state. Technically something other than rules could
		// cause this scenario, but in practice they are the primary use-case for event scope. 
		nonExitingScopeNestingCount: 100
	};

	ExoWeb.config = config;

	// #endregion

	// #region ExoWeb.Unload
	//////////////////////////////////////////////////

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

	// #endregion

	// #region ExoWeb.Errors
	//////////////////////////////////////////////////

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

	ExoWeb.ArgumentTypeError = ArgumentTypeError;
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

	ExoWeb.ArgumentsLengthError = ArgumentsLengthError;
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

	ExoWeb.ArgumentNullError = ArgumentNullError;
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

	ExoWeb.ArgumentError = ArgumentError;
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

	ExoWeb.setLogErrorProvider = setLogErrorProvider;

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

	ExoWeb.addError = addError;

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

	ExoWeb.removeError = removeError;

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

	ExoWeb.logError = logError;

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

	// #endregion

	// #region ExoWeb.Warnings
	//////////////////////////////////////////////////

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

	ExoWeb.setLogWarningProvider = setLogWarningProvider;

	function logWarning(message) {
		if (logWarningProvider) {
			// Log the warning.
			logWarningProvider(message);
		}
	}

	ExoWeb.logWarning = logWarning;

	// #endregion

	// #region ExoWeb.TypeChecking
	//////////////////////////////////////////////////

	var typeExpr = /\s([a-z|A-Z]+)/;

	function type(obj) {
		if (obj === undefined) {
			return "undefined";
		}
		else if (obj === null) {
			return "null";
		}
		else {
			return Object.prototype.toString.call(obj).match(typeExpr)[1].toLowerCase();
		}
	}
	ExoWeb.type = type;

	function isNullOrUndefined(obj) {
		return obj === null || obj === undefined;
	}
	ExoWeb.isNullOrUndefined = isNullOrUndefined;

	function isArray(obj) {
		return type(obj) === "array";
	}
	ExoWeb.isArray = isArray;

	function isString(obj) {
		return type(obj) === "string";
	}
	ExoWeb.isString = isString;

	function isNumber(obj) {
		return type(obj) === "number";
	}
	ExoWeb.isNumber = isNumber;

	var integerExpr = /^-?[0-9]{1,10}$/;

	function isInteger(obj) {
		return isNumber(obj) && !isNaN(obj) && integerExpr.test(obj.toString()) && (obj >= -2147483648 && obj <= 2147483647);
	}
	ExoWeb.isInteger = isInteger;

	function isNatural(obj) {
		return isInteger(obj) && obj > 0;
	}
	ExoWeb.isNatural = isNatural;

	function isWhole(obj) {
		return isInteger(obj) && obj >= 0;
	}
	ExoWeb.isWhole = isWhole;

	var decimalExpr = /^-?[0-9]+\.[0-9]+$/;

	function isDecimal(obj) {
		return isNumber(obj) && !isNaN(obj) && decimalExpr.test(obj.toString());
	}
	ExoWeb.isDecimal = isDecimal;

	function isFunction(obj) {
		return type(obj) === "function";
	}
	ExoWeb.isFunction = isFunction;

	function isBoolean(obj) {
		return type(obj) === "boolean";
	}
	ExoWeb.isBoolean = isBoolean;

	function isDate(obj) {
		return type(obj) === "date";
	}
	ExoWeb.isDate = isDate;

	function isObject(obj) {
		return type(obj) === "object" || (obj && obj instanceof Object);
	}
	ExoWeb.isObject = isObject;

	// #endregion

	// #region ExoWeb.Random
	//////////////////////////////////////////////////

	function randomInteger(min, max) {
		var scale;
		if (arguments.length === 0) {
			min = 0;
			max = 9;
		}
		else if (arguments.length === 1) {
			if (!isInteger(min)) {
				throw new Error("Minimum argument must be an integer.");
			}

			if (min < 0) {
				max = 0;
			}
			else {
				max = min;
				min = 0;
			}
		}
		else if (!isInteger(min)) {
			throw new Error("Minimum argument must be an integer.");
		}
		else if (!isInteger(max)) {
			throw new Error("Maximum argument must be an integer.");
		}
		else if (min >= max) {
			throw new Error("Minimum argument must be less than maximum argument.");
		}

		var rand = Math.random();
		return rand === 1 ? max : Math.floor(rand * (max - min + 1)) + min;
	}

	ExoWeb.randomInteger = randomInteger;

	function randomText(len, includeDigits) {
		if (arguments.length === 0) {
			throw new Error("Length argument is required.");
		}
		else if (!isNatural(len)) {
			throw new Error("Length argument must be a natural number.");
		}

		var result = "";
		for (var i = 0; i < len; i++) {
			var min = 0;
			var max = includeDigits ? 35 : 25;
			var rand = randomInteger(min, max);
			var charCode;
			if (rand <= 25) {
				// Alpha: add 97 for 'a'
				charCode = rand + 97;
			}
			else {
				// Num: start at 0 and add 48 for 0
				charCode = (rand - 26) + 48;
			}
			result += String.fromCharCode(charCode);
		}
		return result;
	}

	ExoWeb.randomText = randomText;

	// #endregion

	// #region ExoWeb.Function
	//////////////////////////////////////////////////

	var overridableNonEnumeratedMethods;

	for (var m in {}) {
		if (m == "toString") {
			overridableNonEnumeratedMethods = [];
			break;
		}
	}

	if (!overridableNonEnumeratedMethods)
		overridableNonEnumeratedMethods = ["toString", "toLocaleString", "valueOf"];

	function addPrototypeMember(obj, name, member) {

		// method
		if (member instanceof Function) {
			obj[name] = member;
		}

		// property
		else if (member instanceof Object) {
			Object.defineProperty(obj, name, member);
		}

		// field
		else {
			obj[name] = member;
		}
	}

	Function.prototype.mixin = function mixin(members, obj) {
		if (!obj) {
			obj = this.prototype;
		}

		for (var m in members) {
			var member = members[m];
			if (members.hasOwnProperty(m)) {
				addPrototypeMember(obj, m, member);
			}
		}

		// IE's "in" operator doesn't return keys for native properties on the Object prototype
		overridableNonEnumeratedMethods.forEach(function (m) {
			var member = members[m];
			if (members.hasOwnProperty(m)) {
				addPrototypeMember(obj, m, member);
			}
		});
	};

	Function.prototype.dontDoubleUp = function Function$dontDoubleUp(options) {
		var proceed = this;
		var calls = [];
	
		// Is the function already being called with the same arguments?
		return function dontDoubleUp() {
			var i, ilen, j, jlen, origCallback, origThisPtr, partitionedArg, partitionedArgIdx, groupBy, callsInProgress, call, shouldJoinCall, otherPartitionedArg, partitionedInCall, joinArgIdx, args;
	
			// Make a copy of the invocation arguments.
			args = Array.prototype.slice.call(arguments);

			// Extract callback and thisPtr arguments, if they exist.
			if (options.callbackArg < arguments.length) {
				origCallback = arguments[options.callbackArg];
			}
			if (options.thisPtrArg < arguments.length) {
				origThisPtr = arguments[options.thisPtrArg];
			}

			// Determine what arguments can be partitioned into separate calls
			if (options.partitionedArg !== null && options.partitionedArg !== undefined) {
				partitionedArg = arguments[options.partitionedArg];
				if (!(partitionedArg instanceof Array)) {
					throw new Error("The partitioned argument must be an array.");
				}

				// Create a copy of the argument.
				partitionedArg = partitionedArg.copy();

				partitionedArgIdx = -1;
			}

			// Determine what values to use to group callers
			groupBy = [];
			if (options.groupBy && options.groupBy instanceof Array) {
				for (i = 0, ilen = options.groupBy.length; i < ilen; i++) {
					if (partitionedArg !== undefined && options.groupBy[i] === options.partitionedArg) {
						partitionedArgIdx = groupBy.length;
					}
					groupBy.push(arguments[options.groupBy[i]]);
				}
			}
			else if (options.groupBy !== null && options.groupBy !== undefined) {
				groupBy.push(arguments[options.groupBy]);
				if (options.groupBy === options.partitionedArg) {
					partitionedArgIdx = 0;
				}
			}
			else {
				for (i = 0, ilen = arguments.length; i < ilen; ++i) {
					if (i !== options.callbackArg && i !== options.thisPtrArg) {
						if (partitionedArg !== undefined && i === options.partitionedArg) {
							partitionedArgIdx = groupBy.length;
						}
						groupBy.push(arguments[i]);
					}
				}
			}

			// Verify that the the partitioned argument is part of the grouping.
			if (partitionedArgIdx === -1) {
				throw new Error("Invalid partitionedArg option.");
			}

			// Is this call already in progress?
			callsInProgress = [];
			for (i = 0, ilen = calls.length; (partitionedArg === undefined || partitionedArg.length > 0) && i < ilen; i++) {
				call = calls[i];

				// TODO: handle optional params better
				if (groupBy.length != call.groupBy.length) {
					continue;
				}

				// Only join calls together if they were called on the same object.
				shouldJoinCall = this === call.context;

				// Make sure all of the arguments match.
				for (j = 0, jlen = groupBy.length; shouldJoinCall && j < jlen; j++) {
					if (j === partitionedArgIdx) {	
						// Attempt to find items in partitioned argument that are in progress and remove them
						shouldJoinCall = call.groupBy[j].some(function(p) {
							return partitionedArg.indexOf(p) >= 0;
						});
					}
					else if (groupBy[j] !== call.groupBy[j]) {
						shouldJoinCall = false;
					}
				}

				if (shouldJoinCall) {

					partitionedInCall = [];

					// Remove partitioned args that will be satisfied by the call in progress.
					if (partitionedArg !== undefined) {
						otherPartitionedArg = call.groupBy[partitionedArgIdx];
						for (j = 0, jlen = otherPartitionedArg.length; j < jlen; j++) {
							joinArgIdx = partitionedArg.indexOf(otherPartitionedArg[j]);
							if (joinArgIdx >= 0) {
								partitionedInCall.push(otherPartitionedArg[j]);
								partitionedArg.splice(joinArgIdx, 1);
							}
						}
					}

					callsInProgress.push({ call: call, partitioned: partitionedInCall });

				}
			}

			if (callsInProgress.length === 0 || (partitionedArg !== undefined && partitionedArg.length > 0)) {

				// track the next call that is about to be made
				call = { callback: Functor(), groupBy: groupBy, context: this };
			
				calls.push(call);

				// make sure the original callback is invoked and that cleanup occurs
				call.callback.add(function() {
					if (calls.indexOf(call) < 0) {
						throw new Error("Call not found.");
					}
					if (origCallback) {
						origCallback.apply(origThisPtr || this, arguments);
					}
					if (options.memoize === true) {
						call.complete = true;
						call.response = {
							thisPtr: this,
							args: Array.prototype.slice.call(arguments)
						};
					}
					else {
						calls.remove(call);
					}
				});

				// Copy the args
				newArgs = args.slice();

				// use remaining partitioned args if in effect
				if (partitionedArg !== undefined && partitionedArg.length > 0) {
					newArgs[options.partitionedArg] = partitionedArg;
				}

				// pass the new callback to the inner function
				newArgs[options.callbackArg] = call.callback;

				call.args = newArgs;

				proceed.apply(this, newArgs);

			}

			if (callsInProgress.length > 0 && origCallback) {
		
				// wait for the original call to complete
				forEach(callsInProgress, function(call) {

					var invocationArgs;

					if (options.partitionedFilter) {
						invocationArgs = args.slice();
						invocationArgs[options.partitionedArg] = call.partitioned;
						invocationArgs[options.callbackArg] = origCallback;
					}

					var callbackArgs;

					if (call.call.complete === true) {
						if (options.partitionedFilter) {
							callbackArgs = Array.prototype.slice.call(call.call.response.args);
							options.partitionedFilter.call(origThisPtr || this, call.call.args, invocationArgs, callbackArgs);
						}
						else {
							callbackArgs = call.call.response.args;
						}

						origCallback.apply(origThisPtr || call.call.response.thisPtr, callbackArgs);
					}
					else {
						call.call.callback.add(function() {
							if (options.partitionedFilter) {
								callbackArgs = Array.prototype.slice.call(arguments);
								options.partitionedFilter.call(origThisPtr || this, call.call.args, invocationArgs, callbackArgs);
							}
							else {
								callbackArgs = arguments;
							}
	
							origCallback.apply(origThisPtr || this, callbackArgs);
						});
					}
				});

			}
		};
	};

	Function.prototype.cached = function Function$cached(options) {
		var proceed = this;
		var cache = {};

		var keygen = (options && options.key) || function(arg) { return arg; };

		return function cached() {
			var key = keygen.apply(this, arguments);
			return cache.hasOwnProperty(key) ? cache[key] : (cache[key] = proceed.apply(this, arguments));
		};
	};

	function bind(obj) {
		var slice = [].slice,
			args = slice.call(arguments, 1),
			self = this,
			nop = function () {},
			bound = function () {
				return self.apply(this instanceof nop ? this : (obj || {}),
					args.concat(slice.call(arguments)));
			};

		nop.prototype = self.prototype;
		bound.prototype = new nop();

		return bound;
	}

	// Function.prototype.bind polyfill
	if (!Function.prototype.bind)
		Function.prototype.bind = bind;

	Function.prototype.prepare = function prepare(thisPtr, args) {
		/// <summary>
		/// Returns a function that will invoke this function with the given
		/// this value and arguments, regardless of how the returned 
		/// function is invoked.
		/// </summary>

		var func = this;
		return function prepare$fn() {
			return func.apply(thisPtr || this, args || []);
		};
	};

	Function.prototype.prependArguments = function prependArguments(/* arg1, arg2, ... */) {
		var func = this;
		var additional = Array.prototype.slice.call(arguments);
		return function prependArguments$fn() {
			var args = [];
			Array.prototype.push.apply(args, additional);
			Array.prototype.push.apply(args, Array.prototype.slice.call(arguments));
			return func.apply(this, args);
		};
	};

	Function.prototype.appendArguments = function appendArguments(/* arg1, arg2, ... */) {
		var func = this;
		var additional = Array.prototype.slice.call(arguments);
		return function appendArguments$fn() {
			var args = Array.prototype.slice.call(arguments);
			Array.prototype.push.apply(args, additional);
			return func.apply(this, args);
		};
	};

	Function.prototype.spliceArguments = function spliceArguments(/* start, howmany, item1, item2, ... */) {
		var func = this;
		var spliceArgs = arguments;
		return function spliceArguments$fn() {
			var args = Array.prototype.slice.call(arguments);
			args.splice.apply(args, spliceArgs);
			return func.apply(this, args);
		};
	};

	Function.prototype.sliceArguments = function sliceArguments(/* start, end */) {
		var func = this;
		var sliceArgs = arguments;
		return function spliceArguments$fn() {
			var args = Array.prototype.slice.call(arguments);
			args = args.slice.apply(args, sliceArgs);
			return func.apply(this, args);
		};
	};

	function mergeFunctions(fn1, fn2, options) {
		// return early if one or both functions are not defined
		if (!fn1 && !fn2) return;
		if (!fn2) return fn1;
		if (!fn1) return fn2;

		if (options && options.async === true) {
			return function () {
				var idx = options.callbackIndex || 0;
				var callback = arguments[idx];

				// Ensure that there is a callback function
				if (callback == null) throw new ArgumentNullError("callback", "'mergeFunctions' was called in async mode");
				if (typeof(callback) !== "function") throw new ArgumentTypeError("callback", "function", callback);

				var signal = new Signal("mergeFunctions");

				// replace callback function with signal pending and invoke callback when both are complete
				var args1 = Array.prototype.slice.call(arguments);
				args1.splice(idx, 1, signal.pending());
				fn1.apply(this, args1);

				var args2 = Array.prototype.slice.call(arguments);
				args2.splice(idx, 1, signal.pending());
				fn2.apply(this, args2);

				signal.waitForAll(callback, (options.thisPtrIndex && arguments[options.thisPtrIndex]) || this);
			};
		}
		else if (options && options.andResults === true) {
			return function () {
				return fn1.apply(this, arguments) && fn2.apply(this, arguments);
			};
		}
		else if (options && options.orResults === true) {
			return function () {
				return fn1.apply(this, arguments) || fn2.apply(this, arguments);
			};
		}
		else {
			return function () {
				fn1.apply(this, arguments);
				fn2.apply(this, arguments);
			};
		}
	}

	function equals(obj) {
		return function(other) {
			return obj === other;
		};
	}

	function not(fn) {
		return function() {
			return !fn.apply(this, arguments);
		};
	}

	function before(original, fn) {
		return function() {
			fn.apply(this, arguments);
			original.apply(this, arguments);
		};
	}

	function after(original, fn) {
		return function() {
			original.apply(this, arguments);
			fn.apply(this, arguments);
		};
	}

	function callArgument(arg) {
		arg.call();
	}

	var funcRegex = /function\s*([\w_\$]*)/i;
	function parseFunctionName(f) {
		var result = funcRegex.exec(f);
		return result ? (result[1] || "{anonymous}") : "{anonymous}";
	}

	// #endregion

	// #region ExoWeb.Array
	//////////////////////////////////////////////////

	function addRange(arr, items) {
		Array.prototype.push.apply(arr, items);
	}

	function contains(arr, item, from) {
		return arr.indexOf(item, from) >= 0;
	}

	function copy(arr) {
		return Array.prototype.slice.call(arr);
	}

	// Filters out duplicate items from the given array.
	/////////////////////////////////////////////////////
	function distinct(arr) {
		var result = [];

		for(var i = 0, len = arr.length; i < len; i++)
			if (result.indexOf(arr[i]) < 0)
				result.push(arr[i]);

		return result;
	}

	function every(arr, callback, thisPtr) {
		for (var i = 0, len = arr.length; i < len; i++)
			if (i in arr && !callback.call(thisPtr || this, arr[i], i, arr))
				return false;

		return true;
	}

	// Based on https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fill#polyfill
	function fill(arr, value) {
		// Steps 1-2.
		if (arr == null) {
			throw new TypeError('Array is null or not defined');
		}

		var O = Object(arr);

		// Steps 3-5.
		var len = O.length >>> 0;

		// Steps 6-7.
		var start = arguments[2];
		var relativeStart = start >> 0;

		// Step 8.
		var k = relativeStart < 0 ?
			Math.max(len + relativeStart, 0) :
			Math.min(relativeStart, len);

		// Steps 9-10.
		var end = arguments[3];
		var relativeEnd = end === undefined ?
			len : end >> 0;

		// Step 11.
		var finalValue = relativeEnd < 0 ?
			Math.max(len + relativeEnd, 0) :
			Math.min(relativeEnd, len);

		// Step 12.
		while (k < finalValue) {
			O[k] = value;
			k++;
		}

		// Step 13.
		return O;
	}

	function filter(arr, callback, thisPtr) {
		var result = [];
		for (var i = 0, len = arr.length; i < len; i++) {
			if (i in arr) {
				var val = arr[i]; // callback may mutate original item
				if (callback.call(thisPtr || this, val, i, arr))
					result.push(val);
			}
		}

		return result;
	}

	// Based on https://vanillajstoolkit.com/polyfills/arrayfind/
	function find(arr, callback) {
		// 1. Let O be ? ToObject(this value).
		if (arr == null) {
			throw new TypeError('Array is null or not defined');
		}

		var o = Object(arr);

		// 2. Let len be ? ToLength(? Get(O, "length")).
		var len = o.length >>> 0;

		// 3. If IsCallable(callback) is false, throw a TypeError exception.
		if (typeof callback !== 'function') {
			throw new TypeError('callback must be a function');
		}

		// 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
		var thisArg = arguments[2];

		// 5. Let k be 0.
		var k = 0;

		// 6. Repeat, while k < len
		while (k < len) {
			// a. Let Pk be ! ToString(k).
			// b. Let kValue be ? Get(O, Pk).
			// c. Let testResult be ToBoolean(? Call(callback, T, « kValue, k, O »)).
			// d. If testResult is true, return kValue.
			var kValue = o[k];
			if (callback.call(thisArg, kValue, k, o)) {
				return kValue;
			}
			// e. Increase k by 1.
			k++;
		}

		// 7. Return undefined.
		return undefined;
	}

	// Based on https://vanillajstoolkit.com/polyfills/arrayfindindex/
	function findIndex(arr, predicate) {
		if (arr == null) {
			throw new TypeError('Array is null or not defined');
		}

		// 1. Let O be ? ToObject(this value).
		var o = Object(arr);

		// 2. Let len be ? ToLength(? Get(O, "length")).
		var len = o.length >>> 0;

		// 3. If IsCallable(predicate) is false, throw a TypeError exception.
		if (typeof predicate !== 'function') {
			throw new TypeError('predicate must be a function');
		}

		// 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
		var thisArg = arguments[2];

		// 5. Let k be 0.
		var k = 0;

		// 6. Repeat, while k < len
		while (k < len) {
			// a. Let Pk be ! ToString(k).
			// b. Let kValue be ? Get(O, Pk).
			// c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
			// d. If testResult is true, return k.
			var kValue = o[k];
			if (predicate.call(thisArg, kValue, k, o)) {
				return k;
			}
			// e. Increase k by 1.
			k++;
		}

		// 7. Return -1.
		return -1;
	}

	function first(arr, callback, thisPtr) {
		for (var i = 0, len = arr.length; i < len; i++) {
			if (i in arr) {
				var val = arr[i];
				if (!callback || callback.call(thisPtr || this, val, i, arr) === true) {
					return val;
				}
			}
		}

		return null;
	}

	// Based on https://vanillajstoolkit.com/polyfills/arrayflat/
	function flat(arr, depth) {
		// If no depth is specified, default to 1
		if (depth === undefined) {
			depth = 1;
		}

		// Recursively reduce sub-arrays to the specified depth
		var flatten = function (arr, depth) {

			// If depth is 0, return the array as-is
			if (depth < 1) {
				return arr.slice();
			}

			// Otherwise, concatenate into the parent array
			return arr.reduce(function (acc, val) {
				return acc.concat(Array.isArray(val) ? flatten(val, depth - 1) : val);
			}, []);

		};

		return flatten(arr, depth);
	}

	function flatMap(arr, callbackFn) {
		return flat(Array.prototype.map.apply(arr, Array.prototype.slice.call(arguments, 1)), 1);
	}

	function forEach(arr, callback, thisPtr) {
		for (var i = 0, len = arr.length; i < len; i++)
			if (i in arr)
				callback.call(thisPtr || this, arr[i], i, arr);
	}

	function indexOf(arr, elt, from) {
		var len = arr.length;
		from = Number(from) || 0;
		from = (from < 0) ? Math.ceil(from) : Math.floor(from);
		if (from < 0) from += len;

		for (; from < len; from++)
			if (from in arr && arr[from] === elt)
				return from;

		return -1;
	}

	function insert(arr, index, item) {
		Array.prototype.splice.call(arr, index, 0, item);
	}

	function insertRange(arr, index, items) {
		var args = items.slice();
		args.splice(0, 0, index, 0);
		Array.prototype.splice.apply(arr, args);
	}

	// Finds the set intersection of the two given arrays.  The items
	// in the resulting list are distinct and in no particular order.
	///////////////////////////////////////////////////////////////////
	function intersect(arr1, arr2) {
		return distinct(filter(arr1, function(item) {
			return arr2.indexOf(item) >= 0;
		}));
	}

	function last(arr, callback, thisPtr) {
		var result = null;

		for (var i = 0, len = arr.length; i < len; i++) {
			if (i in arr) {
				var val = arr[i];
				if (!callback || callback.call(thisPtr || this, val, i, arr) === true) {
					result = val;
				}
			}
		}

		return result;
	}

	function lastIndexOf(arr, item, from) {
		var len = arr.length;

		if (len === 0) return -1;

		var n = len;
		if (from) {
			n = Number(from);

			if (n !== n)
				n = 0;
			else if (n !== 0 && n !== (1 / 0) && n !== -(1 / 0))
				n = (n > 0 || -1) * Math.floor(Math.abs(n));
		}

		var k = n >= 0 ? Math.min(n, len - 1) : len - Math.abs(n);

		while (k >= 0)
			if (k in arr && arr[k] === item)
				return k;

		return -1;
	}

	function map(arr, callback, thisPtr) {
		var result = [];

		for (var i = 0, len = arr.length; i < len; i++)
			if (i in arr)
				result[i] = callback.call(thisPtr || this, arr[i], i, arr);

		return result;
	}

	function mapToArray(arr, callback, thisPtr) {
		var result = [];

		forEach(arr, function(item, i, a) {
			addRange(result, callback.call(thisPtr || this, item, i, a));
		});

		return result;
	}

	function observableSplice(arr, events, index, removeCount, addItems) {
		var removedItems;

		if (removeCount) {
			if (removeCount > 1 && arr.removeRange) {
				removedItems = arr.removeRange(index, removeCount);
			}
			else if (removeCount === 1 && arr.removeAt) {
				removedItems = [arr.removeAt(index)];
			}
			else {
				removedItems = arr.splice(index, removeCount);
			}
	
			if (events) {
				events.push({
					action: Sys.NotifyCollectionChangedAction.remove,
					oldStartingIndex: index,
					oldItems: removedItems,
					newStartingIndex: null,
					newItems: null
				});
			}
		}

		if (addItems.length > 0) {
			if (addItems.length > 1 && arr.insertRange) {
				arr.insertRange(index, addItems);
			}
			else if (addItems.length === 1 && arr.insert) {
				arr.insert(index, addItems[0]);
			}
			else {
				insertRange(arr, index, addItems);
			}

			if (events) {
				events.push({
					action: Sys.NotifyCollectionChangedAction.add,
					oldStartingIndex: null,
					oldItems: null,
					newStartingIndex: index,
					newItems: addItems
				});
			}
		}
	}

	function peek(arr) {
		var peekVal = arr.pop();
		arr.push(peekVal);
		return peekVal;
	}

	function purge(arr, callback, thisPtr) {
		var result = null;

		for (var i = 0; i < arr.length; i++) {
			if (callback.call(thisPtr || this, arr[i], i, arr) === true) {
				// Invoke removeAt method if it exists.
				if (arr.removeAt)
					arr.removeAt(i);
				else
					arr.splice(i, 1);

				// Lazy create result array.
				if (result === null) {
					result = [];
				}

				// Add index (accounting for previously removed
				// items that are now in the return value).
				result.push(i + result.length);

				// Decrement to account for removal.
				i--;
			}
		}

		return result;
	}

	function reduce(arr, accumlator, initialValue){
		var i = 0, len = arr.length, curr;

		if(typeof(accumlator) !== "function")
			throw new TypeError("First argument is not a function.");

		if(!len && arguments.length <= 2)
			throw new TypeError("Array length is 0 and no intial value was given.");

		if(arguments.length <= 2) {
			if (len === 0)
				throw new TypeError("Empty array and no second argument");

			curr = arr[i++]; // Increase i to start searching the secondly defined element in the array
		}
		else {
			curr = arguments[2];
		}

		for(; i < len; i++) {
			if (i in arr) {
				curr = accumlator.call(undefined, curr, arr[i], i, arr);
			}
		}

		return curr;
	}

	function remove(arr, item) {
		var idx = arr.indexOf(item);
		if (idx < 0)
			return false;

		arr.splice(idx, 1);
		return true;
	}

	function removeAt(arr, index) {
		arr.splice(index, 1);
	}

	function removeRange(arr, index, count) {
		return arr.splice(index, count);
	}

	function single(arr, callback, thisPtr) {
		var items;
		if (callback !== undefined) {
			items = filter(arr, callback, thisPtr);
		}
		else {
			items = arr;
		}

		if (items.length > 1)
			throw new Error("Expected a single item, but found " + items.length + ".");

		if (items.length === 0) {
			throw new Error("Expected a single item, but did not find a match.");
		}

		return items[0];
	}

	function some(arr, callback, thisPtr) {
		for (var i = 0, len = arr.length; i < len; i++)
			if (i in arr && callback.call(thisPtr || this, arr[i], i, arr))
				return true;

		return false;
	}

	function update(arr, target/*, trackEvents, equalityFn*/) {
		var source = arr, trackEvents = arguments[2], events = trackEvents ? [] : null, pointer = 0, srcSeek = 0, tgtSeek = 0, equalityFn = arguments[3];

		while (srcSeek < source.length) {
			if (source[srcSeek] === target[tgtSeek]) {
				if (pointer === srcSeek && pointer === tgtSeek) {
					// items match, so advance
					pointer = srcSeek = tgtSeek = pointer + 1;
				}
				else {
					// remove range from source and add range from target
					observableSplice(source, events, pointer, srcSeek - pointer, target.slice(pointer, tgtSeek));

					// reset to index follow target seek location since arrays match up to that point
					pointer = srcSeek = tgtSeek = tgtSeek + 1;
				}
			}
			else if (tgtSeek >= target.length) {
				// reached the end of the target array, so advance the src pointer and test again
				tgtSeek = pointer;
				srcSeek += 1;
			}
			else {
				// advance to the next target item to test
				tgtSeek += 1;
			}
		}

		observableSplice(source, events, pointer, srcSeek - pointer, target.slice(pointer, Math.max(tgtSeek, target.length)));

		return events;
	}

	if (!Array.prototype.addRange)
		Array.prototype.addRange = function(items) { addRange(this, items); };
	if (!Array.prototype.copy)
		Array.prototype.copy = function() { return copy(this); };
	if (!Array.prototype.clear)
		Array.prototype.clear = function () { this.length = 0; };
	if (!Array.prototype.contains)
		Array.prototype.contains = function (elt/*, from*/) { return contains(this, elt, arguments[1]); };
	if (!Array.prototype.dequeue)
		Array.prototype.dequeue = function() { return this.shift(); };
	if (!Array.prototype.distinct)
		Array.prototype.distinct = function() { return distinct(this); };
	if (!Array.prototype.every)
		Array.prototype.every = function(fun /*, thisp*/) { return every(this, fun, arguments[1]); };
	if (!Array.prototype.fill)
		Array.prototype.fill = function(value, times) { return fill(this, value, times); };
	if (!Array.prototype.filter)
		Array.prototype.filter = function(fun/*, thisp */) { return filter(this, fun, arguments[1]); };
	if (!Array.prototype.find)
		Array.prototype.find = function(callbackFn, thisArg) { return find(this, callbackFn, thisArg); };
	if (!Array.prototype.findIndex)
		Array.prototype.findIndex = function(predicate, thisArg) { return findIndex(this, predicate, thisArg); };
	if (!Array.prototype.first)
		Array.prototype.first = function(fun/*, thisp */) { return first(this, fun, arguments[1]); };
	if (!Array.prototype.flat)
		Array.prototype.flat = function(depth) { return flat(this, depth); };
	if (!Array.prototype.flatMap)
		Array.prototype.flatMap = function(callbackFn) { return flatMap(this, callbackFn); };
	if (!Array.prototype.forEach)
		Array.prototype.forEach = function(fun /*, thisp*/) { forEach(this, fun, arguments[1]); };
	if (!Array.prototype.indexOf)
		Array.prototype.indexOf = function(elt/*, from*/) { return indexOf(this, elt, arguments[1]); };
	if (!Array.prototype.intersect)
		Array.prototype.intersect = function(items) { return intersect(this, items); };
	if (!Array.prototype.last)
		Array.prototype.last = function(fun/*, thisp */) { return last(this, fun, arguments[1]); };
	if (!Array.prototype.lastIndexOf)
		Array.prototype.lastIndexOf = function (item/*, from*/) { return lastIndexOf(this, item, arguments[1]); };
	if (!Array.prototype.map)
		Array.prototype.map = function(fun /*, thisp*/) { return map(this, fun, arguments[1]); };
	if (!Array.prototype.mapToArray)
		Array.prototype.mapToArray = function(fun/*, thisp*/) { return mapToArray(this, fun, arguments[1]); };
	if (!Array.prototype.peek)
		Array.prototype.peek = function() { return peek(this); };
	if (!Array.prototype.purge)
		Array.prototype.purge = function(fun/*, thisp*/) { return purge(this, fun, arguments[1]); };
	if (!Array.prototype.reduce)
		Array.prototype.reduce = function(accumulator, intialValue) { return reduce(this, accumulator, intialValue); };
	if (!Array.prototype.remove)
		Array.prototype.remove = function(item) { return remove(this, item); };
	if (!Array.prototype.single)
		Array.prototype.single = function(fun/*, thisp */) { return single(this, fun, arguments[1]); };
	if (!Array.prototype.some)
		Array.prototype.some = function(fun /*, thisp*/) { return some(this, fun, arguments[1]); };

	// Based on https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from#polyfill
	var from = (function () {
		var symbolIterator;
		try {
			symbolIterator = Symbol.iterator
				? Symbol.iterator
				: 'Symbol(Symbol.iterator)';
		} catch (e) {
			symbolIterator = 'Symbol(Symbol.iterator)';
		}

		var toStr = Object.prototype.toString;
		var isCallable = function (fn) {
			return (
				typeof fn === 'function' ||
				toStr.call(fn) === '[object Function]'
			);
		};
		var toInteger = function (value) {
			var number = Number(value);
			if (isNaN(number)) return 0;
			if (number === 0 || !isFinite(number)) return number;
			return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
		};
		var maxSafeInteger = Math.pow(2, 53) - 1;
		var toLength = function (value) {
			var len = toInteger(value);
			return Math.min(Math.max(len, 0), maxSafeInteger);
		};

		var setGetItemHandler = function setGetItemHandler(isIterator, items) {
			var iterator = isIterator && items[symbolIterator]();
			return function getItem(k) {
				return isIterator ? iterator.next() : items[k];
			};
		};

		var getArray = function getArray(
			T,
			A,
			len,
			getItem,
			isIterator,
			mapFn
		) {
			// 16. Let k be 0.
			var k = 0;

			// 17. Repeat, while k < len… or while iterator is done (also steps a - h)
			while (k < len || isIterator) {
				var item = getItem(k);
				var kValue = isIterator ? item.value : item;

				if (isIterator && item.done) {
					return A;
				} else {
					if (mapFn) {
						A[k] =
							typeof T === 'undefined'
								? mapFn(kValue, k)
								: mapFn.call(T, kValue, k);
					} else {
						A[k] = kValue;
					}
				}
				k += 1;
			}

			if (isIterator) {
				throw new TypeError(
					'Array.from: provided arrayLike or iterator has length more then 2 ** 52 - 1'
				);
			} else {
				A.length = len;
			}

			return A;
		};

		// The length property of the from method is 1.
		return function from(arrayLikeOrIterator /*, mapFn, thisArg */) {
			// 1. Let C be the this value.
			var C = this;

			// 2. Let items be ToObject(arrayLikeOrIterator).
			var items = Object(arrayLikeOrIterator);
			var isIterator = isCallable(items[symbolIterator]);

			// 3. ReturnIfAbrupt(items).
			if (arrayLikeOrIterator == null && !isIterator) {
				throw new TypeError(
					'Array.from requires an array-like object or iterator - not null or undefined'
				);
			}

			// 4. If mapfn is undefined, then let mapping be false.
			var mapFn = arguments.length > 1 ? arguments[1] : void undefined;
			var T;
			if (typeof mapFn !== 'undefined') {
				// 5. else
				// 5. a If IsCallable(mapfn) is false, throw a TypeError exception.
				if (!isCallable(mapFn)) {
					throw new TypeError(
						'Array.from: when provided, the second argument must be a function'
					);
				}

				// 5. b. If thisArg was supplied, let T be thisArg; else let T be undefined.
				if (arguments.length > 2) {
					T = arguments[2];
				}
			}

			// 10. Let lenValue be Get(items, "length").
			// 11. Let len be ToLength(lenValue).
			var len = toLength(items.length);

			// 13. If IsConstructor(C) is true, then
			// 13. a. Let A be the result of calling the [[Construct]] internal method
			// of C with an argument list containing the single item len.
			// 14. a. Else, Let A be ArrayCreate(len).
			var A = isCallable(C) ? Object(new C(len)) : new Array(len);

			return getArray(
				T,
				A,
				len,
				setGetItemHandler(isIterator, items),
				isIterator,
				mapFn
			);
		};
	})();

	// Based on https://vanillajstoolkit.com/polyfills/arrayisarray/
	function isArray(value) {
		return Object.prototype.toString.call(value) === '[object Array]';
	}

	function of() {
		return Array.prototype.slice.call(arguments);
	}

	if (!Array.from)
		Array.from = from;
	if (!Array.isArray)
		Array.isArray = isArray;
	if (!Array.of)
		Array.of = of;

	// #endregion

	// #region ExoWeb.String
	//////////////////////////////////////////////////

	// Add String.trim() if not natively supported
	if (typeof String.prototype.trim !== 'function') {
		String.prototype.trim = function () {
			return this.replace(/^\s+|\s+$/g, '');
		}
	}
	function isNullOrEmpty(str) {
		return str === null || str === undefined || str === "";
	}

	// Based on https://vanillajstoolkit.com/polyfills/stringendswith/
	function endsWith(str, searchStr, position) {
		// This works much better than >= because
		// it compensates for NaN:
		if (!(position < str.length)) {
			position = str.length;
		} else {
			position |= 0; // round position
		}
		return str.substr(position - searchStr.length, searchStr.length) === searchStr;
	}

	function includes(str, search, start) {
		if (search instanceof RegExp) {
			throw TypeError('first argument must not be a RegExp');
		}
		if (start === undefined) { start = 0; }
		return str.indexOf(search, start) !== -1;
	}

	// https://gist.github.com/TheBrenny/039add509c87a3143b9c077f76aa550b
	function matchAll (str, rx) {
		if (typeof rx === "string") rx = new RegExp(rx, "g"); // coerce a string to be a global regex
		rx = new RegExp(rx); // Clone the regex so we don't update the last index on the regex they pass us
		var cap = []; // the single capture
		var all = []; // all the captures (return this)
		while ((cap = rx.exec(str)) !== null) all.push(cap); // execute and add
		return all; // profit!
	}

	// Based on https://vanillajstoolkit.com/polyfills/stringpadend/
	function padEnd(str, targetLength, padString) {
		targetLength = targetLength >> 0; //floor if number or convert non-number to 0;
		padString = String((typeof padString !== 'undefined' ? padString : ' '));
		if (str.length > targetLength) {
			return String(str);
		}
		else {
			targetLength = targetLength - str.length;
			if (targetLength > padString.length) {
				padString += repeat(padString, targetLength / padString.length); //append to original to ensure we are longer than needed
			}
			return String(str) + padString.slice(0, targetLength);
		}
	}

	// Based on https://vanillajstoolkit.com/polyfills/stringpadstart/
	function padStart(str, targetLength, padString) {
		targetLength = targetLength >> 0; //truncate if number or convert non-number to 0;
		padString = String((typeof padString !== 'undefined' ? padString : ' '));
		if (str.length > targetLength) {
			return String(str);
		}
		else {
			targetLength = targetLength - str.length;
			if (targetLength > padString.length) {
				padString += repeat(padString, targetLength / padString.length); //append to original to ensure we are longer than needed
			}
			return padString.slice(0, targetLength) + String(str);
		}
	}

	// Based on https://vanillajstoolkit.com/polyfills/stringrepeat/
	function repeat(str, count) {
		if (str == null)
			throw new TypeError('can\'t convert ' + str + ' to object');

		var result = '' + str;
		// To convert string to integer.
		count = +count;
		// Check NaN
		if (count != count)
			count = 0;

		if (count < 0)
			throw new RangeError('repeat count must be non-negative');

		if (count == Infinity)
			throw new RangeError('repeat count must be less than infinity');

		count = Math.floor(count);
		if (result.length == 0 || count == 0)
			return '';

		// Ensuring count is a 31-bit integer allows us to heavily optimize the
		// main part. But anyway, most current (August 2014) browsers can't handle
		// strings 1 << 28 chars or longer, so:
		if (result.length * count >= 1 << 28)
			throw new RangeError('repeat count must not overflow maximum string size');

		var maxCount = result.length * count;
		count = Math.floor(Math.log(count) / Math.log(2));
		while (count) {
			result += result;
			count--;
		}
		result += result.substring(0, maxCount - result.length);
		return result;
	}

	// Based on https://vanillajstoolkit.com/polyfills/stringreplaceall/
	function replaceAll(str, substr, newSubstr) {
		// If a regex pattern
		if (Object.prototype.toString.call(substr).toLowerCase() === '[object regexp]') {
			return str.replace(substr, newSubstr);
		}

		// If a string
		return str.replace(new RegExp(substr, 'g'), newSubstr);
	}

	// Based on https://vanillajstoolkit.com/polyfills/stringstartswith/
	function startsWith(str, searchString, position) {
		return str.slice(position || 0, searchString.length) === searchString;
	}

	// Based on https://vanillajstoolkit.com/polyfills/stringtrimend/
	function trimEnd(str) {
		return str.replace(new RegExp(/[\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF]+/.source + '$', 'g'), '');
	}

	// Based on https://vanillajstoolkit.com/polyfills/stringtrimstart/
	function trimStart(str) {
		return str.replace(new RegExp('^' + /[\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF]+/.source, 'g'), '');
	}

	if (!String.prototype.endsWith)
		String.prototype.endsWith = function (searchStr /*, position*/) { return endsWith(this, rx, arguments[1]); };
	if (!String.prototype.includes)
		String.prototype.includes = function (search /*, start*/) { return includes(this, search, arguments[1]); };
	if (!String.prototype.matchAll)
		String.prototype.matchAll = function (regexp) { return matchAll(this, regexp); };
	if (!String.prototype.padEnd)
		String.prototype.padEnd = function (targetLength /*, padString*/) { return padEnd(this, targetLength, arguments[1]); };
	if (!String.prototype.padStart)
		String.prototype.padStart = function (targetLength /*, padString*/) { return padStart(this, targetLength, arguments[1]); };
	if (!String.prototype.repeat)
		String.prototype.repeat = function (count) { return repeat(this, count); };
	if (!String.prototype.replaceAll)
		String.prototype.replaceAll = function (substr, newSubstr) { return replaceAll(this, substr, newSubstr); };
	if (!String.prototype.startsWith)
		String.prototype.startsWith = function (searchString /*, position*/) { return startsWith(this, searchString, arguments[1]); };
	if (!String.prototype.trimEnd)
		String.prototype.trimEnd = function () { return trimEnd(this); };
	if (!String.prototype.trimStart)
		String.prototype.trimStart = function () { return trimStart(this); };

	// #endregion

	// #region ExoWeb.Cache
	//////////////////////////////////////////////////

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

	// #endregion

	// #region ExoWeb.Activity
	//////////////////////////////////////////////////

	var activityCallbacks = [];

	function registerActivity(label, callback, thisPtr) {
		if (label == null) throw new ArgumentNullError("label");
		if (typeof (label) !== "string") throw new ArgumentTypeError("label", "string", label);
		if (callback == null) throw new ArgumentNullError("callback");
		if (typeof (callback) !== "function") throw new ArgumentTypeError("callback", "function", callback);

		var item = { label: label, callback: callback };

		if (thisPtr) {
			callback.thisPtr = thisPtr;
		}

		activityCallbacks.push(item);
	}

	ExoWeb.registerActivity = registerActivity;

	function isBusy(/* logBusyLabel */) {
		var busy = false;
		var logBusyLabel = arguments[0];

		getBusyItems(function (item) {
			busy = true;

			if (logBusyLabel) {
				console.log("Item \"" + item.label + "\" is busy.");
				return false;
			}
			else {
				return true;
			}
		});

		return busy;
	}

	ExoWeb.isBusy = isBusy;

	function getBusyItems(onBusyItemFound) {
		var busyItems = [];

		for (var i = 0, len = activityCallbacks.length; i < len; i++) {
			var item = activityCallbacks[i];

			if (item.callback.call(item.thisPtr || this) === true) {
				busyItems.push(item);

				if (onBusyItemFound && onBusyItemFound(item) === true)
					return busyItems;
			}
		}

		return busyItems;
	}

	ExoWeb.getBusyItems = getBusyItems;

	// #endregion

	// #region ExoWeb.Batch
	//////////////////////////////////////////////////

	var batchIndex = 0;
	var allBatches = [];
	var currentBatch = null;

	function Batch(label) {
		this._index = batchIndex++;
		this._labels = [label];
		this._rootLabel = label;
		this._subscribers = [];

		allBatches.push(this);
	}

	registerActivity("Batch", function() {
		return Batch.all().length > 0;
	});

	Batch.all = function Batch_$all(includeEnded) {
		return allBatches.filter(function(e) {
			return includeEnded || !e.isEnded();
		});
	};

	Batch.current = function Batch_$current() {
		return currentBatch;
	};

	Batch.suspendCurrent = function Batch_$suspendCurrent(message) {
		if (currentBatch !== null) {
			var batch = currentBatch;
			currentBatch = null;
			return batch;
		}
	};

	Batch.start = function Batch_$start(label) {
		if (currentBatch) {
			currentBatch._begin(label);
		}
		else {
			currentBatch = new Batch(label);
		}

		return currentBatch;
	};

	Batch.resume = function Batch_$resume(batch) {
		if (batch) {
			(batch._transferredTo || batch)._resume();
		}
	};

	Batch.end = function Batch_$end(batch) {
		(batch._transferredTo || batch)._end();
	};

	Batch.whenDone = function Batch_$whenDone(fn, thisPtr) {
		if (currentBatch) {
			currentBatch.whenDone(fn, thisPtr);
		}
		else {
			fn.call(thisPtr || this);
		}
	};

	Batch.current = function Batch_$current() {
		return currentBatch;
	};

	Batch.mixin({
		_begin: function Batch$_begin(label) {
			this._labels.push(label);

			return this;
		},
		_end: function Batch$_end() {
			// Cannot end a batch that has already been ended.
			if (this.isEnded()) {
				return this;
			}

			// Remove the last label from the list.
			var label = this._labels.pop();

			if (this.isEnded()) {
				// If we are ending the current batch, then null out the current batch 
				// variable so that new batches can be created with a new root label.
				if (currentBatch === this) {
					currentBatch = null;
				}

				// Invoke the subscribers.
				var subscriber = this._subscribers.dequeue();
				while (subscriber) {
					subscriber.fn.apply(subscriber.thisPtr || this, arguments);
					subscriber = this._subscribers.dequeue();
				}
			}

			return this;
		},
		_transferTo: function Batch$_transferTo(otherBatch) {
			// Transfers this batch's labels and subscribers to the
			// given batch.  From this point forward this batch defers
			// its behavior to the given batch.

			// Transfer labels from one batch to another.
			otherBatch._labels.addRange(this._labels);
			this._labels.clear();
			otherBatch._subscribers.addRange(this._subscribers);
			this._subscribers.clear();
			this._transferredTo = otherBatch;
		},
		_resume: function Batch$_resume() {
			// Ignore resume on a batch that has already been ended.
			if (this.isEnded()) {
				return;
			}

			if (currentBatch !== null) {
				// If there is a current batch then simple transfer the labels to it.
				this._transferTo(currentBatch);
				return currentBatch;
			}

			currentBatch = this;

			return this;
		},
		isEnded: function Batch$isEnded() {
			return this._labels.length === 0;
		},
		whenDone: function Batch$whenDone(fn, thisPtr) {
			this._subscribers.push({ fn: fn, thisPtr: thisPtr });

			return this;
		}
	});

	ExoWeb.Batch = Batch;

	// #endregion

	// #region ExoWeb.Signal
	//////////////////////////////////////////////////

	var pendingSignalTimeouts = null;

	function Signal(debugLabel) {
		this._waitForAll = [];
		this._pending = 0;
		this._debugLabel = debugLabel;
	}

	var setupCallbacks = function setupCallbacks() {
		window.setTimeout(function () {
			var callbacks, maxBatch = isNumber(config.signalMaxBatchSize) ? config.signalMaxBatchSize : null;
			if (maxBatch && pendingSignalTimeouts.length > maxBatch) {
				// Exceeds max batch size, so only invoke the max number and delay the rest
				callbacks = pendingSignalTimeouts.splice(0, maxBatch);
				setupCallbacks();
			}
			else {
				// No max batch, or does not exceed size, so call all pending callbacks
				callbacks = pendingSignalTimeouts;
				pendingSignalTimeouts = null;
			}
			// Call each callback in order
			callbacks.forEach(callArgument);
		}, 1);
	};

	function doCallback(name, thisPtr, callback, args, executeImmediately) {
		if (executeImmediately === false || (config.signalTimeout === true && executeImmediately !== true)) {
			var batch = Batch.suspendCurrent("_doCallback");

			// manage a queue of callbacks to ensure the order of execution

			var setup = false;
			if (pendingSignalTimeouts === null) {
				pendingSignalTimeouts = [];
				setup = true;
			}

			pendingSignalTimeouts.push(function() {
				Batch.resume(batch);
				callback.apply(thisPtr, args || []);
			});

			if (setup) {
				setupCallbacks();
			}
		}
		else {
			callback.apply(thisPtr, args || []);
		}
	}

	Signal.mixin({
		pending: function Signal$pending(callback, thisPtr, executeImmediately) {
			if (this._pending === 0) {
				Signal.allPending.push(this);
			}

			this._pending++;
			return this._genCallback(callback, thisPtr, executeImmediately);
		},
		orPending: function Signal$orPending(callback, thisPtr, executeImmediately) {
			return this._genCallback(callback, thisPtr, executeImmediately);
		},
		_doCallback: function Signal$_doCallback(name, thisPtr, callback, args, executeImmediately) {
			doCallback.apply(this, arguments);
		},
		_genCallback: function Signal$_genCallback(callback, thisPtr, executeImmediately) {
			var signal = this, called = false;
			return function Signal$_genCallback$result() {
				signal._doCallback("pending", thisPtr || this, function Signal$_genCallback$fn() {

					// Throw an error if the signal callback has already been called
					if (called) throw new Error("(" + signal._debugLabel + ") signal callback was called more than once.");

					// Record the fact that the callback has already been called in case it is called again
					called = true;

					// Invoke the callback if it exists
					if (callback) callback.apply(this, arguments);

					// Signal that the callback is complete
					signal.oneDone();

				}, arguments, executeImmediately);
			};
		},
		waitForAll: function Signal$waitForAll(callback, thisPtr, executeImmediately) {
			if (!callback) {
				return;
			}

			if (this._pending === 0) {
				this._doCallback("waitForAll", thisPtr, callback, [], executeImmediately);
			}
			else {
				this._waitForAll.push({ "callback": callback, "thisPtr": thisPtr, "executeImmediately": executeImmediately });
			}
		},
		oneDone: function Signal$oneDone() {
			--this._pending;

			if (this._pending === 0) {
				Signal.allPending.remove(this);
			}

			while (this._pending === 0 && this._waitForAll.length > 0) {
				var item = this._waitForAll.dequeue();
				this._doCallback("waitForAll", item.thisPtr, item.callback, [], item.executeImmediately);
			}
		},
		isActive: function Signal$isActive() {
			return this._pending > 0;
		}
	});

	Signal.allPending = [];

	Signal.begin = function (debugLabel) {
		return new Signal(debugLabel);
	};

	ExoWeb.Signal = Signal;

	// #endregion

	// #region ExoWeb.Functor
	//////////////////////////////////////////////////

	function Functor() {
		var funcs = [];

		var f = function Functor$fn() {
			for (var i = 0; i < funcs.length; ++i) {
				var item = funcs[i];

				// Don't re-run one-time subscriptions that have already been applied.
				if (item.applied === true) {
					continue;
				}

				// Ensure that there is either no filter or the filter passes.
				if (!item.filter || item.filter.apply(this, arguments) === true) {
					// If handler is set to execute once,
					// remove the handler before calling.
					if (item.once === true) {
						// Mark as applied but leave item in array to avoid potential
						// problems due to re-entry into event invalidating iteration
						// index. In some cases re-entry would be a red-flag, but for
						// "global" events, where the context of the event is derived
						// from the arguments, the event could easily be re-entered
						// in a different context with different arguments.
						item.applied = true;
					}

					// Call the handler function.
					item.fn.apply(this, arguments);
				}
			}
		};

		f._funcs = funcs;
		f.add = Functor$add;
		f.remove = Functor$remove;
		f.isEmpty = Functor$isEmpty;
		f.clear = Functor$clear;

		return f;
	}

	function Functor$add(fn, filter, once) {
		var item = { fn: fn };

		if (filter !== undefined) {
			item.filter = filter;
		}

		if (once !== undefined) {
			item.once = once;
		}

		this._funcs.push(item);

		return fn;
	}

	function Functor$remove(old) {
		for (var i = this._funcs.length - 1; i >= 0; --i) {
			if (this._funcs[i].fn === old) {
				this._funcs.splice(i, 1);
				return true;
			}
		}

		return false;
	}

	function Functor$clear() {
		this._funcs.length = 0;
	}

	function Functor$isEmpty(args) {
		return !this._funcs.some(function (item) { return item.applied !== true && (!args || !item.filter || item.filter.apply(this, args)); }, this);
	}

	var functorEventsInProgress = 0;

	// busy if there are any events in progress
	registerActivity("Functor", function() {
		return functorEventsInProgress > 0;
	});

	Functor.eventing = {
		_addEvent: function Functor$_addEvent(name, func, filter, once) {
			if (!this["_" + name]) {
				this["_" + name] = new Functor();
			}

			this["_" + name].add(func, filter, once);

			return func;
		},
		_removeEvent: function Functor$_removeEvent(name, func) {
			var handler = this["_" + name];
			if (handler) {
				handler.remove(func);
				return true;
			}

			return false;
		},
		_raiseEvent: function Functor$_raiseEvent(name, argsArray) {
			var handler = this["_" + name];
			if (handler) {
				try {
					functorEventsInProgress++;
					handler.apply(this, argsArray || []);
				}
				finally {
					functorEventsInProgress--;
				}
			}
		},
		_clearEvent: function Functor$_clearEvent(name) {
			var evtName = "_" + name;
			if (this.hasOwnProperty(evtName)) {
				this[evtName] = null;
			}
		},
		_getEventHandler: function Functor$_getEventHandler(name) {
			return this["_" + name];
		}
	};

	ExoWeb.Functor = Functor;

	// #endregion

	// #region ExoWeb.FunctionChain
	//////////////////////////////////////////////////

	function FunctionChain(steps, thisPtr) {
		if (!(steps instanceof Array)) {
			throw new ArgumentTypeError("steps", "array", steps);
		}

		this._steps = steps;
		this._thisPtr = thisPtr;
	}

	FunctionChain.prepare = function FunctionChain$_invoke() {
		// Return a function that can be invoked with callback and thisPtr.
		// Useful for assigning to a prototype member, since "this" is used
		// as the thisPtr for the chain if "thisPtr" argument is not supplied,
		// while "thisPtr" of invocation is used as the argument to "invoke".

		var steps,
			thisPtrOuter = null;

		// no args => empty chain
		if (arguments.length === 0) {
			steps = [];
		} else if (arguments.length === 1 && arguments[0] instanceof Array) {
			// One array arg => array of steps
			steps = arguments[0];
		} else if (arguments.length === 2 && arguments[0] instanceof Array) {
			// Two args (first array) => array of steps and this pointer
			steps = arguments[0];
			thisPtrOuter = arguments[1];
		} else {
			// Otherwise, assume arguments correspond to steps
			steps = Array.prototype.slice.call(arguments);
		}

		return function(callback, thisPtr) {
			var chain = new FunctionChain(steps, thisPtrOuter || this);
			chain.invoke(callback, thisPtr);
		};
	};

	FunctionChain.forEachAsync = function (items, stepFunction, callback) {
		if (items.length === 0) {
			if (callback) {
				callback();
			}
			return;
		}

		var chain = new FunctionChain(items.map(function (item) {
			return function (cb, thisPtr) {
				stepFunction.call(thisPtr || this, item, cb, thisPtr || this);
			};
		}));
		chain.invoke(callback);
	};

	function doStep(idx, callback, thisPtr) {
		var outerCallback = callback;
		var outerThisPtr = thisPtr;
		var nextStep = idx + 1 < this._steps.length ?
			doStep.prependArguments(idx + 1, outerCallback, outerThisPtr).bind(this) :
			function() {
				if (outerCallback && outerCallback instanceof Function) {
					outerCallback.apply(outerThisPtr || this, arguments);
				}
			};

		this._steps[idx].call(this._thisPtr || this, nextStep);
	}

	FunctionChain.mixin({
		invoke: function(callback, thisPtr) {
			doStep.call(this, 0, callback, thisPtr);
		}
	});

	ExoWeb.FunctionChain = FunctionChain;

	// #endregion

	// #region ExoWeb.EventScope
	//////////////////////////////////////////////////

	var currentEventScope = null;

	function EventScope() {
		// If there is a current event scope
		// then it will be the parent of the new event scope
		var parent = currentEventScope;

		// Define the parent property
		Object.defineProperty(this, "parent", { value: parent });

		// Define the isActive property
		this.isActive = true;

		// Set this to be the current event scope
		currentEventScope = this;
	}

	EventScope.mixin(Functor.eventing);

	EventScope.mixin({
		abort: function () {
			if (!this.isActive) {
				throw new Error("The event scope cannot be aborted because it is not active.");
			}

			try {
				var abortHandler = this._getEventHandler("abort");
				if (abortHandler && !abortHandler.isEmpty()) {
					// Invoke all subscribers
					abortHandler();
				}

				// Clear the events to ensure that they aren't
				// inadvertantly raised again through this scope
				this._clearEvent("abort");
				this._clearEvent("exit");
			}
			finally {
				// The event scope is no longer active
				this.isActive = false;

				if (currentEventScope && currentEventScope === this) {
					// Roll back to the closest active scope
					while (currentEventScope && !currentEventScope.isActive) {
						currentEventScope = currentEventScope.parent;
					}
				}
			}
		},
		exit: function() {
			if (!this.isActive) {
				throw new Error("The event scope cannot be exited because it is not active.");
			}

			try {
				var exitHandler = this._getEventHandler("exit");
				if (exitHandler && !exitHandler.isEmpty()) {

					// If there is no parent scope, then go ahead and execute the 'exit' event
					if (this.parent === null || !this.parent.isActive) {

						// Record the initial version and initial number of subscribers
						this._exitEventVersion = 0;
						this._exitEventHandlerCount = exitHandler._funcs.length;

						// Invoke all subscribers
						exitHandler();

						// Delete the fields to indicate that raising the exit event suceeded
						delete this._exitEventHandlerCount;
						delete this._exitEventVersion;

					}
					else {
						if (typeof window.ExoWeb.config.nonExitingScopeNestingCount === "number") {
							var maxNesting = window.ExoWeb.config.nonExitingScopeNestingCount - 1;
							if (this.parent.hasOwnProperty("_exitEventVersion") && this.parent._exitEventVersion >= maxNesting) {
								this.abort();
								logWarning("Event scope 'exit' subscribers were discarded due to non-exiting.");
								return;
							}
						}

						// Move subscribers to the parent scope
						this.parent._addEvent("exit", exitHandler);

						if (this.parent.hasOwnProperty("_exitEventVersion")) {
							this.parent._exitEventVersion++;
						}
					}

					// Clear the events to ensure that they aren't
					// inadvertantly raised again through this scope
					this._clearEvent("exit");
					this._clearEvent("abort");
				}
			}
			finally {
				// The event scope is no longer active
				this.isActive = false;

				if (currentEventScope && currentEventScope === this) {
					// Roll back to the closest active scope
					while (currentEventScope && !currentEventScope.isActive) {
						currentEventScope = currentEventScope.parent;
					}
				}
			}
		}
	});

	function EventScope$onExit(callback, thisPtr) {
		if (currentEventScope === null) {
			// Immediately invoke the callback
			if (thisPtr) {
				callback.call(thisPtr);
			}
			else {
				callback();
			}
		}
		else if (!currentEventScope.isActive) {
			throw new Error("The current event scope cannot be inactive.");
		}
		else {
			// Subscribe to the exit event
			currentEventScope._addEvent("exit", callback.bind(thisPtr));
		}
	}

	function EventScope$onAbort(callback, thisPtr) {
		if (currentEventScope !== null) {
			if (!currentEventScope.isActive) {
				throw new Error("The current event scope cannot be inactive.");
			}

			// Subscribe to the abort event
			currentEventScope._addEvent("abort", callback.bind(thisPtr));
		}
	}

	function EventScope$perform(callback, thisPtr) {
		// Create an event scope
		var scope = new EventScope();
		try {
			// Invoke the callback
			if (thisPtr) {
				callback.call(thisPtr);
			}
			else {
				callback();
			}
		}
		finally {
			// Exit the event scope
			scope.exit();
		}
	}

	// Export public functions
	var eventScopeApi = {
		onExit: EventScope$onExit,
		onAbort: EventScope$onAbort,
		perform: EventScope$perform
	};

	ExoWeb.EventScope = eventScopeApi;

	// #endregion

	// #region ExoWeb.EvalWrapper
	//////////////////////////////////////////////////

	// Helper class for interpreting expressions
	function EvalWrapper(value) {
		this.value = value;
	}

	EvalWrapper.mixin({
		get: function EvalWrapper$get(member) {
			var propValue = getValue(this.value, member);

			if (propValue === undefined) {
				propValue = window[member];
			}

			if (propValue === undefined) {
				throw new TypeError(member + " is undefined");
			}

			return new EvalWrapper(propValue);
		}
	});

	ExoWeb.EvalWrapper = EvalWrapper;

	// #endregion

	// #region ExoWeb.Transform
	//////////////////////////////////////////////////

	function Transform(array, forLive) {
		if (array == null) throw new ArgumentNullError("array", "transform input is required");
		if (!(array instanceof Array)) throw new ArgumentTypeError("array", "array", array);

		this._array = array;
		this.rootInput = array;
		if (forLive === true) {
			this._livePending = true;
			this._liveComplete = false;
		}
	}

	function TransformGroup(group, items) {
		this.group = group;
		this.items = items;
	}

	var compileFilterFunction = (function Transform$compileFilterFunction(filter) {
		var parser = /(([a-z_$][0-9a-z_$]*)([.]?))|(('([^']|\')*')|("([^"]|\")*"))/gi;
		var skipWords = ["true", "false", "$index", "null"];

		filter = filter.replace(parser, function (match, ignored, name, more, strLiteral) {
			if ((strLiteral !== undefined && strLiteral !== null && strLiteral.length > 0) || skipWords.indexOf(name) >= 0) {
				return match;
			}

			if (name === "$item") {
				return more ? "" : name;
			}

			if (more.length > 0) {
				return "get('" + name + "')" + more;
			}

			return "get('" + name + "').value";
		});

		return new Function("$item", "$index", "with(new ExoWeb.EvalWrapper($item)){ return (" + filter + ");}");
	}).cached();

	var compileSelectFunction = (function Transform$compileSelectFunction(selector) {
		return new Function("$item", "$index", "return ExoWeb.evalPath($item, '" + selector + "');");
	}).cached();

	var compileSelectManyFunction = (function Transform$compileSelectManyFunction(selector) {
		return new Function("$item", "$index", "return ExoWeb.evalPath($item, '" + selector + "');");
	}).cached();

	var compileGroupsFunction = (function Transform$compileGroupsFunction(groups) {
		return new Function("$item", "$index", "return ExoWeb.evalPath($item, '" + groups + "');");
	}).cached();

	var compileOrderingFunction = (function Transform$compileOrderingFunction(ordering) {
		var orderings = [];
		var parser = /\s*([a-z0-9_.]+)(\s+null)?(\s+(asc|desc))?(\s+null)? *(,|$)/gi;

		ordering.replace(parser, function (match, path, nullsFirst, ws, dir, nullsLast) {
			var isNullsFirst = (nullsFirst !== undefined && nullsFirst !== null && nullsFirst.length > 0);
			var isNullsLast = (nullsLast !== undefined && nullsLast !== null && nullsLast.length > 0);
			orderings.push({
				path: path,
				ab: dir === "desc" ? 1 : -1,
				nulls: isNullsLast || (!ws && isNullsFirst) ? 1 : -1
			});
		});

		function before(a, b) {
			if (a !== null && a !== undefined && a.constructor === String && b !== null && b !== undefined && b.constructor === String) {
				a = a.toLowerCase();
				b = b.toLowerCase();
			}
			return a < b;
		}

		return function compare(aObj, bObj) {
			for (var i = 0; i < orderings.length; ++i) {
				var order = orderings[i];

				var a = evalPath(aObj, order.path, null, null);
				var b = evalPath(bObj, order.path, null, null);

				if (a === null && b !== null) {
					return order.nulls;
				}
				if (a !== null && b === null) {
					return -order.nulls;
				}
				if (before(a, b)) {
					return order.ab;
				}
				if (before(b, a)) {
					return -order.ab;
				}
			}

			return 0;
		};
	}).cached();

	var transforms = {
		where: function where(input, filter, thisPtr) {
			var filterFn = filter instanceof Function ? filter : compileFilterFunction(filter);
			return input.filter(filterFn, thisPtr);
		},
		select: function select(input, selector, thisPtr) {
			var mapFn = selector instanceof Function ? selector : compileSelectFunction(selector);
			return input.map(mapFn, thisPtr);
		},
		selectMany: function select(input, selector, thisPtr) {
			var mapFn = selector instanceof Function ? selector : compileSelectFunction(selector);
			return input.mapToArray(mapFn, thisPtr);
		},
		groupBy: function groupBy(input, groups, thisPtr) {
			var groupFn = groups instanceof Function ? groups : compileGroupsFunction(groups);

			var result = [];
			var len = input.length;
			for (var i = 0; i < len; i++) {
				var item = input[i];
				var groupKey = groupFn.apply(thisPtr || item, [item, i]);

				var group = null;
				for (var g = 0; g < result.length; ++g) {
					if (result[g].group == groupKey) {
						group = result[g];
						group.items.push(item);
						break;
					}
				}

				if (!group) {
					result.push(new TransformGroup(groupKey, [item]));
				}
			}

			return result;
		},
		orderBy: function orderBy(input, ordering, thisPtr) {
			var sortFn = ordering instanceof Function ? ordering : compileOrderingFunction(ordering);
			return input.copy().sort(thisPtr ? sortFn.bind(thisPtr) : sortFn);
		}
	};

	function copyTransform(steps, array, live) {
		var result = $transform(array, live);
		steps.forEach(function (step) {
			result = result[step._transform.method].call(result, step._transform.arg, step._transform.thisPtr)
		});
		return result;
	}

	function makeTransform(array, priorTransform, method, arg, thisPtr) {
		// Make sure that the same transform is not made live more than once since this can cause collisions.
		if (priorTransform._liveComplete === true) {
			throw new Error("Cannot call live on the same transform multiple times.");
		}

		var result;

		// When creating a live transform, the result cannot be used directly as an array to
		// discourage using part of the result when the intention is to eventually call "live".
		// When live mode is not used, then if live is eventually called it will result in a non-optimal
		// copying of the transform.
		if (priorTransform._livePending === true) {
			result = new Transform(array, true);
		}
		else {
			Function.mixin(Transform.prototype, array);
			result = array;
		}

		result._prior = priorTransform;
		result.rootInput = priorTransform.rootInput;
		result._transform = { method: method, arg: arg, thisPtr: thisPtr };
		return result;
	}

	Transform.mixin({
		input: function Transform$input() {
			return this._array || this;
		},
		where: function Transform$where(filter, thisPtr) {
			var output = transforms.where(this.input(), filter, thisPtr);
			return makeTransform(output, this, "where", filter, thisPtr);
		},
		select: function Transform$select(selector, thisPtr) {
			var output = transforms.select(this.input(), selector, thisPtr);
			return makeTransform(output, this, "select", selector, thisPtr);
		},
		selectMany: function Transform$selectMany(selector, thisPtr) {
			var output = transforms.selectMany(this.input(), selector, thisPtr);
			return makeTransform(output, this, "selectMany", selector, thisPtr);
		},
		groupBy: function Transform$groupBy(groups, thisPtr) {
			var output = transforms.groupBy(this.input(), groups, thisPtr);
			if (this._livePending) {
				// make the items array observable if the transform is in live mode
				output.forEach(function (group) {
					ExoWeb.Observer.makeObservable(group.items);
				});
			}
			return makeTransform(output, this, "groupBy", groups, thisPtr);
		},
		orderBy: function Transform$orderBy(ordering, thisPtr) {
			var output = transforms.orderBy(this.input(), ordering, thisPtr);
			return makeTransform(output, this, "orderBy", ordering, thisPtr);
		},
		live: function Transform$live() {
			// Watches for changes on the root input into the transform
			// and raises observable change events on this item as the 
			// results change.

			var transform, steps = [], rootStep;

			// determine the set of transform steps and the level of nested grouping
			for (var step = this; step; step = step._prior) {
				if (step._prior) {
					steps.splice(0, 0, step);
				}
				else {
					rootStep = step;
				}
			}

			// copy and return a live-mode transform if live mode was not used originally
			if (this._livePending !== true) {
				return copyTransform(steps, rootStep.input(), true).live();
			}

			// make a copy of the final transformed data and make it observable
			var output = this.input().copy();
			ExoWeb.Observer.makeObservable(output);
			output.rootInput = this.rootInput;

			// watch for changes to root input and update the transform steps as needed
			ExoWeb.Observer.addCollectionChanged(rootStep.input(), function Transform$live$collectionChanged(sender, args) {
				var changes, stepInput, stepResult, modifiedItemsArrays = [];

				//Sys.NotifyCollectionChangedAction.add;

				// copy the set of changes since they will be manipulated
				changes = args.get_changes().map(function (c) {
					return {
						action: c.action,
						oldItems: c.oldItems ? c.oldItems.copy() : null,
						oldStartingIndex: c.oldStartingIndex,
						newItems: c.newItems ? c.newItems.copy() : null,
						newStartingIndex: c.newStartingIndex
					};
				});

				// make a copied version of the input so that it can be manipulated without affecting the result
				stepInput = rootStep.input().copy();

				// re-run the transform on the newly changed input
				steps.forEach(function (step) {
					// store a reference to the output of this step
					stepResult = step.input();

					if (step._transform.method === "where") {
						changes.purge(function (change) {
							if (change.oldItems) {
								var oldItems = change.oldItems;
								// determine which removed items made it through the filter
								change.oldItems = transforms[step._transform.method](change.oldItems, step._transform.arg, step._transform.thisPtr);
								if (change.oldItems.length === 0) {
									// none of the removed items make it through the filter, so discard
									change.oldItems = null;
									change.oldStartingIndex = null;
									return true;
								}
								else {
									// find the actual index of the first removed item in the resulting array
									change.oldStartingIndex = stepResult.indexOf(change.oldItems[0]);

									// remove the filtered items from the result array
									stepResult.splice(change.oldStartingIndex, change.oldItems.length);
								}
							}
							else if (change.newItems) {
								var newItems = change.newItems;
								// determine which added items will make it through the filter
								change.newItems = transforms[step._transform.method](change.newItems, step._transform.arg, step._transform.thisPtr);
								if (change.newItems.length === 0) {
									// none of the new items will make it through the filter, so discard
									change.newItems = null;
									change.newStartingIndex = null;
									return true;
								}
								else {
									// if not added to the beginning or end of the list, determine
									// the real starting index by finding the index of the previous item
									if (change.newStartingIndex !== 0 && (change.newStartingIndex + change.newItems.length) !== stepInput.length) {
										var found = false;
										for (var idx = change.newStartingIndex - 1; !found && idx >= 0; idx--) {
											if (stepResult.indexOf(stepInput[idx]) >= 0) {
												found = true;
											}
										}
										change.newStartingIndex = idx + 1;
									}

									// splice the filtered items into the result array
									var spliceArgs = change.newItems.copy();
									spliceArgs.splice(0, 0, change.newStartingIndex, 0);
									Array.prototype.splice.apply(stepResult, spliceArgs);
								}
							}
							else {
								return true;
							}
						});
					}
					else if (step._transform.method === "select") {
						changes.forEach(function (change) {
							if (change.oldItems) {
								change.oldItems = stepResult.splice(change.oldStartingIndex, change.oldItems.length);
							}
							else if (change.newItems) {
								var mapFn = step._transform.arg instanceof Function ? step._transform.arg : compileSelectFunction(step._transform.arg);
								change.newItems = change.newItems.map(function (item) {
									return mapFn.call(step._transform.thisPtr || item, item);
								});

								// splice the filtered items into the result array
								var spliceArgs = change.newItems.copy();
								spliceArgs.splice(0, 0, change.newStartingIndex, 0);
								Array.prototype.splice.apply(stepResult, spliceArgs);
							}
						});
					}
					else if (step._transform.method === "selectMany") {
						changes.forEach(function (change) {
							if (change.oldItems) {
								var mapFn = step._transform.arg instanceof Function ? step._transform.arg : compileSelectManyFunction(step._transform.arg);
								var oldItemsMany = change.oldItems.mapToArray(function (item) {
									return mapFn.call(step._transform.thisPtr || item, item);
								});
								var oldPreceeding = stepInput.slice(0, change.oldStartingIndex);
								var oldPreceedingMany = oldPreceeding.mapToArray(function (item) {
									return mapFn.call(step._transform.thisPtr || item, item);
								});
								change.oldItems = stepResult.splice(oldPreceedingMany.length, oldItemsMany.length);
								change.oldStartingIndex = oldPreceedingMany.length;
							}
							else if (change.newItems) {
								var mapFn = step._transform.arg instanceof Function ? step._transform.arg : compileSelectManyFunction(step._transform.arg);
								change.newItems = change.newItems.mapToArray(function (item) {
									return mapFn.call(step._transform.thisPtr || item, item);
								});

								// splice the filtered items into the result array
								var spliceArgs = change.newItems.copy();
								spliceArgs.splice(0, 0, change.newStartingIndex, 0);
								Array.prototype.splice.apply(stepResult, spliceArgs);
							}
						});
					}
					else if (step._transform.method === "groupBy") {
						var groupFn = step._transform.arg instanceof Function ? step._transform.arg : compileGroupsFunction(step._transform.arg);
						var copyOfResults = stepResult.copy();
						changes.forEach(function (change) {
							if (change.oldItems) {
								change.oldItems.forEach(function (item) {
									var groupKey = groupFn.call(step._transform.thisPtr || item, item);
									var group = copyOfResults.filter(function (g) { return g.group === groupKey; })[0];
									// begin and end update on items array
									if (modifiedItemsArrays.indexOf(group.items) < 0) {
										group.items.beginUpdate();
										modifiedItemsArrays.push(group.items);
									}
									// remove the item
									var idx = group.items.indexOf(item);
									group.items.remove(item);
									if (idx === 0) {
										var groupIndex = copyOfResults.indexOf(group),
											sourceIndex = stepInput.indexOf(group.items[0]),
											targetIndex = null;
										for (i = 0; i < copyOfResults.length; i++) {
											if (sourceIndex > stepInput.indexOf(copyOfResults[i].items[0])) {
												targetIndex = i + 1;
												break;
											}
										}
										if (targetIndex !== null) {
											copyOfResults.splice(groupIndex, 1);
											copyOfResults.splice(targetIndex, 0, group);
										}
									}
									if (group.items.length === 0) {
										// remove the group from the copy of the array
										copyOfResults.splice(copyOfResults.indexOf(group), 1);
									}
								});
							}
							else if (change.newItems) {
								change.newItems.forEach(function (item) {
									var groupKey = groupFn.call(step._transform.thisPtr || item, item),
										group = copyOfResults.filter(function (g) { return g.group === groupKey; })[0],
										sourceIndex,
										targetIndex,
										resequenceGroup = false,
										groupIndex,
										i;

									if (group) {
										// begin and end update on items array
										if (modifiedItemsArrays.indexOf(group.items) < 0) {
											group.items.beginUpdate();
											modifiedItemsArrays.push(group.items);
										}
										sourceIndex = stepInput.indexOf(item), targetIndex = null;
										for (i = 0; i < group.items.length; i++) {
											if (sourceIndex < stepInput.indexOf(group.items[i])) {
												targetIndex = i;
												break;
											}
										}
										if (targetIndex !== null) {
											group.items.insert(targetIndex, item);
											// group's index may have changed as a result
											if (targetIndex === 0) {
												resequenceGroup = true;
											}
										}
										else {
											group.items.add(item);
										}
									}
									else {
										group = new TransformGroup(groupKey, [item]);
										ExoWeb.Observer.makeObservable(group.items);
										copyOfResults.push(group);
										resequenceGroup = true;
									}

									if (resequenceGroup === true) {
										groupIndex = copyOfResults.indexOf(group);
										sourceIndex = stepInput.indexOf(group.items[0]);
										targetIndex = null;
										for (i = 0; i < groupIndex; i++) {
											if (sourceIndex < stepInput.indexOf(copyOfResults[i].items[0])) {
												targetIndex = i;
												break;
											}
										}
										if (targetIndex !== null) {
											copyOfResults.splice(groupIndex, 1);
											copyOfResults.splice(targetIndex, 0, group);
										}
									}
								});
							}
						});

						// collect new changes to groups
						changes = update(stepResult, copyOfResults, true);
					}
					else if (step._transform.method === "orderBy") {
						// sort the input and update the step result to match
						var sorted = transforms[step._transform.method](stepInput, step._transform.arg, step._transform.thisPtr);
						changes = update(stepResult, sorted, true);
					}

					// move the input forward to the result of the current step
					stepInput = stepResult;
				});

				// apply changes to the ouput array
				output.beginUpdate();
				changes.forEach(function (change) {
					if (change.oldItems) {
						output.removeRange(change.oldStartingIndex, change.oldItems.length);
					}
					else if (change.newItems) {
						output.insertRange(change.newStartingIndex, change.newItems);
					}
				});
				output.endUpdate();

				// release changes to items arrays of groups, changes to the array occur first to allow
				// for changes to groups' items to be ignored if the group is no longer a part of the output
				modifiedItemsArrays.forEach(function (items) {
					items.endUpdate();
				});
			});

			// mark the transform steps as live complete
			rootStep._liveComplete = true;
			steps.forEach(function (step) {
				step._liveComplete = true;
			});

			return output;
		}
	});

	ExoWeb.Transform = Transform;
	window.$transform = function transform(array, forLive) { return new Transform(array, forLive); };

	// #endregion

	// #region ExoWeb.Translator
	//////////////////////////////////////////////////

	function Translator() {
		this._forwardDictionary = {};
		this._reverseDictionary = {};
	}

	Translator.prototype = {
		lookup: function Translator$lookup(source, category, key) {
			if (source[category]) {
				return source[category][key] || null;
			}
		},
		forward: function Translator$forward(category, key) {
			return this.lookup(this._forwardDictionary, category, key);
		},
		reverse: function Translator$reverse(category, key) {
			return this.lookup(this._reverseDictionary, category, key);
		},
		add: function Translator$addMapping(category, key, value/*, suppressReverse*/) {
			// look for optional suppress reverse lookup argument
			var suppressReverse = (arguments.length == 4 && arguments[3].constructor === Boolean) ? arguments[3] : false;

			// lazy initialize the forward dictionary for the category
			if (!this._forwardDictionary[category]) {
				this._forwardDictionary[category] = {};
			}
			this._forwardDictionary[category][key] = value;

			// don't add to the reverse dictionary if the suppress flag is specified
			if (!suppressReverse) {
				// lazy initialize the reverse dictionary for the category
				if (!this._reverseDictionary[category]) {
					this._reverseDictionary[category] = {};
				}
				this._reverseDictionary[category][value] = key;
			}
		}
	};

	ExoWeb.Translator = Translator;

	// #endregion

	// #region ExoWeb.Utilities
	//////////////////////////////////////////////////

	// determine whether Object.defineProperty is supported and add legacy support is necessary/possible
	var definePropertySupported = false;
	var defineProperty;

	function defineLegacyProperty() {
		Object.defineProperty = function (obj, prop, desc) {

			// assume getter will only need to calculate once following the constructor
			if ("get" in desc) {
				if (!desc.init) throw new Error("Getters are not supported by the current browser.  Use definePropertySupported to check for full support.");

				// assume objects with prototypes are instances and go ahead and initialize the property using the getter
				if (obj.prototype) {
					obj[prop] = desc.get.call(obj, obj);
				}

				// otherwise, configure the prototype to initialize the property when the constructor is called
				else if (obj.constructor) {
					var initProperties = obj.constructor.__initProperties;
					if (!initProperties) {
						obj.constructor.__initProperties = initProperties = {};
					}
					initProperties[prop] = desc.get;
				}
			}

			// assume it is just a data property
			else {
				obj[prop] = desc.value;
			}

			// throw an exception if the property has a setter, which is definitely not supported
			if ("set" in desc) throw new Error("Setters are not supported by the current browser.  Use definePropertySupported to check for full support.");
		};
	}

	try {
		// emulate ES5 getter/setter API using legacy APIs
		if (Object.prototype.__defineGetter__ && !Object.defineProperty) {
			Object.defineProperty = function (obj, prop, desc) {

				// property with getter
				if ("get" in desc) obj.__defineGetter__(prop, desc.get);

				// property with setter
				if ("set" in desc) obj.__defineSetter__(prop, desc.set);

				// data only property
				if (!("get" in desc || "set" in desc)) {

					// read/write property
					if (desc.writable) {
						var value = desc.value;
						obj.__defineGetter__(prop, function () { return value; });
						obj.__defineSetter__(prop, function (val) { value = val; });
					}

					// read only property
					else {
						var value = desc.value;
						obj.__defineGetter__(prop, function () { return value; });
					}
				}
			};
			definePropertySupported = true;
		}

		// otherwise, ensure defineProperty actually works
		else if (Object.defineProperty && Object.defineProperty({}, "x", { get: function () { return true } }).x) {
			definePropertySupported = true;
		}

		// enable legacy support
		else {
			defineLegacyProperty();
		}
	} 

	// no getter/setter support
	catch (e) {

		// enable legacy support
		defineLegacyProperty();
	}

	// classes that call define property should
	function initializeLegacyProperties(obj) {
		if (definePropertySupported) return;
		var initProperties = obj.constructor.__initProperties;
		if (initProperties) {
			for (var p in initProperties) {
				obj[p] = initProperties[p].call(obj, obj);
			}
		}
	}

	// evalPath internal utility function
	function evalPath(obj, path, nullValue, undefinedValue) {
		var i, name, steps = path.split("."), source, value = obj;

		if (value === null) {
			return arguments.length >= 3 ? nullValue : null;
		}
		if (value === undefined) {
			return arguments.length >= 4 ? undefinedValue : undefined;
		}

		for (i = 0; i < steps.length; ++i) {
			name = steps[i];
			source = value;
			value = getValue(source, name);

			if (value === null) {
				return arguments.length >= 3 ? nullValue : null;
			}
			if (value === undefined) {
				return arguments.length >= 4 ? undefinedValue : undefined;
			}
		}

		return value;
	}

	ExoWeb.evalPath = evalPath;

	function getLastTarget(target, propertyPath) {
		var i, pathArray, finalTarget = target;

		if (propertyPath == null) throw new ArgumentNullError("propertyPath");

		if (propertyPath.constructor == String) {
			pathArray = propertyPath.split(".");
		}
		else {
			if (!(propertyPath instanceof Array)) throw ArgumentTypeError("propertyPath", "string|array", propertyPath);
			pathArray = propertyPath;
		}

		for (i = 0; i < pathArray.length - 1; i++) {
			if (finalTarget) {
				finalTarget = getValue(finalTarget, pathArray[i]);
			}
		}

		return finalTarget;
	}

	ExoWeb.getLastTarget = getLastTarget;
	window.$lastTarget = getLastTarget;

	// If a getter method matching the given property name is found on the target it is invoked and returns the 
	// value, unless the the value is undefined, in which case null is returned instead.  This is done so that 
	// calling code can interpret a return value of undefined to mean that the property it requested does not exist.
	// TODO: better name
	function getValue(target, property) {
		var value;

		// the see if there is an explicit getter function for the property
		var getter = target["get_" + property];
		if (getter) {
			value = getter.call(target);
			if (value === undefined) {
				value = null;
			}
		}

		// otherwise search for the property
		else {
			if ((isObject(target) && property in target) ||
				Object.prototype.hasOwnProperty.call(target, property) ||
				(target.constructor === String && /^[0-9]+$/.test(property) && parseInt(property, 10) < target.length)) {
				value = target[property];
				if (value === undefined) {
					value = null;
				}
			}
			else if (/\./.test(property)) {
				logWarning("Possible incorrect usage of \"getValue()\", the path \"" + property + "\" does not exist on the target and appears to represent a multi-hop path.");
			}
		}

		return value;
	}

	ExoWeb.getValue = getValue;

	function getCtor(type) {

		// Only return a value if the argument is defined
		if (type !== undefined && type !== null) {

			// If the argument is a function then return it immediately.
			if (isType(type, Function)) {
				return type;

			}
			else {
				var ctor;

				if (isType(type, String)) {
					// remove "window." from the type name since it is implied
					type = type.replace(/(window\.)?(.*)/, "$2");

					// evaluate the path
					ctor = evalPath(window, type);
				}

				// warn (and implicitly return undefined) if the result is not a javascript function
				if (ctor !== undefined && ctor !== null && !isType(ctor, Function)) {
					logWarning("The given type \"" + type + "\" is not a function.");
				}
				else {
					return ctor;
				}
			}
		}
	}

	ExoWeb.getCtor = getCtor;

	function isType(val, type) {

		// Exit early for checking function type
		if (val !== undefined && val !== null && val === Function && type !== undefined && type !== null && type === Function) {
			return true;
		}

		var ctor = getCtor(type);

		// ensure a defined value and constructor
		return val !== undefined && val !== null &&
				ctor !== undefined && ctor !== null &&
				// accomodate objects (instanceof) as well as intrinsic value types (String, Number, etc)
				(val instanceof ctor || val.constructor === ctor);
	}

	ExoWeb.isType = isType;

	function eachProp(obj, callback, thisPtr) {
		var prop;
		for (prop in obj) {
			if (obj.hasOwnProperty(prop)) {
				if (callback.apply(thisPtr || this, [prop, obj[prop]]) === false) {
					break;
				}
			}
		}
	}

	ExoWeb.eachProp = eachProp;

	function objectToArray(obj) {
		var list = [];
		eachProp(obj, function(prop, value) {
			list.push(value);
		});
		return list;
	}

	ExoWeb.objectToArray = objectToArray;

	function $format(str, values) {
		var source;

		if (arguments.length < 2) {
			return str;
		}

		if (arguments.length > 2) {
			// use arguments passed to function as array
			source = Array.prototype.slice.call(arguments, 1);
		}
		else {
			source = !(values instanceof Array) ? [values] : values;
		}

		return str.replace(/\{([0-9]+)\}/ig, function (match, indexStr) {
			var index = parseInt(indexStr, 10);
			var result = source[index];

			if (result !== null && result !== undefined && result.constructor !== String) {
				result = result.toString();
			}

			return result;
		});
	}

	window.$format = $format;

	function makeHumanReadable(text) {
		return text.replace(/([^A-Z]+)([A-Z])/g, "$1 $2");
	}

	ExoWeb.makeHumanReadable = makeHumanReadable;

	// #endregion

	// #region ExoWeb.TimeSpan
	//////////////////////////////////////////////////

	function TimeSpan(ms) {
		/// <field name="totalSeconds" type="Number">The target entity the condition is associated with.</field>

		this.totalMilliseconds = ms;

		initializeLegacyProperties(this);
	}

	TimeSpan.mixin({
		totalSeconds: { get: function () { return this.totalMilliseconds / 1000; }, init: true },
		totalMinutes: { get: function () { return this.totalSeconds / 60; }, init: true },
		totalHours: { get: function () { return this.totalMinutes / 60; }, init: true },
		totalDays: { get: function () { return this.totalHours / 24; }, init: true },
		milliseconds: { get: function () { return Math.floor(this.totalMilliseconds % 1000); }, init: true },
		seconds: { get: function () { return Math.floor(this.totalSeconds % 60); }, init: true },
		minutes: { get: function () { return Math.floor(this.totalMinutes % 60); }, init: true },
		hours: { get: function () { return Math.floor(this.totalHours % 24); }, init: true },
		days: { get: function () { return Math.floor(this.totalDays); }, init: true },
		toObject: function() {
			return {
				Hours: this.hours,
				Minutes: this.minutes,
				Seconds: this.seconds,
				Milliseconds: this.milliseconds,
				Ticks: this.totalMilliseconds * 1000000 / 100,
				Days: this.days,
				TotalDays: this.totalDays,
				TotalHours: this.totalHours,
				TotalMilliseconds: this.totalMilliseconds,
				TotalMinutes: this.totalMinutes,
				TotalSeconds: this.totalSeconds
			};
		},
		valueOf: function() {
			return this.totalMilliseconds;
		},
		toString: function TimeSpan$toString() { 
			var num;
			var label;

			if (this.totalHours < 1) {
				num = Math.round(this.totalMinutes);
				label = "minute";
			}
			else if (this.totalDays < 1) {
				num = Math.round(this.totalHours * 100) / 100;
				label = "hour";
			}
			else {
				num = Math.round(this.totalDays * 100) / 100;
				label = "day";
			}

			return num == 1 ? (num + " " + label) : (num + " " + label + "s");
		}
	});

	window.TimeSpan = TimeSpan;

	Date.mixin({
		subtract: function Date$subtract(d) {
			return new TimeSpan(this - d);
		},
		add: function Date$add(timeSpan) {
			return new Date(this.getTime() + timeSpan.totalMilliseconds);
		}
	});

	// #endregion

	// #region ExoWeb.Date
	//////////////////////////////////////////////////

	var dayOfWeek = {};
	var days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
	days.forEach(function(day, i) {
		dayOfWeek[day] = i;
	});

	Date.prototype.toDate = function toDate() {
		return new Date(this.getFullYear(), this.getMonth(), this.getDate());
	};

	Date.prototype.addYears = function addYears(numYears) {
		return new Date(this.getFullYear() + numYears, this.getMonth(), this.getDate(), this.getHours(), this.getMinutes(), this.getSeconds(), this.getMilliseconds());
	};

	Date.prototype.addDays = function addDays(numDays, requireWeekDay) {
		var date = new Date(this.getFullYear(), this.getMonth(), this.getDate() + numDays, this.getHours(), this.getMinutes(), this.getSeconds(), this.getMilliseconds());

		// If requireWeekDay is true and the day falls on a Saturday or Sunday, then
		// the the result will be moved back to the preceeding friday (when subtracting days)
		// or forward to the next monday (when adding days).
		if (requireWeekDay === true) {
			// Sunday
			if (date.getDay() === 0) {
				date.setDate(date.getDate() + (numDays >= 0 ? 1 : -2));
			}
			// Saturday 
			else if (date.getDay() === 6) {
				date.setDate(date.getDate() + (numDays >= 0 ? 2 : -1));
			}
		}

		return date;
	};

	var oneHourInMilliseconds = 1000 * 60 * 60;

	Date.prototype.addHours = function addHours(numHours) {
		return new Date(+this + (oneHourInMilliseconds * numHours));
	};

	function getDayOfWeek(day) {
		if (day !== undefined && day !== null && day.constructor === String)
			day = days.indexOf(day.toLowerCase());
		else if (day !== undefined && day !== null && day.constructor !== Number)
			day = null;

		return day >= 0 && day < days.length ? day : null;
	}

	Date.prototype.startOfWeek = function(startOfWeekDay) {
		var startOfWeek = getDayOfWeek(startOfWeekDay) || dayOfWeek.monday; // monday by default
		return this.addDays(startOfWeek - this.getDay());
	};

	Date.prototype.weekOfYear = function(startOfWeekDay) {
		var startOfWeek = getDayOfWeek(startOfWeekDay) || dayOfWeek.monday; // monday by default

		if (this.startOfWeek(startOfWeek).getYear() < this.getYear()) {
			return 0;
		}

		var firstDayOfYear = new Date(this.getFullYear(), 0, 1);
		var firstWeek = firstDayOfYear.startOfWeek(startOfWeek);
		if (firstWeek.getFullYear() < firstDayOfYear.getFullYear()) {
			firstWeek = firstWeek.addDays(7);
		}

		var weeks = 0;
		var target = this.toDate();
		for (var day = firstWeek; day <= target; day = day.addDays(7)) {
			weeks++;
		}

		return weeks;
	};

	Date.prototype.weekDifference = function (other, startOfWeek) {
		var isNegative = other <= this;
		var a = this, b = other;

		if (isNegative)
		{
			a = other;
			b = this;
		}

		var aWeek = a.weekOfYear(startOfWeek);
		var bWeek = b.weekOfYear(startOfWeek);

		for (var i = a.getFullYear(); i < b.getFullYear(); i++)
			bWeek += (new Date(i, 11, 31)).weekOfYear(startOfWeek);

		return isNegative ? aWeek - bWeek : bWeek - aWeek;
	};

	// #endregion

	// #region ExoWeb.Object
	//////////////////////////////////////////////////

	// original code grabbed from http://oranlooney.com/functional-javascript/
	Object.copy = function Object$Copy(obj, options/*, level*/) {
		if (!options) {
			options = {};
		}

		// initialize max level to default value
		if (!options.maxLevel) {
			options.maxLevel = 25;
		}

		// initialize level to default value
		var level = arguments.length > 2 ? arguments[2] : 0;

		if (level >= options.maxLevel || typeof obj !== 'object' || obj === null || obj === undefined) {
			return obj;  // non-object have value sematics, so obj is already a copy.
		}
		else {
			if (obj instanceof Array) {
				var result = [];
				for (var i = 0; i < obj.length; i++) {
					result.push(Object.copy(obj[i]));
				}
				return result;
			}
			else {
				var value = obj.valueOf();
				if (obj != value) {
					// the object is a standard object wrapper for a native type, say String.
					// we can make a copy by instantiating a new object around the value.
					return new obj.constructor(value);
				} else {
					// don't clone entities
					if (typeof(Entity) !== "undefined" && obj instanceof Entity) {
						return obj;
					}
					else {
						// ok, we have a normal object. copy the whole thing, property-by-property.
						var c = {};
						for (var property in obj) {
							// Optionally copy property values as well
							if (options.copyChildren) {
								c[property] = Object.copy(obj[property], options, level + 1);
							}
							else {
								c[property] = obj[property];
							}

						}
						return c;
					}
				}
			}
		}
	};

	// Based on https://vanillajstoolkit.com/polyfills/objectassign/
	function assign(target, varArgs) {
		if (target == null) { // TypeError if undefined or null
			throw new TypeError('Cannot convert undefined or null to object');
		}

		var to = Object(target);

		for (var index = 1; index < arguments.length; index++) {
			var nextSource = arguments[index];

			if (nextSource != null) { // Skip over if undefined or null
				for (var nextKey in nextSource) {
					// Avoid bugs when hasOwnProperty is shadowed
					if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
						to[nextKey] = nextSource[nextKey];
					}
				}
			}
		}
		return to;
	}

	// Based on https://vanillajstoolkit.com/polyfills/objectentries/
	function entries(obj) {
		var ownProps = Object.keys(obj),
			i = ownProps.length,
			resArray = new Array(i); // preallocate the Array

		while (i--)
			resArray[i] = [ownProps[i], obj[ownProps[i]]];

		return resArray;
	}

	if (!Object.assign)
		Object.assign = assign;
	if (!Object.entries)
		Object.entries = entries;

	// #endregion

	// #region ExoWeb.Observer
	//////////////////////////////////////////////////

	var Observer = { };

	Observer.addPathChanged = function Observer$addPathChanged(target, path, handler, allowNoTarget) {
		// Throw an error if the target is null or undefined, unless the calling code specifies that this is ok
		if (target == null) {
			if (allowNoTarget === true) return;
			else throw new ArgumentNullError("target", "'allowNoTarget' is false - path = \"" + (path instanceof Array ? path.join(".") : path) + "\"");
		}

		// Ensure a set of path change handlers
		if (!target.__pathChangeHandlers) {
			target.__pathChangeHandlers = {};
		}

		var list = path;
		if (path instanceof Array) {
			path = path.join(".");
		}
		else {
			list = path.split(".");
		}

		var roots = [];

		function processStep(parent, item, index) {
			var observers = [];

			function addObserver(value) {
				var obs = new PropertyObserver(item);

				observers.push(obs);
				if (index === 0) {
					roots.push(obs);
				}

				obs.start(value, handler);

				// Continue to next steps if there are any
				if (index + 1 < list.length) {
					processStep(obs, list[index + 1], index + 1);
				}
			}

			function removeObserver(value) {
				for (var i = 0; i < observers.length; i++) {
					var obs = observers[i];
					if (obs._source === value) {
						Array.removeAt(observers, i--);
						if (index === 0) {
							Array.remove(roots, obs);
						}

						obs.stop();
					}
				}
			}

			// If there is a step before this one, then respond to 
			// changes to the value(s) at that step.
			if (parent) {
				parent._addEvent("valueCaptured", addObserver);
				parent._addEvent("valueReleased", removeObserver);
			}

			var source = index === 0 ? target : parent.value();
			if (source !== undefined && source !== null) {
				if (source instanceof Array) {
					Array.forEach(source, addObserver);

					// Watch for changes to the target if it is an array, so that we can
					// add new observers, remove old ones, and call the handler.
					if (index === 0) {
						Observer.addCollectionChanged(source, function(sender, args) {
							var changes = args.get_changes();

							Array.forEach(changes.removed || [], removeObserver);
							Array.forEach(changes.added || [], addObserver);
							handler();
						});
					}
				}
				else {
					addObserver(source);
				}
			}
		}

		// Start processing the path
		processStep(null, list[0], 0);

		// Store the observer on the object
		var pathChangeHandlers = target.__pathChangeHandlers[path];
		if (!pathChangeHandlers) {
			target.__pathChangeHandlers[path] = pathChangeHandlers = [];
		}
		pathChangeHandlers.push({ roots: roots, handler: handler });
	};

	Observer.removePathChanged = function Sys$Observer$removePathChanged(target, path, handler) {
		path = (path instanceof Array) ? path.join(".") : path;

		var pathChangeHandlers = target.__pathChangeHandlers ? target.__pathChangeHandlers[path] : null;

		if (pathChangeHandlers) {
			// Search the list for handlers that match the given handler and stop and remove them
			pathChangeHandlers.purge(function(pathChangeHandler) {
				if (pathChangeHandler.handler === handler) {
					Array.forEach(pathChangeHandler.roots, function(observer) {
						observer.stop();
					});
					return true;
				}
			});

			// If there are no more handlers for this path then remove it from the cache
			if (pathChangeHandlers.length === 0) {
				// delete the data specific to this path
				delete target.__pathChangeHandlers[path];

				// determine if there are any other paths being watched
				var hasHandlers = false;
				for (var remainingHandler in target.__pathChangeHandlers) {
					if (target.__pathChangeHandlers.hasOwnProperty(remainingHandler)) {
						hasHandlers = true;
					}
				}

				// null out the property of the target if there are no longer any paths being watched
				if (!hasHandlers) {
					target.__pathChangeHandlers = null;
				}
			}
		}
	};

	var observableInterface = {
		makeObservable: function (target) {
			throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
		},
		disposeObservable: function (target) {
			throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
		},
		addCollectionChanged: function (target, handler) {
			throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
		},
		removeCollectionChanged: function (target, handler) {
			throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
		},
		addPropertyChanged: function (target, property, handler) {
			throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
		},
		removePropertyChanged: function (target, property, handler) {
			throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
		},
		raisePropertyChanged: function (target, property) {
			throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
		},
		setValue: function (target, property, value) {
			throw new Error("Observable provider has not been implemented.  Call ExoWeb.Model.setObservableProvider().");
		}
	};

	// sets the observer provider to use, verifying that it matches the defined interface.
	function setObserverProvider(provider) {
		for (var method in observableInterface) {
			var definition = provider[method];
			if (!(definition instanceof Function)) {
				throw new Error("Observable provider does not implement '" + method + "'.");
			}
			Observer[method] = definition;
		}
	}

	// expose publicly
	ExoWeb.Observer = Observer;

	// #endregion

	// #region ExoWeb.PropertyObserver
	//////////////////////////////////////////////////

	function PropertyObserver(prop) {
		this._source = null;
		this._prop = prop;
		this._handler = null;
	}

	PropertyObserver.mixin(Functor.eventing);

	PropertyObserver.mixin({
		value: function PropertyObserver$value() {
			return ExoWeb.getValue(this._source, this._prop);
		},
		release: function PropertyObserver$release(value) {
			// Notify subscribers that the old value should be released
			if (value instanceof Array) {
				Array.forEach(value, function(item) {
					this._raiseEvent("valueReleased", [item]);
				}, this);
			}
			else {
				this._raiseEvent("valueReleased", [value]);
			}
		},
		capture: function PropertyObserver$capture(value) {
			// Notify subscribers that a new value was captured
			if (value instanceof Array) {
				Array.forEach(value, function(item) {
					this._raiseEvent("valueCaptured", [item]);
				}, this);

				var _this = this;

				// Have to store the array since if the value changes we won't necessarily be able to retrieve the original array
				if (this._collectionTarget !== undefined && this._collectionTarget !== null) {
					Observer.removeCollectionChanged(this._collectionTarget, this._collectionHandler);
				}

				this._collectionTarget = value;

				this._collectionHandler = function collectionHandler(sender, args) {
					var changes = args.get_changes();

					// Call the actual handler
					_this._handler.apply(this, arguments);

					// remove old observers and add new observers
					Array.forEach(changes.removed || [], function(removed) {
						_this._raiseEvent("valueReleased", [removed]);
					});
					Array.forEach(changes.added || [], function(added) {
						_this._raiseEvent("valueCaptured", [added]);
					});
				};

				Observer.addCollectionChanged(this._collectionTarget, this._collectionHandler);
			}
			else {
				this._raiseEvent("valueCaptured", [value]);
			}
		},
		start: function PropertyObserver$start(source, handler) {
			if (this._source) {
				throw new Error("Cannot start an observer that is already started.");
			}

			var _this = this;

			this._source = source;
			this._handler = handler;

			var value = this.value();

			this._propHandler = function propHandler(sender, args) {
				// Call the actual handler.
				_this._handler.apply(this, arguments);

				// Release the old value
				if (value !== undefined && value !== null) {
					_this.release(value);
				}

				value = _this.value();

				// Release the old value
				if (value !== undefined && value !== null) {
					_this.capture(value);
				}
			};

			Observer.addPropertyChanged(this._source, this._prop, this._propHandler);

			// If we currently have a value, then notify subscribers
			if (value !== undefined && value !== null) {
				this.capture(value);
			}
		},
		stop: function PropertyObserver$stop() {
			if (this._source) {
				// Remove the registered event(s)
				Observer.removePropertyChanged(this._source, this._prop, this._propHandler);

				// Have to store the array since if the value changes we won't necessarily be able to retrieve the original array
				if (this._collectionTarget !== undefined && this._collectionTarget !== null) {
					Observer.removeCollectionChanged(this._collectionTarget, this._collectionHandler);
					this.release(this._collectionTarget);
				}
				else {
					var value = this.value();
					if (value !== undefined && value !== null) {
						this.release(value);
					}
				}

				// Null out the source to indicate that it is no longer watching that object
				this._source = null;
			}
		}
	});

	ExoWeb.PropertyObserver = PropertyObserver;

	// #endregion

	// #region ExoWeb.Model.Resource
	//////////////////////////////////////////////////

	var Resource = {
		"allowed-values":							"{property} is not in the list of allowed values.",
		"compare-after":							"{property} must be after {compareSource}.",
		"compare-before":							"{property} must be before {compareSource}.",
		"compare-equal":							"{property} must be the same as {compareSource}.",
		"compare-greater-than":						"{property} must be greater than {compareSource}.",
		"compare-greater-than-or-equal":			"{property} must be greater than or equal to {compareSource}.",
		"compare-less-than":						"{property} must be less than {compareSource}.",
		"compare-less-than-or-equal":				"{property} must be less than or equal to {compareSource}.",
		"compare-not-equal":						"{property} must be different from {compareSource}.",
		"compare-on-or-after":						"{property} must be on or after {compareSource}.",
		"compare-on-or-before":						"{property} must be on or before {compareSource}.",
		"listlength-at-least":						"Please specify at least {min} {property}.",
		"listlength-at-most":						"Please specify no more than {max} {property}.",
		"listlength-between":						"Please specify between {min} and {max} {property}.",
		"range-at-least":							"{property} must be at least {min}.",
		"range-at-most":							"{property} must be at most {max}.",
		"range-between":							"{property} must be between {min} and {max}.",
		"range-on-or-after":						"{property} must be on or after {min}.",
		"range-on-or-before":						"{property} must be on or before {max}.",
		"required":									"{property} is required.",
		"required-if-after":						"{property} is required when {compareSource} is after {compareValue}.",
		"required-if-before":						"{property} is required when {compareSource} is before {compareValue}.",
		"required-if-equal":						"{property} is required when {compareSource} is {compareValue}.",
		"required-if-exists":						"{property} is required when {compareSource} is specified.",
		"required-if-greater-than":					"{property} is required when {compareSource} is greater than {compareValue}.",
		"required-if-greater-than-or-equal":		"{property} is required when {compareSource} is greater than or equal to {compareValue}.",
		"required-if-less-than":					"{property} is required when {compareSource} is less than {compareValue}.",
		"required-if-less-than-or-equal":			"{property} is required when {compareSource} is less than or equal to {compareValue}.",
		"required-if-not-equal":					"{property} is required when {compareSource} is not {compareValue}.",
		"required-if-not-exists":					"{property} is required when {compareSource} is not specified.",
		"required-if-on-or-after":					"{property} is required when {compareSource} is on or after {compareValue}.",
		"required-if-on-or-before":					"{property} is required when {compareSource} is on or before {compareValue}.",
		"string-format":							"{property} must be formatted as {formatDescription}.",
		"string-length-at-least":					"{property} must be at least {min} characters.",
		"string-length-at-most":					"{property} must be at most {max} characters.",
		"string-length-between":                    "{property} must be between {min} and {max} characters.",
	    "format-with-description":                  "{property} must be formatted as {description}.",
		"format-without-description":               "{property} is not properly formatted.",
	    "format-currency":                          "$#,###.##",
	    "format-percentage":                        "#.##%",
	    "format-integer":                           "#,###",
	    "format-decimal":                           "#,###.##",

		// gets the resource with the specified name
		get: function Resource$get(name) {
			return this[name];
		}
	}

	// publicly export the resource object
	ExoWeb.Model.Resource = Resource;

	// #endregion

	// #region ExoWeb.Model.FormatCompiler
	//////////////////////////////////////////////////

	var formatTemplateParser = /\[([_a-zA-Z\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02b8\u02bb-\u02c1\u02d0-\u02d1\u02e0-\u02e4\u02ee\u0370-\u0373\u0376-\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0523\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0621-\u064a\u0660-\u0669\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07c0-\u07ea\u07f4-\u07f5\u07fa\u0904-\u0939\u093d\u0950\u0958-\u0961\u0966-\u096f\u0971-\u0972\u097b-\u097f\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09e6-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a66-\u0a6f\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0ae6-\u0aef\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b66-\u0b6f\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0be6-\u0bef\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58-\u0c59\u0c60-\u0c61\u0c66-\u0c6f\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0ce6-\u0cef\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d28\u0d2a-\u0d39\u0d3d\u0d60-\u0d61\u0d66-\u0d6f\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e50-\u0e59\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0ed0-\u0ed9\u0edc-\u0edd\u0f00\u0f20-\u0f29\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8b\u1000-\u102a\u103f-\u1049\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u1090-\u1099\u10a0-\u10c5\u10d0-\u10fa\u10fc\u1100-\u1159\u115f-\u11a2\u11a8-\u11f9\u1200-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u1676\u1681-\u169a\u16a0-\u16ea\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u17e0-\u17e9\u1810-\u1819\u1820-\u1877\u1880-\u18a8\u18aa\u1900-\u191c\u1946-\u196d\u1970-\u1974\u1980-\u19a9\u19c1-\u19c7\u19d0-\u19d9\u1a00-\u1a16\u1b05-\u1b33\u1b45-\u1b4b\u1b50-\u1b59\u1b83-\u1ba0\u1bae-\u1bb9\u1c00-\u1c23\u1c40-\u1c49\u1c4d-\u1c7d\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u2094\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2c6f\u2c71-\u2c7d\u2c80-\u2ce4\u2d00-\u2d25\u2d30-\u2d65\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31b7\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fc3\ua000-\ua48c\ua500-\ua60c\ua610-\ua62b\ua640-\ua65f\ua662-\ua66e\ua680-\ua697\ua722-\ua788\ua78b-\ua78c\ua7fb-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8d0-\ua8d9\ua900-\ua925\ua930-\ua946\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa50-\uaa59\uac00-\ud7a3\uf900-\ufa2d\ufa30-\ufa6a\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc][_.0-9a-zA-Z\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02b8\u02bb-\u02c1\u02d0-\u02d1\u02e0-\u02e4\u02ee\u0370-\u0373\u0376-\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0523\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0621-\u064a\u0660-\u0669\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07c0-\u07ea\u07f4-\u07f5\u07fa\u0904-\u0939\u093d\u0950\u0958-\u0961\u0966-\u096f\u0971-\u0972\u097b-\u097f\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09e6-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a66-\u0a6f\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0ae6-\u0aef\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b66-\u0b6f\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0be6-\u0bef\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58-\u0c59\u0c60-\u0c61\u0c66-\u0c6f\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0ce6-\u0cef\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d28\u0d2a-\u0d39\u0d3d\u0d60-\u0d61\u0d66-\u0d6f\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e50-\u0e59\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0ed0-\u0ed9\u0edc-\u0edd\u0f00\u0f20-\u0f29\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8b\u1000-\u102a\u103f-\u1049\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u1090-\u1099\u10a0-\u10c5\u10d0-\u10fa\u10fc\u1100-\u1159\u115f-\u11a2\u11a8-\u11f9\u1200-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u1676\u1681-\u169a\u16a0-\u16ea\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u17e0-\u17e9\u1810-\u1819\u1820-\u1877\u1880-\u18a8\u18aa\u1900-\u191c\u1946-\u196d\u1970-\u1974\u1980-\u19a9\u19c1-\u19c7\u19d0-\u19d9\u1a00-\u1a16\u1b05-\u1b33\u1b45-\u1b4b\u1b50-\u1b59\u1b83-\u1ba0\u1bae-\u1bb9\u1c00-\u1c23\u1c40-\u1c49\u1c4d-\u1c7d\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u2094\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2c6f\u2c71-\u2c7d\u2c80-\u2ce4\u2d00-\u2d25\u2d30-\u2d65\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31b7\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fc3\ua000-\ua48c\ua500-\ua60c\ua610-\ua62b\ua640-\ua65f\ua662-\ua66e\ua680-\ua697\ua722-\ua788\ua78b-\ua78c\ua7fb-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8d0-\ua8d9\ua900-\ua925\ua930-\ua946\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa50-\uaa59\uac00-\ud7a3\uf900-\ufa2d\ufa30-\ufa6a\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]*)(\:(.+?))?\]/ig;

	var metaPathParser = /^(.*\.|)meta(\..*|)$/;

	function createTemplateParser(template) {
	    var parse = function parseFormatTemplate() {
	        if (!this._tokens) {
	            this._tokens = [];

	            // Replace escaped \, [ or ] characters with placeholders
	            template = template.replace(/\\\\/g, '\u0000').replace(/\\\[/g, '\u0001').replace(/\\\]/g, '\u0002');
	            var index = 0;
	            formatTemplateParser.lastIndex = 0;
	            var match = formatTemplateParser.exec(template);

	            // Process each token match
	            while (match) {
	                var path = match[1];

	                // Create a token for the current match, including the prefix, path and format
	                this._tokens.push({
	                    prefix: template.substring(index, formatTemplateParser.lastIndex - match[0].length).replace(/\u0000/g, '\\').replace(/\u0001/g, '[').replace(/\u0002/g, ']'),
	                    path: path,
	                    format: match[3] ? match[3].replace(/\u0000/g, '\\').replace(/\u0001/g, '[').replace(/\u0002/g, ']') : null
	                });

	                // Track the last index and find the next match
	                index = formatTemplateParser.lastIndex;
	                match = formatTemplateParser.exec(template);
	            }

	            // Capture any trailing literal text as a token without a path
	            if (index < template.length) {
	                this._tokens.push({
	                    prefix: template.substring(index).replace(/\u0000/g, '\\').replace(/\u0001/g, '[').replace(/\u0002/g, ']')
	                });
	            }
	        }
	    };
	    return parse;
	}

	function createTemplateCompiler(type) {
		var logWarning = function logCompileFormatTemplateWarning(message) {
			if (typeof console !== "undefined") {
				if (console.warn && typeof console.warn === "function")
					console.warn(message);
				else if (console.log && typeof console.log === "function")
					console.log("WARN: " + message);
			}
		};

	    var compile = function compileFormatTemplate(callback, thisPtr) {
	        // First, ensure that the template is parsed
	        this._parse.call(this);

	        // Detect whether the template is being compiled in async mode
	        var isAsync = callback && callback instanceof Function;

	        // If the template is currently being compiled, then wait for it to complete
	        if (this._compileSignal && isAsync) {
	            this._compileSignal.waitForAll(callback, thisPtr);
	            return;
	        }

	        // If the template has already been compiled, then invoke the callback immediately
	        if (this._paths && isAsync) {
	            callback.call(thisPtr || this);
	            return;
	        }

	        if (!this._paths) {
	            if (isAsync) {
	                this._compileSignal = new Signal("compileFormatTemplate");
	            }

	            this._paths = [];

	            this._tokens.forEach(function (token) {
	                var path = token.path;
	                if (path) {
	                    var propertyPath = path;

	                    // See if the path represents a property path in the model
	                    try {
	                        // Detect property path followed by ".meta..."
	                        propertyPath = propertyPath.replace(metaPathParser, "$1");
	                        var isMetaPath = propertyPath.length > 0 && propertyPath.length < path.length;
	                        var allowFormat = !isMetaPath;
	                        if (isMetaPath) {
	                            propertyPath = propertyPath.substring(0, propertyPath.length - 1);
	                        }

	                        // If a property path remains, then attempt to find a default format and paths for the format
	                        if (propertyPath) {
	                            var processFormatProperty = function (property) {
									if (property) {
										// Only allow formats for a property path that is not followed by ".meta..."
										if (allowFormat) {
											// Determine the default property format
											var defaultFormat = property.get_format();

											// If the path references one or more entity properties, include paths for the property format. Otherwise, just add the path.
											var lastIndex = formatTemplateParser.lastIndex;
											if (defaultFormat && defaultFormat.constructor === Format && defaultFormat !== this && defaultFormat.getPaths().length > 0)
												this._paths.addRange(defaultFormat.getPaths().map(function (p) { return propertyPath + "." + p; }));
											else
												this._paths.push(propertyPath);
											formatTemplateParser.lastIndex = lastIndex;
											// Use the default format for the property
											if (!token.format) {
												token.format = defaultFormat;
											}
										}
										// Formats are not allowed, so just add the path
										else {
											this._paths.push(propertyPath);
										}
									} else {
										logWarning("Path '" + propertyPath + "' is not valid.");
									}
	                            };

								// Get the property and process it either immediately, or when the path is available (if compiling in async mode)
								if (isAsync) {
									Model.property(propertyPath, type, false, this._compileSignal.pending(processFormatProperty, this), this, false);
								} else {
									var property = Model.property(propertyPath, type);
									if (property) {
										processFormatProperty.call(this, property);
									} else {
										logWarning("Path '" + propertyPath + "' is not valid.");
									}
								}
	                        }
	                    }
						catch (e) {
							logWarning(e);
	                    }
	                }
	            }, this);

	            // If the format is being compiled async, then invoke the callback when complete
	            if (isAsync) {
	                this._compileSignal.waitForAll(function () {
	                    callback.call(thisPtr || this);
	                    delete this._compileSignal;
	                }, this);
	            }
	        }
	    };
	    return compile;
	}

	// #endregion

	// #region ExoWeb.Model.Format
	//////////////////////////////////////////////////

	function Format(options) {
		if (!options.hasOwnProperty("specifier") || !isString(options.specifier)) {
			throw new Error("Format specifier string must be provided.");
		}
		this._specifier = options.specifier;
		this._paths = options.paths;
		this._convert = options.convert;
		this._convertBack = options.convertBack;
		this._parse = options.parse;
		this._compile = options.compile;
		this._description = options.description;
		this._nullString = options.nullString || "";
		this._undefinedString = options.undefinedString || "";
		this._getFormattedValue = function (obj) {
			var result = "";
			for (var index = 0; index < this._tokens.length; index++) {
				var token = this._tokens[index];
				if (token.prefix)
					result = result + token.prefix;
				if (token.path) {
					var value = evalPath(obj, token.path);
					if (value === undefined || value === null)
						value = "";
					else if (token.format) {
						if (token.format.constructor === String) {
							token.format = getFormat(value.constructor, token.format);
						}

						if (value instanceof Array)
							value = value.map(function (v) { return token.format.convert(v); }).join(", ");
						else
							value = token.format.convert(value);

						if (this._formatEval)
							value = this._formatEval(value);
					}
					result = result + value;
				}
			}

			return result;
		};

		// function to perform additional post formatting
		this._formatEval = options.formatEval;
	}

	Format.fromTemplate = function Format$fromTemplate(type, template, formatEval) {

		return new Format({
			specifier: template,

			parse: createTemplateParser(template),

			compile: createTemplateCompiler(type),

			convert: function convert(obj) {
				if (obj === null || obj === undefined) {
					return "";
				}

				// Ensure the format has been compiled
				this._compile();

				var result = "";
				if (obj instanceof Array)
					for (var i = 0; i < obj.length; i++) {
						var value = this._getFormattedValue(obj[i]);

						if (result !== "" && value !== "")
							result = result + ", " + value;
						else
							result = result + value;
					}
				else
					result = this._getFormattedValue(obj);

				return result;
			},

			formatEval: formatEval
		});
	};

	Format.mixin({
		getTokens: function () {
			if (this._parse)
				this._parse();
			return this._tokens || [];
		},
		getPaths: function (callback, thisPtr) {
			if (this._compile) {
				if (callback && callback instanceof Function) {
					this._compile.call(this, function () {
						var paths = this._paths || [];
						callback.call(thisPtr || this, paths);
					}, this);
				} else {
					this._compile();
					return this._paths || [];
				}
			} else {
				return this._paths || [];
			}
		},
		convert: function (val) {
			if (val === undefined) {
				return this._undefinedString;
			}

			if (val === null) {
				return this._nullString;
			}

			if (val instanceof FormatError) {
				return val.get_invalidValue();
			}

			if (!this._convert) {
				return val;
			}

			return this._convert(val);
		},
		convertBack: function (val) {
			if (val === null || val == this._nullString) {
				return null;
			}

			if (val === undefined || val == this._undefinedString) {
				return;
			}

			if (val.constructor == String) {
				val = val.trim();

				if (val.length === 0) {
					return null;
				}
			}

			if (!this._convertBack) {
				return val;
			}

			try {
				return this._convertBack(val);
			}
			catch (err) {
				if (err instanceof FormatError) {
					return err;
				}
				else {
				    return new FormatError(this._description ? 
	                    Resource.get("format-with-description").replace('{description}', this._description) :
						Resource.get("format-without-description"),
								val);
				}
			}
		},
		toString: function() {
			return this._specifier;
		}	
	});

	Format.hasTokens = function hasTokens(template) {
		formatTemplateParser.lastIndex = 0;
		return formatTemplateParser.test(template);
	}

	ExoWeb.Model.Format = Format;

	// #endregion

	// #region ExoWeb.Model.Model
	//////////////////////////////////////////////////

	function Model() {
		this._types = {};
		this._ruleQueue = [];
	}

	Model.mixin(Functor.eventing);

	Model.mixin({
		dispose: function Model$dispose() {
			for (var key in this._types) {
				delete window[key];
			}
		},
		addType: function Model$addType(name, base, origin, format) {
			var type = new Type(this, name, base, origin, format);
			this._types[name] = type;
			return type;
		},
		type: function (name) {
			return this._types[name];
		},
		types: function (filter) {
			var result = [], typeName, type;
			for (typeName in this._types) {
				type = this._types[typeName];
				if (!filter || filter(type)) {
					result.push(type);
				}
			}
			return result;
		},
		addBeforeContextReady: function (handler) {
			// Only executes the given handler once, since the event should only fire once
			if (!this._contextReady) {
				this._addEvent("beforeContextReady", handler, null, true);
			}
			else {
				handler();
			}
		},

		// queues a rule to be registered
		registerRule: function Model$registerRule(rule) {
			if (!this._contextReady) {
				this._ruleQueue.push(rule);
			} else {
				rule.register();
			}
		},

		// register rules pending registration
		registerRules: function Model$registerRules() {
			var i, rules = this._ruleQueue;
			this._ruleQueue = [];
			for (i = 0; i < rules.length; i += 1) {
				rules[i].register();
			}
		},
		notifyBeforeContextReady: function () {
			this._contextReady = true;
			this.registerRules();
			this._raiseEvent("beforeContextReady", []);
		},
		addAfterPropertySet: function (handler) {
			this._addEvent("afterPropertySet", handler);
		},
		notifyAfterPropertySet: function (obj, property, newVal, oldVal) {
			this._raiseEvent("afterPropertySet", [obj, property, newVal, oldVal]);
		},
		addObjectRegistered: function (func, objectOrFunction, once) {
			this._addEvent("objectRegistered", func, objectOrFunction ? (objectOrFunction instanceof Function ? objectOrFunction : equals(objectOrFunction)) : null, once);
		},
		removeObjectRegistered: function (func) {
			this._removeEvent("objectRegistered", func);
		},
		notifyObjectRegistered: function (obj) {
			this._raiseEvent("objectRegistered", [obj]);
		},
		addObjectUnregistered: function (func) {
			this._addEvent("objectUnregistered", func);
		},
		notifyObjectUnregistered: function (obj) {
			this._raiseEvent("objectUnregistered", [obj]);
		},
		addListChanged: function (func) {
			this._addEvent("listChanged", func);
		},
		notifyListChanged: function (obj, property, changes) {
			this._raiseEvent("listChanged", [obj, property, changes]);
		},
		_ensureNamespace: function Model$_ensureNamespace(name, parentNamespace) {
			var result, nsTokens, target = parentNamespace;

			if (target.constructor === String) {
				nsTokens = target.split(".");
				target = window;
				Array.forEach(nsTokens, function (token) {
					target = target[token];

					if (target === undefined) {
						throw new Error("Parent namespace \"" + parentNamespace + "\" could not be found.");
					}
				});
			} else if (target === undefined || target === null) {
				target = window;
			}

			// create the namespace object if it doesn't exist, otherwise return the existing namespace
			if (!(name in target)) {
				result = target[name] = {};
				return result;
			} else {
				return target[name];
			}
		}
	});

	function ensureType(type, forceLoad, callback) {

		// immediately invoke the callback if no type was specified or the type is loaded
		if (!type || LazyLoader.isLoaded(type)) {
			return callback();
		}

		// force type loading if requested
		if (forceLoad) {
			LazyLoader.load(type, null, false, callback);
		}

		// otherwise, only continue processing when and if dependent types are loaded
		else {
			$extend(type._fullName, callback);
		}

		return null;
	}

	Model.property = function Model$property(path, thisType/*, forceLoadTypes, callback, thisPtr, waitForGlobals*/) {

		var type,
			loadProperty,
			singlePropertyName,
			tokens = null,
			forceLoadTypes = arguments.length >= 3 && typeof arguments[2] === "boolean" ? arguments[2] : false,
			callback = arguments[3],
			thisPtr = arguments[4],
			waitForGlobals = arguments.length >= 6 && typeof arguments[5] === "boolean" ? arguments[5] : true;

		// Allow the path argument to be either a string or PathTokens instance.
		if (path.constructor === PathTokens) {
			tokens = path;
			path = tokens.expression;
		}

		// Return cached property chains as soon as possible (in other words,
		// do as little as possible prior to returning the cached chain).
		if (thisType && thisType._chains && thisType._chains[path]) {
			if (callback) {
				callback.call(thisPtr || this, thisType._chains[path]);
				return null;
			} else {
				return thisType._chains[path];
			}
		}

		// The path argument was a string, so use it to create a PathTokens object.
		// Delay doing this as an optimization for cached property chains.
		if (!tokens) {
			tokens = new PathTokens(path);
		}

		// get the instance type, if specified
		type = thisType instanceof Function ? thisType.meta : thisType;

		// determine if a typecast was specified for the path to identify a specific subclass to use as the root type
		if (tokens.steps[0].property === "this" && tokens.steps[0].cast) {

			//Try and resolve cast to an actual type in the model
			type = Model.getJsType(tokens.steps[0].cast, false).meta;
			tokens.steps.dequeue();
		}

		// create a function to lazily load a property 
		loadProperty = function (containingType, propertyName, propertyCallback) {
			ensureType(containingType, forceLoadTypes, function () {
				propertyCallback.call(thisPtr || this, containingType.property(propertyName));
			});
		};

		// Optimize for a single property expression, as it is neither static nor a chain.
		if (tokens.steps.length === 1) {
			singlePropertyName = tokens.steps[0].property;
			if (callback) {
				loadProperty(type, singlePropertyName, callback);
			} else {
				var singleProperty = type.property(singlePropertyName);
				if (singleProperty) {
					return singleProperty;
				} else {
					throw new Error("Path '" + path + "' is not valid.");
				}
			}
		}

		// otherwise, first see if the path represents a property chain, and if not, a global property
		else {

			// predetermine the global type name and property name before seeing if the path is an instance path
			var globalTypeName = tokens.steps
				.slice(0, tokens.steps.length - 1)
				.map(function (item) { return item.property; })
				.join(".");

			var globalPropertyName = tokens.steps[tokens.steps.length - 1].property;

			// Copy of the Model.property arguments for async re-entry.
			var outerArgs = Array.prototype.slice.call(arguments);

			// create a function to see if the path is a global property if instance processing fails
			var processGlobal = function (instanceParseError) {

				// Retrieve the javascript type by name.
				type = Model.getJsType(globalTypeName, true);

				// Handle non-existant or non-loaded type.
				if (!type) {
					if (callback) {
						if (waitForGlobals) {
							// Retry when type is loaded
							$extend(globalTypeName, Model.property.prepare(Model, outerArgs));
							return null;
						} else {
							callback(null);
							return null;
						}
					} else {
						return null;
					}
				}

				// Get the corresponding meta type.
				type = type.meta;

				// return the static property
				if (callback) {
					loadProperty(type, globalPropertyName, callback);
				} else {
					return type.property(globalPropertyName);
				}
			};

			if (callback) {
				PropertyChain.create(type, tokens, forceLoadTypes, thisPtr ? callback.bind(thisPtr) : callback, processGlobal);
			} else {
				var result = PropertyChain.create(type, tokens, forceLoadTypes) || processGlobal();
				if (result) {
					return result;
				} else {
					throw new Error("Path '" + path + "' is not valid.");
				}
			}
		}
	};

	Model.intrinsicJsTypes = ["Object", "String", "Number", "Boolean", "Date", "TimeSpan", "Array"];
	Model.types = {};
	Model.getJsType = function Model$getJsType(name, allowUndefined) {
		/// <summary>
		/// Retrieves the JavaScript constructor function corresponding to the given full type name.
		/// </summary>
		/// <returns type="Object" />

		var obj = Model.types;
		var steps = name.split(".");
		if (steps.length === 1 && Model.intrinsicJsTypes.indexOf(name) > -1) {
			return window[name];
		}
		else {
			for (var i = 0; i < steps.length; i++) {
				var step = steps[i];
				obj = obj[step];
				if (obj === undefined) {
					if (allowUndefined) {
						return;
					}
					else {
						throw new Error($format("The type \"{0}\" could not be found.  Failed on step \"{1}\".", [name, step]));
					}
				}
			}
			return obj;
		}
	};

	ExoWeb.Model.Model = Model;

	// #endregion

	// #region ExoWeb.Model.Entity
	//////////////////////////////////////////////////

	function Entity() {
	}

	function forEachProperty(obj, callback, thisPtr) {
		for (var prop in obj) {
			callback.call(thisPtr || this, prop, obj[prop]);
		}
	}

	function getProperties(/*[properties] or [propName, propValue] */) {
		if (arguments.length === 2) {
			var properties = {};
			properties[arguments[0]] = arguments[1];
			return properties;
		}
		else {
			return arguments[0];
		}
	}

	Entity.mixin({
		init: function Entity$init(/*[properties] or [propName, propValue] */) {
			forEachProperty(getProperties.apply(this, arguments), function (name, value) {
				var prop = this.meta.type.property(name);

				if (!prop) {
					throw new Error("Could not find property \"" + name + "\" on type \"" + this.meta.type.get_fullName() + "\".");
				}

				// Initialization is not force.  If the propery already has a value it will be ignored.
				Property$_init.call(prop, this, value);
			}, this);
		},
		set: function Entity$set(/*[properties] or [propName, propValue] */) {
			forEachProperty(getProperties.apply(this, arguments), function (name, value) {
				var prop = this.meta.type.property(name);
				if (!prop) {
					throw new Error("Could not find property \"" + name + "\" on type \"" + this.meta.type.get_fullName() + "\".");
				}

				Property$_setter.call(prop, this, value, false);
			}, this);
		},
		get: function Entity$get(propName) {
			return this.meta.type.property(propName).value(this);
		},
		toString: function Entity$toString(format) {
			if (format) {
				format = getFormat(this.constructor, format);
			}
			else {
				format = this.meta.type.get_format();
			}

			if (format)
				return format.convert(this);
			else
				return Entity.toIdString(this);
		}
	});

	// Gets the typed string id suitable for roundtripping via fromIdString
	Entity.toIdString = function Entity$toIdString(obj) {
		return $format("{0}|{1}", [obj.meta.type.get_fullName(), obj.meta.id]);
	};

	// Gets or loads the entity with the specified typed string id
	Entity.fromIdString = function Entity$fromIdString(idString) {
		// Typed identifiers take the form "type|id".
	    var type = idString.substring(0, idString.indexOf("|"));
	    var id = idString.substring(type.length + 1);

		// Use the left-hand portion of the id string as the object's type.
		var jstype = ExoWeb.Model.Model.getJsType(type);

		// Retrieve the object with the given id.
		return jstype.meta.get(id,
			// Typed identifiers may or may not be the exact type of the instance.
			// An id string may be constructed with only knowledge of the base type.
			false
		);
	};

	ExoWeb.Model.Entity = Entity;

	// #endregion

	// #region ExoWeb.Model.Type
	//////////////////////////////////////////////////

	function Type(model, name, baseType, origin) {
		this._fullName = name;

		// if origin is not provided it is assumed to be client
		this._origin = origin || "client";
		this._originForNewProperties = this._origin;

		this._pool = {};
		this._legacyPool = {};
		this._counter = 0;
		this._properties = {}; 
		this._instanceProperties = {};
		this._staticProperties = {};
		this._pendingInit = [];
		this._pendingInvocation = [];

		// define properties
		Object.defineProperty(this, "model", { value: model });
		Object.defineProperty(this, "rules", { value: [] });

		// generate class and constructor
		var jstype = Model.getJsType(name, true);

		// create namespaces as needed
		var nameTokens = name.split("."),
			token = nameTokens.dequeue(),
			namespaceObj = Model.types,
			globalObj = window;

		while (nameTokens.length > 0) {
			namespaceObj = model._ensureNamespace(token, namespaceObj);
			globalObj = model._ensureNamespace(token, globalObj);
			token = nameTokens.dequeue();
		}

		// the final name to use is the last token
		var finalName = token;
		jstype = generateClass(this);

		this._jstype = jstype;

		// If the namespace already contains a type with this name, append a '$' to the name
		if (!namespaceObj[finalName]) {
			namespaceObj[finalName] = jstype;
		}
		else {
			namespaceObj['$' + finalName] = jstype;
		}

		// If the global object already contains a type with this name, append a '$' to the name
		if (!globalObj[finalName]) {
			globalObj[finalName] = jstype;
		}
		else {
			globalObj['$' + finalName] = jstype;
		}

		// setup inheritance
		this.derivedTypes = [];
		var baseJsType;

		if (baseType) {
			baseJsType = baseType._jstype;

			this.baseType = baseType;
			baseType.derivedTypes.push(this);
		
			// inherit all shortcut properties that have aleady been defined
			inheritBaseTypePropShortcuts(jstype, baseType);
		}
		else {
			baseJsType = Entity;
			this.baseType = null;
		}

		disableConstruction = true;
		this._jstype.prototype = new baseJsType();
		disableConstruction = false;

		this._jstype.prototype.constructor = this._jstype;

		// helpers
		jstype.meta = this;

		// Add self-reference to decrease the likelihood of errors
		// due to an absence of the necessary type vs. entity.
		this.type = this;
	}

	// copy shortcut properties from a base meta type (recursively) to a target jstype
	function inheritBaseTypePropShortcuts(jstype, baseType) {
		for (var propName in baseType._properties) {
			jstype["$" + propName] = baseType._properties[propName];
		}

		// recursively add base type properties
		if (baseType.baseType) {
			inheritBaseTypePropShortcuts(jstype, baseType.baseType);
		}
	}

	var disableConstruction = false;

	var validateId = function Type$validateId(type, id) {
		if (id === null || id === undefined) {
			throw new Error($format("Id cannot be {0} (entity = {1}).", id === null ? "null" : "undefined", type.get_fullName()));
		}
		else if (!ExoWeb.isString(id)) {
			throw new Error($format("Id must be a string:  encountered id {0} of type \"{1}\" (entity = {2}).",
				id.toString(), parseFunctionName(id.constructor), type.get_fullName()));
		}
		else if (id === "") {
			throw new Error($format("Id cannot be a blank string (entity = {0}).", type.get_fullName()));
		}
	};

	function generateClass(type) {
		function construct(idOrProps, props, suppressModelEvent) {
			if (!disableConstruction) {
				if (idOrProps && idOrProps.constructor === String) {
					var id = idOrProps;
					var obj = type.get(id,
						// When a constructor is called we do not want to silently
						// return an instance of a sub type, so fetch using exact type.
						true,
						// Indicate that an object is currently being constructed.
						true);

					// If the instance already exists, then initialize properties and return it.
					if (obj) {
						if (props) {
							obj.init(props);
						}
						return obj;
					}

					// Register the newly constructed existing instance.
					type.register(this, id, suppressModelEvent);

					// Initialize properties if provided.
					if (props) {
						this.init(props);
					}
				}
				else {
					// Register the newly constructed new instance. It will
					// be assigned a sequential client-generated id.
					type.register(this, null, suppressModelEvent);

					// Set properties passed into constructor.
					if (idOrProps) {
						this.set(idOrProps);
					}

					// Raise initNew event if registered.
					for (var t = type; t; t = t.baseType) {
						var handler = t._getEventHandler("initNew");
						if (handler) {
							handler(this, {});
						}
					}
				}
			}
		}

		return construct;
	}

	var newIdPrefix = "+c";

	Type.getNewIdPrefix = function getNewIdPrefix() {
		if (arguments.length > 0) throw new Error("The method getNewIdPrefix does not accept arguments");
		return newIdPrefix.substring(1);
	};

	Type.setNewIdPrefix = function setNewIdPrefix(prefix) {
		if (prefix === null || prefix === undefined) throw new Error("The new id prefix argument is required");
		if (typeof(prefix) !== "string") throw new TypeError("The new id prefix must be a string, found " + prefix.toString());
		if (prefix.length === 0) throw new Error("The new id prefix cannot be empty string");
		newIdPrefix = "+" + prefix;
	};

	Type.prototype = {
		// gets and optionally sets the pending initialization status for a static property on the type
		pendingInvocation: function Type$pendingInvocation(rule, value) {
			var indexOfRule = this._pendingInvocation.indexOf(rule);
			if (arguments.length > 1) {
				if (value && indexOfRule < 0) {
					this._pendingInvocation.push(rule);
				}
				else if (!value && indexOfRule >= 0) {
					this._pendingInvocation.splice(indexOfRule, 1);
				}
			}
			return indexOfRule >= 0;
		},

		addInitNew: function Type$addInitNew(handler, obj, once) {
			this._addEvent("initNew", handler, obj ? equals(obj) : null, once);
			return this;
		},

		// gets and optionally sets the pending initialization status for a static property on the type
		pendingInit: function Type$pendingInit(prop, value) {
			var result = this[prop._fieldName] === undefined || this._pendingInit[prop.get_name()] === true;
			if (arguments.length > 1) {
				if (value) {
					this._pendingInit[prop.get_name()] = true;
				}
				else {
					delete this._pendingInit[prop.get_name()];
				}
			}
			return result;
		},
		addInitExisting: function Type$addInitExisting(handler, obj, once) {
			this._addEvent("initExisting", handler, obj ? equals(obj) : null, once);
			return this;
		},
		newId: function Type$newId() {
			// Get the next id for this type's heirarchy.
			for (var nextId, type = this; type; type = type.baseType) {
				nextId = Math.max(nextId || 0, type._counter);
			}

			// Update the counter for each type in the heirarchy.
			for (var type = this; type; type = type.baseType) {
				type._counter = nextId + 1;
			}

			// Return the new id.
			return newIdPrefix + nextId;
		},
		register: function Type$register(obj, id, suppressModelEvent) {
			// register is called with single argument from default constructor
			if (arguments.length === 2) {
				validateId(this, id);
			}

			obj.meta = new ObjectMeta(this, obj);

			if (!id) {
				id = this.newId();
				obj.meta.isNew = true;
			}

			var key = id.toLowerCase();

			obj.meta.id = id;
			Observer.makeObservable(obj);

			for (var t = this; t; t = t.baseType) {
				if (t._pool.hasOwnProperty(key)) {
					throw new Error($format("Object \"{0}|{1}\" has already been registered.", this.get_fullName(), id));
				}

				t._pool[key] = obj;
				if (t._known) {
					t._known.add(obj);
				}
			}

			if (!suppressModelEvent) {
				this.model.notifyObjectRegistered(obj);
			}
		},
		changeObjectId: function Type$changeObjectId(oldId, newId) {
			validateId(this, oldId);
			validateId(this, newId);

			var oldKey = oldId.toLowerCase();
			var newKey = newId.toLowerCase();

			var obj = this._pool[oldKey];

			if (obj) {
				obj.meta.legacyId = oldId;

				for (var t = this; t; t = t.baseType) {
					t._pool[newKey] = obj;

					delete t._pool[oldKey];

					t._legacyPool[oldKey] = obj;
				}

				obj.meta.id = newId;

				return obj;
			}
			else {
				logWarning($format("Attempting to change id: Instance of type \"{0}\" with id = \"{1}\" could not be found.", this.get_fullName(), oldId));
			}
		},
		unregister: function Type$unregister(obj) {
			for (var t = this; t; t = t.baseType) {
				delete t._pool[obj.meta.id.toLowerCase()];

				if (obj.meta.legacyId) {
					delete t._legacyPool[obj.meta.legacyId.toLowerCase()];
				}

				if (t._known) {
					t._known.remove(obj);
				}
			}

			this.model.notifyObjectUnregistered(obj);
		},
		get: function Type$get(id, exactTypeOnly) {
			validateId(this, id);

			var key = id.toLowerCase();
			var obj = this._pool[key] || this._legacyPool[key];

			// If exactTypeOnly is specified, don't return sub-types.
			if (obj && exactTypeOnly === true && obj.meta.type !== this) {
				throw new Error($format("The entity with id='{0}' is expected to be of type '{1}' but found type '{2}'.", id, this._fullName, obj.meta.type._fullName));
			}

			return obj;
		},
		// Gets an array of all objects of this type that have been registered.
		// The returned array is observable and collection changed events will be raised
		// when new objects are registered or unregistered.
		// The array is in no particular order.
		known: function Type$known() {
			var list = this._known;
			if (!list) {
				list = this._known = [];

				for (var id in this._pool) {
					list.push(this._pool[id]);
				}

				Observer.makeObservable(list);
			}

			return list;
		},
		addPropertyAdded: function (handler) {
			this._addEvent("propertyAdded", handler);
		},
		addRule: function Type$addRule(def) {
			return new Rule(this, def);
		},
		addProperty: function Type$addProperty(def) {
			var format = def.format;
			if (format && format.constructor === String) {
				format = getFormat(def.type, format);
			}

			var prop = new Property(this, def.name, def.type, def.label, def.helptext, format, def.isList, def.isStatic, def.isPersisted, def.isCalculated, def.index, def.defaultValue, def.constant);

			this._properties[def.name] = prop;
			(def.isStatic ? this._staticProperties : this._instanceProperties)[def.name] = prop;

			// modify jstype to include functionality based on the type definition
			function genPropertyShortcut(mtype, overwrite) {
				var shortcutName = "$" + def.name;
				if (!(shortcutName in mtype._jstype) || overwrite) {
					mtype._jstype[shortcutName] = prop;
				}

				mtype.derivedTypes.forEach(function (t) {
					genPropertyShortcut(t, false);
				});
			}
			genPropertyShortcut(this, true);

			if (prop.get_isStatic()) {
				// for static properties add member to javascript type
				this._jstype["get_" + def.name] = this._makeGetter(prop, Property$_getter.bind(prop), true);
			}
			else {
				// for instance properties add member to all instances of this javascript type
				this._jstype.prototype["get_" + def.name] = this._makeGetter(prop, Property$_getter.bind(prop), true);
			}

			if (prop.get_isStatic()) {
				this._jstype["set_" + def.name] = this._makeSetter(prop);
			}
			else {
				this._jstype.prototype["set_" + def.name] = this._makeSetter(prop);
			}

			this._raiseEvent("propertyAdded", [this, { property: prop}]);

			return prop;
		},
		addMethod: function Type$addMethod(def) {
			var methodName = this.get_fullName() + "." + def.name;
			var method = function () {
				//signature: p1, p2, p#, paths, onSuccess, onFail

				// Detect the optional success and failure callback delegates
				var onSuccess;
				var onFail;
				var paths = null;

				if (arguments.length > 1) {
					onSuccess = arguments[arguments.length - 2];
					if (onSuccess instanceof Function) {
						onFail = arguments[arguments.length - 1];
					}
					else {
						onSuccess = arguments[arguments.length - 1];
					}
				}
				else if (arguments.length > 0)
					onSuccess = arguments[arguments.length - 1];

				if (!(onSuccess instanceof Function))
					onSuccess = undefined;

				var onSuccessFn = function (result) {
					if (onSuccess !== undefined) {
						onSuccess(result.event);
					}
				};

				var argCount = arguments.length - (onSuccess === undefined ? 0 : 1) - (onFail === undefined ? 0 : 1);
				var firstArgCouldBeParameterSet = argCount > 0 && arguments[0] instanceof Object && !(def.parameters.length === 0 || arguments[0][def.parameters[0]] === undefined);
				var instance = this instanceof Entity ? this : null;

				if (argCount >= 1 && argCount <= 2 && arguments[0] instanceof Object &&
						((argCount == 1 && (def.parameters.length != 1 || firstArgCouldBeParameterSet)) ||
						((argCount == 2 && (def.parameters.length != 2 || (firstArgCouldBeParameterSet && arguments[1] instanceof Array)))))) {

					// Invoke the server event
					context.server.raiseServerEvent(methodName, instance, arguments[0], false, onSuccessFn, onFail, argCount == 2 ? arguments[1] : null);
				}

				// Otherwise, assume that the parameters were all passed in sequential order
				else {
					// Throw an error if the incorrect number of arguments were passed to the method
					if (def.parameters.length == argCount - 1 && arguments[argCount - 1] instanceof Array)
						paths = arguments[argCount - 1];
					else if (def.parameters.length != argCount)
						throw new Error($format("Invalid number of arguments passed to \"{0}.{1}\" method.", this._fullName, def.name));

					if (def.isStatic && paths)
						throw new Error($format("Cannot include paths when invoking a static method - \"{0}.{1}\".", this.meta._fullName, def.name));

					// Construct the arguments to pass
					var args = {};
					for (var parameter in def.parameters) {
						if (def.parameters.hasOwnProperty(parameter)) {
							args[def.parameters[parameter]] = arguments[parameter];
						}
					}

					// Invoke the server event
					context.server.raiseServerEvent(methodName, instance, args, false, onSuccessFn, onFail, paths);
				}
			};

			// Assign the method to the type for static methods, otherwise assign it to the prototype for instance methods
			if (def.isStatic) {
				this._jstype[def.name] = method;
			}
			else {
				this._jstype.prototype[def.name] = method;
			}

		},	
		getPath: function(path) {
			// Get single property
			var property = this.property(path);
		
			// Create property chain
			if (!property) {
				property = PropertyChain.create(this, new ExoWeb.Model.PathTokens(path));
			}

			// Return the property path
			return property;
		},
		getPaths: function(path) {
			var start = 0;
			var paths = [];

			// Process the path
			if (/{|,|}/g.test(path)) {
				var stack = [];
				var parent;

				for (var i = 0, len = path.length; i < len; ++i) {
					var c = path.charAt(i);

					if (c === "{" || c === "," || c === "}") {
						var seg = path.substring(start, i).trim();
						start = i + 1;

						if (c === "{") {
							if (parent) {
								stack.push(parent);
								parent += "." + seg;
							}
							else {
								parent = seg;
							}
						}
						else { // ',' or '}'
							if (seg.length > 0) {
								paths.push(this.getPath(parent ? parent + "." + seg : seg));
							}

							if (c === "}") {
								parent = (stack.length === 0) ? undefined : stack.pop();
							}
						}
					}
				}

				if (stack.length > 0 || parent) {
					throw new Error("Unclosed '{' in path: " + path);
				}

				if (start < path.length) {
					var _seg = path.substring(start).trim();
					if (_seg.length > 0) {
						paths.push(this.getPath(_seg));
					}

					// Set start to past the end of the list to indicate that the entire string was processed
					start = path.length;
				}
			}

			// If the input is a simple property or path, then add the single property or chain
			if (start === 0) {
				paths.push(this.getPath(path.trim()));
			}

			return paths;
		},
		_makeGetter: function Type$_makeGetter(property, getter, skipTypeCheck) {
			return function () {
				// ensure the property is initialized
				var result = getter.call(property, this, skipTypeCheck);

				// ensure the property is initialized
				if (result === undefined || (property.get_isList() && LazyLoader.isRegistered(result))) {
					throw new Error($format(
						"Property {0}.{1} is not initialized.  Make sure instances are loaded before accessing property values.  {2}|{3}",
						property._containingType.get_fullName(),
						property.get_name(),
						this.meta.type.get_fullName(),
						this.meta.id
					));
				}

				// return the result
				return result;
			};
		},
		_makeSetter: function Type$_makeSetter(prop) {
			var setter = function (val) {
				Property$_setter.call(prop, this, val, true);
			};

			setter.__notifies = true;

			return setter;
		},
		get_format: function Type$get_format() {
			return this._format ? this._format : (this.baseType ? this.baseType.get_format() : undefined);
		},
		set_format: function Type$set_format(value) {
			if (value && value.constructor == String)
				value = getFormat(this.get_jstype(), value);
			this._format = value;
		},
		get_fullName: function Type$get_fullName() {
			return this._fullName;
		},
		get_jstype: function Type$get_jstype() {
			return this._jstype;
		},
		get_properties: function Type$get_properties() {
			return ExoWeb.objectToArray(this._properties);
		},
		get_allproperties: function Type$get_allproperties() {
			var temp = ExoWeb.objectToArray(this._properties);

			//go up the base types until there are no more
			var tempObj = this;
			while (tempObj.baseType) {
				tempObj = tempObj.baseType;
				temp = tempObj.get_properties().concat(temp);
			}

			return temp;
		},
		get_baseproperties: function Type$get_baseproperties() {
			var temp = new Array();

			//go up the base types until there are no more
			var tempObj = this;
			var alreadyBase = true;
			while (tempObj.baseType) {
				tempObj = tempObj.baseType;
				temp = tempObj.get_properties().concat(temp);
				alreadyBase = false;
			}

			if (alreadyBase)
				temp = tempObj.get_properties();

			return temp;
		},
		get_staticProperties: function Type$get_staticProperties() {
			return this._staticProperties;
		},
		get_instanceProperties: function Type$get_instanceProperties() {
			return this._instanceProperties;
		},
		property: function Type$property(name) {
			var prop;
			for (var t = this; t && !prop; t = t.baseType) {
				prop = t._properties[name];

				if (prop) {
					return prop;
				}
			}
			return null;
		},
		conditionIf: function (options) {
			new ExoWeb.Model.Rule.condition(this, options);
			return this;
		},
		set_originForNewProperties: function Type$set_originForNewProperties(value) {
			this._originForNewProperties = value;
		},
		get_originForNewProperties: function Type$get_originForNewProperties() {
			return this._originForNewProperties;
		},
		set_origin: function Type$set_origin(value) {
			this._origin = value;
		},
		get_origin: function Type$get_origin() {
			return this._origin;
		},
		compileExpression: function Type$compile(expression) {

			// use exports if required
			if (this._exports || ExoWeb.config.expressionScope) {
				expression = "return function() { return " + expression + "; }";
				var args;
				var values;

				// Include exported functions, if specified
				if (this._exports) {
					args = this._exports.names;
					values = this._exports.implementations;
				}

				// Include global expression scope variables, is specified
				if (ExoWeb.config.expressionScope) {
					if (!ExoWeb.config.expressionScope._names) {
						var scopeNames = [];
						var scopeValues = [];
						for(var key in ExoWeb.config.expressionScope){
							scopeNames.push(key);
							scopeValues.push(ExoWeb.config.expressionScope[key]);
						}
						ExoWeb.config.expressionScope._names = scopeNames;
						ExoWeb.config.expressionScope._values = scopeValues;
					}
					args = args ? args.concat(ExoWeb.config.expressionScope._names) : ExoWeb.config.expressionScope._names;
					values = values ? values.concat(ExoWeb.config.expressionScope._values) : ExoWeb.config.expressionScope._values;
				}

				// Compile the expression using the specified exported functions and global scope variables
				var compile = Function.apply(null, args.concat([expression]));
				return compile.apply(null, values);
			}

			// otherwise, just create the function based on the expression
			else {
				return new Function("return " + expression + ";");
			}
		},
		set_exports: function Type$set_exports(exports) {
			var names = [];
			var script = "return ["
			for (var name in exports) {
				names.push(name);
				script += exports[name] + ",";
			}
			if (script.length > 8) {
				script = script.slice(0, -1) + "];";
				this._exports = { names: names, implementations: new Function(script)() };
			}
		},
		// Adds a single export function to the type for use by calls to compileExpression().
		addExport: function Type$addExport(name, fn) {
			if (!this._exports) {
				this._exports = { names: [name], implementations: new Function("return [" + fn + "];")() };
			}
			else if (this._exports.names.indexOf(name) === -1) {
				this._exports.names.push(name);
				this._exports.implementations.push(new Function("return " + fn)());
			}
		
		},
		eachBaseType: function Type$eachBaseType(callback, thisPtr) {
			for (var baseType = this.baseType; !!baseType; baseType = baseType.baseType) {
				if (callback.call(thisPtr || this, baseType) === false) {
					return;
				}
			}
		},
		isSubclassOf: function Type$isSubclassOf(mtype) {
			var result = false;

			this.eachBaseType(function (baseType) {
				if (baseType === mtype) {
					result = true;
					return false;
				}
			});

			return result;
		},
		isLoaded: function (prop) {
			/// <summary locid="M:J#ExoWeb.Model.Type.isLoaded">
			/// Check whether the Type and optional property are loaded.
			/// </summary>
			/// <param name="prop" optional="true" mayBeNull="true" type="Object">The optional property object or property name to check.</param>

			// First see if there is a lazy loader attached to the entity (and optional property).
			if (LazyLoader.isRegistered(this, null, prop)) {
				return false;
			}

			// Immediately return true if a property name was not specified
			if (prop) {
				// Coerce property names into property instances
				if (isString(prop)) {
					prop = this.property(prop);
				}

				// Otherwise, get the property value and determine whether there is a
				// lazy loader attached to the property value, e.g. entity or list.
				var val = prop.value(this._jstype);
				if (val !== null && val !== undefined && LazyLoader.isRegistered(val)) {
					return false;
				}
			}

			return true;
		},
		toString: function Type$toString() {
			return this.get_fullName();
		},
		addConditionsChanged: function Type$addConditionsChanged(handler, criteria) {
			var filter;

			// condition type filter
			if (criteria instanceof ConditionType) {
				filter = function (sender, args) { return args.conditionTarget.condition.type === criteria; };
			}

				// property filter
			else if (criteria instanceof Property || criteria instanceof PropertyChain) {
				criteria = criteria.lastProperty();
				filter = function (sender, args) { return args.conditionTarget.properties.indexOf(criteria) >= 0; };
			}

			// subscribe to the event
			this._addEvent("conditionsChanged", handler, filter);

			// Return the type meta to support method chaining
			return this;
		},
		removeConditionsChanged: function Type$removeConditionsChanged(handler) {
			this._removeEvent("conditionsChanged", handler);
		}
	};

	Type.mixin(Functor.eventing);
	ExoWeb.Model.Type = Type;

	// #endregion

	// #region ExoWeb.Model.Property
	//////////////////////////////////////////////////

	//////////////////////////////////////////////////////////////////////////////////////
	/// <remarks>
	/// If the interface for this class is changed it should also be changed in
	/// PropertyChain, since PropertyChain acts as an aggregation of properties 
	/// that can be treated as a single property.
	/// </remarks>
	///////////////////////////////////////////////////////////////////////////////
	function Property(containingType, name, jstype, label, helptext, format, isList, isStatic, isPersisted, isCalculated, index, defaultValue, constant) {
		this._containingType = containingType;
		this._name = name;
		this._fieldName = "_" + name;
		this._jstype = jstype;
		this._label = label || makeHumanReadable(name);
		this._helptext = helptext;
		this._format = format;
		this._isList = isList === true;
		this._isStatic = isStatic === true;
		this._isPersisted = isPersisted === true;
		this._isCalculated = isCalculated === true;
		this._index = index;
		this._defaultValue =
			defaultValue !== undefined ? defaultValue :
				isList ? [] :
					jstype === Boolean ? false :
						jstype === Number ? 0 :
							null;

		this._constant = null;
		if (constant !== null && constant !== undefined) {
			// constant value should be lazily initialized to ensure any type dependencies have been resolved
			if (isList && constant instanceof Array) {
				this._constant = function () {
					return constant.map(function (i) {
						return new jstype(i);
					});
				};
			}
			else if (!isList && typeof constant === "object") {
				this._constant = function () {
					new jstype(i);
				};
			}
		}

		this._rules = [];

		if (containingType.get_originForNewProperties()) {
			this._origin = containingType.get_originForNewProperties();
		}

		if (this._origin === "client" && this._isPersisted) {
			logWarning($format("Client-origin properties should not be marked as persisted: Type = {0}, Name = {1}", containingType.get_fullName(), name));
		}
	}

	// updates the property and message or conditionType options for property rules
	function preparePropertyRuleOptions(property, options, error) {
		options.property = property;
		if (error && error.constructor === String) {
			options.message = error;
		}
		else if (error instanceof ConditionType) {
			options.conditionType = error;
		}
		return options;
	}

	// updates the property and message or conditionType options for property rules
	function hasPropertyChangedSubscribers(property, obj) {
		var changedEvent = property._getEventHandler("changed");
		return changedEvent && !changedEvent.isEmpty([obj]);
	}

	// registers a rule with a specific property
	function registerPropertyRule(property, rule) {
		property._rules.push(rule);

		// Raise events if registered.
		var ruleRegisteredEvent = property._getEventHandler("ruleRegistered");
		if (ruleRegisteredEvent && !ruleRegisteredEvent.isEmpty()) {
			ruleRegisteredEvent(rule, { property: property });
		}
	}

	function Property$_init(obj, val, force) {
		var target = (this._isStatic ? this._containingType.get_jstype() : obj);
		var curVal = target[this._fieldName];

		if (curVal !== undefined && !(force === undefined || force)) {
			return;
		}

		target[this._fieldName] = val;

		target.meta.pendingInit(this, false);

		if (val instanceof Array) {
			var _this = this;
			Observer.makeObservable(val);
			Observer.addCollectionChanged(val, function Property$collectionChanged(sender, args) {
				var changes = args.get_changes();

				// Don't raise the change event unless there is actually a change to the collection
				if (changes && changes.some(function (change) { return (change.newItems && change.newItems.length > 0) || (change.oldItems && change.oldItems.length > 0); })) {
					// NOTE: property change should be broadcast before rules are run so that if 
					// any rule causes a roundtrip to the server these changes will be available
					_this._containingType.model.notifyListChanged(target, _this, changes);

					// NOTE: oldValue is not currently implemented for lists
					_this._raiseEvent("changed", [target, { property: _this, newValue: val, oldValue: undefined, changes: changes, collectionChanged: true }]);

					Observer.raisePropertyChanged(target, _this._name);
				}
			});

			// Override the default toString on arrays so that we get a comma-delimited list
			val.toString = Property$_arrayToString.bind(val);
		}

		Observer.raisePropertyChanged(target, this._name);

		// Return the property to support method chaining
		return this;
	}

	function Property$_arrayToString() {
		return this.join(", ");
	}

	function Property$_ensureInited(obj) {
		// Determine if the property has been initialized with a value
		// and initialize the property if necessary
		if (!obj.hasOwnProperty(this._fieldName)) {

			// Do not initialize calculated properties. Calculated properties should be initialized using a property get rule.  
			if (!this.get_isCalculated()) {
				var value = this.get_constant() !== null ? this.get_constant() : this.get_defaultValue();
				Property$_init.call(this, obj, value);
			}

			// Mark the property as pending initialization
			obj.meta.pendingInit(this, true);
		}
	}

	function Property$_getter(obj) {
		// Ensure the entity is loaded before accessing property values
		if (LazyLoader.isRegistered(obj)) {
			return;
		}

		// Ensure that the property has an initial (possibly default) value
		Property$_ensureInited.call(this, obj);

		// Raise get events
		// NOTE: get events may result in a change, so the value cannot be cached
		var getEvent = this._getEventHandler("get");
		if (getEvent && !getEvent.isEmpty()) {
			getEvent(obj, { property: this, value: obj[this._fieldName] });
		}

		// Return the property value
		return obj[this._fieldName];
	}

	function Property$_setter(obj, val, skipTypeCheck, additionalArgs) {
		// Ensure the entity is loaded before setting property values
		if (LazyLoader.isRegistered(obj)) {
			throw new Error("Cannot set " + this.get_name() + "=" + (val === undefined ? "<undefined>" : val) + " for instance " + obj.meta.type.get_fullName() + "|" + obj.meta.id + ": object is ghosted.");
		}

		// Ensure that the property has an initial (possibly default) value
		Property$_ensureInited.call(this, obj);

		if (!this.canSetValue(obj, val)) {
			throw new Error("Cannot set " + this.get_name() + "=" + (val === undefined ? "<undefined>" : val) + " for instance " + obj.meta.type.get_fullName() + "|" + obj.meta.id + ": a value of type " + (this._jstype && this._jstype.meta ? this._jstype.meta.get_fullName() : parseFunctionName(this._jstype)) + " was expected.");
		}

		var old = obj[this._fieldName];

		// Update lists as batch remove/add operations
		if (this.get_isList()) {
			old.beginUpdate();
			update(old, val);
			old.endUpdate();
		}
		else {

			// compare values so that this check is accurate for primitives
			var oldValue = (old === undefined || old === null) ? old : old.valueOf();
			var newValue = (val === undefined || val === null) ? val : val.valueOf();

			// Do nothing if the new value is the same as the old value. Account for NaN numbers, which are
			// not equivalent (even to themselves). Although isNaN returns true for non-Number values, we won't
			// get this far for Number properties unless the value is actually of type Number (a number or NaN).
			if (oldValue !== newValue && !(this._jstype === Number && isNaN(oldValue) && isNaN(newValue))) {
				// Set the backing field value
				obj[this._fieldName] = val;

				obj.meta.pendingInit(this, false);

				// Do not raise change if the property has not been initialized. 
				if (old !== undefined) {
					this.raiseChanged(obj, val, old, additionalArgs);
				}
			}
		}
	}

	Property.mixin({

		defaultValue: function Property$defaultValue(value) {
			this._defaultValue = value;
			return this;
		},

		equals: function Property$equals(prop) {
			if (prop !== undefined && prop !== null) {
				if (prop instanceof Property) {
					return this === prop;
				}
				else if (prop instanceof PropertyChain) {
					var props = prop.all();
					return props.length === 1 && this.equals(props[0]);
				}
			}
		},

		raiseChanged: function (obj, val, old, additionalArgs) {
			// NOTE: property change should be broadcast before rules are run so that if 
			// any rule causes a roundtrip to the server these changes will be available
			this._containingType.model.notifyAfterPropertySet(obj, this, val, old);

			var changedEvent = this._getEventHandler("changed");
			if (changedEvent && !changedEvent.isEmpty()) {
				// Create the event argument object
				var args = { property: this, newValue: val, oldValue: old };

				// Assign custom event argument values
				if (additionalArgs) {
					for (var p in additionalArgs) {
						if (additionalArgs.hasOwnProperty(p)) {
							args[p] = additionalArgs[p];
						}
					}
				}

				changedEvent(obj, args);
			}

			Observer.raisePropertyChanged(obj, this._name);
		},

		rule: function (type) {
			if (type == null) throw new ArgumentNullError("type");
			if (typeof (type) !== "function") throw new ArgumentTypeError("type", "function", type);

			return first(this._rules, function (rule) {
				if (rule instanceof type) {
					return true;
				}
			});
		},
		rules: function (filter) {
			return filter && filter instanceof Function ? this._rules.filter(filter) : this._rules.slice();
		},
		addRuleRegistered: function Property$addRuleRegistered(handler, obj, once) {
			this._addEvent("ruleRegistered", handler, obj ? equals(obj) : null, once);
			return this;
		},
		removeRuleRegistered: function Property$removeRuleRegistered(handler, obj, once) {
			this._removeEvent("ruleRegistered", handler);
			return this;
		},

		toString: function Property$toString() {
			if (this._isStatic) {
				return this.get_path();
			}
			else {
				return $format("this<{0}>.{1}", [this.get_containingType(), this.get_name()]);
			}
		},

		get_containingType: function Property$get_containingType() {
			return this._containingType;
		},
		isDefinedBy: function Property$isDefinedBy(mtype) {
			return this._containingType === mtype || mtype.isSubclassOf(this._containingType);
		},

		get_jstype: function Property$get_jstype() {
			return this._jstype;
		},

		get_index: function Property$get_index() {
			return this._index;
		},

		get_format: function Property$get_format() {
			if (!this._format) {
				if (this._jstype.meta instanceof ExoWeb.Model.Type)
					this._format = this._jstype.meta.get_format(); // Default to type-level formats for entity types
				else
					this._format = getFormat(this._jstype, "G"); // Default to general format for non-entity type
			}
			return this._format;
		},
		set_format: function Property$set_format(value) {
			this._format = getFormat(this._jstype, value);
		},
		format: function (val) {
			return this.get_format() ? this.get_format().convert(val) : val;
		},

		get_defaultValue: function Property$get_defaultValue() {
			// clone array and date defaults since they are mutable javascript types
			return this._defaultValue instanceof Array ? this._defaultValue.slice() :
				this._defaultValue instanceof Date ? new Date(+this._defaultValue) :
					this._defaultValue instanceof TimeSpan ? new TimeSpan(this._defaultValue.totalMilliseconds) :
						this._defaultValue instanceof Function ? this._defaultValue() :
							this._defaultValue;
		},

		get_origin: function Property$get_origin() {
			return this._origin ? this._origin : this._containingType.get_origin();
		},

		get_isEntityType: function Property$get_isEntityType() {
			if (!this.get_jstype().meta) {
				return false;
			}
			return !this._isList;
		},

		get_isEntityListType: function Property$get_isEntityListType() {
			if (!this.get_jstype().meta) {
				return false;
			}
			return this._isList;
		},

		get_isValueType: function Property$get_isValueType() {
			return !this.get_jstype().meta;
		},

		get_isList: function Property$get_isList() {
			return this._isList;
		},

		get_isStatic: function Property$get_isStatic() {
			return this._isStatic;
		},

		get_constant: function Property$get_constant() {
			// initialize and cache the constant value if we have not already
			if (typeof this._constant === "function")
				this._constant = this._constant();
			return this._constant;
		},

		get_isPersisted: function Property$get_isPersisted() {
			return this._isPersisted;
		},

		get_isCalculated: function Property$get_isCalculated() {
			return this._isCalculated;
		},

		get_label: function Property$get_label() {
			return this._label;
		},

		get_helptext: function Property$get_helptext() {
			return this._helptext;
		},

		get_name: function Property$get_name() {
			return this._name;
		},

		get_fieldName: function Property$get_fieldName() {
			return this._fieldName;
		},

		get_path: function Property$get_path() {
			return this._isStatic ? (this._containingType.get_fullName() + "." + this._name) : this._name;
		},

		canSetValue: function Property$canSetValue(obj, val) {
			// NOTE: only allow values of the correct data type to be set in the model

			if (val === undefined) {
				logWarning("You should not set property values to undefined, use null instead: property = ." + this._name + ".");
				return true;
			}

			if (val === null) {
				return true;
			}

			// for entities check base types as well
			if (val.constructor && val.constructor.meta) {
				for (var valType = val.constructor.meta; valType; valType = valType.baseType) {
					if (valType._jstype === this._jstype) {
						return true;
					}
				}

				return false;
			}

			//Data types
			else {
				var valObjectType = val.constructor;

				//"Normalize" data type in case it came from another frame as well as ensure that the types are the same
				switch (type(val)) {
					case "string":
						valObjectType = String;
						break;
					case "number":
						valObjectType = Number;
						break;
					case "boolean":
						valObjectType = Boolean;
						break;
					case "date":
						valObjectType = Date;
						break;
					case "array":
						valObjectType = Array;
						break;
				}

				// value property type check
				return valObjectType === this._jstype ||

					// entity array type check
					(valObjectType === Array && this.get_isList() && val.every(function (child) {
						if (child.constructor && child.constructor.meta) {
							for (var childType = child.constructor.meta; childType; childType = childType.baseType) {
								if (childType._jstype === this._jstype) {
									return true;
								}
							}
						}
						return child.constructor === this._jstype;
					}, this));
			}
		},

		value: function Property$value(obj, val, args) {
			var target = (this._isStatic ? this._containingType.get_jstype() : obj);

			if (target === undefined || target === null) {
				throw new Error($format(
					"Cannot {0} value for {1}static property \"{2}\" on type \"{3}\": target is null or undefined.",
					(arguments.length > 1 ? "set" : "get"), (this._isStatic ? "" : "non-"), this.get_path(), this._containingType.get_fullName()));
			}

			if (arguments.length > 1) {
				Property$_setter.call(this, target, val, false, args);
			}
			else {
				return Property$_getter.call(this, target);
			}
		},

		isInited: function Property$isInited(obj) {
			var target = (this._isStatic ? this._containingType.get_jstype() : obj);
			if (!target.hasOwnProperty(this._fieldName)) {
				// If the backing field has not been created, then property is not initialized
				return false;
			}
			if (this._isList) {
				var value = target[this._fieldName];
				if (value === undefined || !LazyLoader.isLoaded(value)) {
					// If the list is not-loaded, then the property is not initialized
					return false;
				}
			}
			return true;
		},

		// starts listening for get events on the property. Use obj argument to
		// optionally filter the events to a specific object
		addGet: function Property$addGet(handler, obj, once) {
			this._addEvent("get", handler, obj ? equals(obj) : null, once);

			// Return the property to support method chaining
			return this;
		},
		removeGet: function Property$removeGet(handler) {
			this._removeEvent("get", handler);
		},

		// starts listening for change events on the property. Use obj argument to
		// optionally filter the events to a specific object
		addChanged: function Property$addChanged(handler, obj, once) {
			this._addEvent("changed", handler, obj ? equals(obj) : null, once);

			// Return the property to support method chaining
			return this;
		},
		removeChanged: function Property$removeChanged(handler) {
			this._removeEvent("changed", handler);
		},

		firstProperty: function Property$firstProperty() {
			return this;
		},
		lastProperty: function Property$lastProperty() {
			return this;
		},
		properties: function Property$properties() {
			return [this];
		},

		lastTarget: function Property$lastTarget(obj) {
			return obj;
		},

		ifExists: function (path) {
			Model.property(path, this._containingType, true, function (chain) {
				this.calculated({
					basedOn: [path],
					fn: function () {
						return !isNullOrUndefined(chain.value(this));
					}
				});
			}, this);

			return this;
		},

		alias: function (path, eventName) {
			Model.property(path, this._containingType, true, function (chain) {
				this.calculated({
					basedOn: [(eventName ? eventName + " of " : "") + path],
					fn: function () {
						return chain.value(this);
					}
				});
			}, this);

			return this;
		},

		rootedPath: function Property$rootedPath(type) {
			if (this.isDefinedBy(type)) {
				return this._isStatic ? this._containingType.get_fullName() + "." + this._name : this._name;
			}
		},

		label: function (label) {
			this._label = label;
			return this;
		},

		helptext: function (helptext) {
			this._helptext = helptext;
			return this;
		},

		// Adds a rule to the property that will update its value based on a calculation.
		calculated: function (options) {
			options.property = this;
			var definedType = options.rootType ? options.rootType.meta : this._containingType;
			delete options.rootType;

			new CalculatedPropertyRule(definedType, options);

			return this;
		},
		required: function (error) {
			var options = preparePropertyRuleOptions(this, {}, error);
			new ExoWeb.Model.Rule.required(this._containingType, options);
			return this;
		},
		allowedValues: function (source, error) {
			var options = preparePropertyRuleOptions(this, { source: source }, error);
			new ExoWeb.Model.Rule.allowedValues(this._containingType, options);
			return this;
		},
		optionValues: function (source, error) {
			var options = preparePropertyRuleOptions(this, { source: source, onInit: false, onInitNew: false, onInitExisting: false }, error);
			options.ignoreValidation = true;
			new ExoWeb.Model.Rule.allowedValues(this._containingType, options);
			return this;
		},
		compare: function (operator, source, error) {
			var options = preparePropertyRuleOptions(this, { compareOperator: operator, compareSource: source }, error);
			new ExoWeb.Model.Rule.compare(this._containingType, options);
			return this;
		},
		range: function (min, max, error) {
			var options = preparePropertyRuleOptions(this, { min: min, max: max }, error);
			new ExoWeb.Model.Rule.range(this._containingType, options);
			return this;
		},
		conditionIf: function (options, type) {
			var definedType = options.rootType ? options.rootType.meta : this._containingType;
			delete options.rootType;

			options = preparePropertyRuleOptions(this, options, type);
			new ExoWeb.Model.Rule.validated(definedType, options);
			return this;
		},
		errorIf: function (options, error) {
			return this.conditionIf(options, error);
		},
		warningIf: function (options, warning) {
			return this.conditionIf(jQuery.extend(options, { category: ConditionType.Warning }), warning);
		},
		requiredIf: function (source, operator, value, error) {
			if (source.constructor === String) {
				var options = preparePropertyRuleOptions(this, { compareSource: source, compareOperator: operator, compareValue: value }, error);
				new ExoWeb.Model.Rule.requiredIf(this._containingType, options);
			}
			else {
				var definedType = source.rootType ? source.rootType.meta : this._containingType;
				delete source.rootType;
				source = preparePropertyRuleOptions(this, source);

				new ExoWeb.Model.Rule.requiredIf(definedType, source);
			}
			return this;
		},
		stringLength: function (min, max, error) {
			var options = preparePropertyRuleOptions(this, { min: min, max: max }, error);
			new ExoWeb.Model.Rule.stringLength(this._containingType, options);
			return this;
		},
		stringFormat: function (description, expression, reformat, error) {
			var options = preparePropertyRuleOptions(this, { description: description, expression: expression, reformat: reformat }, error);
			new ExoWeb.Model.Rule.stringFormat(this._containingType, options);
			return this;
		},
		listLength: function (options, error) {
			var options = preparePropertyRuleOptions(this, { staticLength: options.staticLength, compareSource: options.compareSource, compareOperator: options.compareOperator }, error);
			new ExoWeb.Model.Rule.listLength(this._containingType, options);
			return this;
		}
	});
	Property.mixin(Functor.eventing);
	ExoWeb.Model.Property = Property;

	// #endregion

	// #region ExoWeb.Model.PathTokens
	//////////////////////////////////////////////////

	function PathTokens(expression) {
	
		// legacy: remove "this." prefix from instance properties
		if (expression.substr(0, 5) === "this.")
			expression = expression.substr(5);

		this.expression = expression;

		// replace "." in type casts so that they do not interfere with splitting path
		expression = expression.replace(/<[^>]*>/ig, function(e) { return e.replace(/\./ig, function() { return "$_$"; }); });

		if (expression.length > 0) {
			this.steps = expression.split(".").map(function (step) {
				// Regex pattern matches all letters and digits that are valid for javascript identifiers, including  "_"
				var parsed = step.match(/^([_0-9a-zA-Z\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02b8\u02bb-\u02c1\u02d0-\u02d1\u02e0-\u02e4\u02ee\u0370-\u0373\u0376-\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0523\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0621-\u064a\u0660-\u0669\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07c0-\u07ea\u07f4-\u07f5\u07fa\u0904-\u0939\u093d\u0950\u0958-\u0961\u0966-\u096f\u0971-\u0972\u097b-\u097f\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09e6-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a66-\u0a6f\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0ae6-\u0aef\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b66-\u0b6f\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0be6-\u0bef\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58-\u0c59\u0c60-\u0c61\u0c66-\u0c6f\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0ce6-\u0cef\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d28\u0d2a-\u0d39\u0d3d\u0d60-\u0d61\u0d66-\u0d6f\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e50-\u0e59\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0ed0-\u0ed9\u0edc-\u0edd\u0f00\u0f20-\u0f29\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8b\u1000-\u102a\u103f-\u1049\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u1090-\u1099\u10a0-\u10c5\u10d0-\u10fa\u10fc\u1100-\u1159\u115f-\u11a2\u11a8-\u11f9\u1200-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u1676\u1681-\u169a\u16a0-\u16ea\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u17e0-\u17e9\u1810-\u1819\u1820-\u1877\u1880-\u18a8\u18aa\u1900-\u191c\u1946-\u196d\u1970-\u1974\u1980-\u19a9\u19c1-\u19c7\u19d0-\u19d9\u1a00-\u1a16\u1b05-\u1b33\u1b45-\u1b4b\u1b50-\u1b59\u1b83-\u1ba0\u1bae-\u1bb9\u1c00-\u1c23\u1c40-\u1c49\u1c4d-\u1c7d\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u2094\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2c6f\u2c71-\u2c7d\u2c80-\u2ce4\u2d00-\u2d25\u2d30-\u2d65\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31b7\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fc3\ua000-\ua48c\ua500-\ua60c\ua610-\ua62b\ua640-\ua65f\ua662-\ua66e\ua680-\ua697\ua722-\ua788\ua78b-\ua78c\ua7fb-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8d0-\ua8d9\ua900-\ua925\ua930-\ua946\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa50-\uaa59\uac00-\ud7a3\uf900-\ufa2d\ufa30-\ufa6a\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]+)(<([_$0-9a-zA-Z\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02b8\u02bb-\u02c1\u02d0-\u02d1\u02e0-\u02e4\u02ee\u0370-\u0373\u0376-\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0523\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0621-\u064a\u0660-\u0669\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07c0-\u07ea\u07f4-\u07f5\u07fa\u0904-\u0939\u093d\u0950\u0958-\u0961\u0966-\u096f\u0971-\u0972\u097b-\u097f\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09e6-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a66-\u0a6f\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0ae6-\u0aef\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b66-\u0b6f\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0be6-\u0bef\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58-\u0c59\u0c60-\u0c61\u0c66-\u0c6f\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0ce6-\u0cef\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d28\u0d2a-\u0d39\u0d3d\u0d60-\u0d61\u0d66-\u0d6f\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e50-\u0e59\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0ed0-\u0ed9\u0edc-\u0edd\u0f00\u0f20-\u0f29\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8b\u1000-\u102a\u103f-\u1049\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u1090-\u1099\u10a0-\u10c5\u10d0-\u10fa\u10fc\u1100-\u1159\u115f-\u11a2\u11a8-\u11f9\u1200-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u1676\u1681-\u169a\u16a0-\u16ea\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u17e0-\u17e9\u1810-\u1819\u1820-\u1877\u1880-\u18a8\u18aa\u1900-\u191c\u1946-\u196d\u1970-\u1974\u1980-\u19a9\u19c1-\u19c7\u19d0-\u19d9\u1a00-\u1a16\u1b05-\u1b33\u1b45-\u1b4b\u1b50-\u1b59\u1b83-\u1ba0\u1bae-\u1bb9\u1c00-\u1c23\u1c40-\u1c49\u1c4d-\u1c7d\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u2094\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2c6f\u2c71-\u2c7d\u2c80-\u2ce4\u2d00-\u2d25\u2d30-\u2d65\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31b7\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fc3\ua000-\ua48c\ua500-\ua60c\ua610-\ua62b\ua640-\ua65f\ua662-\ua66e\ua680-\ua697\ua722-\ua788\ua78b-\ua78c\ua7fb-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8d0-\ua8d9\ua900-\ua925\ua930-\ua946\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa50-\uaa59\uac00-\ud7a3\uf900-\ufa2d\ufa30-\ufa6a\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc$]+)>)?$/i);

				if (!parsed) {
					return null;
				}

				var result = { property: parsed[1] };

				if (parsed[3]) {
					// restore "." in type case expression
					result.cast = parsed[3].replace(/\$_\$/ig, function() { return "."; });
				}

				return result;
			});
		}
		else {
			this.steps = [];
		}
	}

	PathTokens.normalizePaths = function PathTokens$normalizePaths(paths) {
		var result = [];

		if (paths) {
			paths.forEach(function (p) {

				// coerce property and property chains into string paths
				p = p instanceof Property ? p.get_name() :
					p instanceof PropertyChain ? p.get_path() :
					p;

				var stack = [];
				var parent;
				var start = 0;
				var pLen = p.length;

				for (var i = 0; i < pLen; ++i) {
					var c = p.charAt(i);

					if (c === '{' || c === ',' || c === '}') {
						var seg = p.substring(start, i).trim();
						start = i + 1;

						if (c === '{') {
							if (parent) {
								stack.push(parent);
								parent += "." + seg;
							}
							else {
								parent = seg;
							}
						}
						else {   // ',' or '}'
							if (seg.length > 0) {
								result.push(new PathTokens(parent ? parent + "." + seg : seg));
							}

							if (c === '}') {
								parent = (stack.length === 0) ? undefined : stack.pop();
							}
						}
					}
				}

				if (stack.length > 0) {
					throw new Error("Unclosed '{' in path: " + p);
				}

				if (start === 0) {
					result.push(new PathTokens(p.trim()));
				}
			});
		}
		return result;
	};

	PathTokens.mixin({
		buildExpression: function PathTokens$buildExpression() {
			var path = "";
			this.steps.forEach(function(step) {
				path += (path ? "." : "") + step.property + (step.cast ? "<" + step.cast + ">" : "");
			});
			return path;
		},
		toString: function PathTokens$toString() {
			return this.expression;
		}
	});

	ExoWeb.Model.PathTokens = PathTokens;

	// #endregion

	// #region ExoWeb.Model.PropertyChain
	//////////////////////////////////////////////////

	function PropertyChain(rootType, properties, filters) {
		/// <summary>
		/// Encapsulates the logic required to work with a chain of properties and
		/// a root object, allowing interaction with the chain as if it were a 
		/// single property of the root object.
		/// </summary>

		var handlers = null;

		function onStepChanged(priorProp, sender, args) {
			// scan all known objects of this type and raise event for any instance connected
			// to the one that sent the event.
			if (priorProp != undefined) {
				this._rootType.known().forEach(function(known) {
					if (this.connects(known, sender, priorProp)) {
						// Copy the original arguments so that we don't affect other code
						var newArgs = Object.copy(args);

					// Reset property to be the chain, but store the original property as "triggeredBy"
					newArgs.originalSender = sender;
					newArgs.triggeredBy = newArgs.property;
					newArgs.property = this;

						// Call the handler, passing through the arguments
						this._raiseEvent("changed", [known, newArgs]);
					}
				}, this);
			}
			else {
				var newArgs = Object.copy(args);
				// Reset property to be the chain, but store the original property as "triggeredBy"
				newArgs.originalSender = sender;
				newArgs.triggeredBy = newArgs.property;
				newArgs.property = this;

				this._raiseEvent("changed", [sender, newArgs]);
			}
		}

		this._updatePropertyChangeSubscriptions = function() {
			var handler = this._getEventHandler("changed");
			var eventHandlersExist = handler && !handler.isEmpty();
			var subscribedToPropertyChanges = handlers !== null;

			if (!eventHandlersExist && subscribedToPropertyChanges) {
				// If there are no more subscribers then unsubscribe from property-level events
				this._properties.forEach(function(prop, index) {
					var handler = handlers[index];
					prop.removeChanged(handler);
				}, this);
				handlers = null;
			}
			else if (eventHandlersExist && !subscribedToPropertyChanges) {
				// If there are subscribers and we have not subscribed to property-level events, then do so
				handlers = [];
				this._properties.forEach(function(prop, index) {
					var priorProp = (index === 0) ? undefined : this._properties[index - 1];
					var handler = onStepChanged.bind(this).prependArguments(priorProp);
					handlers.push(handler);
					prop.addChanged(handler);
				}, this);
			}
		};

		this._rootType = rootType;
		this._properties = properties;
		this._filters = filters;
	}

	PropertyChain.create = function PropertyChain$create(rootType, pathTokens/*, forceLoadTypes, success, fail*/) {
		/// <summary>
		/// Attempts to synchronously or asynchronously create a property chain for the specified 
		/// root type and path.  Also handles caching of property chains at the type level.
		/// </summary>

		var type = rootType;
		var properties = [];
		var filters = [];
		var filterTypes = [];

		// initialize optional callback arguments
		var forceLoadTypes = arguments.length >= 3 && arguments[2] && arguments[2].constructor === Boolean ? arguments[2] : false;
		var success = arguments.length >= 4 && arguments[3] && arguments[3] instanceof Function ? arguments[3] : null;
		var fail = arguments.length >= 5 && arguments[4] && arguments[4] instanceof Function ?
			arguments[4] : function (error) { if (success) { throw new Error(error); } };

		// process each step in the path either synchronously or asynchronously depending on arguments
		var processStep = function PropertyChain$processStep() {

			// get the next step
			var step = pathTokens.steps.dequeue();
			if (!step) {
				fail($format("Syntax error in property path: {0}", [pathTokens.expression]));

				// return null to indicate that the path is not valid
				return null;
			}

			// get the property for the step 
			var prop = type.property(step.property);
			if (!prop) {
				fail($format("Path '{0}' references an unknown property: {1}.{2}.", [pathTokens.expression, type.get_fullName(), step.property]));

				// return null if the property does not exist
				return null;
			}

			// ensure the property is not static because property chains are not valid for static properties
			if (prop.get_isStatic()) {
				fail($format("Path '{0}' references a static property: {1}.{2}.", [pathTokens.expression, type.get_fullName(), step.property]));

				// return null to indicate that the path references a static property
				return null;
			}

			// store the property for the step
			properties.push(prop);

			// handle optional type filters
			if (step.cast) {

				// determine the filter type
				type = Model.getJsType(step.cast, true).meta;
				if (!type) {
					fail($format("Path '{0}' references an invalid type: {1}", [pathTokens.expression, step.cast]));
					return null;
				}

				var jstype = type.get_jstype();
				filterTypes[properties.length] = jstype;
				filters[properties.length] = function (target) {
					return target instanceof jstype;
				};
			}
			else {
				type = prop.get_jstype().meta;
			}

			// process the next step if not at the end of the path
			if (pathTokens.steps.length > 0) {
				return ensureType(type, forceLoadTypes, processStep);
			}

			// otherwise, create and return the new property chain
			else {

				// processing the path is complete, verify that chain is not zero-length
				if (properties.length === 0) {
					fail($format("PropertyChain cannot be zero-length."));
					return null;
				}

				// ensure filter types on the last step are loaded
				var filterTypeSignal = new Signal("filterType");
				var filterType = filterTypes[properties.length - 1];
				if (filterType) {
					ensureType(filterType.meta, forceLoadTypes, filterTypeSignal.pending(null, null, true));
				}
				var ret;
				filterTypeSignal.waitForAll(function () {
					// create and cache the new property chain
					var chain = new PropertyChain(rootType, properties, filters);
					if (!rootType._chains) {
						rootType._chains = {};
					}
					rootType._chains[pathTokens.expression] = chain;

					// if asynchronous processing was allowed, invoke the success callback
					if (success) {
						success(chain);
					}

					// return the new property chain
					ret = chain;
				}, null, true);
				return ret;
			}
		};

		// begin processing steps in the path
		return ensureType(type, forceLoadTypes, processStep);
	}

	PropertyChain.mixin(Functor.eventing);

	PropertyChain.mixin({
		equals: function PropertyChain$equals(prop) {
			if (prop !== undefined && prop !== null) {
				if (prop instanceof Property) {
					return prop.equals(this);
				}
				else if (prop instanceof PropertyChain) {
					if (prop._properties.length !== this._properties.length) {
						return false;
					}

					for (var i = 0; i < this._properties.length; i++) {
						if (!this._properties[i].equals(prop._properties[i])) {
							return false;
						}
					}

					return true;
				}
			}
		},
		all: function PropertyChain$all() {
			return this._properties;
		},
		append: function PropertyChain$append(prop) {
			Array.addRange(this._properties, prop.all());
		},
		each: function PropertyChain$each(obj, callback, thisPtr, propFilter /*, target, p, lastProp*/) {
			/// <summary>
			/// Iterates over all objects along a property chain starting with the root object (obj).  This
			/// is analogous to the Array forEach function.  The callback may return a Boolean value to indicate 
			/// whether or not to continue iterating.
			/// </summary>
			/// <param name="obj" type="ExoWeb.Model.Entity">
			/// The root object to use in iterating over the chain.
			/// </param>
			/// <param name="callback" type="Function">
			/// The function to invoke at each iteration step.  May return a Boolean value to indicate whether 
			/// or not to continue iterating.
			/// </param>
			/// <param name="propFilter" type="ExoWeb.Model.Property" optional="true">
			/// If specified, only iterates over objects that are RETURNED by the property filter.  In other
			/// words, steps that correspond to a value or values of the chain at a specific property step).
			/// For example, if the chain path is "this.PropA.ListPropB", then...
			///     chain.each(target, callback, null, ListPropB);
			/// ...will iterate the values of the list property only.
			/// </param>

			if (obj == null) throw new ArgumentNullError("obj");
			if (callback == null) throw new ArgumentNullError("callback");
			if (typeof (callback) != "function") throw new ArgumentTypeError("callback", "function", callback);

			// invoke callback on obj first
			var target = arguments[4] || obj;
			var lastProp = arguments[6] || null;
			var props = this._properties.slice(arguments[5] || 0);
			for (var p = arguments[5] || 0; p < this._properties.length; p++) {
				var prop = this._properties[p];
				var isLastProperty = p === this._properties.length - 1;
				var canSkipRemainingProps = isLastProperty || (propFilter && lastProp === propFilter);
				var enableCallback = (!propFilter || lastProp === propFilter);

				if (target instanceof Array) {
					// if the target is a list, invoke the callback once per item in the list
					for (var i = 0; i < target.length; ++i) {
						// take into account any any chain filters along the way
						if (!this._filters[p] || this._filters[p](target[i])) {

							if (enableCallback && callback.call(thisPtr || this, target[i], i, target, prop, p, props) === false) {
								return false;
							}

							if (!canSkipRemainingProps) {
								var targetValue = prop.value(target[i]);
								// continue along the chain for this list item
								if (!targetValue || this.each(obj, callback, thisPtr, propFilter, targetValue, p + 1, prop) === false) {
									return false;
								}
							}
						}
					}
					// subsequent properties already visited in preceding loop
					return true;
				}
				else {
					// return early if the target is filtered and does not match
					if (this._filters[p] && this._filters[p](target) === false) {
						break;
					}

					// take into account any chain filters along the way
					if (enableCallback && callback.call(thisPtr || this, target, -1, null, prop, p, props) === false) {
						return false;
					}
				}

				// if a property filter is used and was just evaluated, stop early
				if (canSkipRemainingProps) {
					break;
				}

				// move to next property in the chain
				target = target[prop._fieldName];

				// break early if the target is undefined
				if (target === undefined || target === null) {
					break;
				}

				lastProp = prop;
			}

			return true;
		},
		get_path: function PropertyChain$get_path() {
			if (!this._path) {
				this._path = this._getPathFromIndex(0);
			}

			return this._path;
		},
		_getPathFromIndex: function PropertyChain$_getPathFromIndex(startIndex) {
			var steps = [];
			if (this._properties[startIndex].get_isStatic()) {
				steps.push(this._properties[startIndex].get_containingType().get_fullName());
			}

			var previousStepType;
			this._properties.slice(startIndex).forEach(function (p, i) {
				if (i !== 0) {
					if (p.get_containingType() !== previousStepType && p.get_containingType().isSubclassOf(previousStepType)) {
						steps[steps.length - 1] = steps[steps.length - 1] + "<" + p.get_containingType().get_fullName() + ">";
					}
				}
				steps.push(p.get_name());
				previousStepType = p.get_jstype().meta;
			});

			return steps.join(".");
		},
		firstProperty: function PropertyChain$firstProperty() {
			return this._properties[0];
		},
		lastProperty: function PropertyChain$lastProperty() {
			return this._properties[this._properties.length - 1];
		},
		properties: function PropertyChain$properties() {
			return this._properties.slice();
		},
		lastTarget: function PropertyChain$lastTarget(obj) {
			for (var p = 0; p < this._properties.length - 1; p++) {
				var prop = this._properties[p];

				// exit early on null or undefined
				if (obj === undefined || obj === null) {
					return obj;
				}

				obj = prop.value(obj);
			}
			return obj;
		},

		prepend: function PropertyChain$prepend(other) {
			var props = other instanceof PropertyChain ? other.all() : [other];

			this._rootType = other.get_containingType();
			Array.prototype.splice.apply(this._properties, [0, 0].concat(props));
		},

		canSetValue: function PropertyChain$canSetValue(obj, value) {
			return this.lastProperty().canSetValue(this.lastTarget(obj), value);
		},

		// Determines if this property chain connects two objects.
		connects: function PropertyChain$connects(fromRoot, toObj, viaProperty) {
			var connected = false;

			// perform simple comparison if no property is defined
			if (!viaProperty) {
				return fromRoot === toObj;
			}

			this.each(fromRoot, function (target) {
				if (target === toObj) {
					connected = true;
					return false;
				}
			}, this, viaProperty);

			return connected;
		},
		rootedPath: function PropertyChain$rootedPath(rootType) {
			for (var i = 0; i < this._properties.length; i++) {
				if (this._properties[i].isDefinedBy(rootType)) {
					var path = this._getPathFromIndex(i);
					return this._properties[i]._isStatic ? this._properties[i].get_containingType().get_fullName() + "." + path : path;
				}
			}
		},
		// starts listening for the get event of the last property in the chain on any known instances. Use obj argument to
		// optionally filter the events to a specific object
		addGet: function PropertyChain$addGet(handler, obj) {
			var chain = this;

			this.lastProperty().addGet(function PropertyChain$_raiseGet(sender, property, value, isInited) {
				handler(sender, chain, value, isInited);
			}, obj);

			// Return the property to support method chaining
			return this;
		},
		removeChanged: function PropertyChain$removeChanged(handler) {
			this._removeEvent("changed", handler);

			this._updatePropertyChangeSubscriptions();
		},
		// starts listening for change events along the property chain on any known instances. Use obj argument to
		// optionally filter the events to a specific object
		addChanged: function PropertyChain$addChanged(handler, obj, once, toleratePartial) {
			var filter = mergeFunctions(

				// Only raise for the given root object if specified
				obj ? equals(obj) : null,

				toleratePartial
					// Ensure that the chain can be accessed without error if toleratePartial is true
					? (function (sender, args) {
						var allCanBeAccessed = true;
						this.each(sender, function (target, targetIndex, targetArray, property, propertyIndex, properties) {
							if (!property.isInited(target)) {
								var propertyGetWouldCauseError = false;
								if (LazyLoader.isRegistered(target)) {
									propertyGetWouldCauseError = true;
								} else if (property.get_isList()) {
									var list = target[property._fieldName];
									if (list && LazyLoader.isRegistered(list)) {
										propertyGetWouldCauseError = true;
									}
								}

								if (propertyGetWouldCauseError) {
									allCanBeAccessed = false;

									// Exit immediately
									return false;
								}
							}
						});
						return allCanBeAccessed;
					}.bind(this))

					// Ensure that the chain is inited from the root if toleratePartial is false
					: this.isInited.bind(this).spliceArguments(1, 1, true),

				{
					// Both filters must pass
					andResults: true
				}

			);

			this._addEvent("changed", handler, filter, once);

			this._updatePropertyChangeSubscriptions();

			// Return the property chain to support method chaining
			return this;
		},
		// Property pass-through methods
		///////////////////////////////////////////////////////////////////////
		get_containingType: function PropertyChain$get_containingType() {
			return this._rootType;
		},
		get_jstype: function PropertyChain$get_jstype() {
			return this.lastProperty().get_jstype();
		},
		get_format: function PropertyChain$get_format() {
			return this.lastProperty().get_format();
		},
		format: function PropertyChain$format(val) {
			return this.lastProperty().format(val);
		},
		get_isList: function PropertyChain$get_isList() {
			return this.lastProperty().get_isList();
		},
		get_isStatic: function PropertyChain$get_isStatic() {
			// TODO
			return this.lastProperty().get_isStatic();
		},
		get_label: function PropertyChain$get_label() {
			return this.lastProperty().get_label();
		},
		get_helptext: function PropertyChain$get_helptext() {
			return this.lastProperty().get_helptext();
		},
		get_name: function PropertyChain$get_name() {
			return this.lastProperty().get_name();
		},
		get_isValueType: function PropertyChain$get_isValueType() {
			return this.lastProperty().get_isValueType();
		},
		get_isEntityType: function PropertyChain$get_isEntityType() {
			return this.lastProperty().get_isEntityType();
		},
		get_isEntityListType: function PropertyChain$get_isEntityListType() {
			return this.lastProperty().get_isEntityListType();
		},
		rules: function (filter) {
			return this.lastProperty().rules(filter);
		},
		value: function PropertyChain$value(obj, val, customInfo) {
			var target = this.lastTarget(obj, true);
			var prop = this.lastProperty();

			if (arguments.length > 1) {
				prop.value(target, val, customInfo);
			}
			else {
				return target ? prop.value(target) : target;
			}
		},
		isInited: function PropertyChain$isInited(obj, enforceCompleteness /*, fromIndex, fromProp*/) {
			/// <summary>
			/// Determines if the property chain is initialized, akin to single Property initialization.
			/// </summary>
			var allInited = true, initedProperties = [], fromIndex = arguments[2] || 0, fromProp = arguments[3] || null, expectedProps = this._properties.length - fromIndex;

			this.each(obj, function(target, targetIndex, targetArray, property, propertyIndex, properties) {
				if (targetArray && enforceCompleteness) {
					if (targetArray.every(function(item) { return this.isInited(item, true, propertyIndex, properties[propertyIndex - 1]); }, this)) {
						Array.prototype.push.apply(initedProperties, properties.slice(propertyIndex));
					}
					else {
						allInited = false;
					}

					// Stop iterating at an array value
					return false;
				}
				else {
					if (!targetArray || targetIndex === 0) {
						initedProperties.push(property);
					}
					if (!property.isInited(target)) {
						initedProperties.remove(property);
						allInited = false;

						// Exit immediately since chain is not inited
						return false;
					}
				}
			}, this, null, obj, fromIndex, fromProp);

			return allInited && (!enforceCompleteness || initedProperties.length === expectedProps);
		},
		toString: function PropertyChain$toString() {
			if (this._isStatic) {
				return this.get_path();
			}
			else {
				var path = this._properties.map(function (e) { return e.get_name(); }).join(".");
				return $format("this<{0}>.{1}", [this.get_containingType(), path]);
			}
		}
	});

	ExoWeb.Model.PropertyChain = PropertyChain;

	// #endregion

	// #region ExoWeb.Model.ObjectMeta
	//////////////////////////////////////////////////

	function ObjectMeta(type, obj) {
		this._obj = obj;
		this.type = type;
		this._conditions = {};
		this._pendingInit = {};
		this._pendingInvocation = [];
	}

	ObjectMeta.mixin({

		get_entity: function () {
			return this._obj;
		},

		// gets the property or property chain for the specified property path
		property: function ObjectMeta$property(propName, thisOnly) {
			return this.type.property(propName, thisOnly);
		},

		// gets and optionally sets the pending initialization status for a property on the current instance
		pendingInvocation: function ObjectMeta$pendingInvocation(rule, value) {
			var indexOfRule = this._pendingInvocation.indexOf(rule);
			if (arguments.length > 1) {
				if (value && indexOfRule < 0) {
					this._pendingInvocation.push(rule);
				}
				else if (!value && indexOfRule >= 0) {
					this._pendingInvocation.splice(indexOfRule, 1);
				}
			}
			return indexOfRule >= 0;
		},

		// gets and optionally sets the pending initialization status for a property on the current instance
		pendingInit: function ObjectMeta$pendingInit(prop, value) {
			var result = this._obj[prop._fieldName] === undefined || this._pendingInit[prop.get_name()] === true;
			if (arguments.length > 1) {
				if (value) {
					this._pendingInit[prop.get_name()] = true;
				}
				else {
					delete this._pendingInit[prop.get_name()];
				}
			}
			return result;
		},

		// gets the condition target with the specified condition type
		getCondition: function ObjectMeta$getCondition(conditionType) {
			return this._conditions[conditionType.code];
		},

		// stores the condition target for the current instance
		setCondition: function ObjectMeta$setCondition(conditionTarget) {
			if (conditionTarget.condition.type != formatConditionType) {
				this._conditions[conditionTarget.condition.type.code] = conditionTarget;
			}
		},

		// clears the condition for the current instance with the specified condition type
		clearCondition: function ObjectMeta$clearCondition(conditionType) {
			delete this._conditions[conditionType.code];
		},

		// determines if the set of permissions are allowed for the current instance
		isAllowed: function ObjectMeta$isAllowed(/*codes*/) {
			if (arguments.length === 0) {
				return undefined;
			}

			// ensure each condition type is allowed for the current instance
			for (var c = arguments.length - 1; c >= 0; c--) {
				var code = arguments[c];
				var conditionType = ConditionType.get(code);

				// return undefined if the condition type does not exist
				if (conditionType === undefined) {
					return undefined;
				}

				// throw an exception if the condition type is not a permission
				if (!(conditionType instanceof ConditionType.Permission)) {
					throw new Error("Condition type \"" + code + "\" should be a Permission.");
				}

				// return false if a condition of the current type exists and is a deny permission or does not exist and is a grant permission
				if (this._conditions[conditionType.code] ? !conditionType.isAllowed : conditionType.isAllowed) {
					return false;
				}
			}

			return true;
		},

		// determines whether the instance and optionally the specified property value is loaded
		isLoaded: function ObjectMeta$isLoaded(prop) {
			/// <summary locid="M:J#ExoWeb.Model.ObjectMeta.isLoaded">
			/// Check whether the instance and optional property are loaded.
			/// </summary>
			/// <param name="prop" optional="true" mayBeNull="true" type="Object">The optional property object or property name to check.</param>

			// First see if there is a lazy loader attached to the entity (and optional property).
			if (LazyLoader.isRegistered(this._obj, null, prop)) {
				return false;
			}

			// Immediately return true if a property name was not specified
			if (prop) {
				// Coerce property names into property instances
				if (isString(prop)) {
					var name = prop;
					prop = this.property(prop, true);
				
					if (!prop) {
						throw new Error("Could not find property \"" + name + "\" on type \"" + this.type.get_fullName() + "\".");
					}
				}

				// Otherwise, get the property value and determine whether there is a
				// lazy loader attached to the property value, e.g. entity or list.
				var val = prop.value(this._obj);
				if (val !== null && val !== undefined && LazyLoader.isRegistered(val)) {
					return false;
				}
			}

			return true;
		},

		// get some or all of the condition
		conditions: function ObjectMeta$conditions(criteria) {

			// condition type filter
			if (criteria instanceof ConditionType) {
				var conditionTarget = this._conditions[criteria.code];
				return conditionTarget ? [conditionTarget.condition] : [];
			}

			// property filter
			if (criteria instanceof Property || criteria instanceof PropertyChain) {
				criteria = criteria.lastProperty();
				var result = [];
				for (var type in this._conditions) {
					var conditionTarget = this._conditions[type];
					if (conditionTarget.properties.some(function (p) { return p.equals(criteria); })) {
						result.push(conditionTarget.condition);
					}
				}
				return result;
			}

			// otherwise, just return all conditions
			var result = [];
			for (var type in this._conditions) {
				result.push(this._conditions[type].condition);
			}
			return result;
		},
		destroy: function () {
			this.type.unregister(this._obj);
		},
		// starts listening for change events on the conditions array. Use obj argument to
		// optionally filter the events to a specific condition type by passing either
		// the condition type code or type itself.
		addConditionsChanged: function ObjectMeta$addConditionsChanged(handler, criteria) {
			var filter;

			// condition type filter
			if (criteria instanceof ConditionType) {
				filter = function (sender, args) { return args.conditionTarget.condition.type === criteria; };
			}

			// property filter
			else if (criteria instanceof Property || criteria instanceof PropertyChain) {
				criteria = criteria.lastProperty();
				filter = function (sender, args) { return args.conditionTarget.properties.indexOf(criteria) >= 0; };
			}

			// subscribe to the event
			this._addEvent("conditionsChanged", handler, filter);

			// Return the object meta to support method chaining
			return this;
		},
		removeConditionsChanged: function ObjectMeta$removeConditionsChanged(handler) {
			this._removeEvent("conditionsChanged", handler);
		}
	});

	ObjectMeta.mixin(Functor.eventing);
	ExoWeb.Model.ObjectMeta = ObjectMeta;

	// #endregion

	// #region ExoWeb.Model.RuleInvocationType
	//////////////////////////////////////////////////

	var RuleInvocationType = {

		/// <summary>
		/// Occurs when an existing instance is initialized.
		/// </summary>
		InitExisting: 2,

		/// <summary>
		/// Occurs when a new instance is initialized.
		/// </summary>
		InitNew: 4,

		/// <summary>
		/// Occurs when a property value is retrieved.
		/// </summary>
		PropertyGet: 8,

		/// <summary>
		/// Occurs when a property value is changed.
		/// </summary>
		PropertyChanged: 16
	}

	// #endregion

	// #region ExoWeb.Model.Rule
	//////////////////////////////////////////////////

	var customRuleIndex = 0;

	function Rule(rootType, options) {
		/// <summary>Creates a rule that executes a delegate when specified model events occur.</summary>
		/// <param name="rootType" type="Type">The model type the rule is for.</param>
		/// <param name="options" type="Object">
		///		The options for the rule, including:
		///			name:				the optional unique name of the type of validation rule
		///			execute:			a function to execute when the rule is triggered
		///			onInit:				true to indicate the rule should run when an instance of the root type is initialized, otherwise false
		///			onInitNew:			true to indicate the rule should run when a new instance of the root type is initialized, otherwise false
		///			onInitExisting:		true to indicate the rule should run when an existing instance of the root type is initialized, otherwise false
		///			onChangeOf:			an array of property paths (strings, Property or PropertyChain instances) that drive when the rule should execute due to property changes
		///			returns:			an array of properties (string name or Property instance) that the rule is responsible to calculating the value of
		/// </param>
		/// <returns type="Rule">The new rule.</returns>

		// exit immediately if called with no arguments
		if (arguments.length === 0) {
			return;
		}

		// ensure a valid root type was provided
		if (!(rootType instanceof ExoWeb.Model.Type)) {
			if (rootType && rootType.meta) {
				rootType = rootType.meta;
			}
			else {
				throw new Error("A value root model type must be specified when constructing rules.");
			}
		}

		// store the initialization options for processing during registration
		if (options) {
			if (options instanceof Function) {
				this._options = {
					name: rootType.get_fullName() + ".Custom." + (++customRuleIndex),
					execute: function (obj) {
						// use the root object as this
						return options.apply(obj, arguments);
					}
				};
			}
			else {
				this._options = options;
				if (!this._options.name) {
					this._options.name = rootType.get_fullName() + ".Custom." + (++customRuleIndex);
				}
			}
		}
		else {
			this._options = {
				name: rootType.get_fullName() + ".Custom." + (++customRuleIndex)
			};
		}
	
		// explicitly override execute if specified
		if (this._options.execute instanceof Function) {
			this.execute = this._options.execute;
		}

		// define properties for the rule
		Object.defineProperty(this, "rootType", { value: rootType });
		Object.defineProperty(this, "name", { value: this._options.name });
		Object.defineProperty(this, "invocationTypes", { value: 0, writable: true });
		Object.defineProperty(this, "predicates", { value: [], writable: true });
		Object.defineProperty(this, "returnValues", { value: [], writable: true });
		Object.defineProperty(this, "isRegistered", { value: false, writable: true });

		// register the rule after loading has completed
		rootType.model.registerRule(this);
	}

	// base rule implementation
	Rule.mixin({

		// indicates that the rule should run only for new instances when initialized
		onInitNew: function () {

			// ensure the rule has not already been registered
			if (!this._options) {
				//throw new Error("Rules cannot be configured once they have been registered: " + this.name);
				return this;
			}

			// configure the rule to run on init new
			this.invocationTypes |= RuleInvocationType.InitNew;
			return this;
		},

		// indicates that the rule should run only for existing instances when initialized
		onInitExisting: function () {

			// ensure the rule has not already been registered
			if (!this._options) {
				//throw new Error("Rules cannot be configured once they have been registered: " + this.name);
				return this;
			}

			// configure the rule to run on init existingh
			this.invocationTypes |= RuleInvocationType.InitExisting;
			return this;
		},

		// indicates that the rule should run for both new and existing instances when initialized
		onInit: function () {

			// ensure the rule has not already been registered
			if (!this._options) {
				//throw new Error("Rules cannot be configured once they have been registered: " + this.name);
				return this;
			}

			// configure the rule to run on both init new and init existing
			this.invocationTypes |= RuleInvocationType.InitNew | RuleInvocationType.InitExisting;
			return this;
		},

		// indicates that the rule should automatically run when one of the specified property paths changes
		// predicates:  an array of property paths (strings, Property or PropertyChain instances) that drive when the rule should execute due to property changes
		onChangeOf: function (predicates) {

			// ensure the rule has not already been registered
			if (!this._options) {
				//throw new Error("Rules cannot be configured once they have been registered: " + this.name);
				return this;
			}

			// allow change of predicates to be specified as a parameter array without []'s
			if (predicates && predicates.constructor === String) {
				predicates = Array.prototype.slice.call(arguments);
			}

			// add to the set of existing change predicates
			this.predicates = this.predicates.length > 0 ? this.predicates.concat(predicates) : predicates;

			// also configure the rule to run on property change unless it has already been configured to run on property get
			if ((this.invocationTypes & RuleInvocationType.PropertyGet) === 0) {
				this.invocationTypes |= RuleInvocationType.PropertyChanged;
			}
			return this;
		},

		// indicates that the rule is responsible for calculating and returning values of one or more properties on the root type
		// properties:	an array of properties (string name or Property instance) that the rule is responsible to calculating the value of
		returns: function (properties) {
			if (!this._options) {
				//throw new Error("Rules cannot be configured once they have been registered: " + this.name);
				return this;
			}
			// allow return properties to be specified as a parameter array without []'s
			if (properties && properties.constructor === String) {
				properties = Array.prototype.slice.call(arguments);
			}
			if (!properties) {
				throw new Error("Rule must specify at least 1 property for returns.");
			}

			// add to the set of existing return value properties
			this.returnValues = this.returnValues.length > 0 ? this.returnValues.concat(properties) : properties;

			// configure the rule to run on property get and not on property change
			this.invocationTypes |= RuleInvocationType.PropertyGet;
			this.invocationTypes &= ~RuleInvocationType.PropertyChanged;
			return this;
		},

		// registers the rule based on the configured invocation types, predicates, and return values
		register: function Rule$register() {

			// create a scope variable to reference the current rule when creating event handlers
			var rule = this;

			// track the rule with the root type
			this.rootType.rules.push(this);

			// create a function to process the rule's options
			var processOptions = function () {
				// configure the rule based on any specified options
				if (this._options) {
					if (this._options.onInit)
						this.onInit();
					if (this._options.onInitNew)
						this.onInitNew();
					if (this._options.onInitExisting)
						this.onInitExisting();
					if (this._options.onChangeOf)
						this.onChangeOf(this._options.onChangeOf);
					if (this._options.returns)
						this.returns(this._options.returns);

					// legacy support for basedOn option syntax
					if (this._options.basedOn) {
						this._options.basedOn.forEach(function (input) {
							var parts = input.split(" of ");
							if (parts.length >= 2) {
								if (parts[0].split(",").indexOf("change") >= 0) {
									this.onChangeOf([parts[1]]);
								}
							}
							else {
								this.onChangeOf(input);
							}
						}, this);
					}
				}

				// indicate that the rule should now be considered registered and cannot be reconfigured
				delete this._options;
			}

			// create a function to determine whether the rule can execute for the given arguments
			var canExecute = function(obj, args) {
				// ensure the rule target is a valid rule root type
				return obj instanceof rule.rootType.get_jstype();
			};

			// create a function to safely execute the rule
			var execute = function (obj, args) {
				// Ensure that the rule can be executed.
				if (!canExecute.call(this, obj, args)) return;

				EventScope$perform(function() {
					if (window.ExoWeb.config.detectRunawayRules) {
						if (currentEventScope.parent && currentEventScope.parent._exitEventVersion) {
							// Determine the maximum number nested calls to EventScope$perform
							// before considering a rule to be a "runaway" rule. 
							var maxNesting;
							if (typeof window.ExoWeb.config.nonExitingScopeNestingCount === "number") {
								maxNesting = window.ExoWeb.config.nonExitingScopeNestingCount - 1;
							} else {
								maxNesting = 99;
							}

							if (currentEventScope.parent._exitEventVersion > maxNesting) {
								logWarning("Aborting rule '" + rule.name + "'.");
								return;
							}
						}
					}

					rule.execute.call(rule, obj, args);
				});
			};

			// create function to perform rule registration once predicates and return values have been prepared
			var register = function () {

				// register for init new
				if (this.invocationTypes & RuleInvocationType.InitNew) {
					this.rootType.addInitNew(function (sender, args) {
						execute.call(this, sender, args);
					});
				}

				// register for init existing
				if (this.invocationTypes & RuleInvocationType.InitExisting) {
					this.rootType.addInitExisting(function (sender, args) {
						execute.call(this, sender, args);
					});
				}

				// register for property change
				if (this.invocationTypes & RuleInvocationType.PropertyChanged) {
					this.predicates.forEach(function (predicate) {
						predicate.addChanged(
							function (sender, args) {
								if (canExecute.call(this, sender, args) && !sender.meta.pendingInvocation(rule)) {
									sender.meta.pendingInvocation(rule, true);
									EventScope$onExit(function() {
										sender.meta.pendingInvocation(rule, false);
										execute.call(this, sender, args);
									});
									EventScope$onAbort(function() {
										sender.meta.pendingInvocation(rule, false);
									});
								}
							},
							null, // no object filter
							false, // subscribe for all time, not once
							true // tolerate nulls since rule execution logic will handle guard conditions
						);
					});
				}

				// register for property get
				if (this.invocationTypes & RuleInvocationType.PropertyGet && this.returnValues) {

					// register for property get events for each return value to calculate the property when accessed
					this.returnValues.forEach(function (returnValue) {
						returnValue.addGet(function (sender, args) {

							// run the rule to initialize the property if it is pending initialization
							if (canExecute.call(this, sender, args) && sender.meta.pendingInit(returnValue)) {
								sender.meta.pendingInit(returnValue, false);
								execute.call(this, sender, args);
							}
						});
					});

					// register for property change events for each predicate to invalidate the property value when inputs change
					this.predicates.forEach(function (predicate) {
						predicate.addChanged(
							function (sender, args) {

								// immediately execute the rule if there are explicit event subscriptions for the property
								if (rule.returnValues.some(function (returnValue) { return hasPropertyChangedSubscribers(returnValue, sender); })) {
									if (canExecute.call(this, sender, args) && !sender.meta.pendingInvocation(rule)) {
										sender.meta.pendingInvocation(rule, true);
										EventScope$onExit(function() {
											sender.meta.pendingInvocation(rule, false);
											execute.call(this, sender, args);
										});
										EventScope$onAbort(function() {
											sender.meta.pendingInvocation(rule, false);
										});
									}
								}

								// Otherwise, just mark the property as pending initialization and raise property change for UI subscribers
								else {
									rule.returnValues.forEach(function (returnValue) {
										sender.meta.pendingInit(returnValue, true);
									});
									// Defer change notification until the scope of work has completed
									EventScope$onExit(function () {
										rule.returnValues.forEach(function (returnValue) { 
											Observer.raisePropertyChanged(sender, returnValue.get_name());
										});
									}, this);
								}
							},
							null, // no object filter
							false, // subscribe for all time, not once
							true // tolerate nulls since rule execution logic will handle guard conditions
						);
					});
				}

				// allow rule subclasses to perform final initialization when registered
				if (this.onRegister instanceof Function) {
					this.onRegister();
				}

				// Mark the rule as successfully registered
				this.isRegistered = true;
			};

			// create a function to kick off the registration process
			var startRegister = function () {
				// process the rule options, this is only done once
				processOptions.call(this);

				// resolve return values, which should all be loaded since the root type is now definitely loaded
				if (this.returnValues) {
					this.returnValues.forEach(function (returnValue, i) {
						if (!(returnValue instanceof Property)) {
							this.returnValues[i] = this.rootType.property(returnValue);
						}
					}, this);
				}

				// resolve all predicates, because the rule cannot run until the dependent types have all been loaded
				if (this.predicates) {
					var signal;
					var predicates = [];

					// setup loading of each property path that the calculation is based on
					this.predicates.forEach(function (predicate, i) {

						// simply copy the predicate over if has already a valid property or property chain
						if (predicate instanceof Property || predicate instanceof PropertyChain) {
							predicates.push(predicate);
						}

						// parse string inputs, which may be paths containing nesting {} hierarchial syntax
						else if (predicate.constructor === String) {

							// create a signal if this is the first string-based input
							if (!signal) {
								signal = new Signal("prepare rule predicates");
							}

							// normalize the paths to accommodate {} hierarchial syntax
							PathTokens.normalizePaths([predicate]).forEach(function (path) {
								Model.property(path, this.rootType, false, signal.pending(function (chain) {
									// add the prepared property or property chain
									predicates.push(chain);
								}, this, true), this);
							}, this);
						}
					}, this);

					// wait until all property information is available to initialize the rule
					if (signal) {
						signal.waitForAll(function () {
							this.predicates = predicates;
							register.call(this);
						}, this, true);
					}

					// otherwise, just immediately proceed with rule registration
					else {
						this.predicates = predicates;
						register.call(this);
					}
				}
			};

			// Optionally perform async pre-registration logic, then kick off the registration process
			if (this.preRegister) {
				// Invoke the rule's pre-register logic if it exists
				if (this.preRegister(function () { startRegister.call(this); }, this) === false) {
					startRegister.call(this);
				}
			} else {
				startRegister.call(this);
			}
		}
	});

	// creates a condition type for the specified rule and type or property, of the specified category type (usually Error or Warning)
	Rule.ensureConditionType = function Rule$ensureConditionType(ruleName, typeOrProp, category, sets) {
		var generatedCode =
			typeOrProp instanceof Property ? $format("{0}.{1}.{2}", [typeOrProp.get_containingType().get_fullName(), typeOrProp.get_name(), ruleName]) :
			typeOrProp instanceof Type ? $format("{0}.{1}", [typeOrProp.get_fullName(), ruleName]) : 
			ruleName;
		var counter = "";

		while (ConditionType.get(generatedCode + counter))
			counter++;

		// return a new client condition type of the specified category
		return new category(generatedCode + counter, $format("Generated condition type for {0} rule.", [ruleName]), null, "client");
	};

	// creates an error for the specified rule and type or property
	Rule.ensureError = function Rule$ensureError(ruleName, typeOrProp, sets) {
		return Rule.ensureConditionType(ruleName, typeOrProp, ConditionType.Error, sets);
	};

	// creates an error for the specified rule and type or property
	Rule.ensureWarning = function Rule$ensureWarning(ruleName, typeOrProp, sets) {
		return Rule.ensureConditionType(ruleName, typeOrProp, ConditionType.Warning, sets);
	};

	// publicly expose the rule
	ExoWeb.Model.Rule = Rule;

	// #endregion

	// #region ExoWeb.Model.RuleInput
	//////////////////////////////////////////////////

	function RuleInput(property) {
		this.property = property;
	}

	RuleInput.prototype = {
		set_dependsOnInit: function RuleInput$set_dependsOnInit(value) {
			this._init = value;
		},
		get_dependsOnInit: function RuleInput$get_dependsOnInit() {
			return this._init === undefined ? false : this._init;
		},
		set_dependsOnChange: function RuleInput$set_dependsOnChange(value) {
			this._change = value;
		},
		get_dependsOnChange: function RuleInput$get_dependsOnChange() {
			return this._change === undefined ? true : this._change;
		},
		set_dependsOnGet: function RuleInput$set_dependsOnGet(value) {
			this._get = value;
		},
		get_dependsOnGet: function RuleInput$get_dependsOnGet() {
			return this._get === undefined ? false : this._get;
		},
		get_isTarget: function RuleInput$get_isTarget() {
			return this._isTarget === undefined ? false : this._isTarget;
		},
		set_isTarget: function RuleInput$set_isTarget(value) {
			this._isTarget = value;
		}
	};
	ExoWeb.Model.RuleInput = RuleInput;

	// #endregion

	// #region ExoWeb.Model.ConditionRule
	//////////////////////////////////////////////////

	function ConditionRule(rootType, options) {
		/// <summary>Creates a rule that asserts a condition based on a predicate.</summary>
		/// <param name="rootType" type="Type">The model type the rule is for.</param>
		/// <param name="options" type="Object">
		///		The options for the rule, including:
		///			assert:				a predicate that returns true when the condition should be asserted
		///			name:				the optional unique name of the type of rule
		///			conditionType:		the optional condition type to use, which will be automatically created if not specified
		///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
		///			message:			the message to show the user when the validation fails
		///			properties:			an array of property paths the validation condition should be attached to when asserted, in addition to the target property
		///			sets:				the optional array of condition type sets to associate the condition with
		///			onInit:				true to indicate the rule should run when an instance of the root type is initialized, otherwise false
		///			onInitNew:			true to indicate the rule should run when a new instance of the root type is initialized, otherwise false
		///			onInitExisting:		true to indicate the rule should run when an existing instance of the root type is initialized, otherwise false
		///			onChangeOf:			an array of property paths (strings, Property or PropertyChain instances) that drive when the rule should execute due to property changes
		/// </param>
		/// <returns type="ConditionRule">The new condition rule.</returns>

		// exit immediately if called with no arguments
		if (arguments.length === 0) return;

		// ensure the rule name is specified
		options.name = options.name || "Condition";

		// store the condition predicate
		var assert = options.assert || options.fn;
		if (assert) {
			this.assert = assert;
		}

		// automatically run the condition rule during initialization of new instances
		if (!options.hasOwnProperty("onInitNew")) {
			options.onInitNew = true;
		}

		// coerce string to condition type
		var conditionType = options.conditionType;
		if (isString(conditionType)) {
			conditionType = ConditionType.get(conditionType);
		}

		// create a condition type if not passed in, defaulting to Error if a condition category was not specified
		Object.defineProperty(this, "conditionType", { 
			value: conditionType || Rule.ensureConditionType(options.name, rootType, options.category || ConditionType.Error, options.sets)
		});

		// automatically run the condition rule during initialization of existing instances if the condition type was defined on the client
		if (!options.hasOwnProperty("onInitExisting") && this.conditionType.origin !== "server") {
			options.onInitExisting = true;
		}

		// store the condition message and properties
		if (options.message) {
			Object.defineProperty(this, "message", { value: options.message, writable: true });
		}
		if (options.properties) {
			Object.defineProperty(this, "properties", { value: options.properties, writable: true });
		}

		// Call the base rule constructor
		Rule.apply(this, [rootType, options]);
	}

	// setup the inheritance chain
	ConditionRule.prototype = new Rule();
	ConditionRule.prototype.constructor = ConditionRule;

	// implement the execute method
	ConditionRule.mixin({

		// subclasses may override this function to return the set of properties to attach conditions to for this rule
		properties: function ConditionRule$properties() {
			return this.hasOwnProperty("properties") ? this.properties : [];
		},

		// subclasses may override this function to calculate an appropriate message for this rule during the registration process
		message: function ConditionRule$message() {
			return this.conditionType.message;
		},

		// subclasses may override this function to indicate whether the condition should be asserted
		assert: function ConditionRule$assert(obj) {
			throw new Error("ConditionRule.assert() must be passed into the constructor or overriden by subclasses.");
		},

		// asserts the condition and adds or removes it from the model if necessary
		execute: function ConditionRule$execute(obj, args) {

			var assert;

			// call assert the root object as "this" if the assertion function was overriden in the constructor
			if (this.hasOwnProperty("assert")) {

				// convert string functions into compiled functions on first execution
				if (this.assert.constructor === String) {
					this.assert = this.rootType.compileExpression(this.assert);
				}
				assert = this.assert.call(obj, obj, args);
			}

			// otherwise, allow "this" to be the current rule to support subclasses that override assert
			else {
				assert = this.assert(obj);
			}

			var message = this.message;
			if (message instanceof Function) {
				if (this.hasOwnProperty("message")) {
					// When message is overriden, use the root object as this
					message = message.bind(obj);
				}
				else {
					message = message.bind(this);
				}
			}

			// create or remove the condition if necessary
			if (assert !== undefined) {
				this.conditionType.when(assert, obj,
						this.properties instanceof Function ? this.properties(obj) : this.properties,
						message);
			}
		},
	
		// gets the string representation of the condition rule
		toString: function () {
			return this.message || this.conditionType.message;
		}
	});

	// expose the rule publicly
	Rule.condition = ConditionRule;
	ExoWeb.Model.ConditionRule = ConditionRule;

	// #endregion

	// #region ExoWeb.Model.ValidatedPropertyRule
	//////////////////////////////////////////////////

	function ValidatedPropertyRule(rootType, options) {
		/// <summary>Creates a rule that validates the value of a property in the model.</summary>
		/// <param name="rootType" type="Type">The model type the rule is for.</param>
		/// <param name="options" type="Object">
		///		The options for the rule, including:
		///			property:			the property being validated (either a Property instance or string property name)
		///			isValid:			function (obj, prop, val) { return true; } (a predicate that returns true when the property is valid)
		///			name:				the optional unique name of the type of validation rule
		///			conditionType:		the optional condition type to use, which will be automatically created if not specified
		///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
		///			message:			the message to show the user when the validation fails	
		///			properties:			an array of property paths the validation condition should be attached to when asserted, in addition to the target property
		///			onInit:				true to indicate the rule should run when an instance of the root type is initialized, otherwise false
		///			onInitNew:			true to indicate the rule should run when a new instance of the root type is initialized, otherwise false
		///			onInitExisting:		true to indicate the rule should run when an existing instance of the root type is initialized, otherwise false
		///			onChangeOf:			an array of property paths (strings, Property or PropertyChain instances) that drive when the rule should execute due to property changes
		/// </param>
		/// <returns type="ValidatedPropertyRule">The new validated property rule.</returns>

		// exit immediately if called with no arguments
		if (arguments.length == 0) return;

		// ensure the rule name is specified
		options.name = options.name || "ValidatedProperty";

		// store the property being validated
		var prop = options.property instanceof Property ? options.property : rootType.property(options.property);
		Object.defineProperty(this, "property", { value: prop });

		// override the prototype isValid function if specified
		if (options.isValid instanceof Function) {
			this.isValid = options.isValid;
		}

		// ensure the properties and predicates to include the target property
		if (!options.properties) {
			options.properties = [prop.get_name()];
		}
		else if (options.properties.indexOf(prop.get_name()) < 0 && options.properties.indexOf(prop) < 0) {
			options.properties.push(prop.get_name());
		}
		if (!options.onChangeOf) {
			options.onChangeOf = [prop];
		}
		else if (options.onChangeOf.indexOf(prop.get_name()) < 0 && options.onChangeOf.indexOf(prop) < 0) {
			options.onChangeOf.push(prop);
		}

		// create a property specified condition type if not passed in, defaulting to Error if a condition category was not specified
		options.conditionType = options.conditionType || Rule.ensureConditionType(options.name, this.property, options.category || ConditionType.Error);

		// Replace the property label token in the validation message if present
		if (options.message) {
			var rule = this;
			var message = options.message;
			var hasTokens = Format.hasTokens(prop.get_label());
		
			if (typeof (message) === "function") {
				// Create a function to apply the format to the property label when generating the message
				options.message = function (obj) {
					var messageTemplate = message.apply(this, [obj]);
					return messageTemplate.replace("{property}", hasTokens ? rule.getPropertyLabelFormat().convert(this) : prop.get_label());
				};
			}
			else if (typeof (message) === "string" && hasTokens) {
				// Create a function to apply the format to the property label when generating the message
				options.message = function (obj) {
					return message.replace("{property}", rule.getPropertyLabelFormat().convert(this));
				};
			}
			else {
				var label = prop.get_label();
				// Escaped unescaped quotes
				if (label.indexOf("\"") >= 0) {
					var text = ""; var prev = "";
					label.split("").forEach(function (c) {
						if (c === "\"" && prev !== "\\")
							text += "\\" + c;
						else
							text += c;
						prev = c;
					});
					label = text;
				}
				options.message = message.replace('{property}', label);
			}
		}

		// call the base rule constructor
		ConditionRule.apply(this, [rootType, options]);
	}

	// setup the inheritance chain
	ValidatedPropertyRule.prototype = new ConditionRule();
	ValidatedPropertyRule.prototype.constructor = ValidatedPropertyRule;

	// extend the base type
	ValidatedPropertyRule.mixin({

		// returns false if the property is valid, true if invalid, or undefined if unknown
		assert: function ValidatedPropertyRule$assert(obj) {

			var isValid = this.isValid(obj, this.property, this.property.value(obj));
			return isValid === undefined ? isValid : !isValid;
		},

		// perform addition initialization of the rule when it is registered
		onRegister: function () {

			// register the rule with the target property
			registerPropertyRule(this.property, this);
		},

		getPropertyLabelFormat: function () {
			// convert the property label into a model format
			if (!this._propertyLabelFormat)
				this._propertyLabelFormat = ExoWeb.Model.getFormat(this.rootType.get_jstype(), this.property.get_label());
			return this._propertyLabelFormat;
		},

		getPropertyLabel: function (obj) {
			if (Format.hasTokens(this.property.get_label())) {
				return this.getPropertyLabelFormat().convert(obj);
			} else {
				return this.property.get_label();
			}
		},

		preRegister: function (callback, thisPtr) {
			// Exit if the rule is no tin a valid state
			if (!this.rootType) {
				return false;
			}

			// Exit if the property label does not contain tokens
			if (!Format.hasTokens(this.property.get_label())) {
				return false;
			}

			var registerFormatPaths = function (formatPaths) {
				if (formatPaths.length <= 0)
					return;

				if (!this._options)
					this._options = {};

				if (!this._options.onChangeOf)
					this._options.onChangeOf = [];

				formatPaths.forEach(function (p) {
					this.rootType.getPaths(p).forEach(function(prop) {
						if (this._options.onChangeOf.indexOf(prop) < 0) {
							if (typeof this._options.onChangeOf === "string")
								this._options.onChangeOf = [this._options.onChangeOf];

							this._options.onChangeOf.push(prop);
						}
					}, this);
				}, this);
			};

			// Ensure tokens included in the format trigger rule execution
			if (callback && callback instanceof Function) {
				this.getPropertyLabelFormat().getPaths(function (formatPaths) {
					registerFormatPaths.call(this, formatPaths);
					callback.call(thisPtr || this);
				}, this);
			} else {
				var formatPaths = this.getPropertyLabelFormat().getPaths();
				registerFormatPaths.call(this, formatPaths);
				return true;
			}
		}
	});

	// Expose the rule publicly
	Rule.validated = ValidatedPropertyRule;
	ExoWeb.Model.ValidatedPropertyRule = ValidatedPropertyRule;

	// #endregion

	// #region ExoWeb.Model.CalculatedPropertyRule
	//////////////////////////////////////////////////

	function CalculatedPropertyRule(rootType, options) {
		/// <summary>Creates a rule that calculates the value of a property in the model.</summary>
		/// <param name="rootType" type="Type">The model type the rule is for.</param>
		/// <param name="options" type="Object">
		///		The options for the rule, including:
		///			property:		the property being calculated (either a Property instance or string property name)
		///			calculate:		a function that returns the value to assign to the property, or undefined if the value cannot be calculated
		///			defaultIfError: the value to return if an error occurs, or undefined to cause an exception to be thrown
		///			name:			the optional unique name of the rule
		///		    onInit:			true to indicate the rule should run when an instance of the root type is initialized, otherwise false
		///		    onInitNew:		true to indicate the rule should run when a new instance of the root type is initialized, otherwise false
		///		    onInitExisting:	true to indicate the rule should run when an existing instance of the root type is initialized, otherwise false
		///		    onChangeOf:		an array of property paths (strings, Property or PropertyChain instances) that drive when the rule should execute due to property changes
		/// </param>
		/// <returns type="CalculatedPropertyRule">The new calculated property rule.</returns>

		// store the property being validated
		var prop = options.property instanceof Property ? options.property : rootType.property(options.property);
		Object.defineProperty(this, "property", { value: prop });

		Object.defineProperty(this, "useOptimalUpdates", { value: options.useOptimalUpdates !== false });

		// ensure the rule name is specified
		options.name = options.name || (rootType.get_fullName() + "." + prop.get_name() + ".Calculated");

		// store the calculation function
		Object.defineProperty(this, "calculate", { value: options.calculate || options.fn, writable: true });

		// store the calculation function
		Object.defineProperty(this, "defaultIfError", { value: options.hasOwnProperty("defaultIfError") ? options.defaultIfError : ExoWeb.config.calculationErrorDefault });

		// indicate that the rule is responsible for returning the value of the calculated property
		options.returns = [prop];

		// Call the base rule constructor 
		Rule.apply(this, [rootType, options]);
	}

	// setup the inheritance chain
	CalculatedPropertyRule.prototype = new Rule();
	CalculatedPropertyRule.prototype.constructor = CalculatedPropertyRule;

	// extend the base type
	CalculatedPropertyRule.mixin({
		execute: function CalculatedPropertyRule$execute(obj) {
			var prop = this.property;

			// convert string functions into compiled functions on first execution
			if (this.calculate.constructor === String) {
				this.calculate = this.rootType.compileExpression(this.calculate);
			}

			// calculate the new property value
			var newValue;
			if (this.defaultIfError === undefined)
				newValue = this.calculate.apply(obj, [obj]);
			else {
				try {
					newValue = this.calculate.apply(obj, [obj]);
				}
				catch (e) {
					newValue = this.defaultIfError;
				}
			}

			// exit immediately if the calculated result was undefined
			if (newValue === undefined) return;

			// modify list properties to match the calculated value instead of overwriting the property
			if (prop.get_isList()) {

				// re-calculate the list values
				var newList = newValue;

				// compare the new list to the old one to see if changes were made
				var curList = prop.value(obj);

				if (newList.length === curList.length) {
					var noChanges = true;

					for (var i = 0; i < newList.length; ++i) {
						if (newList[i] !== curList[i]) {
							noChanges = false;
							break;
						}
					}

					if (noChanges) {
						return;
					}
				}

				// update the current list so observers will receive the change events
				curList.beginUpdate();
				if (this.useOptimalUpdates)
					update(curList, newList);
				else {
					curList.clear();
					curList.addRange(newList);
				}
				curList.endUpdate();
			}

			// otherwise, just set the property to the new value
			else {
				prop.value(obj, newValue, { calculated: true });
			}
		},
		toString: function () {
			return "calculation of " + this.property._name;
		},
		// perform addition initialization of the rule when it is registered
		onRegister: function () {

			// register the rule with the target property
			registerPropertyRule(this.property, this);
		}
	});

	// expose the rule publicly
	Rule.calculated = CalculatedPropertyRule;
	ExoWeb.Model.CalculatedPropertyRule = CalculatedPropertyRule;

	// #endregion

	// #region ExoWeb.Model.RequiredRule
	//////////////////////////////////////////////////

	function RequiredRule(rootType, options) {
		/// <summary>Creates a rule that validates that a property has a value.</summary>
		/// <param name="rootType" type="Type">The model type the rule is for.</param>
		/// <param name="options" type="Object">
		///		The options for the rule, including:
		///			property:			the property being validated (either a Property instance or string property name)
		///			name:				the optional unique name of the type of validation rule
		///			conditionType:		the optional condition type to use, which will be automatically created if not specified
		///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
		///			message:			the message to show the user when the validation fails
		///			requiredValue:		the optional required value
		/// </param>
		/// <returns type="RequiredRule">The new required rule.</returns>

		// ensure the rule name is specified
		options.name = options.name || "Required";

		// ensure the error message is specified
		options.message = options.message || Resource.get("required");

		if (options.requiredValue)
			Object.defineProperty(this, "requiredValue", { value: options.requiredValue });

		// call the base type constructor
		ValidatedPropertyRule.apply(this, [rootType, options]);
	}

	// setup the inheritance chain
	RequiredRule.prototype = new ValidatedPropertyRule();
	RequiredRule.prototype.constructor = RequiredRule;

	// define a global function that determines if a value exists
	RequiredRule.hasValue = function RequiredRule$hasValue(val) {
		return val !== undefined && val !== null && (val.constructor !== String || val.trim() !== "") && (!(val instanceof Array) || val.length > 0);
	};

	// extend the base type
	RequiredRule.mixin({

		// returns true if the property is valid, otherwise false
		isValid: function RequiredRule$isValid(obj, prop, val) {
			if (this.requiredValue)
				return val === this.requiredValue;
			else
				return RequiredRule.hasValue(val);
		},

		// get the string representation of the rule
		toString: function () {
			return $format("{0}.{1} is required", [this.property.get_containingType().get_fullName(), this.property.get_name()]);
		}
	});

	// Expose the rule publicly
	Rule.required = RequiredRule;
	ExoWeb.Model.RequiredRule = RequiredRule;

	// #endregion

	// #region ExoWeb.Model.ValidationRule
	//////////////////////////////////////////////////

	function ValidationRule(rootType, options) {
		/// <summary>Creates a rule that performs custom validation for a property.</summary>
		/// <param name="rootType" type="Type">The model type the rule is for.</param>
		/// <param name="options" type="Object">
		///		The options for the rule, including:
		///			property:			the property being validated (either a Property instance or string property name)
		///			name:				the optional unique name of the type of validation rule
		///			conditionType:		the optional condition type to use, which will be automatically created if not specified
		///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
		///			message:			the message to show the user when the validation fails
		///			requiredValue:		the optional required value
		/// </param>
		/// <returns type="RequiredRule">The new required rule.</returns>

		// ensure the rule name is specified
		options.name = options.name || "Validation";
	
		if (options.message) {
			// Evaluate the message as a localizable resource
			if (Resource.get(options.message))
				options.message = Resource.get(options.message);
		} else if (options.messageFn) {
			// Store the message function if specified
			Object.defineProperty(this, "messageFn", { value: options.messageFn, writable: true });
		} else {
			// Set a default error message is one is not specified
			options.message = Resource.get("validation");
		}
	
		// predicate-based rule
		if (options.isError || options.fn) {
			Object.defineProperty(this, "isError", { value: options.isError || options.fn, writable: true });
		}

		// call the base type constructor
		ValidatedPropertyRule.apply(this, [rootType, options]);
	}

	// setup the inheritance chain
	ValidationRule.prototype = new ValidatedPropertyRule();
	ValidationRule.prototype.constructor = ValidationRule;

	// extend the base type
	ValidationRule.mixin({

		message: function (obj) {
			var message = "";
			var prop = this.property;
			var hasTokens = Format.hasTokens(prop.get_label());

			if (this.messageFn) {
				// convert string functions into compiled functions on first execution
				if (this.messageFn.constructor === String) {
					this.messageFn = this.rootType.compileExpression(this.messageFn);
				}

				// Invoke the function bound to the entity, and also pass the entity as the argument
				// This is consitent with how rule 'message' option that is an own property is called in this manner (see: ConditionRule.js)
				message = this.messageFn.apply(obj, [obj]);

				// Convert a non-string message into a string
				if (message != null && typeof message !== "string") {
					logWarning("Converting message of type '" + (typeof message) + "' for rule '" + this.name + "' to a string.");
					message = message.toString();
				}
			} else {
				// Fall back to the default validation message
				message = Resource.get("validation");
			}

			// Replace the {property} token with the property label (or evaluated label format)
			message = message.replace("{property}", hasTokens ? this.getPropertyLabelFormat().convert(obj) : prop.get_label());

			return message;
		},

		// returns true if the property is valid, otherwise false
		isValid: function ValidationRule$isValid(obj, prop, val) {		
			// convert string functions into compiled functions on first execution
			if (this.isError.constructor === String) {
				this.isError = this.rootType.compileExpression(this.isError);
			}

			try {
				if (!this.isError.apply(obj, [obj])) {
					// The 'isError' function returned false, so consider the object to be valid
					return true;
				} else {
					var message = this.message;
					if (message instanceof Function) {
						if (this.hasOwnProperty("message")) {
							// When message is overriden, use the root object as this (see: ConditionRule.js)
							message = message.bind(obj);
						}
						else {
							message = message.bind(this);
						}

						// Invoke the message function to ensure that it will produce a value
						message = message(obj);
					}

					// If there is no message, then consider the object to be valid
					return !message;
				}
			}
			catch (e) {
				// If 'isError' or 'messageFn' throws an error, then consider the object to be valid
				logWarning(e);
				return true;
			}
		},

		// get the string representation of the rule
		toString: function () {
			return $format("{0}.{1} is invalid", [this.property.get_containingType().get_fullName(), this.property.get_name()]);
		}
	});

	// Expose the rule publicly
	Rule.validation = ValidationRule;
	ExoWeb.Model.ValidationRule = ValidationRule;

	// #endregion

	// #region ExoWeb.Model.RangeRule
	//////////////////////////////////////////////////

	function RangeRule(rootType, options) {
		/// <summary>Creates a rule that validates a property value is within a specific range.</summary>
		/// <param name="rootType" type="Type">The model type the rule is for.</param>
		/// <param name="options" type="Object">
		///		The options for the rule, including:
		///			property:			the property being validated (either a Property instance or string property name)
		///			min:				the minimum valid value of the property
		///			max:				the maximum valid value of the property
		///			minFn:				a function returning the minimum valid value of the property
		///			maxFn:				a function returning the maximum valid value of the property
		///			name:				the optional unique name of the type of validation rule
		///			conditionType:		the optional condition type to use, which will be automatically created if not specified
		///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
		///			message:			the message to show the user when the validation fails
		///		    onChangeOf:			an array of property paths (strings, Property or PropertyChain instances) that drive when the rule should execute due to property changes
		/// </param>
		/// <returns type="RangeRule">The new range rule.</returns>

		// exit immediately if called with no arguments
		if (arguments.length == 0) return;

		// ensure the rule name is specified
		options.name = options.name || "Range";

		// get the property being validated in order to determine the data type
		var property = options.property instanceof Property ? options.property : rootType.property(options.property);

		// coerce date range constants
		if (options.min && property.get_jstype() === Date) {
			options.min = new Date(options.min);
		}
		if (options.max && property.get_jstype() === Date) {
			options.max = new Date(options.max);
		}

		// coerce null ranges to undefined
		if (options.min === null) {
			options.min = undefined;
		}
		if (options.max === null) {
			options.max = undefined;
		}

		// convert constant values into functions
		if (!options.minFn) {
			options.minFn = function() { return options.min; };
		}
		if (!options.maxFn) {
			options.maxFn = function() { return options.max; };
		}

		// Store the min and max functions
		Object.defineProperty(this, "min", { value: options.minFn, writable: true });
		Object.defineProperty(this, "max", { value: options.maxFn, writable: true });

		// call the base type constructor
		ValidatedPropertyRule.apply(this, [rootType, options]);
	}

	// setup the inheritance chain
	RangeRule.prototype = new ValidatedPropertyRule();
	RangeRule.prototype.constructor = RangeRule;

	// extend the base type
	RangeRule.mixin({

		// get the min and max range in effect for this rule for the specified instance
		range: function RangeRule$range(obj) {

			// convert string functions into compiled functions on first execution
			if (this.min && this.min.constructor === String) {
				this.min = this.rootType.compileExpression(this.min);
			}
			if (this.max && this.max.constructor === String) {
				this.max = this.rootType.compileExpression(this.max);
			}

			// determine the min and max values based on the current state of the instance
			var range = { };
			try { range.min = this.min.call(obj); }	catch (e) { }
			try { range.max = this.max.call(obj); }	catch (e) { }
			range.min = range.min == null ? undefined : range.min;
			range.max = range.max == null ? undefined : range.max;

			return range;
		},

		// returns true if the property is valid, otherwise false
		isValid: function RangeRule$isValid(obj, prop, val) { 

			var range = this.range(obj);

			return val === null || val === undefined || ((range.min === undefined || val >= range.min) && (range.max === undefined || val <= range.max));
		},

		message: function RangeRule$message(obj) {

			var range = this.range(obj);

			// ensure the error message is specified
			var message =
				(range.min !== undefined && range.max !== undefined ? Resource.get("range-between").replace("{min}", this.property.format(range.min)).replace("{max}", this.property.format(range.max)) : // between date or ordinal
					this.property.get_jstype() === Date ?
						range.min !== undefined ?
							Resource.get("range-on-or-after").replace("{min}", this.property.format(range.min)) : // on or after date
							Resource.get("range-on-or-before").replace("{max}", this.property.format(range.max)) : // on or before date
						range.min !== undefined ?
							Resource.get("range-at-least").replace("{min}", this.property.format(range.min)) : // at least ordinal
							Resource.get("range-at-most").replace("{max}", this.property.format(range.max))); // at most ordinal

			return message.replace('{property}', this.getPropertyLabel(obj));		
		},

		// get the string representation of the rule
		toString: function () {
			return $format("{0}.{1} in range, min: {2}, max: {3}",
				[this.get_property().get_containingType().get_fullName(),
				this.get_property().get_name(),
				this.min ? "" : this.min,
				this.max ? "" : this.max]);
		}
	});

	// Expose the rule publicly
	Rule.range = RangeRule;
	ExoWeb.Model.RangeRule = RangeRule;

	// #endregion

	// #region ExoWeb.Model.AllowedValuesRule
	//////////////////////////////////////////////////

	function AllowedValuesRule(rootType, options) {
		/// <summary>Creates a rule that validates whether a selected value or values is in a list of allowed values.</summary>
		/// <param name="rootType" type="Type">The model type the rule is for.</param>
		/// <param name="options" type="Object">
		///		The options for the rule, including:
		///			property:		the property being validated (either a Property instance or string property name)
		///			source:			the source property for the allowed values (either a Property or PropertyChain instance or a string property path)
		///			name:			the optional unique name of the rule
		///			conditionType:	the optional condition type to use, which will be automatically created if not specified
		///			category:		ConditionType.Error || ConditionType.Warning, defaults to ConditionType.Error if not specified
		///			message:		the message to show the user when the validation fails
		/// </param>
		/// <returns type="AllowedValuesRule">The new allowed values rule.</returns>

		// ensure the rule name is specified
		options.name = options.name || "AllowedValues";

		// ensure the error message is specified
		options.message = options.message || Resource.get("allowed-values");

		// define properties for the rule
		if (options.source instanceof Property || options.source instanceof PropertyChain) {
			Object.defineProperty(this, "sourcePath", { value: options.source.get_path() });
			Object.defineProperty(this, "source", { value: options.source });
			options.onChangeOf = [options.source];
		}
		else if (options.source instanceof Function || options.fn) {
			Object.defineProperty(this, "sourceFn", { value: options.source || options.fn, writable: true });
			options.fn = null;
		}
		else {
			Object.defineProperty(this, "sourcePath", { value: options.source });
			options.onChangeOf = [options.source];
		}

		if (options.ignoreValidation) {
		    Object.defineProperty(this, "ignoreValidation", { value: options.ignoreValidation });
		}

		// create a property specified condition type if not passed in, defaulting to Error if a condition category was not specified
		options.conditionType = options.conditionType || Rule.ensureConditionType(options.name, this.property, options.category || ConditionType.Error);

		// never run allowed values rules during initialization of existing instances
		if (!options.hasOwnProperty("onInitExisting") && options.conditionType.origin === "server") {
			options.onInitExisting = false;
		}

		// call the base type constructor
		ValidatedPropertyRule.apply(this, [rootType, options]);
	}

	// setup the inheritance chain
	AllowedValuesRule.prototype = new ValidatedPropertyRule();
	AllowedValuesRule.prototype.constructor = AllowedValuesRule;

	// extend the base type
	AllowedValuesRule.mixin({
		onRegister: function AllowedValuesRule$onRegister() {

			// get the allowed values source, if only the path was specified
			if (!this.source && !this.sourceFn) {
				Object.defineProperty(this, "source", { value: Model.property(this.sourcePath, this.rootType) });
			}

			// call the base method
			ValidatedPropertyRule.prototype.onRegister.call(this);
		},
		isValid: function AllowedValuesRule$isValid(obj, prop, value) {

		    //gives the ability to create a drop down of available options
	        //but does not need validatin (combo box)
		    if (this.ignoreValidation) {
		        return true;
		    }

			// return true if no value is currently selected
			if (!value) {
				return true;
			}

			// get the list of allowed values of the property for the given object
			var allowed = this.values(obj);

			// return undefined if the set of allowed values cannot be determined
			if (!LazyLoader.isLoaded(allowed)) {
				return;
			}

			// ensure that the value or list of values is in the allowed values list (single and multi-select)				
			if (value instanceof Array) {
				return value.every(function (item) { return Array.contains(allowed, item); });
			}
			else {
				return Array.contains(allowed, value);
			}
		},

		// Subscribes to changes to the allow value predicates, indicating that the allowed values have changed
		addChanged: function AllowedValuesRule$addChanged(handler, obj, once) {
			for (var p = 0; p < this.predicates.length; p++) {
				var predicate = this.predicates[p];
				if (predicate !== this.property)
					predicate.addChanged(handler, obj, once);
			}
		},

		// Unsubscribes from changes to the allow value predicates
		removeChanged: function AllowedValuesRule$removeChanged(handler, obj, once) {
			for (var p = 0; p < this.predicates.length; p++) {
				var predicate = this.predicates[p];
				if (predicate !== this.property)
					predicate.removeChanged(handler, obj, once);
			}
		},

		values: function AllowedValuesRule$values(obj, exitEarly) {
			if (!this.source && !this.sourceFn) {
				logWarning("AllowedValues rule on type \"" + this.prop.get_containingType().get_fullName() + "\" has not been initialized.");
				return;
			}

			// Function-based allowed values
			if (this.sourceFn) {

				// convert string functions into compiled functions on first execution
				if (this.sourceFn.constructor === String) {
					this.sourceFn = this.rootType.compileExpression(this.sourceFn);
				}

				return this.sourceFn.call(obj, obj);
			}

			// Property path-based allowed values
			else {
				// For non-static properties, verify that a final target exists and
				// if not return an appropriate null or undefined value instead.
				if (!this.source.get_isStatic()) {
					// Get the value of the last target for the source property (chain).
					var lastTarget = this.source.lastTarget(obj, exitEarly);

					// Use the last target to distinguish between the absence of data and
					// data that has not been loaded, if a final value cannot be obtained.
					if (lastTarget === undefined) {
						// Undefined signifies unloaded data
						return undefined;
					}
					else if (lastTarget === null) {
						// Null signifies the absensce of a value
						return null;
					}
				}

				// Return the value of the source for the given object
				return this.source.value(obj);
			}
		},
		toString: function AllowedValuesRule$toString() {
			return $format("{0}.{1} allowed values = {2}", [this.property.get_containingType().get_fullName(), this.property.get_name(), this._sourcePath]);
		}
	});

	// expose the rule publicly
	Rule.allowedValues = AllowedValuesRule;
	ExoWeb.Model.AllowedValuesRule = AllowedValuesRule;

	// #endregion

	// #region ExoWeb.Model.CompareRule
	//////////////////////////////////////////////////

	function CompareRule(rootType, options) {
		/// <summary>Creates a rule that validates a property by comparing it to another property.</summary>
		/// <param name="rootType" type="Type">The model type the rule is for.</param>
		/// <param name="options" type="Object">
		///		The options for the rule, including:
		///			property:			the property being validated (either a Property instance or string property name)
		///			compareSource:		the source property to compare to (either a Property or PropertyChain instance or a string property path)
		///			compareOperator:	the relational comparison operator to use (one of "Equal", "NotEqual", "GreaterThan", "GreaterThanEqual", "LessThan" or "LessThanEqual")
		///			name:				the optional unique name of the type of validation rule
		///			conditionType:		the optional condition type to use, which will be automatically created if not specified
		///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
		///			message:			the message to show the user when the validation fails
		/// </param>
		/// <returns type="CompareRule">The new compare rule.</returns>

		// exit immediately if called with no arguments
		if (arguments.length == 0) return;

		options.name = options.name || "Compare";
	
		// ensure changes to the compare source triggers rule execution
		if (options.compareSource)
			options.onChangeOf = [options.compareSource];

		// define properties for the rule
		Object.defineProperty(this, "compareOperator", { value: options.compareOperator });
		if (options.source instanceof Property || options.compareSource instanceof PropertyChain) {
			Object.defineProperty(this, "comparePath", { value: options.compareSource.get_path() });
			Object.defineProperty(this, "compareSource", { value: options.compareSource });
		}
		else {
			Object.defineProperty(this, "comparePath", { value: options.compareSource });
		}

		// call the base type constructor
		ValidatedPropertyRule.apply(this, [rootType, options]);
	}

	// compares the source value to a comparison value using the specified operator
	CompareRule.compare = function CompareRule$compare(sourceValue, compareOp, compareValue, defaultValue) {
		if (compareValue === undefined || compareValue === null) {
			switch (compareOp) {
				case "Equal": return !RequiredRule.hasValue(sourceValue);
				case "NotEqual": return RequiredRule.hasValue(sourceValue);
			}
		}

		if (sourceValue !== undefined && sourceValue !== null && compareValue !== undefined && compareValue !== null) {
			switch (compareOp) {
				case "Equal": return sourceValue == compareValue;
				case "NotEqual": return sourceValue != compareValue;
				case "GreaterThan": return sourceValue > compareValue;
				case "GreaterThanEqual": return sourceValue >= compareValue;
				case "LessThan": return sourceValue < compareValue;
				case "LessThanEqual": return sourceValue <= compareValue;
			}
			// Equality by default.
			return sourceValue == compareValue;
		}

		return defaultValue;
	};

	// setup the inheritance chain
	CompareRule.prototype = new ValidatedPropertyRule();
	CompareRule.prototype.constructor = CompareRule;

	// extend the base type
	CompareRule.mixin({

		// return true of the comparison is valid, otherwise false
		isValid: function Compare$isValid(obj, prop, value) {
			var compareValue = this.compareSource.value(obj);
			return CompareRule.compare(value, this.compareOperator, compareValue, true);
		},

		// calculates the appropriate message based on the comparison operator and data type
		message: function () {
			var message;
			var isDate = this.compareSource.get_jstype() === Date;
			if (this.compareOperator === "Equal") {
				message = Resource.get("compare-equal");
			}
			else if (this.compareOperator === "NotEqual") {
				message = Resource.get("compare-not-equal");
			}
			else if (this.compareOperator === "GreaterThan") {
				message = Resource.get(isDate ? "compare-after" : "compare-greater-than");
			}
			else if (this.compareOperator === "GreaterThanEqual") {
				message = Resource.get(isDate ? "compare-on-or-after" : "compare-greater-than-or-equal");
			}
			else if (this.compareOperator === "LessThan") {
				message = Resource.get(isDate ? "compare-before" : "compare-less-than");
			}
			else if (this.compareOperator === "LessThanEqual") {
				message = Resource.get(isDate ? "compare-on-or-before" : "compare-less-than-or-equal");
			}
			else {
				throw new Error("Invalid comparison operator for compare rule.");
			}

			message = message.replace("{compareSource}", this.compareSource.get_label());

			return message.replace('{property}', this.getPropertyLabel(obj));
		},

		// perform addition initialization of the rule when it is registered
		onRegister: function () {

			// get the compare source, if only the path was specified
			if (!this.compareSource && this.comparePath) {
				Object.defineProperty(this, "compareSource", { value: Model.property(this.comparePath, this.rootType) });
			}

			// call the base method
			ValidatedPropertyRule.prototype.onRegister.call(this);
		}
	});

	// expose the rule publicly
	Rule.compare = CompareRule;
	ExoWeb.Model.CompareRule = CompareRule;

	// #endregion

	// #region ExoWeb.Model.RequiredIfRule
	//////////////////////////////////////////////////

	function RequiredIfRule(rootType, options) {
		/// <summary>Creates a rule that conditionally validates whether a property has a value.</summary>
		/// <param name="rootType" type="Type">The model type the rule is for.</param>
		/// <param name="options" type="Object">
		///		The options for the rule, including:
		///			property:			the property being validated (either a Property instance or string property name)
		///			isRequired:			a predicate function indicating whether the property should be required
		///			compareSource:		the source property to compare to (either a Property or PropertyChain instance or a string property path)
		///			compareOperator:	the relational comparison operator to use (one of "Equal", "NotEqual", "GreaterThan", "GreaterThanEqual", "LessThan" or "LessThanEqual")
		///			compareValue:		the optional value to compare to
		///			name:				the optional unique name of the type of validation rule
		///			conditionType:		the optional condition type to use, which will be automatically created if not specified
		///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
		///			message:			the message to show the user when the validation fails
		///		    onInit:				true to indicate the rule should run when an instance of the root type is initialized, otherwise false
		///		    onInitNew:			true to indicate the rule should run when a new instance of the root type is initialized, otherwise false
		///		    onInitExisting:		true to indicate the rule should run when an existing instance of the root type is initialized, otherwise false
		///		    onChangeOf:			an array of property paths (strings, Property or PropertyChain instances) that drive when the rule should execute due to property changes
		///			requiredValue:		the optional required value
		/// </param>
		/// <returns type="RequiredIfRule">The new required if rule.</returns>

		options.name = options.name || "RequiredIf";

		// ensure changes to the compare source triggers rule execution
		if (!options.onChangeOf && options.compareSource) {
			options.onChangeOf = [options.compareSource];
		}

		// predicate-based rule
		if (options.isRequired || options.fn) {
			Object.defineProperty(this, "isRequired", { value: options.isRequired || options.fn, writable: true });
			options.fn = null;
			options.message = options.message || Resource.get("required");
		}

			// comparison-based rule
		else {
			Object.defineProperty(this, "comparePath", { value: options.compareSource });
			Object.defineProperty(this, "compareOperator", {
				value: options.compareOperator || (options.compareValue !== undefined && options.compareValue !== null ? "Equal" : "NotEqual"),
				writable: true
			});
			Object.defineProperty(this, "compareValue", { value: options.compareValue, writable: true });
		}

		if (options.requiredValue)
			Object.defineProperty(this, "requiredValue", { value: options.requiredValue });

		// call the base type constructor
		ValidatedPropertyRule.apply(this, [rootType, options]);
	}

	// setup the inheritance chain
	RequiredIfRule.prototype = new ValidatedPropertyRule();
	RequiredIfRule.prototype.constructor = RequiredIfRule;

	// extend the base type
	RequiredIfRule.mixin({

		// determines whether the property should be considered required
		isRequired: function RequiredIfRule$required(obj) {
			var sourceValue = this.compareSource.value(obj);
			return CompareRule.compare(sourceValue, this.compareOperator, this.compareValue, false);
		},

		// calculates the appropriate message based on the comparison operator and data type
		message: function () {
			var message;
			var isDate = this.compareSource.get_jstype() === Date;
			if (this.compareValue === undefined || this.compareValue === null) {
				message = Resource.get(this.compareOperator === "Equal" ? "required-if-not-exists" : "required-if-exists");
			}
			else if (this.compareOperator === "Equal") {
				message = Resource.get("required-if-equal");
			}
			else if (this.compareOperator === "NotEqual") {
				message = Resource.get("required-if-not-equal");
			}
			else if (this.compareOperator === "GreaterThan") {
				message = Resource.get(isDate ? "required-if-after" : "required-if-greater-than");
			}
			else if (this.compareOperator === "GreaterThanEqual") {
				message = Resource.get(isDate ? "required-if-on-or-after" : "required-if-greater-than-or-equal");
			}
			else if (this.compareOperator === "LessThan") {
				message = Resource.get(isDate ? "required-if-before" : "required-if-less-than");
			}
			else if (this.compareOperator === "LessThanEqual") {
				message = Resource.get(isDate ? "required-if-on-or-before" : "required-if-less-than-or-equal");
			}
			else {
				throw new Error("Invalid comparison operator for compare rule.");
			}

			message = message.replace("{compareSource}", this.compareSource.get_label())
				.replace("{compareValue}", this.compareSource.format(this.compareValue));

			return message.replace('{property}', this.getPropertyLabel(obj));
		},

		// returns false if the property is valid, true if invalid, or undefined if unknown
		assert: function RequiredIfRule$assert(obj) {
			var isReq;

			// convert string functions into compiled functions on first execution
			if (this.isRequired.constructor === String) {
				this.isRequired = this.rootType.compileExpression(this.isRequired);
			}

			if (this.hasOwnProperty("isRequired")) {
				try {
					isReq = this.isRequired.call(obj);
				}
				catch (e) {
					isReq = false;
				}
			}
				// otherwise, allow "this" to be the current rule to support subclasses that override assert
			else
				isReq = this.isRequired(obj);

			if (this.requiredValue)
				return isReq && this.property.value(obj) !== this.requiredValue;
			else
				return isReq && !RequiredRule.hasValue(this.property.value(obj));
		},

		// perform addition initialization of the rule when it is registered
		onRegister: function () {

			// call the base method
			ValidatedPropertyRule.prototype.onRegister.call(this);

			// perform addition registration for required if rules with a compare source
			if (this.comparePath) {

				// get the compare source, which is already a rule predicate and should immediately resolve
				Object.defineProperty(this, "compareSource", { value: Model.property(this.comparePath, this.rootType) });

				// flip the equality rules for boolean data types
				if (this.compareSource.get_jstype() === Boolean && this.compareOperator == "NotEqual" && (this.compareValue === undefined || this.compareValue === null)) {
					this.compareOperator = "Equal";
					this.compareValue = true;
				}
			}
		}
	});

	// Expose the rule publicly
	Rule.requiredIf = RequiredIfRule;
	ExoWeb.Model.RequiredIfRule = RequiredIfRule;

	// #endregion

	// #region ExoWeb.Model.StringLengthRule
	//////////////////////////////////////////////////

	function StringLengthRule(rootType, options) {
		/// <summary>Creates a rule that validates that the length of a string property is within a specific range.</summary>
		/// <param name="rootType" type="Type">The model type the rule is for.</param>
		/// <param name="options" type="Object">
		///		The options for the rule, including:
		///			property:			the property being validated (either a Property instance or string property name)
		///			min:				the minimum length of the property
		///			max:				the maximum length of the property
		///			name:				the optional unique name of the type of validation rule
		///			conditionType:		the optional condition type to use, which will be automatically created if not specified
		///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
		///			message:			the message to show the user when the validation fails
		/// </param>
		/// <returns type="RangeRule">The new range rule.</returns>

		// ensure the rule name is specified
		options.name = options.name || "StringLength";

		// store the min and max lengths
		Object.defineProperty(this, "min", { value: options.min });
		Object.defineProperty(this, "max", { value: options.max });

		// ensure the error message is specified
		options.message = options.message ||
			(options.min && options.max ? Resource.get("string-length-between").replace("{min}", this.min).replace("{max}", this.max) :
			options.min ? Resource.get("string-length-at-least").replace("{min}", this.min) :
			Resource.get("string-length-at-most").replace("{max}", this.max));

		// call the base type constructor
		ValidatedPropertyRule.apply(this, [rootType, options]);
	}

	// setup the inheritance chain
	StringLengthRule.prototype = new ValidatedPropertyRule();
	StringLengthRule.prototype.constructor = StringLengthRule;

	// extend the base type
	StringLengthRule.mixin({

		// returns true if the property is valid, otherwise false
		isValid: function StringLengthRule$isValid(obj, prop, val) {
			return !val || val === "" || ((!this.min || val.length >= this.min) && (!this.max || val.length <= this.max));
		},

		// get the string representation of the rule
		toString: function () {
			return $format("{0}.{1} in range, min: {2}, max: {3}",
				[this.get_property().get_containingType().get_fullName(),
				this.get_property().get_name(),
				this.min ? "" : this.min,
				this.max ? "" : this.max]);
		}
	});

	// Expose the rule publicly
	Rule.stringLength = StringLengthRule;
	ExoWeb.Model.StringLengthRule = StringLengthRule;

	// #endregion

	// #region ExoWeb.Model.StringFormatRule
	//////////////////////////////////////////////////

	function StringFormatRule(rootType, options) {
		/// <summary>Creates a rule that validates that a string property value is correctly formatted.</summary>
		/// <param name="rootType" type="Type">The model type the rule is for.</param>
		/// <param name="options" type="Object">
		///		The options for the rule, including:
		///			property:			the property being validated (either a Property instance or string property name)
		///			description:		the human readable description of the format, such as MM/DD/YYY
		///		    expression:			a regular expression string or RegExp instance that the property value must match
		///		    reformat:			and optional regular expression reformat string or reformat function that will be used to correct the value if it matches
		///			name:				the optional unique name of the type of validation rule
		///			conditionType:		the optional condition type to use, which will be automatically created if not specified
		///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
		///			message:			the message to show the user when the validation fails
		/// </param>
		/// <returns type="StringFormatRule">The new string format rule.</returns>

		// exit immediately if called with no arguments
		if (arguments.length == 0) return;

		// ensure the rule name is specified
		options.name = options.name || "StringFormat";


		// ensure the error message is specified
		if (Resource.get(options.message))
	        options.message = Resource.get(options.message);
	    else
	        options.message = options.message || Resource.get("string-format").replace("{formatDescription}", options.description);

		// define properties for the rule
		Object.defineProperty(this, "description", { value: options.description });
		Object.defineProperty(this, "expression", { value: options.expression instanceof RegExp ? options.expression : RegExp(options.expression) });
		Object.defineProperty(this, "reformat", { value: options.reformat });

		// call the base type constructor
		ValidatedPropertyRule.apply(this, [rootType, options]);
	}

	// setup the inheritance chain
	StringFormatRule.prototype = new ValidatedPropertyRule();
	StringFormatRule.prototype.constructor = StringFormatRule;

	// extend the base type
	StringFormatRule.mixin({

		// returns true if the property is valid, otherwise false
		isValid: function StringFormatRule$isValid(obj, prop, val) {
			var isValid = true;
			if (val && val != "") {
				this.expression.lastIndex = 0;
				isValid = this.expression.test(val);
				if (isValid && this.reformat) {
					if (this.reformat instanceof Function) {
						val = this.reformat(val);
					}
					else {
						this.expression.lastIndex = 0;
						val = val.replace(this.expression, this.reformat);
					}
					prop.value(obj, val);
				}
			}
			return isValid;
		},

		// get the string representation of the rule
		toString: function () {
			return $format("{0}.{1} formatted as {2}",
				[this.get_property.get_containingType().get_fullName(),
				this.get_property().get_name(),
				this.description]);
		}
	});

	// Expose the rule publicly
	Rule.stringFormat = StringFormatRule;
	ExoWeb.Model.StringFormatRule = StringFormatRule;

	// #endregion

	// #region ExoWeb.Model.ListLengthRule
	//////////////////////////////////////////////////

	function ListLengthRule(rootType, options) {
		/// <summary>Creates a rule that validates a list property contains a specific range of items.</summary>
		/// <param name="rootType" type="Type">The model type the rule is for.</param>
		/// <param name="options" type="Object">
		///		The options for the rule, including:
		///			property:			the property being validated (either a Property instance or string property name)
		///			min:				the minimum valid value of the property
		///			max:				the maximum valid value of the property
		///			minFn:				a function returning the minimum valid value of the property
		///			maxFn:				a function returning the maximum valid value of the property
		///			name:				the optional unique name of the type of validation rule
		///			conditionType:		the optional condition type to use, which will be automatically created if not specified
		///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
		///			message:			the message to show the user when the validation fails
		///		    onChangeOf:			an array of property paths (strings, Property or PropertyChain instances) that drive when the rule should execute due to property changes
		/// </param>
		/// <returns type="ListLengthRule">The new list length rule.</returns>

		// ensure the rule name is specified
		options.name = options.name || "ListLength";

		// call the base type constructor
		RangeRule.apply(this, [rootType, options]);
	}

	// setup the inheritance chain
	ListLengthRule.prototype = new RangeRule();
	ListLengthRule.prototype.constructor = ListLengthRule;

	// extend the base type
	ListLengthRule.mixin({

		// returns true if the property is valid, otherwise false
		isValid: function ListLengthRule$isValid(obj, prop, val) {

			var range = this.range(obj);

			return val === null || val === undefined || ((!range.min || val.length >= range.min) && (!range.max || val.length <= range.max));
		},

		message: function ListLengthRule$message(obj) {

			var range = this.range(obj);

			// ensure the error message is specified
			var message =
				(range.min && range.max ? Resource.get("listlength-between").replace("{min}", this.property.format(range.min)).replace("{max}", this.property.format(range.max)) : 
						range.min ?
							Resource.get("listlength-at-least").replace("{min}", this.property.format(range.min)) : // at least ordinal
							Resource.get("listlength-at-most").replace("{max}", this.property.format(range.max))); // at most ordinal

			return message.replace('{property}', this.getPropertyLabel(obj));
		}
	});

	// Expose the rule publicly
	Rule.listLength = ListLengthRule;
	ExoWeb.Model.ListLengthRule = ListLengthRule;

	// #endregion

	// #region ExoWeb.Model.ConditionTypeSet
	//////////////////////////////////////////////////

	function ConditionTypeSet(name) {
		if (allConditionTypeSets[name]) {
			throw new Error("A set with the name \"" + name + "\" has already been created.");
		}

		Object.defineProperty(this, "name", { value: name });
		Object.defineProperty(this, "types", { value: [] });
		Object.defineProperty(this, "active", { value: false, writable: true });
		Object.defineProperty(this, "conditions", { value: [] });

		allConditionTypeSets[name] = this;
	}

	var allConditionTypeSets = ConditionTypeSet.allConditionTypeSets = {};

	ConditionTypeSet.all = function ConditionTypeSet$all() {
		/// <summary>
		/// Returns an array of all condition type sets that have been created.
		/// Note that the array is created each time the function is called.
		/// </summary>
		/// <returns type="Array" />

		var all = [];
		for (var name in allConditionTypeSets) {
			all.push(allConditionTypeSets[name]);
		}
		return all;
	};

	ConditionTypeSet.get = function ConditionTypeSet$get(name) {
		/// <summary>
		/// Returns the condition type set with the given name, if it exists.
		/// </summary>
		/// <param name="name" type="String" />
		/// <returns type="ConditionTypeSet" />

		return allConditionTypeSets[name];
	};

	ConditionTypeSet.prototype = {
		activate: function ConditionTypeSet$activate(value) {
			if (!this.active) {
				this.active = true;
				this._raiseEvent("activated");
			}
		},
		deactivate: function ConditionTypeSet$deactivate() {
			if (this.active) {
				this.active = false;
				this._raiseEvent("deactivated");
			}
		},
		addActivated: function ConditionTypeSet$addActivated(handler) {
			this._addEvent("activated", handler);
		},
		removeActivated: function ConditionTypeSet$removeActivated(handler) {
			this._removeEvent("activated", handler);
		},
		addDeactivated: function ConditionTypeSet$addDeactivated(handler) {
			this._addEvent("deactivated", handler);
		},
		removeDeactivated: function ConditionTypeSet$removeDeactivated(handler) {
			this._removeEvent("deactivated", handler);
		},

		addConditionsChanged: function ConditionTypeSet$addConditionsChanged(handler) {

			// subscribe to the event
			this._addEvent("conditionsChanged", handler);

			// Return the condition type to support method chaining
			return this;
		},

		removeConditionsChanged: function ConditionTypeSet$removeConditionsChanged(handler) {
			this._removeEvent("conditionsChanged", handler);
		}
	};

	ConditionTypeSet.mixin(ExoWeb.Functor.eventing);

	ExoWeb.Model.ConditionTypeSet = ConditionTypeSet;

	// #endregion

	// #region ExoWeb.Model.ConditionType
	//////////////////////////////////////////////////

	function ConditionType(code, category, message, sets, origin) {
		// So that sub types can use it's prototype.
		if (arguments.length === 0) {
			return;
		}

		if (allConditionTypes[code]) {
			throw new Error("A condition type with the code \"" + code + "\" has already been created.");
		}

		Object.defineProperty(this, "code", { value: code });
		Object.defineProperty(this, "category", { value: category });
		Object.defineProperty(this, "message", { value: message });
		Object.defineProperty(this, "sets", { value: sets || [] });
		Object.defineProperty(this, "rules", { value: [] });
		Object.defineProperty(this, "conditions", { value: [] });
		Object.defineProperty(this, "origin", { value: origin });

		if (sets && sets.length > 0) {
			Array.forEach(sets, function(s) {
				s.types.push(this);
			}, this);
		}

		allConditionTypes[code] = this;
	}

	var allConditionTypes = ConditionType.allConditionTypes = {};

	ConditionType.all = function ConditionType$all() {
		/// <summary>
		/// Returns an array of all condition types that have been created.
		/// Note that the array is created each time the function is called.
		/// </summary>
		/// <returns type="Array" />

		var all = [];
		for (var name in allConditionTypes) {
			all.push(allConditionTypes[name]);
		}
		return all;
	}

	ConditionType.get = function ConditionType$get(code) {
		/// <summary>
		/// Returns the condition type with the given code, if it exists.
		/// </summary>
		/// <param name="code" type="String" />
		/// <returns type="ConditionTypeSet" />

		return allConditionTypes[code];
	};

	ConditionType.prototype = {

		// adds or removes a condition from the model for the specified target if necessary
		when: function ConditionType$when(condition, target, properties, message) {

			// get the current condition if it exists
			var conditionTarget = target.meta.getCondition(this);

			// add the condition on the target if it does not exist yet
			if (condition) {

				// if the message is a function, invoke to get the actual message
				message = message instanceof Function ? message(target) : message;

				// create a new condition if one does not exist
				if (!conditionTarget) {
					return new Condition(this, message, target, properties, "client");
				}

				// replace the condition if the message has changed
				else if (message && message != conditionTarget.condition.message) {

					// destroy the existing condition
					conditionTarget.condition.destroy();

					// create a new condition with the updated message
					return new Condition(this, message, target, properties, "client");
				}

				// otherwise, just return the existing condition
				else {
					return conditionTarget.condition;
				}
			}

			// Destroy the condition if it exists on the target and is no longer valid
			if (conditionTarget != null)
				conditionTarget.condition.destroy();

			// Return null to indicate that no condition was created
			return null;
		},
		extend: function ConditionType$extend(data) {
			for (var prop in data) {
				if (prop !== "type" && prop !== "rule" && !this["get_" + prop]) {
					var fieldName = "_" + prop;
					this[fieldName] = data[prop];
					this["get" + fieldName] = function ConditionType$getter() {
						return this[fieldName];
					}
				}
			}
		},
	
		addConditionsChanged: function ConditionType$addConditionsChanged(handler) {

			// subscribe to the event
			this._addEvent("conditionsChanged", handler);

			// Return the condition type to support method chaining
			return this;
		},

		removeConditionsChanged: function ConditionType$removeConditionsChanged(handler) {
			this._removeEvent("conditionsChanged", handler);
		}
	}

	ConditionType.mixin(Functor.eventing);

	ExoWeb.Model.ConditionType = ConditionType;

	(function() {
		//////////////////////////////////////////////////////////////////////////////////////
		function Error(code, message, sets, origin) {
			ConditionType.call(this, code, "Error", message, sets, origin);
		}

		Error.prototype = new ConditionType();

		ExoWeb.Model.ConditionType.Error = Error;

		//////////////////////////////////////////////////////////////////////////////////////
		function Warning(code, message, sets, origin) {
			ConditionType.call(this, code, "Warning", message, sets, origin);
		}

		Warning.prototype = new ConditionType();

		ExoWeb.Model.ConditionType.Warning = Warning;

		//////////////////////////////////////////////////////////////////////////////////////
		function Permission(code, message, sets, permissionType, isAllowed, origin) {
			ConditionType.call(this, code, "Permission", message, sets, origin);
			Object.defineProperty(this, "permissionType", { value: permissionType });
			Object.defineProperty(this, "isAllowed", { value: isAllowed });
		}

		Permission.prototype = new ConditionType();

		ExoWeb.Model.ConditionType.Permission = Permission;
	})();

	// #endregion

	// #region ExoWeb.Model.ConditionTarget
	//////////////////////////////////////////////////

	function ConditionTarget(condition, target, properties) {
		/// <summary>Represents the association of a condition to a specific target entity.</summary>
		/// <param name="condition" type="Condition">The condition the target is for.</param>
		/// <param name="target" type="Entity">The target entity the condition is associated with.</param>
		/// <param name="properties" type="Array" elementType="Property">The set of properties on the target entity the condition is related to.</param>
		/// <returns type="ConditionTarget">The new condition target.</returns>

	    /// <field name="target" type="Entity">The target entity the condition is associated with.</field>
	    /// <field name="condition" type="Condition">The condition the target is for.</field>
	    /// <field name="properties" type="Array" elementType="Property">The set of properties on the target entity the condition is related to.</field>

	    Object.defineProperty(this, "target", { value: target });
		Object.defineProperty(this, "condition", { value: condition });
		Object.defineProperty(this, "properties", { value: properties });

		// attach the condition target to the target entity
		target.meta.setCondition(this);
	}

	// #endregion

	// #region ExoWeb.Model.Condition
	//////////////////////////////////////////////////

	function Condition(type, message, target, properties, origin) {
		/// <summary>Represents an instance of a condition of a specific type associated with one or more entities in a model.</summary>
	    /// <param name="type" type="ConditionType">The type of condition, which usually is an instance of a subclass like Error, Warning or Permission.</param>
	    /// <param name="message" type="String">The optional message to use for the condition, which will default to the condition type message if not specified.</param>
		/// <param name="target" type="Entity">The root target entity the condition is associated with.</param>
	    /// <param name="properties" type="Array" elementType="String">The set of property paths specifying which properties and entities the condition should be attached to.</param>
		/// <param name="origin" type="String">The original source of the condition, either "client" or "server".</param>
		/// <returns type="Condition">The new condition instance.</returns>

		/// <field name="type" type="ConditionType">The type of condition, which usually is an instance of a subclass like Error, Warning or Permission.</field>
		/// <field name="message" type="String">The optional message to use for the condition, which will default to the condition type message if not specified.</field>
		/// <field name="origin" type="String">The original source of the condition, either "client" or "server".</field>
		/// <field name="targets" type="Array" elementType="ConditionTarget">The set of condition targets that link the condition to specific entities and properties.</field>

		Object.defineProperty(this, "type", { value: type });
		Object.defineProperty(this, "message", { value: message || (type ? type.message : undefined) });
		Object.defineProperty(this, "origin", { value: origin });

		var targets = [];

		// create targets if a root was specified
		if (target) {

			// set the properties to an empty array if not specified and normalize the paths to expand {} syntax if used
			properties = PathTokens.normalizePaths(properties || []);

			// create a single condition target if the specified properties are all on the root
			if (properties.every(function (p) { return p.length === 1; }))
				targets.push(new ConditionTarget(this, target, properties));

			// otherwise, process the property paths to create the necessary sources
			else {
				// process each property path to build up the condition sources
				for (var p = properties.length - 1; p >= 0; p--) {
					var steps = properties[p].steps;
					var instances = [target];

					var leaf = steps.length - 1;

					// iterate over each step along the path
					for (var s = 0; s < steps.length; s++) {
						var step = steps[s].property;
						var childInstances = [];

						// create condition targets for all instances for the current step along the path
						for (var i = instances.length - 1; i >= 0; i--) {
							var instance = instances[i];

							// get the property for the current step and instance type and skip if the property cannot be found
							var property = instance.meta.type.property(step);
							if (!property) {
								continue;
							}

							// only create conditions on the last step, the leaf node
							if (s === leaf) {
								// see if a target already exists for the current instance
								var conditionTarget = null;
								for (var t = targets.length - 1; t >= 0; t--) {
									if (targets[t].target === instance) {
										conditionTarget = targets[t];
										break;
									}
								}

								// create the condition target if it does not already exist
								if (!conditionTarget) {
									conditionTarget = new ConditionTarget(this, instance, [property]);
									targets.push(conditionTarget);
								}

								// otherwise, just ensure it references the current step
								else if (conditionTarget.properties.indexOf(property) < 0)
									conditionTarget.properties.push(property);
							}

							// get the value of the current step
							var child = property.value(instance);

							// add the children, if any, to the set of child instances to process for the next step
							if (child instanceof Entity)
								childInstances.push(child);
							else if (child instanceof Array && child.length > 0 && child[0] instanceof Entity)
								childInstances = childInstances.concat(child);
						}

						// assign the set of instances to process for the next step
						instances = childInstances;
					}
				}
			}
		}

		// store the condition targets
		Object.defineProperty(this, "targets", { value: targets });

		// raise events for the new condition
		if (this.type != formatConditionType) {

			// raise events on condition targets
			for (var t = targets.length - 1; t >= 0; t--) {
				var conditionTarget = targets[t];

				// instance events
				conditionTarget.target.meta._raiseEvent("conditionsChanged", [conditionTarget.target.meta, { conditionTarget: conditionTarget, add: true, remove: false }]);

				// type events
				for (var type = conditionTarget.target.meta.type; type; type = type.baseType) {
					type._raiseEvent("conditionsChanged", [conditionTarget.target.meta, { conditionTarget: conditionTarget, add: true, remove: false }]);
				}
			}

			// raise events on condition types
			this.type.conditions.push(this);
			this.type._raiseEvent("conditionsChanged", [this.type, { condition: this, add: true, remove: false }]);

			// raise events on condition type sets
			if (this.type.sets) {
				for (var s = this.type.sets.length - 1; s >= 0; s--) {
					var set = this.type.sets[s];
					set.conditions.push(this);
					set._raiseEvent("conditionsChanged", [set, { condition: this, add: true, remove: false }]);
				}
			}
		}
	}

	// implementation
	Condition.mixin({
		destroy: function Condition$destroy() {
			/// <summary>Removes the condition targets from all target instances and raises condition change events.</summary>

			// raise events on condition type sets
			if (this.type.sets) {
				for (var s = this.type.sets.length - 1; s >= 0; s--) {
					var set = this.type.sets[s];
					set.conditions.remove(this);
					set._raiseEvent("conditionsChanged", [set, { condition: this, add: false, remove: true }]);
				}
			}

			// raise events on condition types
			this.type.conditions.remove(this);
			this.type._raiseEvent("conditionsChanged", [this.type, { condition: this, add: false, remove: true }]);

			for (var t = this.targets.length - 1; t >= 0; t--) {
				var conditionTarget = this.targets[t];
				conditionTarget.target.meta.clearCondition(conditionTarget.condition.type);

				// instance events
				conditionTarget.target.meta._raiseEvent("conditionsChanged", [conditionTarget.target.meta, { conditionTarget: conditionTarget, add: false, remove: true }]);

				// type events
				for (var type = conditionTarget.target.meta.type; type; type = type.baseType) {
					type._raiseEvent("conditionsChanged", [conditionTarget.target.meta, { conditionTarget: conditionTarget, add: false, remove: true }]);
				}
			}

			// remove references to all condition targets
			this.targets.slice(0, 0);
		},
		toString: function Condition$toString() {
			return this.message;
		}
	});

	// Expose the type publicly
	ExoWeb.Model.Condition = Condition;

	// #endregion

	// #region ExoWeb.Model.FormatError
	//////////////////////////////////////////////////

	function FormatError(message, invalidValue) {
		Object.defineProperty(this, "message", { value: message });
		Object.defineProperty(this, "invalidValue", { value: invalidValue });
	}

	var formatConditionType = new ConditionType.Error("FormatError", "The value is not properly formatted.", []);

	FormatError.mixin({
		createCondition: function FormatError$createCondition(target, prop) {
			return new Condition(formatConditionType,
				this.message.replace("{property}", prop.get_label()),
				target,
				[prop.get_name()],
				"client");
		},
		toString: function FormateError$toString() {
			return this._invalidValue;
		}
	});

	ExoWeb.Model.FormatError = FormatError;

	// #endregion

	// #region ExoWeb.Model.FormatProvider
	//////////////////////////////////////////////////

	var formatProvider = function formatProvider(type, format) {
		throw new Error("Format provider has not been implemented.  Call ExoWeb.Model.setFormatProvider(fn);");
	};

	function getFormat(type, format) {

		// return null if a format specifier was not provided
		if (!format || format === '')
			return null;

		// initialize format cache
		if (!type._formats)
			type._formats = {};

		// first see if the requested format is cached
		var f = type._formats[format];
		if (f)
			return f;

		// then see if it is an entity type
		if (type.meta && type.meta instanceof Type)
			type._formats[format] = f = Format.fromTemplate(type, format);

		// otherwise, call the format provider to create a new format
		else
			type._formats[format] = f = formatProvider(type, format);

		return f;
	}

	function setFormatProvider(fn) {
		formatProvider = fn;
	}

	ExoWeb.Model.getFormat = getFormat;

	// #endregion

	// #region ExoWeb.Model.LazyLoader
	//////////////////////////////////////////////////

	/*global isType, PathTokens, logWarning, parseFunctionName, getValue, Signal */

	function LazyLoader() {
	}

	LazyLoader.eval = function LazyLoader$eval(target, path, successCallback, errorCallback, scopeChain, thisPtr/*, continueFn, performedLoading, root, processed, invokeImmediatelyIfPossible*/) {
		var processed, root, performedLoading, continueFn, step, i, value, invokeImmediatelyIfPossible;

		if (path === undefined || path === null) {
			path = "";
		}

		if (isType(path, String)) {
			path = new PathTokens(path);
		}
		else if (isType(path, Array)) {
			logWarning("Calling LazyLoader.eval with a path Array is deprecated, please use a string path instead.");
			path = new PathTokens(path.join("."));
		}
		else if (!isType(path, PathTokens)) {
			throw new Error("Unknown path \"" + path + "\" of type " + parseFunctionName(path.constructor) + ".");
		}

		scopeChain = scopeChain || [window];

		// If additional arguments were specified (internal), then use those.
		if (arguments.length === 11) {
			// Allow an invocation to specify continuing loading properties using a given function, by default this is LazyLoader.eval.
			// This is used by evalAll to ensure that array properties can be force loaded at any point in the path.
			continueFn = arguments[6] instanceof Function ? arguments[6] : continueFn;
			// Allow recursive calling function (eval or evalAll) to specify that loading was performed.
			performedLoading = arguments[7] instanceof Boolean ? arguments[7] : false;
			// Allow recursive calling function (eval or evalAll) to specify the root object being used.
			root = arguments[8];
			// Allow recursive calling function (eval or evalAll) to specify the processed steps.
			processed = arguments[9];
			// Allow recursive calling function (eval or evalAll) to specify whether to invoke the callback immmediately if possible (when no loading is required).
			invokeImmediatelyIfPossible = arguments[10];
		}
		// Initialize to defaults.
		else {
			continueFn = LazyLoader.eval;
			performedLoading = false;
			root = target;
			processed = [];
			invokeImmediatelyIfPossible = null;
		}

		// If the target is null or undefined then attempt to backtrack using the scope chain
		if (target === undefined || target === null) {
			target = root = scopeChain.dequeue();
		}
	
		while (path.steps.length > 0) {
			// If null or undefined was passed in with no scope chain, fail
			if (target === undefined || target === null) {
				if (errorCallback) {
					errorCallback.apply(thisPtr || this, ["Target is null or undefined"]);
				}
				else {
					throw new Error("Cannot complete property evaluation because the target is null or undefined");
				}
			}

			// If an array is encountered and this call originated from "evalAll" then delegate to "evalAll", otherwise
			// this will most likely be an error condition unless the remainder of the path are properties of Array.
			if (continueFn !== LazyLoader.eval && target instanceof Array) {
				continueFn(target, path, successCallback, errorCallback, scopeChain, thisPtr, continueFn, performedLoading, root, processed, invokeImmediatelyIfPossible);
				return;
			}

			// Get the next step to evaluate
			step = path.steps.dequeue();

			// If the target is not loaded then load it and continue when complete
			if (LazyLoader.isRegistered(target, null, step.property)) {
				performedLoading = true;
				Array.insert(path.steps, 0, step);
				LazyLoader.load(target, step.property, false, function () {
					continueFn(target, path, successCallback, errorCallback, scopeChain, thisPtr, continueFn, performedLoading, root, processed, invokeImmediatelyIfPossible);
				});
				return;
			}

			// Get the value of the current step
			value = getValue(target, step.property);

			// If the value is undefined then there is a problem since getValue returns null if a property exists but returns no value.
			if (value === undefined) {
				// Attempt to backtrack using the next item in the scope chain.
				if (scopeChain.length > 0) {
					target = root = scopeChain.dequeue();
					Array.insert(path.steps, 0, step);
					for (i = processed.length - 1; i >= 0; i -= 1) {
						Array.insert(path.steps, 0, processed[i]);
					}
					processed.length = 0;
				}
				// Otherwise, fail since the path could not be evaluated
				else {
					if (errorCallback) {
						errorCallback.apply(thisPtr || this, ["Property is undefined: " + step.property]);
					}
					else {
						throw new Error("Cannot complete property evaluation because a property is undefined: " + step.property);
					}

					return;
				}
			}
			// The next target is null (nothing left to evaluate) or there is a cast of the current property and the value is
			// not of the cast type (no need to continue evaluating).
			else if (value === null || (step.cast && !isType(value, step.cast))) {
				if (successCallback) {
					successCallback.apply(thisPtr || this, [null, performedLoading, root]);
				}
				return;
			}
			// Otherwise, continue to the next property.
			else {
				processed.push(step);
				target = value;
			}
		}

		// Load final object
		if (target !== undefined && target !== null && LazyLoader.isRegistered(target)) {
			performedLoading = true;
			LazyLoader.load(target, null, false, successCallback ? successCallback.prepare(thisPtr || this, [target, performedLoading, root]) : undefined);
		}
		else if (successCallback) {
			successCallback.apply(thisPtr || this, [target, performedLoading, root]);
		}
	};

	LazyLoader.evalAll = function LazyLoader$evalAll(target, path, successCallback, errorCallback, scopeChain, thisPtr/*, continueFn, performedLoading, root, processed, invokeImmediatelyIfPossible*/) {
		var root, performedLoading, processed, invokeImmediatelyIfPossible, signal, results, errors, successCallbacks, errorCallbacks, allSucceeded;

		if (arguments.length === 11) {
			performedLoading = arguments[7] instanceof Boolean ? arguments[7] : false;
			root = arguments[8];
			processed = arguments[9];
			invokeImmediatelyIfPossible = arguments[10];
		}
		else {
			performedLoading = false;
			root = target;
			processed = [];
			invokeImmediatelyIfPossible = null;
		}

		// Ensure that the target is an array
		if (!(target instanceof Array)) {
			LazyLoader.eval(target, path, successCallback, errorCallback, scopeChain, thisPtr, LazyLoader.evalAll, performedLoading, root, processed, invokeImmediatelyIfPossible);
			return;
		}
			// Ensure that the array is loaded, then continue
		else if (LazyLoader.isRegistered(target)) {
			LazyLoader.load(target, null, false, function () {
				LazyLoader.evalAll(target, path, successCallback, errorCallback, scopeChain, thisPtr, LazyLoader.evalAll, performedLoading, root, processed, invokeImmediatelyIfPossible);
			});
			return;
		}

		signal = new Signal("evalAll - " + path);
		results = [];
		errors = [];
		successCallbacks = [];
		errorCallbacks = [];
		allSucceeded = true;

		target.forEach(function (subTarget, i) {
			results.push(null);
			errors.push(null);
			successCallbacks.push(signal.pending(function (result, performedLoadingOne, rootOne) {
				performedLoading = performedLoading || performedLoadingOne;
				results[i] = result;
				if (root !== rootOne) {
					logWarning("Found different roots when evaluating all paths.");
				}
				root = rootOne;
			}, null, invokeImmediatelyIfPossible));
			errorCallbacks.push(signal.orPending(function (err) {
				allSucceeded = false;
				errors[i] = err;
			}, null, invokeImmediatelyIfPossible));
		});

		target.forEach(function (subTarget, i) {
			// Make a copy of the original path tokens for arrays so that items' processing don't affect one another.
			if (path instanceof PathTokens) {
				path = path.buildExpression();
			}
			LazyLoader.eval(subTarget, path, successCallbacks[i], errorCallbacks[i], scopeChain, thisPtr, LazyLoader.evalAll, performedLoading, root, processed.slice(0), invokeImmediatelyIfPossible);
		});

		signal.waitForAll(function () {
			if (allSucceeded) {
				// call the success callback if one exists
				if (successCallback) {
					successCallback.apply(thisPtr || this, [results, performedLoading, root]);
				}
			}
			else if (errorCallback) {
				errorCallback.apply(thisPtr || this, [errors]);
			}
			else {
				errors.forEach(function (e) {
					throw new Error("Error encountered while attempting to eval paths for all items in the target array: " + e);
				});
			}
		}, null, invokeImmediatelyIfPossible);
	};

	LazyLoader.isRegistered = function LazyLoader$isRegistered(obj, targetLoader, targetProperty) {
		var reg, loader, propertyLoader, targetPropertyName;

		if (obj === null || obj === undefined) {
			return false;
		}

		reg = obj._lazyLoader;

		if (!reg) {
			return false;
		}

		if (targetProperty) {
			if (isString(targetProperty)) {
				targetPropertyName = targetProperty;
			} else if (targetProperty instanceof Property) {
				targetPropertyName = targetProperty.get_name();
			} else {
				throw new Error("Unexpected targetProperty argument value \"" + targetProperty + "\" in LazyLoader.isRegistered().");
			}
			// Attempt to retrieve a property-specific loader if it exists.
			if (reg.byProp && reg.byProp.hasOwnProperty(targetPropertyName)) {
				propertyLoader = reg.byProp[targetPropertyName];
				if (propertyLoader !== null && propertyLoader !== undefined) {
					return true;
				}
			}
		}

		loader = reg.allProps;
		if (loader !== null && loader !== undefined) {
			if (targetLoader) {
				return loader === targetLoader;
			}
			return true;
		}

		return false;
	};

	LazyLoader.isLoaded = function LazyLoader$isLoaded(obj /*, paths...*/) {
		var result, paths, singlePath, singleStep, nextStep, propName, filterType, property, value;

		if (obj === undefined) {
			result = undefined;
		} else if (obj === null) {
			result = null;
		} else {
			if (arguments.length === 1) {
				// No paths were specified...
				paths = null;
			} else {
				// Paths were specified in some form. They can be passed in as an array of 1 or
				// more arguments, or passed in seperately to be processed as "rest" arguments.
				if (arguments.length === 2) {
					if (isType(arguments[1], Array)) {
						// 1) isLoaded(obj, ["arg1", "arg2", ...]);
						paths = arguments[1];
					} else {
						// 2) isLoaded(obj, "arg");
						paths = [arguments[1]];
					}
				} else {
					// 3) isLoaded(obj, "arg1", "arg2", ...);
					paths = Array.prototype.slice.call(arguments, 1);
				}
			}

			if (!paths || paths.length === 0) {
				// No paths, so this is only an object-level check for the existence of a loader.
				result = !LazyLoader.isRegistered(obj);
			} else if (paths.length === 1) {
				// Only one path, so walk down the path until a non-loaded step is detected.
				singlePath = paths[0];

				// Remove unnecessary "this." prefix.
				if (isType(singlePath, String) && singlePath.startsWith("this.")) {
					singlePath = singlePath.substring(5);
				}

				// Attempt to optimize for a single property name or final path step.
				if (isType(singlePath, String) && singlePath.indexOf(".") < 0) {
					if (singlePath.length === 0) {
						throw new Error("Unexpected empty string passed to LazyLoader.isLoaded().");
					}
					propName = singlePath;
				} else if (isType(singlePath, PathTokens)) {
					if (singlePath.steps.length === 0) {
						throw new Error("Unexpected empty path tokens passed to LazyLoader.isLoaded().");
					} else if (singlePath.steps.length === 1) {
						singleStep = singlePath.steps.dequeue();
						propName = singleStep.property;
					}
				}

				if (propName) {
					// Optimize for a single property name or path step.
					if (LazyLoader.isRegistered(obj, null, propName)) {
						result = false;
					} else {
						// Get the value of the single property or final path step.
						if (obj.meta) {
							property = obj.meta.property(propName, true);
							value = property.value(obj);
						} else {
							value = getValue(obj, propName);
						}

						if (!value) {
							// There is no value, so there can be no lazy loader registered.
							return true;
						} else {
							// If the property value doesn't have a registered lazy loader, then it is considered loaded.
							return !LazyLoader.isRegistered(value);
						}
					}
				} else {
					if (isType(singlePath, String)) {
						if (singlePath.length === 0) {
							throw new Error("Unexpected empty string passed to LazyLoader.isLoaded().");
						}
						singlePath = new PathTokens(singlePath);
					} else if (!isType(singlePath, PathTokens)) {
						throw new Error("Unknown path \"" + singlePath + "\" of type " + parseFunctionName(singlePath.constructor) + ".");
					}

					// Get the value of the next step.
					nextStep = singlePath.steps.dequeue();
					if (obj.meta) {
						property = obj.meta.property(nextStep.property, true);
						value = property.value(obj);
					} else {
						value = getValue(obj, nextStep.property);
					}

					if (!value) {
						// There is no value, so there can be no lazy loader registered.
						return true;
					} else if (LazyLoader.isRegistered(value)) {
						// There is a lazy loader, so stop processing and return false.
						return false;
					} else {
						// There is no lazy loader, so continue processing the next step.
						if (nextStep.cast) {
							filterType = Model.getJsType(nextStep.cast, true);
						}
						if (nextStep.cast && !filterType) {
							// Stop processing since the filter type doesn't yet exist.
							result = true;
						} else if (isArray(value)) {
							// Make a copy of the original path tokens for arrays so that items' processing don't affect one another.
							if (singlePath instanceof PathTokens) {
								singlePath = singlePath.buildExpression();
							}
							result = !value.some(function (item) {
								return (!filterType || item instanceof filterType) && !LazyLoader.isLoaded(item, singlePath);
							});
						} else if (filterType && !(value instanceof filterType)) {
							// Stop processing since the value doesn't pass the filter.
							result = true;
						} else {
							result = LazyLoader.isLoaded(value, singlePath);
						}
					}
				}
			} else {
				// Multiple paths, so check each one individually.
				result = !paths.some(function (path) {
					// Use some and the inverse of the result in order to exit
					// immediately as soon as a non-loaded step is found.
					return !LazyLoader.isLoaded(obj, path);
				});
			}
		}

		return result;
	};

	LazyLoader.load = function LazyLoader$load(obj, propName, inScope, callback, thisPtr) {
		var reg = obj._lazyLoader;
		if (!reg) {
			if (callback && callback instanceof Function) {
				callback.call(thisPtr || this);
			}
		}
		else {
			var loader;
			if (propName && reg.byProp) {
				loader = reg.byProp[propName];
			}

			if (!loader) {
				loader = reg.allProps;
			}

			if (!loader) {
				throw new Error($format("Attempting to load object but no appropriate loader is registered. object: {0}, property: {1}", obj, propName));
			}

			loader.load(obj, propName, inScope, callback, thisPtr);
		}
	};

	LazyLoader.register = function LazyLoader$register(obj, loader, propName) {
		var reg = obj._lazyLoader;

		if (!reg) {
			reg = obj._lazyLoader = {};
		}

		if (propName) {
			if (!reg.byProp) {
				reg.byProp = {};
			}

			reg.byProp[propName] = loader;
		}
		else {
			obj._lazyLoader.allProps = loader;
		}
	};

	LazyLoader.unregister = function LazyLoader$unregister(obj, loader, propName) {
		var reg = obj._lazyLoader;

		if (!reg) {
			return;
		}

		if (propName) {
			delete reg.byProp[propName];
		} else if (reg.byProp) {
			var allDeleted = true;
			for (var p in reg.byProp) {
				if (reg.byProp[p] === loader) {
					delete reg.byProp[p];
				}
				else {
					allDeleted = false;
				}
			}

			if (allDeleted) {
				delete reg.byProp;
			}
		}

		if (reg.allProps === loader) {
			delete reg.allProps;
		}

		if (!reg.byProp && !reg.allProps) {
			delete obj._lazyLoader;
		}
	};

	// #endregion

	// #region ExoWeb.Model.Utilities
	//////////////////////////////////////////////////

	var coreGetValue = getValue;

	// If a getter method matching the given property name is found on the target it is invoked and returns the 
	// value, unless the the value is undefined, in which case null is returned instead.  This is done so that 
	// calling code can interpret a return value of undefined to mean that the property it requested does not exist.
	// TODO: better name
	getValue = function getValueOverride(target, property) {

		// first see if the property is a model property
		if (target instanceof ExoWeb.Model.Entity || (target.meta && target.meta instanceof ExoWeb.Model.Type)) {
			var prop = target.meta.type.property(property);
			if (prop) {
				var value = prop.value(target);
				if (value === undefined) {
					value = null;
				}
				return value;
			}
		}

		return coreGetValue(target, property);
	}

	ExoWeb.getValue = getValue;

	// #endregion

	// #region ExoWeb.Mapper.ObjectProvider
	//////////////////////////////////////////////////

	/*global exports, context, Batch */

	var objectProviderFn = function objectProviderFn() {
		throw new Error("Object provider has not been implemented. Call ExoWeb.Mapper.setObjectProvider(fn);");
	};

	function objectProvider(type, ids, paths, inScope, changes, onSuccess, onFailure, thisPtr) {
		var scopeQueries, batch;

		// ensure correct value of "scopeQueries" argument
		if (onSuccess !== undefined && onSuccess !== null && !(onSuccess instanceof Function)) {
			// scopeQueries is included in call, so shift arguments
			scopeQueries = onSuccess;
			onSuccess = onFailure;
			onFailure = thisPtr;
			thisPtr = arguments.length > 8 ? arguments[8] : null;
		}
		else {
			// scopeQueries is NOT included in call, so insert default value into args array
			scopeQueries = context.server._scopeQueries; //ignore jslint
		}

		if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
			thisPtr = onFailure;
			onFailure = null;
		}

		batch = Batch.suspendCurrent("objectProvider");

		objectProviderFn(type, ids, paths, inScope, changes, scopeQueries,
			function () {
				Batch.resume(batch);
				if (onSuccess) {
					onSuccess.apply(thisPtr || null, arguments);
				}
			},
			function () {
				Batch.resume(batch);
				if (onFailure) {
					onFailure.apply(thisPtr || null, arguments);
				}
			});
	}

	ExoWeb.Mapper.setObjectProvider = function setObjectProvider(fn) {
		objectProviderFn = fn;
	};

	// #endregion

	// #region ExoWeb.Mapper.QueryProvider
	//////////////////////////////////////////////////

	/*global exports, context, Batch */

	var queryProviderFn = function queryProviderFn() {
		throw new Error("Query provider has not been implemented. Call ExoWeb.Mapper.setQueryProvider(fn);");
	};

	function queryProvider(queries, changes, onSuccess, onFailure, thisPtr) {
		var scopeQueries, batch;

		// ensure correct value of "scopeQueries" argument
		if (onSuccess !== undefined && onSuccess !== null && !(onSuccess instanceof Function)) {
			// scopeQueries is included in call, so shift arguments
			scopeQueries = onSuccess;
			onSuccess = onFailure;
			onFailure = thisPtr;
			thisPtr = arguments.length > 5 ? arguments[5] : null;
		}
		else {
			// scopeQueries is NOT included in call, so insert default value into args array
			scopeQueries = context.server._scopeQueries; //ignore jslint
		}

		if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
			thisPtr = onFailure;
			onFailure = null;
		}

		batch = Batch.suspendCurrent("queryProvider");

		queryProviderFn(queries, changes, scopeQueries,
			function () {
				Batch.resume(batch);
				if (onSuccess) {
					onSuccess.apply(thisPtr || this, arguments);
				}
			},
			function () {
				Batch.resume(batch);
				if (onFailure) {
					onFailure.apply(thisPtr || this, arguments);
				}
			});
	}

	ExoWeb.Mapper.setQueryProvider = function setQueryProvider(fn) {
		queryProviderFn = fn;
	};

	// #endregion

	// #region ExoWeb.Mapper.TypeProvider
	//////////////////////////////////////////////////

	/*global exports, Batch, copy, purge, eachProp */

	var typeProviderFn = function typeProviderFn() {
		throw new Error("Type provider has not been implemented. Call ExoWeb.Mapper.setTypeProvider(fn);");
	};

	function typeProviderImpl(types, callback, thisPtr) {
		var batch = Batch.suspendCurrent("typeProvider"),
			typesToLoad = copy(types),
			cachedTypes = [],
			typesJson = {};

		purge(typesToLoad, function (type) {
			var cachedType = window.ExoWeb.cache(type);

			if (!cachedType) {
				return false;
			}
			else if (window.ExoWeb.cacheHash && cachedType.cacheHash !== window.ExoWeb.cacheHash) {
				// the cached type definition is out of date, so remove it and continue
				window.ExoWeb.cache(type, null);
				return false;
			}

			cachedTypes.push(type);
			return true;
		});

		// If some (or all) of the types are currently cached, go ahead and call the success function.
		if (cachedTypes.length > 0) {
			cachedTypes.forEach(function (type) {
				typesJson[type] = window.ExoWeb.cache(type).types[type];
			});
		}

		if (typesToLoad.length > 0) {
			typeProviderFn(typesToLoad,
				function (result) {
					Batch.resume(batch);

					var resultsJson = result.types;

					// Add the resulting json and cache each type.
					eachProp(resultsJson, function (type) {

						// construct a json object, with the cachehash, for cacheing
						var json = { cacheHash: window.ExoWeb.cacheHash, types: {} };

						// extract the type definition
						json.types[type] = typesJson[type] = resultsJson[type];

						// cache the type
						window.ExoWeb.cache(type, json);

					});

					callback.call(thisPtr || null, true, typesJson);
				},
				function () {
					Batch.resume(batch);

					var args = copy(arguments);
					args.splice(0, 0, false);
					callback.apply(thisPtr || null, args);
				});
		}
		else {
			Batch.resume(batch);
			callback.call(thisPtr || null, true, typesJson);
		}
	}

	function deleteTypeJson(originalArgs, invocationArgs, callbackArgs) {
		// If type request was handled by another caller, then assume that typesFromJson will be called
		if (callbackArgs[0]) {
			callbackArgs.splice(1, 1, {}, callbackArgs[1]);
		}
	}

	var typeProvider = typeProviderImpl.dontDoubleUp({ callbackArg: 1, partitionedArg: 0, partitionedFilter: deleteTypeJson, memoize: true });

	ExoWeb.Mapper.setTypeProvider = function setTypeProvider(fn) {
		typeProviderFn = fn;
	};

	// #endregion

	// #region ExoWeb.Mapper.ListProvider
	//////////////////////////////////////////////////

	/*global exports, context, Batch */

	var listProviderFn = function listProvider() {
		throw new Error("List provider has not been implemented. Call ExoWeb.Mapper.setListProvider(fn);");
	};

	function listProvider(ownerType, owner, listProp, paths, changes, onSuccess, onFailure, thisPtr) {
		var scopeQueries, batch, listPath, pathsToLoad, ownerId;

		// ensure correct value of "scopeQueries" argument
		if (onSuccess !== undefined && onSuccess !== null && !(onSuccess instanceof Function)) {
			// scopeQueries is included in call, so shift arguments
			scopeQueries = onSuccess;
			onSuccess = onFailure;
			onFailure = thisPtr;
			thisPtr = arguments.length > 7 ? arguments[7] : null;
		}
		else {
			// scopeQueries is NOT included in call, so insert default value into args array
			scopeQueries = context.server._scopeQueries; //ignore jslint
		}

		if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
			thisPtr = onFailure;
			onFailure = null;
		}

		batch = Batch.suspendCurrent("listProvider");

		ownerId = owner === "static" ? null : owner;
		listPath = owner === "static" ? ownerType + "." + listProp : listProp;
		pathsToLoad = [listPath];

		// prepend list prop to beginning of each other prop
		if (paths && paths.length > 0) {
			Array.forEach(paths, function (p) {
				pathsToLoad.push(listPath + "." + p);
			});
		}

		listProviderFn(ownerType, ownerId, pathsToLoad, changes, scopeQueries,
			function () {
				Batch.resume(batch);
				if (onSuccess) {
					onSuccess.apply(thisPtr || null, arguments);
				}
			},
			function () {
				Batch.resume(batch);
				if (onFailure) {
					onFailure.apply(thisPtr || null, arguments);
				}
			});
	}

	ExoWeb.Mapper.setListProvider = function setListProvider(fn) {
		listProviderFn = fn;
	};

	// #endregion

	// #region ExoWeb.Mapper.RoundtripProvider
	//////////////////////////////////////////////////

	/*global exports, context, Batch */

	var roundtripProviderFn = function roundtripProviderFn() {
		throw new Error("Roundtrip provider has not been implemented. Call ExoWeb.Mapper.setRoundtripProvider(fn);");
	};

	function roundtripProvider(root, paths, changes, onSuccess, onFailure, thisPtr) {
		var scopeQueries, batch;
	
		// ensure correct value of "scopeQueries" argument
		if (onSuccess !== undefined && onSuccess !== null && !(onSuccess instanceof Function)) {
			// scopeQueries is included in call, so shift arguments
			scopeQueries = onSuccess;
			onSuccess = onFailure;
			onFailure = thisPtr;
			thisPtr = arguments.length > 4 ? arguments[4] : null;
		}
		else {
			// scopeQueries is NOT included in call, so insert default value into args array
			scopeQueries = context.server._scopeQueries; //ignore jslint
		}

		if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
			thisPtr = onFailure;
			onFailure = null;
		}

		batch = Batch.suspendCurrent("roundtripProvider");

		roundtripProviderFn(root, paths, changes, scopeQueries,
			function () {
				Batch.resume(batch);
				if (onSuccess) {
					onSuccess.apply(thisPtr || this, arguments);
				}
			},
			function () {
				Batch.resume(batch);
				if (onFailure) {
					onFailure.apply(thisPtr || this, arguments);
				}
			});
	}

	ExoWeb.Mapper.setRoundtripProvider = function setRoundtripProvider(fn) {
		roundtripProviderFn = fn;
	};

	// #endregion

	// #region ExoWeb.Mapper.SaveProvider
	//////////////////////////////////////////////////

	/*global exports, context, Batch */

	var saveProviderFn = function saveProviderFn() {
		throw new Error("Save provider has not been implemented. Call ExoWeb.Mapper.setSaveProvider(fn);");
	};

	function saveProvider(root, changes, onSuccess, onFailure, thisPtr) {
		var scopeQueries, batch;

		// ensure correct value of "scopeQueries" argument
		if (onSuccess !== undefined && onSuccess !== null && !(onSuccess instanceof Function)) {
			// scopeQueries is included in call, so shift arguments
			scopeQueries = onSuccess;
			onSuccess = onFailure;
			onFailure = thisPtr;
			thisPtr = arguments.length > 5 ? arguments[5] : null;
		}
		else {
			// scopeQueries is NOT included in call, so insert default value into args array
			scopeQueries = context.server._scopeQueries; //ignore jslint
		}

		if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
			thisPtr = onFailure;
			onFailure = null;
		}

		batch = Batch.suspendCurrent("saveProvider");
		saveProviderFn(root, changes, scopeQueries,
			function () {
				Batch.resume(batch);
				if (onSuccess) {
					onSuccess.apply(thisPtr || this, arguments);
				}
			},
			function () {
				Batch.resume(batch);
				if (onFailure) {
					onFailure.apply(thisPtr || this, arguments);
				}
			});
	}

	ExoWeb.Mapper.setSaveProvider = function setSaveProvider(fn) {
		saveProviderFn = fn;
	};

	// #endregion

	// #region ExoWeb.Mapper.EventProvider
	//////////////////////////////////////////////////

	/*global exports, context, Batch */

	var eventProviderFn = function eventProviderFn() {
		throw new Error("Event provider has not been implemented. Call ExoWeb.Mapper.setEventProvider(fn);");
	};

	function eventProvider(eventType, eventInstance, event, paths, changes, onSuccess, onFailure, thisPtr) {
		var scopeQueries, batch;

		// ensure correct value of "scopeQueries" argument
		if (onSuccess !== undefined && onSuccess !== null && !(onSuccess instanceof Function)) {
			// scopeQueries is included in call, so shift arguments
			scopeQueries = onSuccess;
			onSuccess = onFailure;
			onFailure = thisPtr;
			thisPtr = arguments.length > 8 ? arguments[8] : null;
		}
		else {
			// scopeQueries is NOT included in call, so insert default value into args array
			scopeQueries = context.server._scopeQueries; //ignore jslint
		}

		if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
			thisPtr = onFailure;
			onFailure = null;
		}

		batch = Batch.suspendCurrent("eventProvider");
		eventProviderFn(eventType, eventInstance, event, paths, changes, scopeQueries,
			function () {
				Batch.resume(batch);
				if (onSuccess) {
					onSuccess.apply(thisPtr || null, arguments);
				}
			},
			function () {
				Batch.resume(batch);
				if (onFailure) {
					onFailure.apply(thisPtr || null, arguments);
				}
			});
	}

	ExoWeb.Mapper.setEventProvider = function setEventProvider(fn) {
		eventProviderFn = fn;
	};

	// #endregion

	// #region ExoWeb.Mapper.ResponseHandler
	//////////////////////////////////////////////////

	function ResponseHandler(model, serverSync, options) {
		if (options === undefined || options === null) {
			throw new Error("Options cannot be null or undefined.");
		}

		this._model = model;
		this._serverSync = serverSync;
		this._options = options;
	}

	ResponseHandler.mixin({
		execute: ExoWeb.FunctionChain.prepare(
			function ResponseHandler$startResponseBatch(callback, thisPtr) {
				/// <summary>
				/// Start a new response batch.
				/// </summary>

				this._batch = Batch.start("ResponseHandler");
				callback.call(thisPtr || this);
			},
			function ResponseHandler$setServerInfo(callback, thisPtr) {
				/// <summary>
				/// Set server info from JSON
				/// </summary>

				if (this._options.serverInfo) {
					this._serverSync.set_ServerInfo(this._options.serverInfo);
				}

				callback.call(thisPtr || this);
			},

			function ResponseHandler$loadTypes(callback, thisPtr) {
				/// <summary>
				/// Load types from JSON
				/// </summary>
				if (this._options.types) {
					for (var typeName in this._options.types) {
						var mtype = this._model.type(typeName);

						// If this type has not already been loaded, laod from JSON
						if (!mtype || LazyLoader.isRegistered(mtype)) {
							var typesToUse = {};
							typesToUse[typeName] = this._options.types[typeName];
							typesFromJson(this._model, typesToUse);

							mtype = this._model.type(typeName);

							// Remove lazy-loader
							TypeLazyLoader.unregister(mtype);

							// Raise $extends handlers for the type
							raiseExtensions(mtype);
						}
					}
				}

				callback.call(thisPtr || this);
			},

			function ResponseHandler$startQueueingEvents(callback, thisPtr) {
				/// <summary>
				/// Start queueing model events
				/// </summary>

				this._eventScope = new EventScope();
				callback.call(thisPtr || this);
			},

			function ResponseHandler$applyChanges(callback, thisPtr) {
				/// <summary>
				/// Apply changes from JSON
				/// </summary>

				if (this._options.changes) {
					if (this._options.changes) {
						this._serverSync.applyChanges(this._options.checkpoint, this._options.changes, this._options.source, null, this._options.checkpoint, this._options.description ? this._options.description + ":response" : null, null, this._options.beforeApply, this._options.afterApply, callback, thisPtr);
					}
					else {
						if (this._options.source) {
							// no changes, so record empty set
							this._serverSync._changeLog.addSet(this._options.source, this._options.description + ":response");
							this._serverSync._changeLog.start({ user: this._serverSync.get_localUser() });
						}
						callback.call(thisPtr || this);
					}
				}
				else {
					callback.call(thisPtr || this);
				}
			},

			function ResponseHandler$loadInstances(callback, thisPtr) {
				/// <summary>
				/// Load instance data from JSON
				/// </summary>

				if (this._options.instances) {
					objectsFromJson(this._model, this._options.instances, function (instancesPendingInit) {
						this.instancesPendingInit = instancesPendingInit;
						callback.apply(thisPtr || this, arguments);
					}, this);
				}
				else {
					callback.call(thisPtr || this);
				}
			},

			function ResponseHandler$registerRules(callback, thisPtr) {
				/// <summary>
				/// Register all rules pending registration with the model
				/// </summary>

				this._model.registerRules();
				callback.call(thisPtr || this);
			},

			function ResponseHandler$stopQueueingEvents(callback, thisPtr) {
				/// <summary>
				/// Stop queueing model events
				/// </summary>

				this._serverSync.batchChanges(this._options.description + ":result", function () {
					this._eventScope.exit();
				}, this);

				callback.call(thisPtr || this);
			},

			function ResponseHandler$initInstances(callback, thisPtr) {
				/// <summary>
				/// Initialize all instances loaded by the response
				/// </summary>

				// Raise init events for existing instances loaded by the response
				if (this.instancesPendingInit) {
					var instances = this.instancesPendingInit;
					context.server._changeLog.batchChanges(this._options.description ? this._options.description + ":initExisting" : "responseHandlerInitExisting", context.server._localUser, function () {
						instances.forEach(function (obj) {
							for (var t = obj.meta.type; t; t = t.baseType) {
								var handler = t._getEventHandler("initExisting");
								if (handler)
									handler(obj, {});
							}
						});
					}, true);
				}

				callback.call(thisPtr || this);
			},

			function ResponseHandler$loadConditions(callback, thisPtr) {
				/// <summary>
				/// Load conditions from JSON
				/// </summary>

				if (this._options.conditions) {
					conditionsFromJson(this._model, this._options.conditions, this.instancesPendingInit, callback, thisPtr);
				}
				else {
					callback.call(thisPtr || this);
				}
			},

			function ResponseHandler$endResponseBatch(callback, thisPtr) {
				/// <summary>
				/// End the response batch.
				/// </summary>

				Batch.end(this._batch);
				callback.call(thisPtr || this);
			}
		)
	});

	ResponseHandler.execute = function (model, serverSync, options, callback, thisPtr) {
		(new ResponseHandler(model, serverSync, options)).execute(callback, thisPtr);
	};

	ExoWeb.Mapper.ResponseHandler = ResponseHandler;

	// #endregion

	// #region ExoWeb.Mapper.Translation
	//////////////////////////////////////////////////

	// Gets or loads the entity with the specified typed string id
	Entity.fromIdString = function Entity$fromIdString(idString) {
		// Typed identifiers take the form "type|id".
	    var type = idString.substring(0, idString.indexOf("|"));
	    var id = idString.substring(type.length + 1);

		// Use the left-hand portion of the id string as the object's type.
		var jstype = ExoWeb.Model.Model.getJsType(type);

		// Attempt to retrieve the object with the given id.
		var obj = jstype.meta.get(
			// Use the right-hand portion of the id string as the object's id.
			id,

			// Typed identifiers may or may not be the exact type of the instance.
			// An id string may be constructed with only knowledge of the base type.
			false
		);

		// If the object does not exist, assume it is an existing object that is not
		// yet in memory client-side, so create a ghosted instance.
		if (!obj) {
			obj = new jstype(id);
			if (jstype.meta.get_origin() === "server") {
				ObjectLazyLoader.register(obj);
			}
		}

		return obj;
	};

	function toExoModel(val, translator) {
		if (val === undefined || val === null)
			return;

		// entities only: translate forward to the server's id
		if (val instanceof ExoWeb.Model.Entity) {
			var result = {
				id: val.meta.id,
				type: val.meta.type.get_fullName()
			};

			if (val.meta.isNew) {
				result.isNew = true;
			}

			result.id = translator.forward(result.type, result.id) || result.id;
			return result;
		}

		return val;
	}

	function translateId(translator, type, id) {
		// get the server id, either translated or as the serialized entity id itself
		var serverId = translator.forward(type, id) || id;
		// get the client id, either a reverse translation of the server id or the server id itself
		var clientId = translator.reverse(type, serverId) || serverId;

		return clientId;
	}

	function fromExoModel(val, translator, create, supplementalObjectsArray) {
		if (val !== undefined && val !== null && val.type && val.id ) {
			var type = ExoWeb.Model.Model.getJsType(val.type);

			// Entities only: translate back to the client's id.  This is necessary to handle the fact that ids are created on 
			// both the client and server.  Also, in some cases a transaction references an entity that was created on the server 
			// and then committed, so that the id actually references an object that already exists on the client but with a different id.
			//--------------------------------------------------------------------------------------------------------
			if (type.meta && type.meta instanceof ExoWeb.Model.Type && translator) {
				// NOTE: don't alter the original object
				var id = translateId(translator, val.type, val.id);

				var obj = type.meta.get(id,
					// Since "fromExoModel" operates on the ExoModel change object format,
					// it can be assumed that the instance type is exact.
					true
				);

				// If the object was not found and a supplemental list was provided, then search for it
				if (!obj && supplementalObjectsArray && supplementalObjectsArray.length > 0) {
					var matches = supplementalObjectsArray.filter(function(o) {
						return o instanceof type && o.meta.id === id;
					});
					if (matches.length > 1) {
						throw new Error("Expected a single item, but found " + matches.length + ".");
					}
					obj = matches[0];
				}

				if (!obj && create) {
					obj = new type(id);
					if (type.meta.get_origin() === "server") {
						ObjectLazyLoader.register(obj);
					}
				}

				return obj;
			}

			// is this needed? Can the if statement that checks type.meta be removed?
			return val;
		}

		return val;
	}

	// #endregion

	// #region ExoWeb.Mapper.ExoModelEventListener
	//////////////////////////////////////////////////

	function ExoModelEventListener(model, translator, filters) {
		this._model = model;
		this._translator = translator;
		this._filters = filters;

		// listen for events
		model.addListChanged(this.onListChanged.bind(this));
		model.addAfterPropertySet(this.onPropertyChanged.bind(this));
		model.addObjectRegistered(this.onObjectRegistered.bind(this));
		model.addObjectUnregistered(this.onObjectUnregistered.bind(this));
	}

	ExoModelEventListener.mixin(ExoWeb.Functor.eventing);

	ExoModelEventListener.mixin({
		addChangeDetected: function ExoModelEventListener$onEvent(handler) {
			this._addEvent("changeDetected", handler);
		},

		// Model event handlers
		onListChanged: function ExoModelEventListener$onListChanged(obj, property, listChanges) {
			if (this._filters && this._filters.listChanged && this._filters.listChanged(obj, property, listChanges) !== true)
				return;

			// Recording static property changes is not supported by the JSON format or the server-side implementation.
			if (property.get_isStatic()) {
				return;
			}

			for (var i = 0; i < listChanges.length; ++i) {
				var listChange = listChanges[i];

				var change = {
					type: "ListChange",
					instance: toExoModel(obj, this._translator),
					property: property.get_name(),
					added: [],
					removed: []
				};

				var _this = this;
				if (listChange.newStartingIndex >= 0 || listChange.newItems) {
					Array.forEach(listChange.newItems, function ExoModelEventListener$onListChanged$addedItem(obj) {
						change.added.push(toExoModel(obj, _this._translator));
					});
				}
				if (listChange.oldStartingIndex >= 0 || listChange.oldItems) {
					Array.forEach(listChange.oldItems, function ExoModelEventListener$onListChanged$removedItem(obj) {
						change.removed.push(toExoModel(obj, _this._translator));
					});
				}

				this._raiseEvent("changeDetected", [change]);
			}
		},
		onObjectRegistered: function ExoModelEventListener$onObjectRegistered(obj) {
			if (this._filters && this._filters.objectRegistered && this._filters.objectRegistered(obj) !== true)
				return;

			if (obj.meta.isNew) {
				var change = {
					type: "InitNew",
					instance: toExoModel(obj, this._translator)
				};

				this._raiseEvent("changeDetected", [change]);
			}
		},
		onObjectUnregistered: function ExoModelEventListener$onObjectUnregistered(obj) {
			if (this._filters && this._filters.objectUnregistered && this._filters.objectUnregistered(obj) !== true)
				return;

			//if (obj.meta.type.get_origin() === "server") {
			//	throw new Error($format("Unregistering server-type objects is not currently supported: {0}|{1}", obj.meta.type.fullName, obj.meta.id));
			//}
		},
		onPropertyChanged: function ExoModelEventListener$onPropertyChanged(obj, property, newValue, oldValue) {
			if (this._filters && this._filters.propertyChanged && this._filters.propertyChanged(obj, property, newValue, oldValue) !== true)
				return;

			// Recording static property changes is not supported by the JSON format or the server-side implementation.
			if (property.get_isStatic()) {
				return;
			}

			if (property.get_isValueType()) {
				var valueChange = {
					type: "ValueChange",
					instance: toExoModel(obj, this._translator),
					property: property.get_name(),
					oldValue: oldValue,
					newValue: newValue
				};

				this._raiseEvent("changeDetected", [valueChange]);
			}
			else {
				var refChange = {
					type: "ReferenceChange",
					instance: toExoModel(obj, this._translator),
					property: property.get_name(),
					oldValue: toExoModel(oldValue, this._translator),
					newValue: toExoModel(newValue, this._translator)
				};

				this._raiseEvent("changeDetected", [refChange]);
			}
		}
	});

	ExoWeb.Mapper.ExoModelEventListener = ExoModelEventListener;

	// #endregion

	// #region ExoWeb.Mapper.ChangeSet
	//////////////////////////////////////////////////

	/*globals exports, Functor, ArgumentError, ArgumentNullError, ArgumentTypeError, randomText */

	function ChangeSet(source, title, user, initialChanges, code) {
		if (source === null || source === undefined) {
			throw new ArgumentNullError("source");
		}
		if (source.constructor !== String) {
			throw new ArgumentTypeError("source", "string", source);
		}
		if (source !== "init" && source !== "server" && source !== "client") {
			throw new ArgumentError("source", source + " must be in the set ['init', 'server', 'client']");
		}
		if (user !== null && user !== undefined && user.constructor !== String) {
			throw new ArgumentTypeError("user", "string", user);
		}

		this.code = code || randomText(8);
		this.source = source;
		this.title = title || null;
		this.user = user || null;
		this.changes = (initialChanges && initialChanges instanceof Array) ? [].concat(initialChanges) : [];
		this.onChangeAdded = new Functor();
		this.onChangeUndone = new Functor();
		this.onTruncated = new Functor();
	}

	ChangeSet.mixin({
		add: function (change) {
			var idx = this.changes.push(change) - 1;
			this.onChangeAdded(change, idx, this);
			return idx;
		},
		checkpoint: function (title, code) {
			// Generate a random code for the checkpoint if one is not given.
			if (!code) {
				code = randomText(10);
			}

			// Add the checkpoint and return the code.
			this.add({ type: "Checkpoint", title: title || "untitled", code: code });
			return code;
		},
		count: function (filter, thisPtr) {
			if (!filter) {
				return this.changes.length;
			}

			return this.changes.filter(filter, thisPtr).length;
		},
		lastChange: function () {
			return this.changes.length > 0 ? this.changes[this.changes.length - 1] : null;
		},
		serialize: function (forServer, filter, thisPtr) {
			if (arguments.length === 0) {
				forServer = true;
			} else if (forServer instanceof Function) {
				thisPtr = filter;
				filter = forServer;
				forServer = true;
			}

			var result = {
				source: this.source,
				changes: filter ? this.changes.filter(filter, thisPtr) : Array.prototype.slice.call(this.changes)
			};

			if (!forServer) {
				result.title = this.title;
				result.code = this.code;
				if (this.user) {
					result.user = this.user;
				}
			}

			return result;
		},
		truncate: function (checkpoint, filter, thisPtr) {
			// Allow calling as function(filter, thisPtr)
			if (checkpoint && Object.prototype.toString.call(checkpoint) === "[object Function]") {
				thisPtr = filter;
				filter = checkpoint;
				checkpoint = null;
			}

			// Wrap custom filter if a checkpoint is given.
			if (checkpoint) {
				var foundCheckpoint = false;
				var customFilter = filter;
				filter = function(change) {
					// Check to see if this is the checkpoint we're looking for.
					if (change.type === "Checkpoint" && change.code === checkpoint) {
						foundCheckpoint = true;
					}

					// Stop truncating when the checkpoint is found.
					if (foundCheckpoint === true) {
						return false;
					}

					// Delegate to custom filter if one is given.
					return customFilter ? customFilter.apply(this, arguments) : true;
				};
			}

			// Discard all changes that match the given filter
			var numRemoved;
			if (filter) {
				var removedAt = this.changes.purge(filter, thisPtr);
				numRemoved = removedAt ? removedAt.length : 0;
			} else {
				numRemoved = this.changes.length;
				this.changes.clear();
			}

			this.onTruncated(numRemoved, this);
			return numRemoved;
		},
		undo: function() {
			if (this.changes.length > 0) {
				var lastIdx = this.changes.length - 1;
				var change = this.changes[lastIdx];
				this.changes.splice(lastIdx, 1);
				this.onChangeUndone(change, lastIdx, this);
				return change;
			}

			return null;
		}
	});

	// #endregion

	// #region ExoWeb.Mapper.ChangeLog
	//////////////////////////////////////////////////

	/*globals Functor, ChangeSet */

	function ChangeLog(defaultUser) {
		this._defaultUser = defaultUser;
		this.activeSet = null;
		this.sets = [];
		this.onChangeAdded = new Functor();
		this.onChangeSetStarted = new Functor();
		this.onChangeUndone = new Functor();
		this.onTruncated = new Functor();
	}

	ChangeLog.mixin({
		add: function (change) {
			// Adds a new change to the log.

			if (this.activeSet === null) {
				throw new Error("The change log is not currently active.");
			}

			var idx = this.activeSet.add(change);

			this.onChangeAdded(change, idx, this.activeSet, this);

			return idx;
		},
		addSet: function (source, title, user, changes, code) {
			var changeSet = new ChangeSet(source, title, user, changes, code);
			this.sets.push(changeSet);
			return changeSet;
		},
		batchChanges: function (title, user, action, removeIfEmpty) {
			/// <summary>
			/// Ensures that the set of changes that result from invoking
			/// `action` are placed in a dedicated change set with the given
			/// `title` (or description) and `user` and no other changes.
			/// </summary>

			if (!title || title.constructor !== String || title.length === 0) {
				throw new Error("The first argument to batchChanges must be a non-empty string which specifies a title for the changes.");
			}
			if (user !== null && user !== undefined && (user.constructor !== String || user.length === 0)) {
				throw new Error("The second argument to batchChanges must be a non-empty string which specifies the user who is initiating the changes.");
			}
			if (!action || !(action instanceof Function)) {
				throw new Error("The third argument to batchChanges must be a function which performs the changes.");
			}

			var newBatchSetIndex,
				newBatchSet,
				changeSetStartedHandler,
				previousActiveSet = this.activeSet,
				previousActiveSetIdx = previousActiveSet ? this.sets.indexOf(previousActiveSet) : -1,
				priorSet = previousActiveSet,
				usePriorSet = true,
				newActiveSet = null;

			// Start a new set for the batch if there isn't a current active set. If there is a current active set it can be
			// re-used if it has no pre-existing changes and has the same source, title, and user.
			if (!previousActiveSet || (previousActiveSet.changes.length > 0 || previousActiveSet.source !== "client" || previousActiveSet.title !== title || previousActiveSet.user !== user)) {
				newBatchSet = new ChangeSet("client", title, user || this._defaultUser);
				this.sets.push(newBatchSet);
				this.activeSet = newBatchSet;
			}

			// If a new set is created for the batch, and there was a previous active set, then remove it if it isn't needed.
			if (newBatchSet && previousActiveSet) {
				// If there are no changes, no title, and no user, then the set doesn't provide any useful information.
				if (!previousActiveSet.title && !previousActiveSet.user && previousActiveSet.changes.length === 0) {
					// Re-use the set rather than create a new one. This is not strictly necessary, but since
					// there is a precedent for attempting to reuse sets, it makes sense to do so here as well.
					newActiveSet = previousActiveSet;

					// Remove the set from the log.
					this.sets.splice(previousActiveSetIdx, 1);
					// NOTE: no need to alter "activeSet", since it was already changed to be the new batch set.

					// Move the prior set back since the previous active set is removed.
					priorSet = this.sets[previousActiveSetIdx - 1];

					// Don't re-use the prior set since it was not active and the
					// previous active set was removed (as if it never existed).
					usePriorSet = false;
				}
			}

			// Raise an error if a change set is started while the batch is being performed.
			changeSetStartedHandler = function () {
				throw new Error("Nested change batches are not currently supported. Batch already in progress: " + title);
			};

			// Attach the event
			this.onChangeSetStarted.add(changeSetStartedHandler);

			try {
				// Invoke the action callback.
				action();
			} finally {
				// Remove the event
				if (!this.onChangeSetStarted.remove(changeSetStartedHandler)) {
					throw new Error("Could not unsubscribe from change set started event.");
				}

				if (newBatchSet) {
					newBatchSetIndex = this.sets.indexOf(newBatchSet);

					// Remove the new batch set if the caller specified that it should be removed if empty and there were no changes.
					if (removeIfEmpty && newBatchSet === this.activeSet && newBatchSet.changes.length === 0) {
						this.sets.splice(newBatchSetIndex, 1);

						// Restore the previous active set to the log if it was removed.
						if (previousActiveSet && priorSet !== previousActiveSet) {
							this.sets.splice(previousActiveSetIdx, 0, previousActiveSet);
						}

						this.activeSet = previousActiveSet;
						return null;
					}

					this.onChangeSetStarted(newBatchSet, usePriorSet ? priorSet : null, newBatchSetIndex, this);
				}

				// If there was previously an active set, start a new
				// set in order to collect changes that follow separately.
				if (newActiveSet) {
					var idx = this.sets.push(newActiveSet) - 1;
					var newPriorSet = this.sets[idx - 1];
					this.activeSet = newActiveSet;
					this.onChangeSetStarted(newActiveSet, newPriorSet, idx, this);
				} else if (previousActiveSet) {
					// Use the previous title and user for the new set.
					this.start({ title: previousActiveSet.title, user: previousActiveSet.user });
				} else if (this.activeSet.changes.length > 0) {
					// If there wasn't an active set before, then start a new set
					// without a title only if there are changes in the active
					// set. This is a last-resort to ensure that following changes
					// are not included with the changes that were just batched.
					this.start("unknown");
				}
			}

			return newBatchSet;
		},
		checkpoint: function (title, code) {
			if (!this.activeSet) {
				return null;
			}

			return this.activeSet.checkpoint(title, code);
		},
		compress: function (tailOnly, considerAdditionalInfo) {
			var removed = [];

			for (var i = this.sets.length - 1; i >= 0; i--) {
				var set = this.sets[i];
				if (set.changes.length === 0 && (!considerAdditionalInfo || (!set.title && !set.user))) {
					if (set === this.activeSet) {
						this.activeSet = null;
					}

					// Remove the item
					var splicedItems = this.sets.splice(i, 1);

					// Insert at the beginning of the list of removed items
					var spliceArgs = [0, 0];
					Array.prototype.push.apply(spliceArgs, splicedItems);
					Array.prototype.splice.apply(removed, spliceArgs);
				}

				if (tailOnly) {
					// Exit early after checking the last
					// change set if 'tailOnly' is specified.
					break;
				}
			}

			return removed;
		},
		count: function (filter, thisPtr) {
			var result = 0;
			forEach(this.sets, function (set) {
				result += set.count(filter, thisPtr);
			}, this);
			return result;
		},
		lastChange: function () {
			for (var i = this.sets.length - 1; i >= 0; i--) {
				var set = this.sets[i];
				var change = set.lastChange();
				if (change !== null && change !== undefined) {
					return change;
				}
			}

			return null;
		},
		serialize: function (forServer, filter, thisPtr) {
			// Serializes the log and it's sets, including
			// those changes that pass the given filter.

			if (arguments.length === 0) {
				forServer = true;
			} else if (forServer instanceof Function) {
				thisPtr = filter;
				filter = forServer;
				forServer = true;
			}

			return this.sets.map(function (set) {
				return set.serialize(forServer, filter, thisPtr);
			});
		},
		start: function (titleOrOptions, continueLast) {
			// Starts a new change set, which means that new changes will
			// be added to the new set from this point forward.
			var title, user, code;

			if (titleOrOptions == null) throw new ArgumentNullError("titleOrOptions");
			if (titleOrOptions.constructor !== String && !(titleOrOptions instanceof Object)) throw new ArgumentTypeError("titleOrOptions", "string|object", titleOrOptions);

			if (continueLast != null && continueLast.constructor !== Boolean) throw new ArgumentTypeError("continueLast", "boolean", continueLast);

			if (titleOrOptions.constructor === String) {
				title = titleOrOptions;
				user = null;
				code = null;
			} else {
				title = titleOrOptions.title || null;
				user = titleOrOptions.user || null;
				code = titleOrOptions.code || null;
			}

			var previousActiveSet = this.activeSet;

			if (continueLast) {
				var candidateSet = previousActiveSet;
				if (!candidateSet && this.sets.length > 0) {
					candidateSet = this.sets[this.sets.length - 1];
				}
				if (candidateSet && candidateSet.source === "client" && candidateSet.user === user && candidateSet.title === title) {
					if (previousActiveSet) {
						return null;
					} else {
						this.activeSet = candidateSet;
						this.onChangeSetStarted(candidateSet, previousActiveSet, this.sets.length - 1, this);
						return candidateSet;
					}
				}
			}

			var set = new ChangeSet("client", title, user || this._defaultUser, null, code);
			var idx = this.sets.push(set) - 1;
			this.activeSet = set;
			this.onChangeSetStarted(set, previousActiveSet, idx, this);
			return set;
		},
		stop: function () {
			if (!this.activeSet) {
				throw new Error("The change log is not currently active.");
			}

			this.activeSet = null;
		},
		truncate: function (checkpoint, filter, thisPtr) {
			// Removes all change sets where all changes match the given
			// filter.  If a set contains one or more changes that do NOT
			// match, the set is left intact with those changes.

			// Allow calling as function(filter, thisPtr)
			if (checkpoint && Object.prototype.toString.call(checkpoint) === "[object Function]") {
				thisPtr = filter;
				filter = checkpoint;
				checkpoint = null;
			}

			var numRemoved = 0;
			var foundCheckpoint = false;

			for (var i = 0; i < this.sets.length; i++) {
				if (checkpoint) {
					foundCheckpoint = this.sets[i].changes.some(function (c) {
						return c.type === "Checkpoint" && c.code === checkpoint;
					});
				}

				numRemoved += this.sets[i].truncate(checkpoint, filter, thisPtr);

				// If all changes have been removed (or all but the given checkpoint) then discard the set
				if (this.sets[i].changes.length === 0) {
					var currentSet = this.sets[i];
					this.sets.splice(i--, 1);
					if (currentSet === this.activeSet) {
						this.activeSet = null;
					}
				}

				if (foundCheckpoint)
					break;
			}

			this.onTruncated(numRemoved, this);
			return numRemoved;
		},
		undo: function () {
			if (!this.activeSet) {
				throw new Error("The change log is not currently active.");
			}

			var currentSet = this.activeSet,
				currentSetIndex = this.sets.indexOf(currentSet);

			while (currentSet.changes.length === 0) {
				// remove the set from the log
				this.sets.splice(currentSetIndex, 1);

				if (--currentSetIndex < 0) {
					return null;
				}

				currentSet = this.sets[currentSetIndex];
				this.activeSet = currentSet;
			}

			var idx = currentSet.changes.length - 1;
			var change = currentSet.undo();

			this.onChangeUndone(change, idx, currentSet, this);

			return change;
		}
	});

	// #endregion

	// #region ExoWeb.Mapper.ServerSync
	//////////////////////////////////////////////////

	/*globals window, setTimeout, clearTimeout, context */
	/*globals Functor, Translator, Observer, ArgumentNullError, ArgumentTypeError */
	/*globals Model, Entity, LazyLoader, ObjectLazyLoader, ChangeLog, ExoModelEventListener, fromExoModel */
	/*global saveProvider, roundtripProvider, eventProvider, objectProvider */

	function ServerSync(model) {
		// Basic argument validation.
		if (model === null || model === undefined) {
			throw new ArgumentNullError("model");
		}
		if (typeof (model) !== "object" || !(model instanceof Model)) {
			throw new ArgumentTypeError("model", "model", model);
		}

		// Create the necessary local variables.
		var changeLog = new ChangeLog(),
			translator = new Translator(),
			objectsDeleted = [],
			isObjectDeleted = function (deletedObjectsList, obj, isChange) {
				if (Array.contains(deletedObjectsList, obj)) {
					if (isChange) {
						logWarning($format("Object {0}|{1} was changed but has been deleted.", obj.meta.type.get_fullName(), obj.meta.id));
					}
					return true;
				}
				return false;
			},
			filterObjectEvent = function (obj) {
				return !isObjectDeleted(objectsDeleted, obj, false);
			},
			filterPropertyEvent = function (obj) {
				return !isObjectDeleted(objectsDeleted, obj, true);
			},
			listener = new ExoModelEventListener(model, translator, {
				listChanged: filterPropertyEvent,
				propertyChanged: filterPropertyEvent,
				objectRegistered: filterObjectEvent,
				objectUnregistered: filterObjectEvent
			}),
			applyingChanges = 0,
			isCapturingChanges = false,
			self = this;

		// When the event listener detects a change then pass it along to the change log.
		listener.addChangeDetected(function (change) {
			if (applyingChanges <= 0 && isCapturingChanges === true) {
				if (change.property) {
					var instance = fromExoModel(change.instance, translator);
					var property = instance.meta.property(change.property);

					if (property.get_jstype() === Date && change.newValue && property.get_format() && !hasTimeFormat.test(property.get_format().toString())) {
						var serverOffset = self.get_ServerTimezoneOffset();
						var localOffset = -(new Date().getTimezoneOffset() / 60);
						var difference = localOffset - serverOffset;
						change.newValue = change.newValue.addHours(difference);
					}
					else if (change.newValue && change.newValue instanceof TimeSpan) {
						change.newValue = change.newValue.toObject();
					}
				}

				changeLog.add(change);

				self._raiseEvent("changesDetected", [self, { reason: "listener.addChangeDetected", changes: [change] }]);

				// Restart auto-save interval if necessary.
				if (self._saveInterval && self.canSave(change) && isPropertyChangePersisted(change)) {
					self._queueAutoSave();
				}
			}
		});

		// Applying changes (e.g. via a server response change set).
		this.isApplyingChanges = function () {
			return applyingChanges > 0;
		};
		this.beginApplyingChanges = function () {
			applyingChanges += 1;
		};
		this.endApplyingChanges = function () {
			applyingChanges -= 1;

			if (applyingChanges < 0) {
				throw new Error("Error in transaction log processing: unmatched begin and end applying changes.");
			}
		};

		// Capturing changes (i.e. after context initialization has completed).
		this.isCapturingChanges = function () {
			return isCapturingChanges === true;
		};
		this.beginCapturingChanges = function () {
			if (!isCapturingChanges) {
				isCapturingChanges = true;
				changeLog.start({ user: this._localUser });
			}
		};
		this.stopCapturingChanges = function () {
			if (isCapturingChanges) {
				isCapturingChanges = false;
				changeLog.stop();
			}
		};
		this.ignoreChanges = function (before, callback, after, thisPtr) {
			if (arguments.length === 1) {
				callback = arguments[0];
				before = null;
			}

			return function () {
				var beforeCalled = false;

				try {
					applyingChanges += 1;

					if (before && before instanceof Function) {
						before();
					}

					beforeCalled = true;

					callback.apply(thisPtr || this, arguments);
				} finally {
					applyingChanges -= 1;

					if (beforeCalled === true && after && after instanceof Function) {
						after();
					}
				}
			};
		};

		this.isObjectDeleted = function (obj, isChange) {
			return isObjectDeleted(objectsDeleted, obj, isChange);
		};

		// If an existing object is registered then register it for lazy loading.
		model.addObjectRegistered(function (obj) {
			if (!obj.meta.isNew && obj.meta.type.get_origin() === "server" && isCapturingChanges === true && !applyingChanges) {
				ObjectLazyLoader.register(obj);
			}
		});

		// Link model and server objects.
		Object.defineProperty(this, "model", { value: model });
		Object.defineProperty(model, "server", { value: this });

		// Assign backing fields as needed
		this._changeLog = changeLog;
		this._scopeQueries = [];
		this._objectsExcludedFromSave = [];
		this._objectsDeleted = objectsDeleted;
		this._translator = translator;
		this._serverInfo = null;
		this._localUser = null;

		Observer.makeObservable(this);
	}

	function isPropertyChangePersisted(change) {
		if (change.property) {
			var jstype = Model.getJsType(change.instance.type, true);
			if (jstype) {
				var prop = jstype.meta.property(change.property);
				// Can't save non-persisted properties
				if (!prop.get_isPersisted()) {
					return false;
				}
			}
		}
		return true;
	}

	ServerSync.mixin(Functor.eventing);

	var pendingRequests = 0;

	registerActivity("ServerSync: request", function() {
		return pendingRequests > 0;
	});

	function serializeChanges(includeAllChanges, simulateInitRoot) {
		var changes = this._changeLog.serialize(includeAllChanges ? this.canSend : this.canSave, this);

		// temporary HACK (no, really): splice InitNew changes into init transaction
		if (simulateInitRoot && simulateInitRoot.meta.isNew) {
			function isRootInitChange(change) {
				return change.type === "InitNew" && change.instance.type === simulateInitRoot.meta.type.get_fullName() &&
					(change.instance.id === simulateInitRoot.meta.id || this._translator.reverse(change.instance.type, change.instance.id) === simulateInitRoot.meta.id);
			}

			var found = false;
			var initSet = changes.filter(function(set) { return set.source === "init"; })[0];
			if (!initSet || !initSet.changes.some(isRootInitChange, this)) {
				changes.forEach(function(set) {
					if (found === true) return;
					set.changes.forEach(function(change, index) {
						if (found === true) return;
						else if (isRootInitChange.call(this, change)) {
							set.changes.splice(index, 1);
							if (!initSet) {
								initSet = { changes: [change], source: "init" };
								changes.splice(0, 0, initSet);
							}
							else {
								initSet.changes.push(change);
							}
							found = true;
						}
					}, this);
				}, this);
			}
		}

		return changes;
	}

	// when ServerSync is made singleton, this data will be referenced via closure
	function ServerSync$addScopeQuery(query) {
		this._scopeQueries.push(query);
	}

	function ServerSync$storeInitChanges(changes) {
		var activeSet = this._changeLog.activeSet;

		this._changeLog.addSet("init", null, null, changes);

		if (activeSet) {
			this._changeLog.start({ title: activeSet.title, user: activeSet.user });
		}
	}

	function ServerSync$retroactivelyFixChangeWhereIdChanged(changeInstance, obj) {
		// Update change to reflect the object's new id if it is referencing a legacy id
		if (changeInstance.id === obj.meta.legacyId) {
			changeInstance.id = obj.meta.id;
			changeInstance.isNew = false;
		}
	}

	ServerSync.mixin({
		// Enable/disable save & related functions
		///////////////////////////////////////////////////////////////////////
		enableSave: function ServerSync$enableSave(obj) {
			if (!(obj instanceof Entity)) {
				throw new Error("Can only enableSave on entity objects.");
			}

			if (Array.contains(this._objectsExcludedFromSave, obj)) {
				var oldPendingChanges;
				if (this._saveRoot) {
					// If autosave is enabled then determine if we need to queue a timeout
					oldPendingChanges = this.changes(false, this._saveRoot, true);
				}
				Array.remove(this._objectsExcludedFromSave, obj);

				this._raiseEvent("changesDetected", [this, { reason: "enableSave" }]);

				// Determine if ther are now pending changes
				if (oldPendingChanges && oldPendingChanges.length === 0 && this._saveInterval && !this._saveTimeout) {
					if (this.changes(false, this._saveRoot, true).length > 0) {
						this._queueAutoSave();
					}
				}
				return true;
			}
		},
		disableSave: function ServerSync$disableSave(obj) {
			if (!(obj instanceof Entity)) {
				throw new Error("Can only disableSave on entity objects.");
			}

			if (!Array.contains(this._objectsExcludedFromSave, obj)) {
				var oldPendingChanges;
				if (this._saveRoot) {
					// If autosave is enabled then determine if we need to queue a timeout
					oldPendingChanges = this.changes(false, this._saveRoot, true);
				}
				this._objectsExcludedFromSave.push(obj);

				this._raiseEvent("changesDetected", [this, { reason: "disableSave" }]);

				// Determine if ther are no longer pending changes
				if (oldPendingChanges && oldPendingChanges.length > 0 && this._saveInterval && this._saveTimeout) {
					if (this.changes(false, this._saveRoot, true).length === 0) {
						window.clearTimeout(this._saveTimeout);
						this._saveTimeout = null;
					}
				}
				return true;
			}
		},
		notifyDeleted: function ServerSync$notifyDeleted(obj) {
			if (!(obj instanceof Entity)) {
				throw new Error("Notified of deleted object that is not an entity.");
			}

			if (!Array.contains(this._objectsDeleted, obj)) {
				this._objectsDeleted.push(obj);
				return true;
			}

			return false;
		},
		canSend: function (change) {

			// Checkpoint is a client-only event type.
			if (change.type === "Checkpoint") {
				return false;
			}

			if (change.instance) {
				var type = Model.getJsType(change.instance.type, true);
				if (type && LazyLoader.isLoaded(type.meta)) {
					if (type.meta.get_origin() !== "server") {
						// Don't send change events for types that didn't originate from the server.
						return false;
					}

					if (change.property) {
						var property = type.meta.property(change.property);
						// Don't send property change events for properties that didn't originate from the server, or static properties.
						if (property.get_origin() !== "server" || property.get_isStatic()) {
							return false;
						}
					}

					// Don't send changes for deleted objects.
					var obj = fromExoModel(change.instance, this._translator, false, this._objectsDeleted);
					if (obj && this.isObjectDeleted(obj, false)) {
						return false;
					}
				}
			}

			// Event is ok to send.
			return true;
		},
		canSaveObject: function ServerSync$canSaveObject(objOrMeta) {
			var obj;
			var errorFmt = "Unable to test whether object can be saved:  {0}.";

			if (objOrMeta == null) {
				throw new ArgumentNullError("objOrMeta");
			}
			else if (objOrMeta instanceof ExoWeb.Model.ObjectMeta) {
				obj = objOrMeta._obj;
			}
			else if (objOrMeta instanceof Entity) {
				obj = objOrMeta;
			}
			else {
				throw new ArgumentTypeError("objOrMeta", "ObjectMeta|Entity", objOrMeta);
			}

			return !Array.contains(this._objectsExcludedFromSave, obj) && !Array.contains(this._objectsDeleted, obj);
		},
		canSave: function ServerSync$canSave(change) {

			// Can't save changes that can't be sent to the server at all.
			if (!this.canSend(change)) return false;

			// For list changes additionally check added and removed objects.
			if (change.type === "ListChange") {
				if (change.added.length > 0 || change.removed.length > 0) {
					var ignore = true;

					// Search added and removed for an object that can be saved.
					Array.forEach(change.added, function (item) {
						// if the type doesn't exist then obviously the instance doesn't either
						if (!item.type || !ExoWeb.Model.Model.getJsType(item.type, true)) {
							ignore = false;
						}
						else {
							var obj = fromExoModel(item, this._translator, false, this._objectsDeleted);
							// Only objects that exist can be disabled
							if (!obj || this.canSaveObject(obj)) {
								ignore = false;
							}
						}
					}, this);
					Array.forEach(change.removed, function (item) {
						// if the type doesn't exist then obviously the instance doesn't either
						if (!item.type || !ExoWeb.Model.Model.getJsType(item.type, true)) {
							ignore = false;
						}
						else {
							var obj = fromExoModel(item, this._translator, false, this._objectsDeleted);
							if (!obj || this.canSaveObject(obj)) {
								ignore = false;
							}
						}
					}, this);

					// If no "savable" object was found in added or 
					// removed then this change cannot be saved.
					if (ignore) {
						return false;
					}
				}
			}
			// For reference changes additionally check oldValue/newValue
			else if (change.type === "ReferenceChange") {
				var oldJsType = change.oldValue && ExoWeb.Model.Model.getJsType(change.oldValue.type, true);
				if (oldJsType) {
					var oldValue = fromExoModel(change.oldValue, this._translator, false, this._objectsDeleted);
					if (oldValue && !this.canSaveObject(oldValue)) {
						return false;
					}
				}

				var newJsType = change.newValue && ExoWeb.Model.Model.getJsType(change.newValue.type, true);
				if (newJsType) {
					var newValue = fromExoModel(change.newValue, this._translator, false, this._objectsDeleted);
					if (newValue && !this.canSaveObject(newValue)) {
						return false;
					}
				}
			}

			// if the type doesn't exist then obviously the instance doesn't either
			var jstype = ExoWeb.Model.Model.getJsType(change.instance.type, true);
			if (!jstype) {
				return true;
			}

			// Ensure that the instance that the change pertains to can be saved.
			var instanceObj = fromExoModel(change.instance, this._translator, false, this._objectsDeleted);
			return !instanceObj || this.canSaveObject(instanceObj);
		},

		_handleResult: function ServerSync$_handleResult(result, description, checkpoint, callbackOrOptions) {
			var callback, beforeApply = null, afterApply = null;

			if (callbackOrOptions instanceof Function) {
				callback = callbackOrOptions;
			}
			else {
				callback = callbackOrOptions.callback;
				beforeApply = callbackOrOptions.beforeApply;
				afterApply = callbackOrOptions.afterApply;
			}

			ResponseHandler.execute(this.model, this, {
				instances: result.instances,
				conditions: result.conditions,
				types: result.types && result.types instanceof Array ? null : result.types,
				changes: result.changes,
				source: "server",
				description: description,
				checkpoint: checkpoint,
				serverInfo: result.serverInfo,
				beforeApply: beforeApply,
				afterApply: afterApply
			}, callback, this);
		},

		// General events methods
		///////////////////////////////////////////////////////////////////////
		addRequestBegin: function (handler) {
			this._addEvent("requestBegin", handler);
		},
		removeRequestBegin: function (handler) {
			this._removeEvent("requestBegin", handler);
		},
		addRequestEnd: function (handler) {
			this._addEvent("requestEnd", handler);
		},
		removeRequestEnd: function (handler) {
			this._removeEvent("requestEnd", handler);
		},
		addRequestSuccess: function (handler) {
			this._addEvent("requestSuccess", handler);
		},
		removeRequestSuccess: function (handler) {
			this._removeEvent("requestSuccess", handler);
		},
		addRequestFailed: function (handler) {
			this._addEvent("requestFailed", handler);
		},
		removeRequestFailed: function (handler) {
			this._removeEvent("requestFailed", handler);
		},

		// Raise Server Event
		///////////////////////////////////////////////////////////////////////
		raiseServerEvent: function ServerSync$raiseServerEvent(name, target, event, includeAllChanges, success, failed, paths) {
			/// <summary locid="M:J#ExoWeb.Mapper.ServerSync.save">
			/// Raise a server event on the given target. The given success or failure callback is invoked
			/// when the request is complete.
			/// </summary>
			/// <param name="name" optional="false" mayBeNull="false" type="String"></param>
			/// <param name="target" optional="false" mayBeNull="false" type="ExoWeb.Model.Entity"></param>
			/// <param name="event" optional="true" mayBeNull="null" type="Object"></param>
			/// <param name="success" optional="true" mayBeNull="true" type="Function"></param>
			/// <param name="failed" optional="true" mayBeNull="true" type="Function"></param>
			/// <param name="paths" optional="true" mayBeNull="true" isArray="true" type="String"></param>

			var args, checkpoint, serializedEvent, serializedEventTarget, eventPropName;

			pendingRequests++;

			// Checkpoint the log to ensure that we only truncate changes that were saved.
			checkpoint = this._changeLog.checkpoint("raiseServerEvent(" + name + ")-" + +(new Date()));

			args = {
				type: "raiseServerEvent",
				target: target,
				checkpoint: checkpoint,
				includeAllChanges: includeAllChanges
			};

			args.eventName = name;
			args.eventObject = event;

			this._raiseEvent("raiseServerEventBegin", [this, args]);

			serializedEvent = {};

			// If an event object is provided then convert its entity properties into their serialized form.
			if (event !== undefined && event !== null) {
				for (eventPropName in event) {
					var arg = event[eventPropName];

					if (arg instanceof Array) {
						serializedEvent[eventPropName] = arg.map(function (a) { return toExoModel(a, this._translator); }, this);
					} else {
						serializedEvent[eventPropName] = toExoModel(arg, this._translator);
					}
				}
			}

			serializedEventTarget = toExoModel(target, this._translator);

			args.root = serializedEventTarget;
			args.eventData = serializedEvent;

			this._raiseEvent("requestBegin", [this, args]);

			eventProvider(
				name,
				serializedEventTarget,
				serializedEvent,
				paths,
				serializeChanges.call(this, includeAllChanges, target),
				this._onRaiseServerEventSuccess.bind(this).appendArguments(args, checkpoint, success),
				this._onRaiseServerEventFailed.bind(this).appendArguments(args, failed || success)
			);
		},
		_onRaiseServerEventSuccess: function ServerSync$_onRaiseServerEventSuccess(result, args, checkpoint, callback) {
			args.responseObject = result;
			args.requestSucceeded = true;

			this._raiseEvent("requestEnd", [this, args]);

			this._handleResult(result, "raiseServerEvent(" + args.eventName + ")", checkpoint, function () {
				this._raiseEvent("requestSuccess", [this, args]);

				var event = result.events[0];
				if (event instanceof Array) {
					for (var i = 0; i < event.length; ++i) {
						event[i] = fromExoModel(event[i], this._translator, true);
					}
				}
				else {
					event = fromExoModel(event, this._translator, true);
				}

				restoreDates(event);

				result.event = event;

				args.eventResult = event;

				this._raiseEvent("raiseServerEventEnd", [this, args]);
				this._raiseEvent("raiseServerEventSuccess", [this, args]);

				if (callback && callback instanceof Function) {
					callback(result);
				}

				pendingRequests--;
			});
		},
		_onRaiseServerEventFailed: function ServerSync$_onRaiseServerEventFailed(error, args, callback) {
			args.responseObject = error;
			args.requestSucceeded = false;

			this._raiseEvent("requestEnd", [this, args]);
			this._raiseEvent("requestFailed", [this, args]);

			this._raiseEvent("raiseServerEventEnd", [this, args]);
			this._raiseEvent("raiseServerEventFailed", [this, args]);

			if (callback && callback instanceof Function) {
				callback(error);
			}

			pendingRequests--;
		},
		addRaiseServerEventBegin: function (handler) {
			this._addEvent("raiseServerEventBegin", handler);
		},
		removeRaiseServerEventBegin: function (handler) {
			this._removeEvent("raiseServerEventBegin", handler);
		},
		addRaiseServerEventEnd: function (handler) {
			this._addEvent("raiseServerEventEnd", handler);
		},
		removeRaiseServerEventEnd: function (handler) {
			this._removeEvent("raiseServerEventEnd", handler);
		},
		addRaiseServerEventSuccess: function (handler) {
			this._addEvent("raiseServerEventSuccess", handler);
		},
		removeRaiseServerEventSuccess: function (handler) {
			this._removeEvent("raiseServerEventSuccess", handler);
		},
		addRaiseServerEventFailed: function (handler) {
			this._addEvent("raiseServerEventFailed", handler);
		},
		removeRaiseServerEventFailed: function (handler) {
			this._removeEvent("raiseServerEventFailed", handler);
		},

		// Roundtrip
		///////////////////////////////////////////////////////////////////////
		roundtrip: function ServerSync$roundtrip(target, paths, success, failed) {
			/// <summary locid="M:J#ExoWeb.Mapper.ServerSync.save">
			/// Roundtrips the current changes to the server. The given success or failure callback is
			/// invoked when the request is complete.
			/// </summary>
			/// <param name="target" optional="false" mayBeNull="false" type="ExoWeb.Model.Entity"></param>
			/// <param name="paths" optional="false" mayBeNull="true" isArray="true" type="String"></param>
			/// <param name="success" optional="false" mayBeNull="true" type="Function"></param>
			/// <param name="failed" optional="false" mayBeNull="true" type="Function"></param>

			var args, checkpoint, serializedTarget, includeAllChanges;

			pendingRequests++;

			if (target && target instanceof Function) {
				success = target;
				failed = paths;
				target = null;
				paths = null;
			}

			checkpoint = this._changeLog.checkpoint("roundtrip-" + +(new Date()));

			if (target) {
				includeAllChanges = true;
			} else {
				includeAllChanges = false;
			}

			args = {
				type: "roundtrip",
				target: target || null,
				checkpoint: checkpoint,
				includeAllChanges: includeAllChanges
			};

			this._raiseEvent("roundtripBegin", [this, args]);

			if (target) {
				serializedTarget = toExoModel(target, this._translator);
			} else {
				serializedTarget = null;
			}

			args.root = serializedTarget;

			this._raiseEvent("requestBegin", [this, args]);

			roundtripProvider(
				serializedTarget,
				paths,
				serializeChanges.call(this, includeAllChanges, target),
				this._onRoundtripSuccess.bind(this).appendArguments(args, checkpoint, success),
				this._onRoundtripFailed.bind(this).appendArguments(args, failed || success)
			);
		},
		_onRoundtripSuccess: function ServerSync$_onRoundtripSuccess(result, args, checkpoint, callback) {
			args.responseObject = result;
			args.requestSucceeded = true;

			this._raiseEvent("requestEnd", [this, args]);

			this._handleResult(result, "roundtrip", checkpoint, function () {
				this._raiseEvent("requestSuccess", [this, args]);
				this._raiseEvent("roundtripEnd", [this, args]);
				this._raiseEvent("roundtripSuccess", [this, args]);

				if (callback && callback instanceof Function) {
					callback(result);
				}

				pendingRequests--;
			});
		},
		_onRoundtripFailed: function ServerSync$_onRoundtripFailed(error, args, callback) {
			args.responseObject = error;
			args.requestSucceeded = false;

			this._raiseEvent("requestEnd", [this, args]);
			this._raiseEvent("requestFailed", [this, args]);

			this._raiseEvent("roundtripEnd", [this, args]);
			this._raiseEvent("roundtripFailed", [this, args]);

			if (callback && callback instanceof Function) {
				callback(error);
			}

			pendingRequests--;
		},
		startAutoRoundtrip: function (interval) {
			if (!interval || typeof(interval) !== "number" || interval <= 0) {
				throw new Error("An interval must be specified for auto-save.");
			}

			// cancel any pending roundtrip schedule
			this.stopAutoRoundtrip();

			function doRoundtrip() {
				this.roundtrip(function () {
					this._roundtripTimeout = window.setTimeout(doRoundtrip.bind(this), interval);
				});
			}

			this._roundtripTimeout = window.setTimeout(doRoundtrip.bind(this), interval);
		},
		stopAutoRoundtrip: function () {
			if (this._roundtripTimeout) {
				window.clearTimeout(this._roundtripTimeout);
			}
		},
		addRoundtripBegin: function (handler) {
			this._addEvent("roundtripBegin", handler);
		},
		removeRoundtripBegin: function (handler) {
			this._removeEvent("roundtripBegin", handler);
		},
		addRoundtripEnd: function (handler) {
			this._addEvent("roundtripEnd", handler);
		},
		removeRoundtripEnd: function (handler) {
			this._removeEvent("roundtripEnd", handler);
		},
		addRoundtripSuccess: function (handler) {
			this._addEvent("roundtripSuccess", handler);
		},
		removeRoundtripSuccess: function (handler) {
			this._removeEvent("roundtripSuccess", handler);
		},
		addRoundtripFailed: function (handler) {
			this._addEvent("roundtripFailed", handler);
		},
		removeRoundtripFailed: function (handler) {
			this._removeEvent("roundtripFailed", handler);
		},

		// Save
		///////////////////////////////////////////////////////////////////////
		save: function (target, success, failed) {
			/// <summary locid="M:J#ExoWeb.Mapper.ServerSync.save">
			/// Saves changes to the given target and related entities. The given success or failure
			/// callback is invoked when the request is complete.
			/// </summary>
			/// <param name="target" optional="false" mayBeNull="false" type="ExoWeb.Model.Entity"></param>
			/// <param name="success" optional="false" mayBeNull="true" type="Function"></param>
			/// <param name="failed" optional="false" mayBeNull="true" type="Function"></param>

			var args, checkpoint, serializedTarget;

			pendingRequests++;

			// Checkpoint the log to ensure that we only truncate changes that were saved.
			checkpoint = this._changeLog.checkpoint("save-" + +(new Date()));

			args = {
				type: "save",
				target: target,
				checkpoint: checkpoint,
				includeAllChanges: false
			};

			this._raiseEvent("saveBegin", [this, args]);

			serializedTarget = toExoModel(target, this._translator);

			args.root = serializedTarget;

			this._raiseEvent("requestBegin", [this, args]);

			saveProvider(
				serializedTarget,
				serializeChanges.call(this, false, target),
				this._onSaveSuccess.bind(this).appendArguments(args, checkpoint, success),
				this._onSaveFailed.bind(this).appendArguments(args, failed || success)
			);
		},
		_onSaveSuccess: function ServerSync$_onSaveSuccess(result, args, checkpoint, callback) {
			args.responseObject = result;
			args.requestSucceeded = true;

			this._raiseEvent("requestEnd", [this, args]);

			this._handleResult(result, "save", checkpoint, function () {
				this._raiseEvent("requestSuccess", [this, args]);
				this._raiseEvent("saveEnd", [this, args]);
				this._raiseEvent("saveSuccess", [this, args]);

				if (callback && callback instanceof Function) {
					callback(result);
				}

				pendingRequests--;
			});
		},
		_onSaveFailed: function (error, args, callback) {
			args.responseObject = error;
			args.requestSucceeded = false;

			this._raiseEvent("requestEnd", [this, args]);
			this._raiseEvent("requestFailed", [this, args]);

			this._raiseEvent("saveEnd", [this, args]);
			this._raiseEvent("saveFailed", [this, args]);

			if (callback && callback instanceof Function) {
				callback(error);
			}

			pendingRequests--;
		},
		startAutoSave: function ServerSync$startAutoSave(root, interval, maxAttempts) {
			if (!root || !(root instanceof Entity)) {
				throw new Error("A root object must be specified for auto-save.");
			}

			if (!interval || typeof(interval) !== "number" || interval <= 0) {
				throw new Error("An interval must be specified for auto-save.");
			}

			if (maxAttempts && (typeof (maxAttempts) !== "number" || maxAttempts <= 0)) {
				throw new Error("Max number of auto-save attempts must be a positive number.");
			}

			// cancel any pending save schedule
			this.stopAutoSave();

			this._saveInterval = interval;
			this._saveRoot = root;

			// Attempt to provide a somewhat reasonable default.
			this._maxAutoSaveAttempts = maxAttempts || 3;
		},
		stopAutoSave: function ServerSync$stopAutoSave() {
			if (this._saveTimeout) {
				window.clearTimeout(this._saveTimeout);
				this._saveTimeout = null;
			}

			this._saveInterval = null;
			this._saveRoot = null;
			this._maxAutoSaveAttempts = null;
		},
		_autoSaveSuccess: function() {
			this._failedAutoSaveAttempts = 0;

			// Wait for the next change before next auto save
			this._saveTimeout = null;

			// ...unless there were new pending changes encountered since the last auto-save.
			if (this.changes(false, this._saveRoot, true).length > 0) {
				this._queueAutoSave();
			}
		},
		_autoSaveFailure: function() {
			if (++this._failedAutoSaveAttempts < this._maxAutoSaveAttempts) {
				this._queueAutoSave();
			} else {
				logWarning($format("Auto-save failed {0} consecutive times and will not re-try again until additional changes are detected.", this._failedAutoSaveAttempts));
			}
		},
		_doAutoSave: function() {
			this.save(this._saveRoot, this._autoSaveSuccess.bind(this), this._autoSaveFailure.bind(this));
		},
		_queueAutoSave: function ServerSync$_queueAutoSave() {
			if (this._saveTimeout) {
				// Already queued...
				return;
			}

			if (!this._saveInterval || !this._saveRoot || !this._maxAutoSaveAttempts) {
				// Auto-save is not configured...
				return;
			}

			this._saveTimeout = window.setTimeout(this._doAutoSave.bind(this), this._saveInterval);
		},
		addSaveBegin: function (handler) {
			this._addEvent("saveBegin", handler);
		},
		removeSaveBegin: function (handler) {
			this._removeEvent("saveBegin", handler);
		},
		addSaveEnd: function (handler) {
			this._addEvent("saveEnd", handler);
		},
		removeSaveEnd: function (handler) {
			this._removeEvent("saveEnd", handler);
		},
		addSaveSuccess: function (handler) {
			this._addEvent("saveSuccess", handler);
		},
		removeSaveSuccess: function (handler) {
			this._removeEvent("saveSuccess", handler);
		},
		addSaveFailed: function (handler) {
			this._addEvent("saveFailed", handler);
		},
		removeSaveFailed: function (handler) {
			this._removeEvent("saveFailed", handler);
		},

		// EnsureLoaded
		///////////////////////////////////////////////////////////////////////
		ensureLoaded: function (target, paths, includePathsFromQueries, success, failed) {
			/// <summary locid="M:J#ExoWeb.Mapper.ServerSync.ensureLoaded">
			/// Loads the given entity (and optionally a set of relative paths) if necessary. The given success or failure
			/// callback is invoked when the request is complete if loading was required. If no loading was required, the
			/// success callback is invoked after a short period of time. This artifical asynchronicity is introduced
			/// primarily to limit call stack size, and in the case of loading a consistent asynchronous experience is
			/// acceptable and perhaps even expected to some extent.
			/// </summary>
			/// <param name="target" optional="false" mayBeNull="false" type="ExoWeb.Model.Entity|ExoWeb.Model.Type"></param>
			/// <param name="paths" optional="false" mayBeNull="true" isArray="true" type="String"></param>
			/// <param name="includePathsFromQueries" mayBeNull="true" type="Boolean" optional="false"></param>
			/// <param name="success" optional="false" mayBeNull="true" type="Function"></param>
			/// <param name="failed" optional="false" mayBeNull="true" type="Function"></param>

			var args, checkpoint, serializedTarget, queryPaths, pathsToLoad, staticPath, staticProperty;

			pendingRequests++;

			if (target === null || target === undefined) {
				throw new Error("Method ensureLoaded requires a target argument.");
			}

			if (target instanceof Entity) {
				if (includePathsFromQueries) {
					// Get the paths from the original query(ies) that apply to the target object (based on type).
					queryPaths = ObjectLazyLoader.getRelativePaths(target);
					if (paths) {
						pathsToLoad = paths.concat(queryPaths);
					} else {
						pathsToLoad = queryPaths;
					}
				} else {
					pathsToLoad = paths || [];
				}
			} else {
				// For static loading a single array or object will be loaded with no additional paths.
				pathsToLoad = [];

				// Use the meta type if a type constructor was used as the target.
				if (target instanceof Function && target.meta && target.meta && target.meta instanceof Type) {
					target = target.meta;
				}

				if (!(target instanceof Type)) {
					throw new Error($format("Method ensureLoaded expects target of type Entity or Type, but found type \"{0}\".", parseFunctionName(target.constructor)));
				}

				if (paths === null || paths === undefined) {
					throw new Error("Method ensureLoaded requires a paths argument for static property loading.");
				}

				if (Object.prototype.toString.call(paths) === "[object String]") {
					staticPath = paths;
				} else if (Object.prototype.toString.call(paths) === "[object Array]") {
					if (paths.length === 1) {
						staticPath = paths[0];
					} else {
						throw new Error($format("Multiple paths cannot be specified when ensuring that static property information is loaded: \"{0}.[{1}]\".", target.get_fullName(), paths.join(",")));
					}
				} else {
					throw new Error($format("Argument \"paths\" was expected to be a string or array of strings, but found type \"{0}\" instead.", parseFunctionName(target.constructor)));
				}

				// Static property path can only be a single property name, not a multi-step path.
				if (staticPath.indexOf(".") >= 0) {
					throw new Error($format("Multiple path steps cannot be specified when ensuring that static property information is loaded: \"{0}.{1}\".", target.get_fullName(), staticPath));
				}

				// Get the meta property for the given single path.
				staticProperty = target.property(staticPath);

				// Prepend the target type name to the static path for later use in logging and errors, etc.
				staticPath = target.get_fullName() + "." + staticPath;

				// Get the static path value and verify that there is a value in order to ensure loading.
				target = staticProperty.value(target);
				if (target === null || target === undefined) {
					throw new Error($format("Unable to ensure that static path \"{0}\" is loaded because it evaluates to a null or undefined value.", staticPath));
				}
			}

			// Checkpoint the log to ensure that we only truncate changes that were saved.
			checkpoint = this._changeLog.checkpoint("ensureLoaded" + +(new Date()));

			args = {
				type: "ensureLoaded",
				target: target instanceof Entity ? target : null,
				checkpoint: checkpoint,
				includeAllChanges: true
			};

			this._raiseEvent("ensureLoadedBegin", [this, args]);

			// Check if the object or any of the paths require loading. Apply the array of paths to the
			// isLoaded call, since the paths will be obtained as "rest" parameters.
			if (!LazyLoader.isLoaded.apply(null, [target].concat(pathsToLoad))) {
				serializedTarget = target instanceof Entity ? toExoModel(target, this._translator) : null;

				args.root = serializedTarget;

				this._raiseEvent("requestBegin", [this, args]);

				// TODO: reference to server will be a singleton, not context
				objectProvider(
					target instanceof Entity ? target.meta.type.get_fullName() : target.get_fullName(),
					target instanceof Entity ? [target.meta.id] : [],
					pathsToLoad,
					false, // in scope?
					serializeChanges.call(this, true),
					this._onEnsureLoadedSuccess.bind(this).appendArguments(args, checkpoint, success),
					this._onEnsureLoadedFailed.bind(this).appendArguments(args, failed || success));
			} else {
				var self = this;
				window.setTimeout(function () {
					args.requiredLoading = false;

					self._raiseEvent("ensureLoadedEnd", [self, args]);
					self._raiseEvent("ensureLoadedSuccess", [self, args]);

					if (success && success instanceof Function) {
						success();
					}

					pendingRequests--;
				}, 1);
			}
		},
		_onEnsureLoadedSuccess: function (result, args, checkpoint, callback) {
			args.responseObject = result;
			args.requestSucceeded = true;

			this._raiseEvent("requestEnd", [this, args]);

			this._handleResult(result, "ensureLoaded", checkpoint, function () {
				this._raiseEvent("requestSuccess", [this, args]);

				args.requiredLoading = true;

				this._raiseEvent("ensureLoadedEnd", [this, args]);
				this._raiseEvent("ensureLoadedSuccess", [this, args]);

				if (callback && callback instanceof Function) {
					callback(result);
				}

				pendingRequests--;
			});
		},
		_onEnsureLoadedFailed: function (error, args, callback) {
			args.responseObject = error;
			args.requestSucceeded = false;

			this._raiseEvent("requestEnd", [this, args]);
			this._raiseEvent("requestFailed", [this, args]);

			args.requiredLoading = true;

			this._raiseEvent("ensureLoadedEnd", [this, args]);
			this._raiseEvent("ensureLoadedFailed", [this, args]);

			if (callback && callback instanceof Function) {
				callback(error);
			}

			pendingRequests--;
		},
		addEnsureLoadedBegin: function (handler) {
			this._addEvent("ensureLoadedBegin", handler);
		},
		removeEnsureLoadedBegin: function (handler) {
			this._removeEvent("ensureLoadedBegin", handler);
		},
		addEnsureLoadedEnd: function (handler) {
			this._addEvent("ensureLoadedEnd", handler);
		},
		removeEnsureLoadedEnd: function (handler) {
			this._removeEvent("ensureLoadedEnd", handler);
		},
		addEnsureLoadedSuccess: function (handler) {
			this._addEvent("ensureLoadedSuccess", handler);
		},
		removeEnsureLoadedSuccess: function (handler) {
			this._removeEvent("ensureLoadedSuccess", handler);
		},
		addEnsureLoadedFailed: function (handler) {
			this._addEvent("ensureLoadedFailed", handler);
		},
		removeEnsureLoadedFailed: function (handler) {
			this._removeEvent("ensureLoadedFailed", handler);
		},

		// Apply Changes
		///////////////////////////////////////////////////////////////////////
		applyChanges: function (checkpoint, changes, source, user, setId, description, filter, beforeApply, afterApply, callback, thisPtr) {
			if (!changes || !(changes instanceof Array)) {
				if (callback) {
					callback.call(thisPtr || this);
				}
				return;
			}

			if (source == null) throw new ArgumentNullError("source");

			var newChanges = [];

			var signal = new Signal("applyChanges");
			var waitForAllRegistered = false;
			var batchStarted = false;
			var changesApplying = false;
			var callbackInvoked = false;
			var methodExited = false;

			try {
				var batch = ExoWeb.Batch.start("apply changes");
				batchStarted = true;

				this.beginApplyingChanges();
				changesApplying = true;

				var previousActiveSet = null;

				if (this._changeLog.activeSet) {
					previousActiveSet = this._changeLog.activeSet;

					// Stop the active set
					this._changeLog.stop();

					if (this._changeLog.compress(true, true).indexOf(previousActiveSet) > 0) {
						// If the previous active set was removed, then don't use it later on.
						previousActiveSet = null;
					}
				}

				var changeSet = this._changeLog.addSet(source, description, user, null, setId);

				this._changeLog.onChangeSetStarted(changeSet, previousActiveSet, previousActiveSet ? this._changeLog.sets.indexOf(previousActiveSet) : -1, this._changeLog);

				// Determine that the target of a change is a new instance
				var instanceIsNew = function (change) {
					if (ExoWeb.Model.Model.getJsType(change.instance.type, true)) {
						var obj = fromExoModel(change.instance, this._translator);
						return obj && obj.meta.isNew;
					}
					return false;
				};

				// truncate change log up-front if save occurred
				var shouldDiscardChange;
				var saveChanges = changes.filter(function (c, i) { return c.type === "Save"; });
				var numSaveChanges = saveChanges.length;
				if (numSaveChanges > 0) {
					// Collect all of the id changes in the response. Multiple saves could occur.
					var idChanges = saveChanges.mapToArray(function (change) { return change.added || []; });

					// Create a list of new instances that were saved. Use a typed identifier form since the id stored
					// in changes in the change log will be a server id rather than client id (if there is a distinction)
					// and using the typed identifier approach allows for a straightforward search of the array.
					var newInstancesSaved = idChanges.map(function (idChange) { return idChange.type + "|" + idChange.oldId; });

					// Truncate changes that we believe were actually saved based on the response
					shouldDiscardChange = function (change) {
						var couldHaveBeenSaved, isNewObjectNotYetSaved;

						// Determine if the change could have been saved in the first place
						couldHaveBeenSaved = this.canSave(change);

						// Determine if the change targets a new object that has not been saved
						isNewObjectNotYetSaved = change.instance && (change.instance.isNew || instanceIsNew.call(this, change)) && !newInstancesSaved.contains(change.instance.type + "|" + change.instance.id);

						// Return a value indicating whether or not the change should be removed
						return couldHaveBeenSaved && !isNewObjectNotYetSaved;
					};

					// Truncate changes that we believe were actually saved based on the response
					this._changeLog.truncate(checkpoint, shouldDiscardChange.bind(this));
					this._changeLog.start({ user: this._localUser });

					// Update affected scope queries
					idChanges.forEach(function (idChange) {
						var jstype = ExoWeb.Model.Model.getJsType(idChange.type, true);
						if (jstype && LazyLoader.isLoaded(jstype.meta)) {
							var serverOldId = idChange.oldId;
							var clientOldId = !(idChange.oldId in jstype.meta._pool) ?
								this._translator.reverse(idChange.type, serverOldId) :
								idChange.oldId;
							this._scopeQueries.forEach(function (query) {
								query.ids = query.ids.map(function (id) {
									return (id === clientOldId) ? idChange.newId : id;
								}, this);
							}, this);
						}
					}, this);
				}

				var numPendingSaveChanges = numSaveChanges;

				changes.forEach(function (change) {
					if (change.type === "InitNew") {
						this.applyInitChange(change, beforeApply, afterApply, signal.pending());
					}
					else if (change.type === "ReferenceChange") {
						this.applyRefChange(change, beforeApply, afterApply, signal.pending());
					}
					else if (change.type === "ValueChange") {
						this.applyValChange(change, beforeApply, afterApply, signal.pending());
					}
					else if (change.type === "ListChange") {
						this.applyListChange(change, beforeApply, afterApply, signal.pending());
					}
					else if (change.type === "Save") {
						this.applySaveChange(change, beforeApply, afterApply, signal.pending());
						numPendingSaveChanges--;
					}

					if (change.type !== "Save") {
						var noObjectsWereSaved = numSaveChanges === 0;
						var hasPendingSaveChanges = numPendingSaveChanges > 0;

						// Only record a change if there is not a pending save change, also take into account new instances that are not saved
						if (noObjectsWereSaved || !hasPendingSaveChanges || !shouldDiscardChange.call(this, change)) {
							// Apply additional filter
							if (!filter || filter(change) === true) {
								newChanges.push(change);
								changeSet.add(change);
							}
						}
					}
				}, this);

				// Start a new change set to capture future changes.
				if (this.isCapturingChanges()) {
					this._changeLog.start({ user: this._localUser });
				}

				waitForAllRegistered = true;
				signal.waitForAll(function () {
					// The method has not yet exited, which means that teardown is happening
					// synchronously, so end applying changes before invoking the callback.
					if (!methodExited) {
						this.endApplyingChanges();
					}

					ExoWeb.Batch.end(batch);

					if (callback) {
						callback.call(thisPtr || this);
					}

					callbackInvoked = true;
				}, this, true);
			}
			finally {
				// The 'teardown' callback was not invoked, either because of an error or because
				// of delayed execution of the teardown routine, so end applying changes immediately.
				if (changesApplying && !callbackInvoked) {
					this.endApplyingChanges();
				}

				// An error occurred after the batch was started but before the 'teardown' callback
				// was registered (which would normally end the batch) so end it immediately.
				if (batchStarted && !waitForAllRegistered) {
					ExoWeb.Batch.end(batch);
				}
			}

			if (newChanges.length > 0) {
				this._raiseEvent("changesDetected", [this, { reason: "applyChanges", changes: newChanges }]);
			}

			// Allow potentially asynchronous callbacks to detect that the
			// method has already exited via a closure on this variable.
			methodExited = true;
		},
		applySaveChange: function (change, before, after, callback, thisPtr) {
			if (!(change.added || change.deleted)) {
				if (callback) {
					callback.call(thisPtr || this);
				}
				return;
			}

			change.deleted.forEach(function (instance) {
				tryGetJsType(this.model, instance.type, null, false, function (type) {
					tryGetEntity(this.model, this._translator, type, instance.id, null, LazyLoadEnum.None, this.ignoreChanges(before, function (obj) {
						// Notify server object that the instance is deleted
						this.notifyDeleted(obj);
						// Simply a marker flag for debugging purposes
						obj.meta.isDeleted = true;
						// Unregister the object so that it can't be retrieved via get, known, or have rules execute against it
						type.meta.unregister(obj);
						// Remove affected scope queries
						this._scopeQueries.purge(function (query) {
							// Remove the deleted object's id from the scope query
							query.ids.purge(function (id) {
								return (id === obj.meta.id);
							}, this);
							// Remove the scope query if it is empty
							return query.ids.length === 0;
						}, this);
					}, after), this);
				}, this);
			}, this);

			change.added.forEach(function (idChange, idChangeIndex) {
				ensureJsType(this.model, idChange.type, this.ignoreChanges(before, function (jstype) {
					var serverOldId = idChange.oldId;
					var clientOldId = !(idChange.oldId in jstype.meta._pool) ?
							this._translator.reverse(idChange.type, serverOldId) :
							idChange.oldId;

					// If the client recognizes the old id then this is an object we have seen before
					if (clientOldId) {
						var type = this.model.type(idChange.type);

						// Attempt to load the object whos id is changing.
						var obj = type.get(
							// Load the object using the object's id prior to saving.
							clientOldId,

							// When processing server-side changes we can expect that the type of the instance
							// is exactly the type specified in the change object, not a base type. 
							true
						);

						// Ensure that the object exists.
						if (!obj) {
							throw new Error($format(
								"Unable to change id for object of type \"{0}\" from \"{1}\" to \"{2}\" since the object could not be found.",
								jstype.meta.get_fullName(), idChange.oldId, idChange.newId));
						}

						// Change the id and make non-new.
						type.changeObjectId(clientOldId, idChange.newId);
						Observer.setValue(obj.meta, "isNew", false);

						// Update affected scope queries
						this._scopeQueries.forEach(function (query) {
							query.ids = query.ids.map(function (id) {
								return (id === clientOldId) ? idChange.newId : id;
							}, this);
						}, this);

						// Update post-save changes with new id
						function fixChangeInstanceDueToIdChange(inst) {
							if (inst) {
								var jstype = Model.getJsType(inst.type, true);
								if (jstype && obj === fromExoModel(inst, this._translator)) {
									inst.id = idChange.newId;
									inst.isNew = false;
								}
							}
						}

						this._changeLog.sets.forEach(function (set) {
							set.changes.forEach(function (change) {
								// Only process changes to model instances
								if (!change.instance) return;

								fixChangeInstanceDueToIdChange.call(this, change.instance);

								// For list changes additionally check added and removed objects.
								if (change.type === "ListChange") {
									// get the jsType of the object that contains the list
									var jsType = Model.getJsType(change.instance.type, true);

									if (jsType) {
										if (jsType.meta.property(change.property).get_isEntityListType()) {
											if (change.added.length > 0)
												change.added.forEach(fixChangeInstanceDueToIdChange, this);
											if (change.removed.length > 0)
												change.removed.forEach(fixChangeInstanceDueToIdChange, this);
										}
									}
								}
								// For reference changes additionally check oldValue/newValue
								else if (change.type === "ReferenceChange") {
									fixChangeInstanceDueToIdChange.call(this, change.oldValue);
									fixChangeInstanceDueToIdChange.call(this, change.newValue);
								}
							}, this);
						}, this);
					}
					// Otherwise, log an error.
					else {
						logWarning($format("Cannot apply id change on type \"{0}\" since old id \"{1}\" was not found.", idChange.type, idChange.oldId));
					}
				}, after), this);
			}, this);

			// Callback immediately since nothing will be force loaded
			if (callback) {
				callback.call(thisPtr || this);
			}
		},
		applyInitChange: function (change, before, after, callback, thisPtr) {
			tryGetJsType(this.model, change.instance.type, null, false, this.ignoreChanges(before, function (jstype) {

				// Attempt to fetch the object in case it has already been created.
				var newObj = jstype.meta.get(
					// Since the object is being newly created, we can use the server-generated id.
					change.instance.id,

					// When processing server-side changes we can expect that the type of the instance
					// is exactly the type specified in the change object, not a base type. 
					true
				);

				if (!newObj) {
					// Check for a translation between the old id that was reported and an actual old id.  This is
					// needed since new objects that are created on the server and then committed will result in an accurate
					// id change record, but "instance.id" for this change will actually be the persisted id.
					var serverOldId = this._translator.forward(change.instance.type, change.instance.id) || change.instance.id;

					lazyCreateEntity(change.instance.type, serverOldId, this.ignoreChanges(before, function () {
						// Create the new object (supress events)
						newObj = new jstype(null, null, true);

						// Remember the object's client-generated new id and the corresponding server-generated new id
						this._translator.add(change.instance.type, newObj.meta.id, serverOldId);

						// Raise event after recording id mapping so that listeners can leverage it
						this.model.notifyObjectRegistered(newObj);

						return newObj;
					}, after), this);
				}
			}, after), this);

			// Callback immediately since nothing will be force loaded
			if (callback) {
				callback.call(thisPtr || this);
			}
		},
		applyRefChange: function (change, before, after, callback, thisPtr) {
			var hasExited = false;
			var callBeforeExiting = true;

			tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
				tryGetEntity(this.model, this._translator, srcType, change.instance.id, null, LazyLoadEnum.None, this.ignoreChanges(before, function (srcObj) {
					// Update change to reflect the object's new id
					ServerSync$retroactivelyFixChangeWhereIdChanged(change.instance, srcObj);

					// Cache the property since it is not a simple property access.
					var property = srcObj.meta.property(change.property);
					if (!property) {
						throw new Error("Property \"" + change.property + "\" could not be found on type \"" + srcType.meta.get_fullName() + "\".");
					}

					// Apply change
					if (change.newValue) {
						// Don't call immediately since we may need to lazy load the type
						if (!hasExited) {
							callBeforeExiting = false;
						}

						tryGetJsType(this.model, change.newValue.type, null, true, this.ignoreChanges(before, function (refType) {
							tryGetEntity(this.model, this._translator, refType, change.newValue.id, null, LazyLoadEnum.Lazy, this.ignoreChanges(before, function (refObj) {
								// Update change to reflect the object's new id
								ServerSync$retroactivelyFixChangeWhereIdChanged(change.newValue, refObj);

								// Update change to reflect the object's new id
								if (change.newValue.id === refObj.meta.legacyId) {
									change.newValue.id = refObj.meta.id;
								}

								// Manually ensure a property value, if it doesn't have one then it will be marked as pendingInit
								Property$_ensureInited.call(property, srcObj);

								// Mark the property as no longer pending init since its value is being established
								srcObj.meta.pendingInit(property, false);

								// Set the property value
								Observer.setValue(srcObj, change.property, refObj);

								// Callback once the type has been loaded
								if (!callBeforeExiting && callback) {
									callback.call(thisPtr || this);
								}
							}, after), this);
						}, after), this);
					}
					else {
						// Manually ensure a property value, if it doesn't have one then it will be marked as pendingInit
						Property$_ensureInited.call(property, srcObj);

						// Mark the property as no longer pending init since its value is being established
						srcObj.meta.pendingInit(property, false);

						// Set the property value
						Observer.setValue(srcObj, change.property, null);
					}

					// Update oldValue's id in change object
					if (change.oldValue) {
						tryGetJsType(this.model, change.oldValue.type, null, true, this.ignoreChanges(before, function (refType) {
							// Update change to reflect the object's new id
							var refObj = fromExoModel(change.oldValue, this._translator, true);
							ServerSync$retroactivelyFixChangeWhereIdChanged(change.oldValue, refObj);
						}, after), this);
					}
				}, after), this);
			}, this);

			// Callback immediately since nothing will be force loaded...yet
			if (callBeforeExiting && callback) {
				callback.call(thisPtr || this);
			}

			hasExited = true;
		},
		applyValChange: function (change, before, after, callback, thisPtr) {
			tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
				tryGetEntity(this.model, this._translator, srcType, change.instance.id, null, LazyLoadEnum.None, this.ignoreChanges(before, function (srcObj) {
					// Update change to reflect the object's new id
					ServerSync$retroactivelyFixChangeWhereIdChanged(change.instance, srcObj);

					// Cache the new value, becuase we access it many times and also it may be modified below
					// to account for timezone differences, but we don't want to modify the actual change object.
					var newValue = change.newValue;

					// Cache the property since it is not a simple property access.
					var property = srcObj.meta.property(change.property);
					if (!property) {
						throw new Error("Property \"" + change.property + "\" could not be found on type \"" + srcType.meta.get_fullName() + "\".");
					}

					if (property.get_jstype() === Date && newValue && newValue.constructor == String && newValue.length > 0) {

						// Convert from string (e.g.: "2011-07-28T06:00:00.000Z") to date.
						dateRegex.lastIndex = 0;
						newValue = new Date(newValue.replace(dateRegex, dateRegexReplace));

						//now that we have the value set for the date.
						//if the underlying property datatype is actually a date and not a datetime
						//then we need to add the local timezone offset to make sure that the date is displayed acurately.
						if (property.get_format() && !hasTimeFormat.test(property.get_format().toString())) {
							var serverOffset = this.get_ServerTimezoneOffset();
							var localOffset = -(new Date().getTimezoneOffset() / 60);
							newValue = newValue.addHours(serverOffset - localOffset);
						}
					}
					else if (newValue && newValue instanceof TimeSpan) {
						newValue = newValue.toObject();
					}

					// Manually ensure a property value, if it doesn't have one then it will be marked as pendingInit
					Property$_ensureInited.call(property, srcObj);

					// Mark the property as no longer pending init since its value is being established
					srcObj.meta.pendingInit(property, false);

					// Set the property value
					Observer.setValue(srcObj, change.property, newValue);
				}, after), this);
			}, this);

			// Callback immediately since nothing will be force loaded
			if (callback) {
				callback.call(thisPtr || this);
			}
		},
		applyListChange: function (change, before, after, callback, thisPtr) {
			var hasExited = false;
			var callBeforeExiting = true;

			tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
				tryGetEntity(this.model, this._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, this.ignoreChanges(before, function (srcObj) {
					// Update change to reflect the object's new id
					ServerSync$retroactivelyFixChangeWhereIdChanged(change.instance, srcObj);

					var property = srcObj.meta.property(change.property);
					if (!property) {
						throw new Error("Property \"" + change.property + "\" could not be found on type \"" + srcType.meta.get_fullName() + "\".");
					}

					var isEntityList = property.get_isEntityListType();
					var list = property.value(srcObj);

					list.beginUpdate();

					var listSignal = new ExoWeb.Signal("applyListChange-items");

					// apply added items
					if (change.added.length > 0) {
						// Don't call immediately since we may need to lazy load the type
						if (!hasExited) {
							callBeforeExiting = false;
						}

						// Add each item to the list after ensuring that the type is loaded
						change.added.forEach(function (item) {
							if (isEntityList) {
								tryGetJsType(this.model, item.type, null, true, listSignal.pending(this.ignoreChanges(before, function (itemType) {
									tryGetEntity(this.model, this._translator, itemType, item.id, null, LazyLoadEnum.Lazy, this.ignoreChanges(before, function (itemObj) {
										// Update change to reflect the object's new id
										ServerSync$retroactivelyFixChangeWhereIdChanged(item, itemObj);

										if (!list.contains(itemObj)) {
											ListLazyLoader.allowModification(list, function () {
												list.add(itemObj);
											});
										}
									}, after), this);
								}, after)), this, true);
							} else {
								ListLazyLoader.allowModification(list, function () {
									list.add(item);
								});
							}
						}, this);
					}

					// apply removed items
					change.removed.forEach(function (item) {
						if (isEntityList) {
							// no need to load instance only to remove it from a list when it can't possibly exist
							tryGetJsType(this.model, item.type, null, false, this.ignoreChanges(before, function (itemType) {
								tryGetEntity(this.model, this._translator, itemType, item.id, null, LazyLoadEnum.Lazy, this.ignoreChanges(before, function (itemObj) {
									// Update change to reflect the object's new id
									ServerSync$retroactivelyFixChangeWhereIdChanged(item, itemObj);

									ListLazyLoader.allowModification(list, function () {
										list.remove(itemObj);
									});
								}, after), this);
							}, after), this, true);
						} else {
							ListLazyLoader.allowModification(list, function () {
								list.remove(item);
							});
						}
					}, this);

					// don't end update until the items have been loaded
					listSignal.waitForAll(this.ignoreChanges(before, function () {
						try {
							var listUpdateEnded = false;
							if (hasExited) {
								this.beginApplyingChanges();
							}
							try {
								ListLazyLoader.allowModification(list, function () {
									// Update variable first to indicate that endUpdate was at least attempted.
									// If the call to endUpdate generates an error we would not want to attempt
									// again and potentially generate a different error because of side-effects.
									listUpdateEnded = true;

									list.endUpdate();
								});
							} finally {
								if (!listUpdateEnded) {
									list.endUpdate();
								}
							}
						} finally {
							if (hasExited) {
								this.endApplyingChanges();
							}
						}

						// Callback once all instances have been added
						if (!callBeforeExiting && callback) {
							callback.call(thisPtr || this);
						}
					}, after), this, true);
				}, after), this);
			}, this);

			// Callback immediately since nothing will be force loaded...yet
			if (callBeforeExiting && callback) {
				callback.call(thisPtr || this);
			}

			hasExited = true;
		},

		// Checkpoint
		///////////////////////////////////////////////////////////////////////
		checkpoint: function ServerSync$checkpoint() {
			return this._changeLog.checkpoint();
		},

		// Rollback
		///////////////////////////////////////////////////////////////////////
		rollback: function ServerSync$rollback(checkpoint, callback, thisPtr) {
			var signal = new Signal("rollback");
			var waitForAllRegistered = false;

			try {
				var batch = ExoWeb.Batch.start("rollback changes");

				this.beginApplyingChanges();

				var change = this._changeLog.undo();
				while (change && !(change.type === "Checkpoint" && change.code === checkpoint)) {
					if (change.type == "InitNew") {
						this.rollbackInitChange(change, signal.pending());
					}
					else if (change.type == "ReferenceChange") {
						this.rollbackRefChange(change, signal.pending());
					}
					else if (change.type == "ValueChange") {
						this.rollbackValChange(change, signal.pending());
					}
					else if (change.type == "ListChange") {
						this.rollbackListChange(change, signal.pending());
					}

					change = this._changeLog.undo();
				}

				waitForAllRegistered = true;
				signal.waitForAll(function () {
					this.endApplyingChanges();
					ExoWeb.Batch.end(batch);
					if (callback) {
						callback.call(thisPtr || this);
					}
					this._raiseEvent("changesDetected", [this, { reason: "rollback" }]);
				}, this, true);
			}
			finally {
				// the signal was not registered, therefore we need to handle endApplyingChanges call here
				if (!waitForAllRegistered) {
					this.endApplyingChanges();
					ExoWeb.Batch.end(batch);
				}
			}
		},
		rollbackValChange: function ServerSync$rollbackValChange(change, callback, thisPtr) {
			tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
				tryGetEntity(this.model, this._translator, srcType, change.instance.id, null, LazyLoadEnum.None, function (srcObj) {

					// Cache the new value, becuase we access it many times and also it may be modified below
					// to account for timezone differences, but we don't want to modify the actual change object.
					var oldValue = change.oldValue;

					// Cache the property since it is not a simple property access.
					var property = srcObj.meta.property(change.property);
					if (!property) {
						throw new Error("Property \"" + change.property + "\" could not be found on type \"" + srcType.meta.get_fullName() + "\".");
					}

					if (property.get_jstype() === Date && oldValue && oldValue.constructor == String && oldValue.length > 0) {

						// Convert from string (e.g.: "2011-07-28T06:00:00.000Z") to date.
						dateRegex.lastIndex = 0;
						oldValue = new Date(oldValue.replace(dateRegex, dateRegexReplace));

						//now that we have the value set for the date.
						//if the underlying property datatype is actually a date and not a datetime
						//then we need to add the local timezone offset to make sure that the date is displayed acurately.
						if (property.get_format() && !hasTimeFormat.test(property.get_format().toString())) {
							var serverOffset = this.get_ServerTimezoneOffset();
							var localOffset = -(new Date().getTimezoneOffset() / 60);
							oldValue = oldValue.addHours(serverOffset - localOffset);
						}
					}
					else if (oldValue && oldValue instanceof TimeSpan) {
						oldValue = oldValue.toObject();
					}

					// Set the property value
					Observer.setValue(srcObj, change.property, oldValue);
				}, this);
			}, this);

			// Callback immediately since nothing will be force loaded
			if (callback) {
				callback.call(thisPtr || this);
			}
		},
		rollbackRefChange: function ServerSync$rollbackRefChange(change, callback, thisPtr) {
			var hasExited = false;
			var callBeforeExiting = true;

			tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
				tryGetEntity(this.model, this._translator, srcType, change.instance.id, null, LazyLoadEnum.None, function (srcObj) {
					if (change.oldValue) {
						// Don't call immediately since we may need to lazy load the type
						if (!hasExited) {
							callBeforeExiting = false;
						}

						tryGetJsType(this.model, change.oldValue.type, null, true, function (refType) {
							tryGetEntity(this.model, this._translator, refType, change.oldValue.id, null, LazyLoadEnum.None, function (refObj) {
								Observer.setValue(srcObj, change.property, refObj);

								// Callback once the type has been loaded
								if (!callBeforeExiting && callback) {
									callback.call(thisPtr || this);
								}
							}, this);
						}, this);
					}
					else {
						Observer.setValue(srcObj, change.property, null);
					}
				}, this);
			}, this);

			// Callback immediately since nothing will be force loaded...yet
			if (callBeforeExiting && callback) {
				callback.call(thisPtr || this);
			}

			hasExited = true;
		},
		rollbackInitChange: function ServerSync$rollbackInitChange(change, callback, thisPtr) {
			//TODO: need to remove from the translator
			if (callback) {
				callback.call(thisPtr || this);
			}
		},
		rollbackListChange: function ServerSync$rollbackListChange(change, callback, thisPtr) {
			var hasExited = false;
			var callBeforeExiting = true;

			tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
				tryGetEntity(this.model, this._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, function (srcObj) {
					var property = srcObj.meta.property(change.property);
					if (!property) {
						throw new Error("Property \"" + change.property + "\" could not be found on type \"" + srcType.meta.get_fullName() + "\".");
					}

					var isEntityList = property.get_isEntityListType();
					var list = property.value(srcObj);
					var translator = this._translator;

					list.beginUpdate();

					var listSignal = new ExoWeb.Signal("rollbackListChange-items");

					// Rollback added items
					change.added.forEach(function rollbackListChanges$added(item) {
						if (isEntityList) {
							tryGetJsType(this.model, item.type, null, false, function (itemType) {
								var childObj = fromExoModel(item, translator);
								if (childObj) {
									list.remove(childObj);
								}
							}, this);
						} else {
							list.remove(item);
						}
					}, this);

					// Rollback removed items
					if (change.removed.length > 0) {
						// Don't call immediately since we may need to lazy load the type
						if (!hasExited) {
							callBeforeExiting = false;
						}

						change.removed.forEach(function rollbackListChanges$added(item) {
							if (isEntityList) {
								tryGetJsType(this.model, item.type, null, true, listSignal.pending(function (itemType) {
									var childObj = fromExoModel(item, translator, true);
									list.add(childObj);
								}, this, true), this);
							} else {
								list.add(item);
							}
						}, this);
					}

					// don't end update until the items have been loaded
					listSignal.waitForAll(function () {
						if (hasExited) {
							this.beginApplyingChanges();
						}
						ListLazyLoader.allowModification(list, function () {
							list.endUpdate();
						});
						if (hasExited) {
							this.endApplyingChanges();
						}
						// Callback once all instances have been added
						if (!callBeforeExiting && callback) {
							callback.call(thisPtr || this);
						}
					}, this);
				}, this);
			}, this);

			// Callback immediately since nothing will be force loaded...yet
			if (callBeforeExiting && callback) {
				callback.call(thisPtr || this);
			}

			hasExited = true;
		},

		// Various
		///////////////////////////////////////////////////////////////////////
		addChangesDetected: function (handler) {
			this._addEvent("changesDetected", handler);
		},
		batchChanges: function (description, callback, thisPtr) {
			// Remove empty batches if a descriptive title or user is not specified.
			// If a title or user is specified then it may be desireable to keep it for diagnostic purposes.
			var removeIfEmpty = !description && !this._localUser;

			this._changeLog.batchChanges(description, this._localUser, thisPtr ? callback.bind(thisPtr) : callback, removeIfEmpty);
		},
		changes: function ServerSync$changes(includeAllChanges, simulateInitRoot, excludeNonPersisted) {
			var list = [];
			var sets = serializeChanges.call(this, includeAllChanges, simulateInitRoot);
			sets.forEach(function (set) {
				if (excludeNonPersisted) {
					list.addRange(set.changes.filter(isPropertyChangePersisted));
				}
				else {
					list.addRange(set.changes);
				}
			});
			return list;
		},
		get_ServerTimezoneOffset: function ServerSync$get_ServerTimezoneOffset() {
			//if we have not set the server timezone offset yet, retrieve it from the server
			var timezoneOffset = 0;

			if (this._serverInfo !== null) {
				timezoneOffset = this._serverInfo.TimeZoneOffset;
			}

			return timezoneOffset;
		},
		set_ServerInfo: function ServerSync$set_ServerTimezoneOffset(newInfo) {
			//join the new server info with the information that you are adding.
			this._serverInfo = this._serverInfo ? jQuery.extend(this._serverInfo, newInfo) : newInfo;
		},
		get_localUser: function ServerSync$get_localUser(user) {
			return this._localUser;
		},
		set_localUser: function ServerSync$set_localUser(user) {
			this._localUser = user;
		}
	});

	Property.prototype.triggersRoundtrip = function (paths) {
		this.addChanged(function (sender) {
			if (!context.server.isApplyingChanges()) {
				EventScope$onExit(function() {
					setTimeout(function () {
						sender.meta.type.model.server.roundtrip(sender, paths);
					}, 100);
				});
			}
		});
	};

	// #endregion

	// #region ExoWeb.Mapper.Internals
	//////////////////////////////////////////////////

	var STATIC_ID = "static";
	var dateRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})\:(\d{2})\:(\d{2})(\.\d{3})?Z$/g;
	var dateRegexReplace = "$2/$3/$1 $4:$5:$6 GMT";
	var hasTimeFormat = /[hHmts]/;

	function ensureJsType(model, typeName, callback, thisPtr) {
		var mtype = model.type(typeName);

		if (!mtype) {
			fetchTypes(model, [typeName], function(jstype) {
				callback.call(thisPtr || this, jstype);
			});
		}
		else if (LazyLoader.isRegistered(mtype)) {
			LazyLoader.load(mtype, null, false, function(jstype) {
				callback.apply(thisPtr || this, [jstype]);
			});
		}
		else {
			callback.apply(thisPtr || this, [mtype.get_jstype()]);
		}
	}

	function conditionsFromJson(model, conditionsJson, forInstances, callback, thisPtr) {

		for (var conditionCode in conditionsJson) {
			conditionFromJson(model, forInstances, conditionCode, conditionsJson[conditionCode]);
		}

		if (callback && callback instanceof Function) {
			callback.call(thisPtr || this);
		}
	}

	function conditionFromJson(model, forInstances, conditionCode, conditionsJson) {
		var conditionType = ExoWeb.Model.ConditionType.get(conditionCode);

		if (!conditionType) {
			logWarning("A condition type with code \"" + conditionCode + "\" could not be found.");
			return;
		}

		var serverSync = model.server;

		// process each condition
		if (forInstances) {
			conditionsJson.forEach(function (conditionJson) {
				var rootTarget = conditionJson.targets[0];
				if (rootTarget) {
					tryGetJsType(serverSync.model, rootTarget.instance.type, null, false, function (jstype) {
						tryGetEntity(serverSync.model, serverSync._translator, jstype, rootTarget.instance.id, null, LazyLoadEnum.None, function (rootTargetInstance) {
							if (forInstances.indexOf(rootTargetInstance) >= 0) {
								conditionTargetsFromJson(model, conditionType, conditionJson.message, conditionJson.targets);
							}
						});
					});
				}
			});
		}
		else {
			conditionsJson.forEach(function (conditionJson) {
				conditionTargetsFromJson(model, conditionType, conditionJson.message, conditionJson.targets);
			});
		}
	}

	function conditionTargetsFromJson(model, conditionType, message, targetsJson) {
		var condition = new Condition(conditionType, message, null, null, "server");

		var serverSync = model.server;

		// process each condition target
		targetsJson.forEach(function (target) {
			tryGetJsType(serverSync.model, target.instance.type, null, false, function (jstype) {
				tryGetEntity(serverSync.model, serverSync._translator, jstype, target.instance.id, null, LazyLoadEnum.None, function (instance) {
					condition.targets.push(new ConditionTarget(condition, instance, target.properties.map(function (p) { return jstype.meta.property(p); })));
				});
			});
		});
	}

	function objectsFromJson(model, json, callback, thisPtr) {
		var signal = new ExoWeb.Signal("objectsFromJson");
		var objectsLoaded = [];
		for (var typeName in json) {
			var poolJson = json[typeName];
			for (var id in poolJson) {
				// locate the object's state in the json
				objectFromJson(model, typeName, id, poolJson[id], signal.pending(function (obj) {
					if (obj) {
						objectsLoaded.push(obj);
					}
				}), thisPtr);
			}
		}

		signal.waitForAll(function() {
			callback.call(thisPtr || this, objectsLoaded);
		});
	}

	function objectFromJson(model, typeName, id, json, callback, thisPtr) {
		// get the object to load
		var obj;

		// family-qualified type name is not available so can't use getType()
		var mtype = model.type(typeName);

		// if this type has never been seen, go and fetch it and resume later
		if (!mtype) {
			fetchTypes(model, [typeName], function () {
				objectFromJson(model, typeName, id, json, callback);
			});
			return;
		}

		// Load object's type if needed
		if (LazyLoader.isRegistered(mtype)) {
			LazyLoader.load(mtype, null, false, function() {
				objectFromJson(model, typeName, id, json, callback, thisPtr);
			});
			return;
		}

		// get target object to load
		if (id === STATIC_ID) {
			obj = null;
		}
		else {
			obj = getObject(model, typeName, id, null, true);
		}

		var loadedObj;

		var initObj = false;
		if (id === STATIC_ID) {
			initObj = true;
		} else if (obj) {
			if (LazyLoader.isRegistered(obj)) {
				initObj = true;
				// track the newly loaded instance to pass to the caller when complete
				loadedObj = obj;
				// unregister the instance from loading
				ObjectLazyLoader.unregister(obj);
			}
			if (obj.wasGhosted) {
				initObj = true;
				// track the newly loaded instance to pass to the caller when complete
				loadedObj = obj;
				delete obj.wasGhosted;
			}
		}

		// Continue if the object needs to be initialized (ghosted or lazy loaded),
		// or there is no object (load static lists), or the object is not new (load
		// non-loaded list properties for an object that was previously loaded).
		if (initObj || !obj || !obj.meta.isNew) {
			var loadedProperties = [];

			// Load object's properties
			for (var t = mtype; t !== null; t = obj ? t.baseType : null) {
				var props = obj ? t.get_instanceProperties() : t.get_staticProperties();

				for (var propName in props) {
					if (loadedProperties.indexOf(propName) >= 0) {
						continue;
					}

					loadedProperties.push(propName);

					var prop = props[propName];

					if (!prop) {
						throw new Error($format("Cannot load object {0}|{2} because it has an unexpected property '{1}'", typeName, propName, id));
					}

					if (prop.get_origin() !== "server") {
						continue;
					}

					if (!initObj && !prop.get_isList()) {
						// If the root object is already initialized, then skip over non-list properties.
						continue;
					}

					var propData;

					// instance fields have indexes, static fields use names
					if (obj) {
						propData = json[prop.get_index()];
					} else {
						propData = json[propName];

						// not all static fields may be present
						if (propData === undefined) {
							continue;
						}
					}

					if (propData !== null) {
						var propType = prop.get_jstype();

						// Always process list properties since they can be loaded after the parent object.
						if (prop.get_isList()) {
							var list = prop.get_isStatic() ? prop.value() : obj[prop._fieldName];

							if (propData == "?") {
								// don't overwrite list if its already a ghost
								if (!list) {
									list = ListLazyLoader.register(obj, prop);
									Property$_init.call(prop, obj, list, false);
								}
							} else {
								if (!list || LazyLoader.isRegistered(list)) {

									var doingObjectInit = undefined;
									//var newItems = [];

									// json has list members
									if (list) {
										ListLazyLoader.unregister(list);
										doingObjectInit = false;
									} else {
										list = [];
										doingObjectInit = true;
									}

									for (var i = 0; i < propData.length; i++) {
										var ref = propData[i];
										var c = getObject(model, propType, (ref && ref.id || ref), (ref && ref.type || propType));
										if (list.contains(c)) {
											logWarning($format("Initializing list {0}|{1}.{2} already contains object {3}.", typeName, id, prop._name, Entity.toIdString(c)));
										}
										//newItems.push(c);
										list.push(c);
									}

									if (doingObjectInit) {
										Property$_init.call(prop, obj, list);
									} else {
										// Collection change driven by user action or other behavior would result in the "change" event
										// being raised for the list property.  Since we don't want to record this as a true observable
										// change, raise the event manually so that rules will still run as needed.
										//if (obj) {
										prop._raiseEvent("changed", [obj, { property: prop, newValue: list, oldValue: undefined, collectionChanged: true }]);
										//}

										// Example of explicitly raising the collection change event if needed.
										// NOTE: This is probably not necessary because it is difficult to get a reference to a
										// non-loaded list and so nothing would be watching for changes prior to loading completion.
										// The _initializing flag would be necessary to signal to the property's collection change
										// handler that it should not raise the various events in response to the collection change.
										//list._initializing = true;
										//Sys.Observer.raiseCollectionChanged(list, [new Sys.CollectionChange(Sys.NotifyCollectionChangedAction.add, newItems, 0)]);
										//delete list._initializing;
									}
								}
							}
						} else if (initObj) {
							var ctor = prop.get_jstype(true);

							// assume if ctor is not found its a model type not an intrinsic
							if (!ctor || ctor.meta) {
								Property$_init.call(prop, obj, getObject(model, propType, (propData && propData.id || propData), (propData && propData.type || propType)));
							} else {
								// Coerce strings into dates
								if (ctor == Date && propData && propData.constructor == String && propData.length > 0) {

									// Convert from string (e.g.: "2011-07-28T06:00:00.000Z") to date.
									dateRegex.lastIndex = 0;
									propData = new Date(propData.replace(dateRegex, dateRegexReplace));

									//now that we have the value set for the date.
									//if the underlying property datatype is actually a date and not a datetime
									//then we need to add the local timezone offset to make sure that the date is displayed acurately.
									if (prop.get_format() && !hasTimeFormat.test(prop.get_format().toString())) {
										var serverOffset = model.server.get_ServerTimezoneOffset();
										var localOffset = -(new Date().getTimezoneOffset() / 60);
										propData = propData.addHours(serverOffset - localOffset);
									}
								} else if (ctor === TimeSpan) {
									propData = new TimeSpan(propData.TotalMilliseconds);
								}
								Property$_init.call(prop, obj, propData);
							}
						}
					} else if (initObj) {
						Property$_init.call(prop, obj, null);
					}
				}
			}
		}

		if (callback && callback instanceof Function) {
			callback.call(thisPtr || this, loadedObj);
		}
	}

	function typesFromJson(model, json, onTypeLoadSuccess, onTypeLoadFailure) {
		for (var typeName in json) {
			var typeJson = json[typeName];
			if (typeJson === null) {
				if (onTypeLoadFailure) {
					onTypeLoadFailure(typeName, null);
				}
			} else {
				typeFromJson(model, typeName, typeJson);
				if (onTypeLoadSuccess) {
					onTypeLoadSuccess(typeName, typeJson);
				}
			}
		}
	}

	function typeFromJson(model, typeName, json) {
		// get model type. it may have already been created for lazy loading
		var mtype = getType(model, typeName, json.baseType);

		// set the default type format
		if (json.format) {
			mtype.set_format(getFormat(mtype.get_jstype(), json.format));
		}

		if (mtype.get_originForNewProperties() === "client") {
			throw new Error("Type \"" + mtype._fullName + "\" has already been loaded");
		}

		// store exports
		if (json.exports) {
			mtype.set_exports(json.exports);
		}

		// define properties
		for (var propName in json.properties) {
			var propJson = json.properties[propName];

			// Type
			var propType = propJson.type;
			if (propJson.type.endsWith("[]")) {
				propType = propType.toString().substring(0, propType.length - 2);
				propJson.isList = true;
			}
			propType = getJsType(model, propType);

			// Format
			var format = getFormat(propType, propJson.format);

			// Add the property
			var prop = mtype.addProperty({
				name: propName,
				type: propType,
				label: propJson.label,
				helptext: propJson.helptext,
				format: format,
				isList: propJson.isList === true,
				isStatic: propJson.isStatic === true,
				isPersisted: propJson.isPersisted !== false,
				isCalculated: propJson.isCalculated === true,
				index: propJson.index,
				defaultValue: propJson.defaultValue ? mtype.compileExpression(propJson.defaultValue) : undefined,
				constant: propJson.constant
			});
		
			// setup static properties for lazy loading
			if (propJson.isStatic && propJson.isList) {
				Property$_init.call(prop, null, ListLazyLoader.register(null, prop));
			}

			// process property specific rules, which have a specialized json syntax to improve readability and minimize type json size
			if (propJson.rules) {
				for (var rule in propJson.rules) {
					var options = propJson.rules[rule];
				
					// default the type to the rule name if not specified
					if (!options.type) {
						options.type = rule;

						// calculate the name of the rule if not specified in the json, assuming it will be unique
						if (!options.name) {
							options.name = mtype.get_fullName() + "." + prop.get_name() + "." + rule.substr(0, 1).toUpperCase() + rule.substr(1);
						}
					}

					// initialize the name of the rule if not specified in the json
					else if (!options.name) {
						options.name = rule;
					}

					options.property = prop;
					ruleFromJson(mtype, options);
				}
			}
		}

		// ensure all properties added from now on are considered client properties
		mtype.set_originForNewProperties("client");

		// define methods
		for (var methodName in json.methods) {
			var methodJson = json.methods[methodName];
			mtype.addMethod({ name: methodName, parameters: methodJson.parameters, isStatic: methodJson.isStatic });
		}

		// define condition types
		if (json.conditionTypes)
			conditionTypesFromJson(model, mtype, json.conditionTypes);

		// define rules 
		if (json.rules) {
			for (var i = 0; i < json.rules.length; ++i) {
				ruleFromJson(mtype, json.rules[i]);
			}
		}

	}

	function conditionTypesFromJson(model, mtype, json) {
		json.forEach(function (ctype) {
			conditionTypeFromJson(mtype, ctype);
		});
	}

	function conditionTypeFromJson(mtype, json) {

		// for rules that assert a single condition, the code will be the unique name of the rule
		json.code = json.code || json.name;

		// attempt to retrieve the condition type by code.
		var conditionType = ExoWeb.Model.ConditionType.get(json.code);

		// create the condition type if it does not already exist.
		if (!conditionType) {

			// get a list of condition type sets for this type.
			var sets = !json.sets ? [] : json.sets.map(function(name) {
				var set = ExoWeb.Model.ConditionTypeSet.get(name);
				if (!set) {
					set = new ExoWeb.Model.ConditionTypeSet(name);
				}
				return set;
			});

			// create the appropriate condition type based on the category.
			if (!json.category || json.category == "Error") {
				conditionType = new ExoWeb.Model.ConditionType.Error(json.code, json.message, sets, "server");
			}
			else if (json.category == "Warning") {
				conditionType = new ExoWeb.Model.ConditionType.Warning(json.code, json.message, sets, "server");
			}
			else if (json.category == "Permission") {
				conditionType = new ExoWeb.Model.ConditionType.Permission(json.code, json.message, sets, json.permissionType, json.isAllowed, "server");
			}
			else {
				conditionType = new ExoWeb.Model.ConditionType(json.code, json.category, json.message, sets, "server");
			}

			// account for the potential for subclasses to be serialized with additional properties.
			conditionType.extend(json);
		}

		if (json.rule && json.rule.hasOwnProperty("type")) {
			conditionType.rules.push(ruleFromJson(mtype, json.rule, conditionType));
		}

		return conditionType;
	}

	function ruleFromJson(mtype, options) {
		var ruleType = ExoWeb.Model.Rule[options.type];
		if (options.conditionType) {
			options.conditionType = conditionTypeFromJson(mtype, options.conditionType);
		}
		else if (ruleType.prototype instanceof ConditionRule) {
			options.conditionType = conditionTypeFromJson(mtype, options);
		}
		return new ruleType(mtype, options);
	}

	function getJsType(model, typeName, forLoading) {
		// Get an array representing the type family.
		var family = typeName.split(">");

		// Try to get the js type from the window object.
		var jstype = ExoWeb.Model.Model.getJsType(family[0], true);

		// If its not defined, assume the type is a model type
		// that may eventually be fetched.
		if (jstype === undefined) {
			jstype = getType(model, null, family).get_jstype();
		}

		return jstype;
	}

	function flattenTypes(types, flattened) {
		function add(item) {
			if (flattened.indexOf(item) < 0) {
				flattened.push(item);
			}
		}

		if (types instanceof Array) {
			Array.forEach(types, add);
		}
		else if (typeof (types) === "string") {
			Array.forEach(types.split(">"), add);
		}
		else if (types) {
			add(types);
		}
	}

	// Gets a reference to a type.  IMPORTANT: typeName must be the
	// family-qualified type name (ex: Employee>Person).
	function getType(model, finalType, propType) {
		// ensure the entire type family is at least ghosted
		// so that javascript OO mechanisms work properly
		var family = [];

		flattenTypes(finalType, family);
		flattenTypes(propType, family);

		var mtype;
		var baseType;

		while (family.length > 0) {
			baseType = mtype;

			var type = family.pop();

			if (type instanceof ExoWeb.Model.Type) {
				mtype = type;
			}
			else if (type.meta) {
				mtype = type.meta;
			}
			else {
				// type is a string
				mtype = model.type(type);

				// if type doesn't exist, setup a ghost type
				if (!mtype) {
					mtype = model.addType(type, baseType, "server");
					TypeLazyLoader.register(mtype);
				}
			}
		}

		return mtype;
	}

	function getObject(model, propType, id, finalType, forLoading) {
		if (id === STATIC_ID) {
			throw new Error("Function 'getObject' can only be called for instances (id='" + id + "')");
		}

		// get model type
		var mtype = getType(model, finalType, propType);

		// Try to locate the instance by id.
		var obj = mtype.get(id,
			// If an exact type exists then it should be specified in the call to getObject.
			true);

		// If it doesn't exist, create a ghosted instance.
		if (!obj) {
			obj = new (mtype.get_jstype())(id);
			obj.wasGhosted = true;
			if (!forLoading) {
				// If the instance is not being loaded, then attach a lazy loader.
				ObjectLazyLoader.register(obj);
			}
		}

		return obj;
	}

	function onTypeLoaded(model, typeName) {
		var mtype = model.type(typeName);
		mtype.eachBaseType(function(mtype) {
			if (!LazyLoader.isLoaded(mtype)) {
				throw new Error("Base type " + mtype._fullName + " is not loaded.");
			}
		});
		TypeLazyLoader.unregister(mtype);
		raiseExtensions(mtype);
		return mtype;
	}

	///////////////////////////////////////////////////////////////////////////////
	function fetchTypesImpl(model, typeNames, callback, thisPtr) {
		var signal = new ExoWeb.Signal("fetchTypes(" + typeNames.join(",") + ")");
		signal.pending();

		var typesPending = typeNames.copy(), typesLoaded = [];

		function typesFetched(success, types, otherTypes) {
			var baseTypesToFetch = [], loadedTypes = [], baseTypeDependencies = {}, loadableTypes = [];

			if (success) {
				typesFromJson(model, types, null, function (typeName) {
					// Remove types that failed to load
					typesPending.remove(typeName);
				});

				// Update types that have been loaded.  This needs to be persisted since
				// this function can recurse and arguments are not persisted.
				eachProp(types, function(prop) { typesLoaded.push(prop); });
				if (otherTypes) {
					eachProp(otherTypes, function(prop) { typesLoaded.push(prop); });
				}

				// Extract the types that can be loaded since they have no pending base types
				purge(typesPending, function(typeName) {
					var mtype, pendingBaseType = false;

					// In the absense of recursion this will be equivalent to enumerating
					// the properties of the "types" and "otherTypes" arguments.
					if (typesLoaded.contains(typeName)) {
						mtype = model.type(typeName);
						if (mtype) {
							if (LazyLoader.isLoaded(mtype)) {
								loadedTypes.push(mtype._fullName);
							}
							else {
								// find base types that are not loaded
								mtype.eachBaseType(function(baseType) {
									// Don't raise the loaded event until the base types are marked as loaded (or about to be marked as loaded in this pass)
									if (!LazyLoader.isLoaded(baseType)) {
										// Base type will be loaded in this pass
										if (typesLoaded.contains(baseType._fullName)) {
											if (baseTypeDependencies.hasOwnProperty(typeName)) {
												baseTypeDependencies[typeName].splice(0, 0, baseType._fullName);
											}
											else {
												baseTypeDependencies[typeName] = [baseType._fullName];
											}
										}
										else {
											pendingBaseType = true;
											if (!baseTypesToFetch.contains(baseType._fullName) && !typesPending.contains(baseType._fullName)) {
												baseTypesToFetch.push(baseType._fullName);
											}
										}
									}
								});

								if (!pendingBaseType) {
									loadableTypes.push(typeName);
									return true;
								}
							}
						}
					}
				});

				// Remove types that have already been marked as loaded
				loadedTypes.forEach(function(typeName) {
					typesPending.remove(typeName);
				});

				// Raise loaded event on types that can be marked as loaded
				while(loadableTypes.length > 0) {
					var typeName = loadableTypes.dequeue();
					if (baseTypeDependencies.hasOwnProperty(typeName)) {
						// Remove dependencies from array and map
						var deps = baseTypeDependencies[typeName];
						delete baseTypeDependencies[typeName];
						deps.forEach(function(t) {
							loadableTypes.remove(t);
							delete baseTypeDependencies[t];
						});

						// Splice the types back into the beginning of the array in the correct order.
						var spliceArgs = deps;
						spliceArgs.push(typeName);
						spliceArgs.splice(0, 0, 0, 0);
						Array.prototype.splice.apply(loadableTypes, spliceArgs);
					}
					else {
						typesPending.remove(typeName);
						onTypeLoaded(model, typeName);
					}
				}

				// Fetch any pending base types
				if (baseTypesToFetch.length > 0) {
					// TODO: need to notify dontDoubleUp that these types are
					// now part of the partitioned argument for the call.
					typesPending.addRange(baseTypesToFetch);

					// Make a recursive request for base types.
					typeProvider(baseTypesToFetch, typesFetched);
				}
				else if (typesPending.length === 0 && signal.isActive()) {
					// COMPLETE!!!
					signal.oneDone();
				}
			}
			// Handle an error response.  Loading should
			// *NOT* continue as if the type is available.
			else {
				throw new Error($format("Failed to load {0} (HTTP: {1}, Timeout: {2})", typeNames.join(","), types._statusCode, types._timedOut));
			}
		}

		// request the types
		typeProvider(typeNames, typesFetched);

		signal.waitForAll(function() {
			if (callback && callback instanceof Function) {
				var jstypes = typeNames.map(function (typeName) {
					var mtype = model.type(typeName);
					return mtype ? mtype.get_jstype() : null;
				});
				callback.apply(thisPtr || this, jstypes);
			}
		});
	}

	function moveTypeResults(originalArgs, invocationArgs, callbackArgs) {
		// Replace all elements of the callback args array with the types that were requested
		var spliceArgs = [0, callbackArgs.length];
		Array.prototype.push.apply(spliceArgs, invocationArgs[1].map(function(typeName) {
			var mtype = invocationArgs[0].type(typeName);
			return mtype ? mtype.get_jstype() : null;
		}));
		Array.prototype.splice.apply(callbackArgs, spliceArgs);
	}

	var fetchTypes = fetchTypesImpl.dontDoubleUp({ callbackArg: 2, thisPtrArg: 3, partitionedArg: 1, partitionedFilter: moveTypeResults });

	// fetches model paths and calls success or fail based on the outcome
	function fetchPathTypes(model, jstype, path, success, fail) {
		var step = path.steps.dequeue();
		var removedSteps = [step];
		while (step) {
			// locate property definition in model
			var prop = jstype.meta.property(step.property);

			if (!prop) {
				var args = [0, 0];
				Array.prototype.push.apply(args, removedSteps);
				Array.prototype.splice.apply(path.steps, args);
				fail("Could not find property \"" + step.property + "\" on type \"" + jstype.meta.get_fullName() + "\".");
				return;
			}

			// don't need to fetch type information for value types
			if (prop.get_isValueType()) {
				break;
			}

			// Load the type of the property if its not yet loaded
			var mtype;
			if (step.cast) {
				mtype = model.type(step.cast);

				// if this type has never been seen, go and fetch it and resume later
				if (!mtype) {
					Array.insert(path.steps, 0, step);
					fetchTypes(model, [step.cast], function () {
						fetchPathTypes(model, jstype, path, success, function () {
							var args = [0, 0];
							Array.prototype.push.apply(args, removedSteps);
							Array.prototype.splice.apply(path.steps, args);
							fail.apply(this, arguments);
						});
					});
					return;
				}
			}
			else {
				mtype = prop.get_jstype().meta;
			}

			// if property's type isn't load it, then fetch it
			if (!LazyLoader.isLoaded(mtype)) {
				fetchTypes(model, [mtype.get_fullName()], function (t) {
					fetchPathTypes(model, t, path, success, function () {
						var args = [0, 0];
						Array.prototype.push.apply(args, removedSteps);
						Array.prototype.splice.apply(path.steps, args);
						fail.apply(this, arguments);
					});
				});

				// path walking will resume with callback
				return;
			}

			// keep walking the path
			jstype = mtype.get_jstype();

			step = path.steps.dequeue();
			removedSteps.push(step);
		}

		// Inform the caller that the path has been successfully fetched
		success();
	}

	function fetchQueryTypes(model, typeName, paths, callback) {
		var signal = new ExoWeb.Signal("fetchTypes");

		function rootTypeLoaded(jstype) {
		
			// process all paths
			if (paths) {
				Array.forEach(paths, function (path) {

					// attempt to fetch the path
					fetchPathTypes(model, jstype, path, signal.pending(), function (err) {

						// determine if the path represents a static property if the path was not valid
						var step = null, typeName = "";
						while (path.steps.length > 1) {
							step = path.steps.dequeue();
							typeName += (typeName.length > 0 ? "." : "") + step.property;
						}

						var mtype = model.type(typeName);

						var fetchStaticPathTypes = function fetchStaticPathTypes() {
							fetchPathTypes(model, (mtype || model.type(typeName)).get_jstype(), path, signal.pending(), function () {
								throw new Error("Invalid query path \"" + path + "\" - " + err);
							});
						};

						if (!mtype) {
							// first time type has been seen, fetch it
							fetchTypes(model, [typeName], signal.pending(function (t) {
								if (!t) {
									throw new Error(err);
								}
								fetchStaticPathTypes(t);
							}));
						}
						else if (LazyLoader.isRegistered(mtype)) {
							// lazy load type and continue walking the path
							LazyLoader.load(mtype, null, false, signal.pending(fetchStaticPathTypes));
						}
						else {
							fetchStaticPathTypes();
						}

					});
				});
			}
		}

		// load root type, then load types referenced in paths
		var rootType = model.type(typeName);
		if (!rootType) {
			fetchTypes(model, [typeName], signal.pending(function(t) {
				rootTypeLoaded(t);
			}));
		}
		else if (LazyLoader.isRegistered(rootType)) {
			LazyLoader.load(rootType, null, false, signal.pending(rootTypeLoaded));
		}
		else {
			rootTypeLoaded(rootType.get_jstype());
		}

		signal.waitForAll(callback);
	}

	// Recursively searches throught the specified object and restores dates serialized as strings
	function restoreDates(value) {
		function tryRestoreDate(obj, key) {
			var val = obj[key];
			if (val && val.constructor === String && dateRegex.test(val)) {
				dateRegex.lastIndex = 0;
				obj[key] = new Date(val.replace(dateRegex, dateRegexReplace));
			}
		}

		if (value instanceof Array) {
			for (var i = 0; i < value.length; i++) {
				tryRestoreDate(value, i);
			}
		}
		else if (value instanceof Object) {
			for (var field in value) {
				if (value.hasOwnProperty(field)) {
					tryRestoreDate(value, field);
				}
			}
		}
	}

	function tryGetJsType(model, name, property, forceLoad, callback, thisPtr) {
		var jstype = ExoWeb.Model.Model.getJsType(name, true);

		if (jstype && LazyLoader.isLoaded(jstype.meta)) {
			callback.call(thisPtr || this, jstype);
		}
		else if (jstype && forceLoad) {
			LazyLoader.load(jstype.meta, property, false, callback, thisPtr);
		}
		else if (!jstype && forceLoad) {
			ensureJsType(model, name, callback, thisPtr);
		}
		else {
			$extend(name, function() {
				callback.apply(this, arguments);
			}, thisPtr);
		}
	}

	var pendingEntities = {};

	function lazyCreateEntity(type, id, callback, thisPtr) {
		var pendingForType = pendingEntities[type];
		if (!pendingForType) {
			pendingEntities[type] = pendingForType = {};
		}

		if (!pendingForType[id]) {
			pendingForType[id] = { callback: callback, thisPtr: thisPtr };
		}
	}

	var LazyLoadEnum = {
		// If the object doesn't exist, then the callback will be invoked once the object has been loaded for some other reason.
		None: 0,
		// If the object doesn't exist, then force creation and loading of the object and invoke the callback immediately.
		Force: 1,
		// If the object doesn't exist, then force creation and loading of the object and invoke the callback when loading is complete.
		ForceAndWait: 2,
		// If the object doesn't exist, then create the object and invoke the callback.
		Lazy: 3
	};

	var metaGet = Type.prototype.get;

	Type.prototype.get = function (id, exactTypeOnly, suppressLazyInit) {
		var obj = metaGet.apply(this, arguments);

		if (!obj && !suppressLazyInit) {
			// If the object doesn't exist and is pending, create it.
			var pendingForType = pendingEntities[this.get_fullName()];
			if (pendingForType) {
				var pendingForId = pendingForType[id];
				if (pendingForId) {
					obj = pendingForId.callback.call(pendingForId.thisPtr);
				}
			}
		}

		return obj;
	};

	function tryGetEntity(model, translator, type, id, property, lazyLoad, callback, thisPtr) {
		// First, attempt to retrieve an existing object.
		var obj = type.meta.get(
			// Translate to the client-side id.
			translateId(translator, type.meta.get_fullName(), id),

			// We know that tryGetEntity is only called internally and the source of the entity
			// information is always seen as server-origin and so should specify an exact type.
			true,

			// Dont' lazily create the new object if no lazy behavior is specified, i.e. the caller doesn't want to force the object to exist.
			lazyLoad !== LazyLoadEnum.Force && lazyLoad !== LazyLoadEnum.ForceAndWait && lazyLoad !== LazyLoadEnum.Lazy
		);

		if (obj && obj.meta.isLoaded(property)) {
			// If the object exists and is loaded, then invoke the callback immediately.
			callback.call(thisPtr || this, obj);
		}
		else if (lazyLoad == LazyLoadEnum.Lazy) {
			if (!obj) {
				obj = fromExoModel({ type: type.meta.get_fullName(), id: id }, translator, true);
			}

			// In lazy mode, simply invoke the callback if the object exists, since the caller doesn't care whether it is loaded.
			callback.call(thisPtr || this, obj);
		}
		else if (lazyLoad == LazyLoadEnum.Force) {
			// The caller wants the instance force loaded but doesn't want to wait for it to complete.

			// If the instance doesn't exist then ensure that a ghosted instance is created.
			if (!obj) {
				obj = fromExoModel({ type: type.meta.get_fullName(), id: id }, translator, true);
			}

			// Invoke the callback immediately.
			callback.call(thisPtr || this, obj);

			// After the callback has been invoked, force loading to occur.
			LazyLoader.load(obj, property, false);
		}
		else if (lazyLoad == LazyLoadEnum.ForceAndWait) {
			// The caller wants the instance force loaded and will wait for it to complete.

			// If the instance doesn't exist then ensure that a ghosted instance is created.
			if (!obj) {
				obj = fromExoModel({ type: type.meta.get_fullName(), id: id }, translator, true);
			}

			// Force loading to occur, passing through the callback.
			LazyLoader.load(obj, property, false, thisPtr ? callback.bind(thisPtr) : callback);
		}
		else {
			// The caller does not want to force loading, so wait for the instance to come into existance and invoke the callback when it does.

			function invokeCallback() {
				if (filter(obj) !== true)
					return;

				// only invoke the callback once
				propertyFilter = function () { return false; };
				callback.call(thisPtr || this, obj);
			}

			var objSignal = new Signal("wait for object to exist");

			function ensureListLoaded() {
				// If there is a property specified that is a list, then don't invoke the callback until it is loaded.
				if (property) {
					var propertyObj = type.meta.property(property);
					// Only entity lists can be lazy loaded in addition to the parent object.
					if (propertyObj.get_isEntityListType()) {
						if (!obj.meta.isLoaded(property)) {
							// List lazy loader will invoke property change event
							propertyObj.addChanged(objSignal.pending(null, null, true), obj, true);
						}
					}
				}
			}

			function waitForObjectLoaded() {
				// Since the object is not loaded, don't invoke the callback until it is loaded.
				obj.meta.type.addInitExisting(objSignal.pending(function () {
					ensureListLoaded();
				}, null, true), obj, true);
			}

			function waitForObjectExists() {
				// The object doesn't exist, so don't invoke the callback until something causes it to be created.
				model.addObjectRegistered(objSignal.pending(null, null, true), function (newObj) {
					if (newObj.meta.type === type.meta && newObj.meta.id === translateId(translator, type.meta.get_fullName(), id)) {
						obj = newObj;
						if (!obj.meta.isLoaded()) {
							waitForObjectLoaded();
						}
						return true;
					}
				}, true);
			}

			if (!obj) {
				waitForObjectExists();
			} else if (!obj.meta.isLoaded()) {
				waitForObjectLoaded();
			} else {
				ensureListLoaded();
			}

			objSignal.waitForAll(function () {
				callback.call(thisPtr || this, obj);
			}, null, true);
		}
	}

	// #endregion

	// #region ExoWeb.Mapper.TypeLazyLoader
	//////////////////////////////////////////////////

	function TypeLazyLoader() {
	}

	function typeLoad(mtype, propName, inScope, callback, thisPtr) {
		if (!ExoWeb.config.allowTypeLazyLoading) {
			throw new Error("Type lazy loading has been disabled: " + mtype.get_fullName());
		}

		fetchTypes(mtype.model, [mtype.get_fullName()], function(jstype) {
			if (callback && callback instanceof Function) {
				callback(jstype);
			}
		}, thisPtr);
	}

	TypeLazyLoader.mixin({
		load: typeLoad.dontDoubleUp({ callbackArg: 3, thisPtrArg: 4, groupBy: 0 })
	});

	(function() {
		var instance = new TypeLazyLoader();

		TypeLazyLoader.register = function(obj) {
			LazyLoader.register(obj, instance);
		};

		TypeLazyLoader.unregister = function(obj) {
			LazyLoader.unregister(obj, instance);
		};
	})();

	// #endregion

	// #region ExoWeb.Mapper.ObjectLazyLoader
	//////////////////////////////////////////////////

	// <reference path="../core/Config.js" />

	function ObjectLazyLoader() {
		this._requests = {};
		this._typePaths = {};
	}

	var pendingObjects = 0;

	registerActivity("ObjectLazyLoader", function() {
		return pendingObjects > 0;
	});

	function objLoad(obj, propName, inScope, callback, thisPtr) {
		if (!ExoWeb.config.allowObjectLazyLoading) {
			throw new Error($format("Object lazy loading has been disabled: {0}|{1}", obj.meta.type.get_fullName(), obj.meta.id));
		}

		pendingObjects++;

		var signal = new ExoWeb.Signal("object lazy loader");

		var id = obj.meta.id || STATIC_ID;
		var mtype = obj.meta.type || obj.meta;

		// Get the paths from the original query(ies) that apply to this object (based on type).
		var paths = ObjectLazyLoader.getRelativePaths(obj);

		// Add the property to load if specified.  Assumes an instance property.
		if (propName && paths.indexOf(propName) < 0) {
			paths.push(propName);
		}

		// fetch object json
		logWarning($format("Lazy load object: {0}|{1}", mtype.get_fullName(), id));

		// TODO: reference to server will be a singleton, not context
		objectProvider(mtype.get_fullName(), [id], paths, inScope,
			serializeChanges.call(context.server, true),
			function(result) {
				mtype.model.server._handleResult(result, $format("Lazy load: {0}|{1}", mtype.get_fullName(), id), null, function() {
					LazyLoader.unregister(obj, this);
					pendingObjects--;

					// Raise init events if registered.
					for (var t = mtype; t; t = t.baseType) {
						var handler = t._getEventHandler("initExisting");
						if (handler)
							handler(obj, {});
					}

					callback.call(thisPtr || this, obj);
				});
			},
			function(e) {
				pendingObjects--;
				var message = $format("Failed to load {0}|{1}: ", [mtype.get_fullName(), id]);
				if (e !== undefined && e !== null &&
					e.get_message !== undefined && e.get_message !== null &&
					e.get_message instanceof Function) {

					message += e.get_message();
				}
				else {
					message += "unknown error";
				}
				throw new Error(message);
			});

		// does the object's type need to be loaded too?
		if (LazyLoader.isRegistered(mtype)) {
			LazyLoader.load(mtype, null, false, signal.pending());
		}
	}

	ObjectLazyLoader.mixin({
		load: objLoad.dontDoubleUp({ callbackArg: 3, thisPtrArg: 4, groupBy: 0 })
	});

	(function() {
		var instance = new ObjectLazyLoader();

		ObjectLazyLoader.addPaths = function ObjectLazyLoader$addPaths(rootType, paths) {
			var typePaths = instance._typePaths[rootType];
			if (!typePaths) {
				typePaths = instance._typePaths[rootType] = [];
			}
			for (var i = 0; i < paths.length; i++) {
				var path = paths[i];
				if (typePaths.indexOf(path) < 0) {
					typePaths.push(path);
				}
			}
		};

		ObjectLazyLoader.getRelativePaths = function getRelativePaths(obj) {
			return ObjectLazyLoader.getRelativePathsForType(obj.meta.type);
		};

		ObjectLazyLoader.getRelativePathsForType = function getRelativePathsForType(type) {
			var relPaths = [];

			for (var typeName in instance._typePaths) {
				var jstype = Model.getJsType(typeName);

				if (jstype && jstype.meta) {
					var paths = instance._typePaths[typeName];
					for (var i = 0; i < paths.length; i++) {
						var path = paths[i].expression;
						var chain = Model.property(path, jstype.meta);
						// No need to include static paths since if they were 
						// cached then they were loaded previously.
						if (!chain.get_isStatic()) {
							var rootedPath = chain.rootedPath(type);
							if (rootedPath) {
								relPaths.push(rootedPath);
							}
						}
					}
				}
			}

			return relPaths.distinct();
		};

		ObjectLazyLoader.isRegistered = function (obj) {
			return LazyLoader.isRegistered(obj, instance);
		};

		ObjectLazyLoader.register = function(obj) {
			if (!ObjectLazyLoader.isRegistered(obj)) {
				if (obj.meta.type.get_origin() !== "server") {
					throw new Error($format("Cannot lazy load instance of non-server-origin type: {0}|{1}", obj.meta.type.get_fullName(), obj.meta.id));
				}
				LazyLoader.register(obj, instance);
			}
		};

		ObjectLazyLoader.unregister = function(obj) {
			LazyLoader.unregister(obj, instance);
		};
	})();

	// #endregion

	// #region ExoWeb.Mapper.ListLazyLoader
	//////////////////////////////////////////////////

	function ListLazyLoader() {
	}

	function listLoad(list, propName, inScope, callback, thisPtr) {
		var signal = new ExoWeb.Signal("list lazy loader");

		var model = list._ownerProperty.get_containingType().model;
		var ownerId = list._ownerId;
		var containingType = list._ownerProperty.get_containingType();

		// Determine the instance or type that owns the list.
		var owner = ownerId === STATIC_ID ?

			// For static lists the owner is a type.
			containingType.get_jstype() :

			// For non-static lists, retrieve the owner by type and id.
			containingType.get(
				// Fetch the owner using the id specified in the lazy loader metadata.
				ownerId,

				// When loading a list the type of the owner comes from the containing
				// type of the property, so it may not be the exact type of the instance.
				false
			);

		var ownerType = ownerId === STATIC_ID ? owner.meta.get_fullName() : owner.meta.type.get_fullName();
		var prop = list._ownerProperty;
		var propIndex = list._ownerProperty.get_index();
		var propName = list._ownerProperty.get_name();
		var propType = list._ownerProperty.get_jstype().meta;

		if (!ExoWeb.config.allowListLazyLoading) {
			throw new Error($format("List lazy loading has been disabled: {0}|{1}.{2}", ownerType, ownerId, propName));
		}

		// load the objects in the list
		logWarning($format("Lazy load list: {0}|{1}.{2}", ownerType, ownerId, propName));

		var objectJson, conditionsJson;

		// TODO: reference to server will be a singleton, not context
		listProvider(ownerType, ownerId, propName, ownerId === STATIC_ID ? [] : ObjectLazyLoader.getRelativePathsForType(propType),
			serializeChanges.call(context.server, true),
			signal.pending(function(result) {
				objectJson = result.instances;
				conditionsJson = result.conditions;
			}),
			signal.orPending(function(e) {
				var errorMessage;
				if (e !== undefined && e !== null &&
						e.get_message !== undefined && e.get_message !== null &&
						e.get_message instanceof Function) {

					errorMessage = e.get_message();
				}
				else if (e.message) {
					errorMessage = e.message;
				}
				else {
					errorMessage = "unknown error";
				}

				throw new Error($format("Failed to load {0}|{1}.{2}: {3}", ownerType, ownerId, propName, errorMessage));
			})
		);

		// ensure that the property type is loaded as well.
		// if the list has objects that are subtypes, those will be loaded later
		// when the instances are being loaded
		if (LazyLoader.isRegistered(propType)) {
			LazyLoader.load(propType, null, false, signal.pending());
		}

		signal.waitForAll(function() {
			if (!objectJson) {
				return;
			}

			// The actual type name and id as found in the resulting json.
			var jsonId = ownerId;
			var jsonType = ownerType;

			// Find the given type and id in the object json.  The type key may be a dervied type.
			function searchJson(mtype, id) {
				// The given type is a key that is present in the result json.
				if (objectJson[mtype.get_fullName()]) {

					// The id is also a key.
					if (objectJson[mtype.get_fullName()][id]) {
						jsonType = mtype.get_fullName();
						jsonId = id;
						return true;
					}

					// Ids returned from the server are not always in the same case as ids on the client, so check one-by-one.
					for (var varId in objectJson[mtype.get_fullName()]) {
						if (varId.toLowerCase() == id.toLowerCase()) {
							jsonType = mtype.get_fullName();
							jsonId = varId;
							return true;
						}
					}
				}

				// Check derived types recursively.
				for (var i = 0; i < mtype.derivedTypes.length; i++) {
					if (searchJson(mtype.derivedTypes[i], id)) {
						return true;
					}
				}
			}

			if (!searchJson(ExoWeb.Model.Model.getJsType(ownerType).meta, ownerId)) {
				throw new Error($format("Data could not be found for {0}:{1}.", ownerType, ownerId));
			}

			var listJson = prop.get_isStatic() ?
				objectJson[jsonType][jsonId][propName] :
				objectJson[jsonType][jsonId][propIndex];

			if (!(listJson instanceof Array)) {
				throw new Error($format("Attempting to load list {0} of instance {1}:{2}, but the response JSON is not an array: {3}.", propName, ownerType, ownerId, listJson));
			}

			var populateList = false;
			//var newItems = [];

			if (LazyLoader.isRegistered(list)) {
				// If the lazy loader is no longer registered,
				// then don't populate the list.
				populateList = true;
				ListLazyLoader.unregister(list, this);
			}

			// populate the list with objects
			for (var i = 0; i < listJson.length; i++) {
				var ref = listJson[i];
				var item = getObject(model, propType, (ref && ref.id || ref), (ref && ref.type || propType));

				//newItems.push(item);

				if (populateList) {
					if (list.contains(item)) {
						logWarning($format("Lazy loading list {0}|{1}.{2} already contains object {3}.", ownerType, ownerId, propName, Entity.toIdString(item)));
					}
					list.push(item);
				}

				// if the list item is already loaded ensure its data is not in the response
				// so that it won't be reloaded
				if (LazyLoader.isLoaded(item)) {
					delete objectJson[jsonType][ref.id];
				}
			}

			// remove list from json and process the json.  there may be
			// instance data returned for the objects in the list
			if (LazyLoader.isLoaded(owner)) {
				delete objectJson[jsonType][jsonId];
			}

			ListLazyLoader.unregister(list, this);

			var batch = ExoWeb.Batch.start($format("{0}|{1}.{2}", [ownerType, ownerId, propName]));

			var done = function() {
				// Collection change driven by user action or other behavior would result in the "change" event
				//	being raised for the list property.  Since we don't want to record this as a true observable
				//	change, raise the event manually so that rules will still run as needed.
				// This occurs before batch end so that it functions like normal object loading.
				//if (ownerId !== STATIC_ID) {
				prop._raiseEvent("changed", [owner, { property: prop, newValue: list, oldValue: undefined, collectionChanged: true }]);
				//}

				// Example of explicitly raising the collection change event if needed.
				// NOTE: This is probably not necessary because it is difficult to get a reference to a
				// non-loaded list and so nothing would be watching for changes prior to loading completion.
				// The _initializing flag would be necessary to signal to the property's collection change
				// handler that it should not raise the various events in response to the collection change.
				//list._initializing = true;
				//Sys.Observer.raiseCollectionChanged(list, [new Sys.CollectionChange(Sys.NotifyCollectionChangedAction.add, newItems, 0)]);
				//delete list._initializing;

				ExoWeb.Batch.end(batch);
				callback.call(thisPtr || this, list);
			};

			objectsFromJson(model, objectJson, function() {
				if (conditionsJson) {
					conditionsFromJson(model, conditionsJson, list.slice(0), done);
				}
				else {
					done();
				}
			});
		});
	}

	ListLazyLoader.mixin({
		load: listLoad.dontDoubleUp({ callbackArg: 3, thisPtrArg: 4, groupBy: 0 })
	});

	(function() {
		var instance = new ListLazyLoader();

		var modifiableLists = [];

		function lazyListModified(sender, args) {
			// Check that modifications have not been allowed.
			if (modifiableLists.indexOf(sender) < 0) {
				// Check that at least one change involves adding or removing a non-new instance.
				if (args.get_changes().mapToArray(function(c) { return c.newItems || []; }).concat(args.get_changes().mapToArray(function(c) { return c.oldItems || []; })).some(function(i) { return !i.meta.isNew; })) {
					throw new Error($format("{0} list {1}.{2} was modified but it has not been loaded.",
						this._isStatic ? "Static" : "Non-static",
						this._isStatic ? this._containingType.get_fullName() : "this<" + this._containingType.get_fullName() + ">",
						this._name
					));
				}
			}
		}

		ListLazyLoader.register = function(obj, prop) {
			var list = [];

			// Throw an error if a non-loaded list is modified
			var collectionChangeHandler = lazyListModified.bind(prop);
			list._collectionChangeHandler = collectionChangeHandler;
			Observer.addCollectionChanged(list, collectionChangeHandler);

			list._ownerId = prop.get_isStatic() ? STATIC_ID : obj.meta.id;
			list._ownerProperty = prop;

			LazyLoader.register(list, instance);

			return list;
		};

		ListLazyLoader.unregister = function(list) {
			Observer.removeCollectionChanged(list, list._collectionChangeHandler);
			LazyLoader.unregister(list, instance);

			delete list._ownerId;
			delete list._ownerProperty;
			delete list._collectionChangeHandler;
		};

		ListLazyLoader.allowModification = function(list, callback, thisPtr) {
			modifiableLists.push(list);
			callback.call(thisPtr || this);
			modifiableLists.remove(list);
		};
	})();

	// #endregion

	// #region ExoWeb.Mapper.Context
	//////////////////////////////////////////////////

	// Signal to keep track of any ongoing context initialization
	var allSignals = new ExoWeb.Signal("Context : allSignals");

	ExoWeb.registerActivity("Context: allSignals", function() {
		return allSignals.isActive();
	});

	function Context() {
		window.context = this;

		this.model = { meta: new ExoWeb.Model.Model() };
		this.server = new ServerSync(this.model.meta);
	}

	Context.mixin(ExoWeb.Functor.eventing);

	var numberOfPendingQueries;

	Context.mixin({
		addReady: function Context$addReady(callback, thisPtr) {
			var queriesAreComplete = numberOfPendingQueries === 0;

			this._addEvent("ready", thisPtr ? callback.bind(thisPtr) : callback, null, true);

			// Simulate the event being raised immediately if a query or queries have already completed
			if (queriesAreComplete) {
				// Subscribers will not actually be called until signals have subsided
				allSignals.waitForAll(function() {
					this._raiseEvent("ready");
				}, this);
			}
		},
		isPending: function () {
			return numberOfPendingQueries > 0;
		},
		beginContextReady: ExoWeb.Functor(),
		endContextReady: ExoWeb.Functor()
	});

	function ensureContext() {
		if (!window.context) {
			window.context = new Context();
		}

		if (!(window.context instanceof Context)) {
			throw new Error("The window object has a context property that is not a valid context.");
		}
	}

	Context.ready = function Context$ready(context) {
		numberOfPendingQueries--;

		var queriesAreComplete = numberOfPendingQueries === 0;

		if (queriesAreComplete) {
			// Indicate that one or more model queries are ready for consumption
			allSignals.waitForAll(function() {
				context._raiseEvent("ready");
			});
		}
	};

	Context.query = function Context$query(context, options) {
		var queriesHaveBegunOrCompleted = numberOfPendingQueries !== undefined;
		if (!queriesHaveBegunOrCompleted) {
			numberOfPendingQueries = 0;
		}
		numberOfPendingQueries++;

		// Execute the query and fire the ready event when complete
		(new ContextQuery(context, options)).execute(function() {
			Context.ready(context);
		});
	}

	// #endregion

	// #region ExoWeb.Mapper.ContextQuery
	//////////////////////////////////////////////////

	function ContextQuery(context, options) {
		this.context = context;
		this.options = options;
		this.batch = null;
		this.state = {};
	}

	ContextQuery.mixin({
		execute: ExoWeb.FunctionChain.prepare(

		// Starts a batch so that others will not respond to changes that are
		// broadcast during querying, i.e. instance loading.
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$setup(callback, thisPtr) {
				// start a batch to represent all of the pending work
				this.batch = ExoWeb.Batch.start("context query");

				// store init changes as early as possible
				if (this.options.changes)
					ServerSync$storeInitChanges.call(this.context.server, this.options.changes);

				// If the allSignals signal is not active, then set up a fake pending callback in
				// order to ensure that the context is not "loaded" prior to models being initilized.
				if (!allSignals.isActive()) {
					this._predictiveModelPending = allSignals.pending(null, this, true);
				}

				// Setup lazy loading on the context object to control lazy evaluation.
				// Loading is considered complete at the same point model.ready() fires. 
				LazyLoader.register(this.context, {
					load: function context$load(obj, propName, inScope, callback, thisPtr) {
						// objects are already loading so just queue up the calls
						allSignals.waitForAll(function context$load$callback() {
							LazyLoader.unregister(obj, this);

							if (callback && callback instanceof Function) {
								callback.call(thisPtr || this);
							}
						}, this, true);
					}
				});

				callback.call(thisPtr || this);
			},

		// Perform pre-processing of model queries and their paths.
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$initModels(callback, thisPtr) {
				if (this.options.model) {
					// Start capturing changes prior to processing any model query
					this.context.server.beginCapturingChanges();
					ExoWeb.eachProp(this.options.model, function (varName, query) {
						// Assert that the necessary properties are provided
						if (!query.hasOwnProperty("from") || (!query.hasOwnProperty("id") && !query.hasOwnProperty("ids")))
							throw new Error("The model query \"" + varName + "\" requires a from and id or ids clause.");
						if (query.hasOwnProperty("id") && query.hasOwnProperty("ids"))
							throw new Error("The model query \"" + varName + "\" must specify either id or ids, not both.");

						// common initial setup of state for all model queries
						this.state[varName] = { signal: new ExoWeb.Signal("createContext." + varName), isArray: false };

						if (this._predictiveModelPending) {
							delete this._predictiveModelPending;
						}
						else {
							allSignals.pending(null, this, true);
						}

						// normalize id(s) property and determine whether the result should be an array
						if (query.hasOwnProperty("ids") && !(query.ids instanceof Array)) {
							query.ids = [query.ids];
						}
						else if (query.hasOwnProperty("id") && !(query.id instanceof Array)) {
							query.ids = [query.id];
							delete query.id;
						}
						else {
							// we know that either id or ids is specified, so if neither
							// one is NOT an array, then the query must be an array
							this.state[varName].isArray = true;

							// pre-initialize array queries
							var arr = [];
							Observer.makeObservable(arr);
							this.context.model[varName] = arr;
						}

						// get rid of junk (null/undefined/empty) ids
						query.ids = filter(query.ids, not(isNullOrEmpty));

						// remove new ids for later processing
						query.newIds = purge(query.ids, equals($newId()));

						// Store the paths for later use in lazy loading
						query.normalized = ExoWeb.Model.PathTokens.normalizePaths(query.include);
						ObjectLazyLoader.addPaths(query.from, query.normalized);

						// use temporary config setting to enable/disable scope-of-work functionality
						if (query.inScope !== false) {
							if (query.ids.length > 0) {
								this.state[varName].scopeQuery = {
									from: query.from,
									ids: query.ids,
									// TODO: this will be subset of paths interpreted as scope-of-work
									include: query.include ? query.include : [],
									inScope: true,
									forLoad: false
								};
							}
						}
					}, this);
				}

				// Undo predictive pending "callback" set up before models were processed.
				if (this._predictiveModelPending) {
					delete this._predictiveModelPending;
					allSignals.oneDone();
				}

				callback.call(thisPtr || this);
			},

		// Only fetch the types if they are not embedded. If the types are
		// embedded then fetching the types from server will cause a signal to
		// be created that will never be processed.
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$fetchTypes(callback, thisPtr) {
				var typesToLoad = [], model = this.context.model.meta, instances = this.options.instances, signal = new ExoWeb.Signal("ContextQuery$fetchTypes");

				// Include types for all instances in instance payload
				if (instances && (!this.options.types || this.options.types instanceof Array)) {
					eachProp(this.options.instances, function(t) {
						// Add the type of the instances.
						var mtype = model.type(t);
						if (!mtype || LazyLoader.isRegistered(mtype)) {
							typesToLoad.push(t);
						}
					}, this);
				}

				// Load all types specified in types portion of query
				if (this.options.types && this.options.types instanceof Array) {
					this.options.types
						.map(function(t) {
							return t.from || t;
						}).filter(function(t) {
							// Exclude types that are already loaded
							var mtype = model.type(t);
							return !mtype || LazyLoader.isRegistered(mtype);
						}).forEach(function(t) {
							if (!typesToLoad.contains(t)) {
								typesToLoad.push(t);
							}
						});
				}

				// Fetch types in a single batch request
				if (typesToLoad.length > 0) {
					fetchTypes(model, typesToLoad, signal.pending(), this);
				}

				// Fetch additional types based on model queries and paths
				if (this.options.model && (!this.options.types || this.options.types instanceof Array)) {
					ExoWeb.eachProp(this.options.model, function (varName, query) {
						fetchQueryTypes(this.context.model.meta, query.from, query.normalized, signal.pending());
					}, this);
				}

				signal.waitForAll(callback, thisPtr);
			},

		// Process embedded data as if it had been recieved from the server in
		// the form of a web service response. This should enable flicker-free
		// page loads by embedded data, changes, etc.
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$processEmbedded(callback, thisPtr) {
				if (this.options.instances || this.options.conditions || (this.options.types && !(this.options.types instanceof Array))) {
					var handler = new ResponseHandler(this.context.model.meta, this.context.server, {
						instances: this.options.instances,
						conditions: this.options.conditions,
						types: this.options.types && this.options.types instanceof Array ? null : this.options.types,
						serverInfo: this.options.serverInfo
					});

					handler.execute(function () {
						// Update 'isNew' for objects that show up in InitNew changes.
						if (this.options.changes) {
							this.options.changes.forEach(function (change) {
								if (change.type === "InitNew") {
									tryGetJsType(this.context.server.model, change.instance.type, null, false, function (jstype) {

										// Attempt to find the InitNew instance if it was present in the instances JSON.
										var obj = jstype.meta.get(
											// Ok to fetch the instance by the server-generated id?
											change.instance.id,
										
											// When processing embedded changes we can expect that the type of the instance
											// is exactly the type specified in the change object, not a base type.
											true
										);

										// If it exists, then it would have been created as an existing object, so mark it as new.
										if (obj) {
											obj.meta.isNew = true;
										}

									}, this);
								}
							}, this);
						}

						callback.call(thisPtr || this);
					}, this);
				}
				else {
					callback.call(thisPtr || this);
				}
			},

		// Detect batch query candidates and send batch request, if batching is
		// enabled (true by default).
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$doBatchRequest(callback, thisPtr) {
				if (this.options.model && ExoWeb.config.individualQueryLoading !== true) {
					var pendingQueries = [];
					var batchQuerySignal;

					ExoWeb.eachProp(this.options.model, function (varName, query) {
						if (!query.load && query.ids.length > 0) {
							var jstype = ExoWeb.Model.Model.getJsType(query.from, true);

							// get a list of ids that should be batch-requested
							var batchIds = filter(query.ids, function (id, index) {
								// if the type doesn't exist, include the id in the batch query
								if (!jstype) return true;

								// Check to see if the object already exists, i.e. because of embedding.
								var obj = jstype.meta.get(
									// Translate the specified ID, which may be a server-generated new id,
									// into the appropriate client-generated id.
									translateId(this.context.server._translator, query.from, id),

									// The type specified in a query may be a sub-class of the actual type,
									// since it may be written by hand and not known ahead of time.
									false
								);

								// If it doesn't exist, include the id in the batch query.
								if (obj === undefined) {
									return true;
								}

								// otherwise, include it in the model
								if (this.state[varName].isArray) {
									this.context.model[varName][index] = obj;
								}
								else {
									this.context.model[varName] = obj;
								}
							}, this);

							if (batchIds.length > 0) {
								if (batchQuerySignal === undefined) {
									batchQuerySignal = new ExoWeb.Signal("batch query");
									batchQuerySignal.pending(null, this, true);
								}

								// complete the individual query signal after the batch is complete
								batchQuerySignal.waitForAll(this.state[varName].signal.pending(null, this, true), this, true);

								pendingQueries.push({
									from: query.from,
									ids: batchIds,
									include: query.include || [],
									inScope: true,
									forLoad: true
								});
							}
						}
					}, this);

					if (pendingQueries.length > 0) {
						// perform batch query
						queryProvider(pendingQueries, null,
							function context$objects$callback(result) {
								objectsFromJson(this.context.model.meta, result.instances, function () {
									if (result.conditions) {
										conditionsFromJson(this.context.model.meta, result.conditions, null, function () {
											batchQuerySignal.oneDone();
										});
									}
									else {
										batchQuerySignal.oneDone();
									}
								}, this);
							},
							function context$objects$callback(error) {
								throw new Error($format("Failed to load batch query (HTTP: {0}, Timeout: {1})", error._statusCode, error._timedOut));
							}, this);
					}
				}

				callback.call(thisPtr || this);
			},

		// Send individual requests and simulate for "load" option.
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$doIndividualRequests(callback, thisPtr) {
				if (this.options.model) {
					// 2) Start loading instances individually
					ExoWeb.eachProp(this.options.model, function (varName, query) {
						if (query.load) {
							// bypass all server callbacks if data is embedded
							this.state[varName].objectJson = query.load.instances;
							this.state[varName].conditionsJson = query.load.conditions;
						}
						// need to load data from server
						// fetch object state if an id of a persisted object was specified
						else if (ExoWeb.config.individualQueryLoading === true) {
							tryGetJsType(this.context.model.meta, query.from, null, true, function (type) {
								// TODO: eliminate duplication!!!
								// get the list of ids that should be individually loaded
								var individualIds = filter(query.ids, function (id, index) {

									// Check to see if the object already exists, i.e. because of embedding.
									var obj = type.meta.get(
										// Translate the specified ID, which may be a server-generated new id,
										// into the appropriate client-generated id.
										translateId(this.context.server._translator, query.from, id),
									
										// The type specified in a query may be a sub-class of the actual type,
										// since it may be written by hand and not known ahead of time.
										false
									);

									// If it doesn't exist, include the id in the batch query.
									if (obj === undefined) {
										return true;
									}

									// otherwise, include it in the model
									if (this.state[varName].isArray) {
										this.context.model[varName][index] = obj;
									}
									else {
										this.context.model[varName] = obj;
									}
								}, this);

								if (individualIds.length > 0) {
									// for individual queries, include scope queries for all *BUT* the query we are sending
									var scopeQueries = [];
									var currentVarName = varName;
									ExoWeb.eachProp(this.options.model, function (varName, query) {
										if (varName !== currentVarName && this.state[varName].scopeQuery) {
											scopeQueries.push(this.state[varName].scopeQuery);
										}
									}, this);

									objectProvider(query.from, individualIds, query.include || [], true, null, scopeQueries,
										this.state[varName].signal.pending(function context$objects$callback(result) {
											this.state[varName].objectJson = result.instances;
											this.state[varName].conditionsJson = result.conditions;
										}, this, true),
										this.state[varName].signal.orPending(function context$objects$callback(error) {
											throw new Error($format("Failed to load {0}|{1} (HTTP: {3}, Timeout: {4})",
												query.from, query.ids, error._statusCode, error._timedOut));
										}, this, true), this);
								}
							}, this);
						}
					}, this);
				}

				callback.call(thisPtr || this);
			},

		// Load static paths for queries that don't otherwise require loading.
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$doStaticRequests(callback, thisPtr) {
				if (this.options.model) {
					ExoWeb.eachProp(this.options.model, function (varName, query) {
						if (!query.load && query.ids.length === 0) {
							// Remove instance paths when an id is not specified
							var staticPaths = query.include ? query.include.filter(function (p) { return !p.startsWith("this.") && !p.startsWith("this{"); }) : null;

							// Only call the server if paths were specified
							if (staticPaths && staticPaths.length > 0) {
								objectProvider(null, null, staticPaths, false, null,
									allSignals.pending(function context$objects$callback(result) {
										// load the json. this may happen asynchronously to increment the signal just in case
										objectsFromJson(this.context.model.meta, result.instances, allSignals.pending(function () {
											if (result.conditions) {
												conditionsFromJson(this.context.model.meta, result.conditions, null, allSignals.pending());
											}
										}), this);
									}, this, true),
									allSignals.orPending(function context$objects$callback(error) {
										throw new Error($format("Failed to load {0}|{1} (HTTP: {2}, Timeout: {3})",
											query.from, query.ids, error._statusCode, error._timedOut));
									}, this, true)
								);
							}
						}
					}, this);
				}

				callback.call(thisPtr || this);
			},

		// Process instances data for queries as they finish loading.
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$processResults(callback, thisPtr) {
				if (this.options.model) {
					ExoWeb.eachProp(this.options.model, function (varName, query) {
						this.state[varName].signal.waitForAll(function context$model() {
							// make sure everything isn't considered complete until new objects are also created
							if (query.newIds) allSignals.pending();

							// check to see if the root(s) have already been established
							if ((!this.state[varName].isArray && this.context.model[varName]) ||
								(this.state[varName].isArray && !query.ids.some(function (id, index) { return !this.context.model[varName][index]; }))) {

								allSignals.oneDone();
								return;
							}
							// otherwise, loading is required to establish roots if there are any server ids
							else if (query.ids.length > 0) {
								var processResponse = new Signal("processing response");

								if (this.state[varName].objectJson) {
									// load the json. this may happen asynchronously so increment the signal just in case
									objectsFromJson(this.context.model.meta, this.state[varName].objectJson, processResponse.pending(null, this), this, true);

									// indicate that instance data is already being loaded
									delete this.state[varName].objectJson;
								}

								processResponse.waitForAll(this.state[varName].signal.pending(function context$model$callback() {
									var mtype = this.context.model.meta.type(query.from);

									if (!mtype) {
										throw new Error($format("Could not get type {0} required to process query results.", query.from));
									}

									// establish roots for each id
									forEach(query.ids, function (id, index) {
										// TODO: resolve translator access
										var clientId = translateId(this.context.server._translator, query.from, id);

										// Retrieve the existing instance by id.
										var obj = mtype.get(
											// Translate the specified ID, which may be a server-generated new id,
											// into the appropriate client-generated id.
											clientId,

											// The type specified in a query may be a sub-class of the actual type,
											// since it may be written by hand and not known ahead of time.
											false
										);

										// If it doesn't exist, raise an error.
										if (obj == null) {
											throw new Error("Could not get " + query.from + " with id = " + clientId + (id !== clientId ? "(" + id + ")" : "") + ".");
										}

										// Otherwise, include it in the model.
										if (!this.state[varName].isArray && !this.context.model[varName]) {
											this.context.model[varName] = obj;
										}
										else if (this.state[varName].isArray && !this.context.model[varName][index]) {
											this.context.model[varName][index] = obj;
										}
									}, this);

									if (this.state[varName].conditionsJson) {
										conditionsFromJson(this.context.model.meta, this.state[varName].conditionsJson, null, function () {
											// model object has been successfully loaded!
											allSignals.oneDone();
										}, this);
									}
									else {
										// model object has been successfully loaded!
										allSignals.oneDone();
									}
								}, this), this);
							}
							else {
								// model object has been successfully loaded!
								allSignals.oneDone();
							}

							if (this.state[varName].objectJson) {
								// ensure that instance data is loaded (even if not needed to establish roots) just in case
								// root object was satisfied because it happened to be a part of the model of another root object
								objectsFromJson(this.context.model.meta, this.state[varName].objectJson, allSignals.pending());
							}

							// construct a new object(s) if a new id(s) was specified
							if (query.newIds) {
								// if json must be processed, signal will have been incremented again
								this.state[varName].signal.waitForAll(function () {
									if (this.state[varName].isArray) {
										foreach(query.newIds, function (index) {
											this.context.model[varName][index] = new (this.context.model.meta.type(query.from).get_jstype())();
										}, this);
									}
									else {
										this.context.model[varName] = new (this.context.model.meta.type(query.from).get_jstype())();
									}
								}, this);

								// model object has been successfully loaded!
								allSignals.oneDone();
							}
						}, this);
					}, this, true);
				}

				callback.call(thisPtr || this);
			},

		// Perform pre-processing of model queries and their paths.
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$postQueries(callback, thisPtr) {
				if (this.options.model) {
					ExoWeb.eachProp(this.options.model, function (varName, query) {
						if (this.state[varName].scopeQuery) {
							ServerSync$addScopeQuery.call(this.context.server, this.state[varName].scopeQuery);
						}
					}, this);
				}

				callback.call(thisPtr || this);
			},

		// Final cleanup step. Allow rules to run initially, end the batch,
		// and allow the server sync to start capturing existing objects in
		// order to attach a lazy loader.
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$cleanup(callback, thisPtr) {
				allSignals.waitForAll(function () {
					// allows previously defered rules to run
					this.context.model.meta.notifyBeforeContextReady();

					ExoWeb.Batch.end(this.batch);
				}, this, true);

				callback.call(thisPtr || this);
			}
		)
	});

	// #endregion

	// #region ExoWeb.Mapper.ExoWeb
	//////////////////////////////////////////////////

	// Don't activate the DOM automatically, instead delay until after context initialization
	Sys.activateDom = false;

	// Object constant to signal to mapper to create a new instance rather than load one
	var $newId = function $newId() {
		return "$newId";
	};

	window.$newId = $newId;

	// Indicates whether or not the DOM has been activated
	var activated = false;

	var serverInfo;

	var pendingTypeQueries = [];

	// Callback(s) to execute as soon as a context query begins.
	var initFns = new ExoWeb.Functor();

	// Signal to gate context completion via extendContext options.
	var globalReadySignal = new Signal();

	var extendContextFn = null;

	var contextReadyFns = new ExoWeb.Functor();

	var domReadyFns = new ExoWeb.Functor();

	function modelReadyHandler() {
		if (extendContextFn) {
			extendContextFn(window.context, globalReadySignal.pending());
			extendContextFn = null;
		}

		globalReadySignal.waitForAll(function () {
			if (!contextReadyFns.isEmpty()) {
				window.context.beginContextReady();
				contextReadyFns(window.context);
				window.context.endContextReady();
			}

			jQuery(function () {
				// Activate the document if this is the first context to load
				if (!activated && ExoWeb.config.autoActivation) {
					activated = true;
					Sys.Application.activateElement(document.documentElement);
				}

				// Invoke dom ready notifications
				if (!domReadyFns.isEmpty()) {
					if (ExoWeb.config.debug) {
						domReadyFns(window.context);
					} else {
						try {
							domReadyFns(window.context);
						} catch (e) {
							ExoWeb.logError(e, true);
						}
					}
				}
			});
		});
	}

	// Global method for initializing ExoWeb on a page

	function $exoweb(options) {

		// Support initialization function argument
		if (options instanceof Function) {
			options = { init: options };
		}

		if (options.init) {
			// Register the init function ONCE.
			initFns.add(options.init, null, true);
			delete options.init;
		}

		if (options.extendContext) {
			// Merge the extendContext function so that the callback argument is invoked after ALL have invoked the callback.
			extendContextFn = mergeFunctions(extendContextFn, options.extendContext, { async: true, callbackIndex: 1 });
			delete options.extendContext;
		}

		if (options.contextReady) {
			// Register the contextReady function ONCE.
			contextReadyFns.add(options.contextReady, null, true);
			delete options.contextReady;
		}

		if (options.domReady) {
			// Register the domReady function ONCE.
			domReadyFns.add(options.domReady, null, true);
			delete options.domReady;
		}

		// The server info object will be maintained here and constantly set each time a
		// context query is created. It shouldn't be publicly set for any other reason.
		if (options.serverInfo) {
			// Merge any additional serverInfo options.
			serverInfo = jQuery.extend(serverInfo, options.serverInfo);
			delete options.serverInfo;
		}

		if (options.types && options.types instanceof Array) {
			// Store type queries for later use, since only embedded data or a model query triggers immediate querying.
			pendingTypeQueries = pendingTypeQueries.concat(options.types);
			delete options.types;
		}

		// A model query or embedded data will trigger a context query immediately.
		var triggerQuery = false;
		var queryObject = {};

		if (options.model) {
			triggerQuery = true;
			queryObject.model = options.model;
			delete options.model;
		}

		if (options.types) {
			triggerQuery = true;
			queryObject.types = options.types;
			delete options.types;
		}

		if (options.instances) {
			triggerQuery = true;
			queryObject.instances = options.instances;
			delete options.instances;
		}

		if (options.conditions) {
			triggerQuery = true;
			queryObject.conditions = options.conditions;
			delete options.conditions;
		}

		if (options.changes) {
			triggerQuery = true;
			queryObject.changes = options.changes;
			delete options.changes;
		}

		if (triggerQuery) {

			// Ensure that a context is created if it hasn't been already.
			ensureContext();

			// Perform initialization immediately
			initFns(window.context);

			// Include server info if present.
			if (serverInfo) {
				// The server info object will be maintained here and constantly set each time a
				// context query is created. It shouldn't be publicly set for any other reason.
				queryObject.serverInfo = serverInfo;
			}

			// Send pending type queries with the query if types were not embedded.
			if (pendingTypeQueries.length > 0 && !queryObject.types) {
				queryObject.types = pendingTypeQueries;
				pendingTypeQueries = [];
			}

			// Start the new query
			Context.query(window.context, queryObject);

			if (pendingTypeQueries.length > 0) {
				// Send a seperate query for type queries if they couldn't be send with the primary query.
				Context.query(window.context, { types: pendingTypeQueries });
				pendingTypeQueries = [];
			}

			// Perform context initialization when the model is ready
			window.context.addReady(modelReadyHandler);

		} else if (window.context) {

			// Ensure that the context variable has not been used for some other purpose.
			if (!(window.context instanceof Context)) {
				throw new Error("The window object has a context property that is not a valid context.");
			}

			// Context has already been created, so perform initialization immediately
			initFns(window.context);

			// If the context has already completed, then fire the ready handler. It is safe to fire more than once.
			if (!window.context.isPending()) {
				allSignals.waitForAll(modelReadyHandler);
			}
		}

	}

	window.$exoweb = $exoweb;

	// #endregion

	// #region ExoWeb.Mapper.Extend
	//////////////////////////////////////////////////

	var pendingTypeExtensions = {};
	var pendingSubtypeExtensions = {};

	function raiseExtensions(mtype) {
		//ExoWeb.Batch.whenDone(function() { 
			// apply app-specific configuration
			// defer until loading is completed to reduce init events
			var exts = pendingTypeExtensions[mtype.get_fullName()];
			if (exts) {
				delete pendingTypeExtensions[mtype.get_fullName()];
				exts(mtype.get_jstype());
			}

			mtype.eachBaseType(function(baseType) {
				var subExts = pendingSubtypeExtensions[baseType.get_fullName()];
				if (subExts) {
					// don't delete subtype extensions since more subtypes may be created
					subExts(mtype.get_jstype());
				}
			});
		//});
	}

	function extendOne(typeName, callback, thisPtr) {
		var jstype = ExoWeb.Model.Model.getJsType(typeName, true);

		if (jstype && LazyLoader.isLoaded(jstype.meta)) {
			callback.call(thisPtr || this, jstype);
		}
		else {
			var pending = pendingTypeExtensions[typeName];

			if (!pending) {
				pending = pendingTypeExtensions[typeName] = ExoWeb.Functor();
			}

			pending.add(thisPtr ? callback.bind(thisPtr) : callback);
		}
	}

	window.$extend = function(typeInfo, callback, thisPtr) {
		if (typeInfo == null) throw new ArgumentNullError("typeInfo");

		// If typeInfo is an arry of type names, then use a signal to wait until all types are loaded.
		if (Object.prototype.toString.call(typeInfo) === "[object Array]") {
			var signal = new ExoWeb.Signal("extend");

			var types = [];
			typeInfo.forEach(function(item, index) {
				if (item.constructor !== String) {
					throw new ArgumentTypeError("typeInfo", "string", item);
				}

				extendOne(item, signal.pending(function(type) {
					types[index] = type;
				}), thisPtr);
			});

			signal.waitForAll(function() {
				// When all types are available, call the original callback.
				callback.apply(thisPtr || this, types);
			});
		}
		// Avoid the overhead of signal and just call extendOne directly.
		else if (typeInfo.constructor === String) {
			extendOne(typeInfo, callback, thisPtr);
		}
		else {
			throw new ArgumentTypeError("typeInfo", "string|array", typeInfo);
		}
	};

	window.$extendSubtypes = function(typeName, callback, thisPtr) {
		if (typeName == null) throw new ArgumentNullError("typeName");
		if (typeName.constructor !== String) throw new ArgumentTypeError("typeName", "string", typeName);

		var jstype = ExoWeb.Model.Model.getJsType(typeName, true);

		if (jstype) {
			// Call for existing, loaded subtypes
			Array.forEach(jstype.meta.derivedTypes || [], function(mtype) {
				if (mtype && LazyLoader.isLoaded(mtype)) {
					callback.call(thisPtr || this, mtype.get_jstype());
					Array.forEach(mtype.derivedTypes || [], arguments.callee.spliceArguments(1, 2));
				}
			});
		}
	
		var pending = pendingSubtypeExtensions[typeName];

		if (!pending) {
			pending = pendingSubtypeExtensions[typeName] = ExoWeb.Functor();
		}

		pending.add(thisPtr ? callback.bind(thisPtr) : callback);
	};

	window.$extendProperties = function (typeName, includeBuiltIn, callback, thisPtr) {
		if (typeName == null) throw new ArgumentNullError("typeName");
		if (typeName.constructor !== String) throw new ArgumentTypeError("typeName", "string", typeName);

		if (includeBuiltIn && includeBuiltIn instanceof Function) {
			thisPtr = callback;
			callback = includeBuiltIn;
			includeBuiltIn = false;
		}

		extendOne(typeName, function (jstype) {
			// Raise handler for existing properties
			jstype.meta.get_properties().forEach(function (prop) {
				if (includeBuiltIn === true || prop.get_origin() !== "server")
					callback.call(thisPtr || this, prop, true);
			});

			// Raise handler when new properties are added
			jstype.meta.addPropertyAdded(function (sender, args) {
				callback.call(thisPtr || this, args.property, false);
			});
		});
	}

	// #endregion

	// #region ExoWeb.UI.Toggle
	//////////////////////////////////////////////////

	function Toggle(element) {

		// Default action is show
		this._action = "show";

		Toggle.initializeBase(this, [element]);
	}

	var Toggle_allowedActions = ["show", "hide", "enable", "disable", "render", "dispose", "addClass", "removeClass"];

	// Actions
	Toggle.mixin({
		// Show/Hide
		//////////////////////////////////////////////////////////
		link_show: function Toggle$link_show() {
			if ((this._action === "show" && jQuery(this._element).is(".toggle-on")) || (this._action === "hide" && jQuery(this._element).is(".toggle-off"))) {
				this.set_state("on");
			}
			else {
				this.set_state("off");
			}
		},
		add_showing: function (handler) {
			/// <summary locid="E:J#Sys.UI.DataView.showing" />
			this._addHandler("showing", handler);
		},
		remove_showing: function (handler) {
			this._removeHandler("showing", handler);
		},
		add_hiding: function (handler) {
			/// <summary locid="E:J#Sys.UI.DataView.hiding" />
			this._addHandler("hiding", handler);
		},
		remove_hiding: function (handler) {
			this._removeHandler("hiding", handler);
		},
		do_show: function Toggle$do_show() {
		
			// visibility has changed so raise event
			if (this._visible === undefined || this._visible === false) {
				var showingArgs = new ActionEventArgs();

				this._pendingEventArgs = showingArgs;

				if (this._visible === false) {
					Sys.Observer.raiseEvent(this, "showing", showingArgs);
				}

				showingArgs.waitForAll(function () {
					this._pendingEventArgs = null;

					if (this._effect == "slide" && this._visible === false)
						jQuery(this._element).slideDown();
					else if (this._effect == "fade" && this._visible === false)
						jQuery(this._element).fadeIn();
					else
						jQuery(this._element).show();

					this.set_state("on");

					// visibility has changed so raise event
					Sys.Observer.raiseEvent(this, "shown");

					this._visible = true;

					this._pendingActions();
				}, this, true);
			}
		},
		do_hide: function Toggle$do_hide() {

			// visibility has changed so raise event
			if (this._visible === undefined || this._visible === true) {
				var hidingArgs = new ActionEventArgs();

				this._pendingEventArgs = hidingArgs;

				if (this._visible === true) {
					Sys.Observer.raiseEvent(this, "hiding", hidingArgs);
				}

				hidingArgs.waitForAll(function () {
					this._pendingEventArgs = null;

					if (this._effect == "slide" && this._visible === true)
						jQuery(this._element).slideUp();
					else if (this._effect == "fade" && this._visible === true)
						jQuery(this._element).fadeOut();
					else
						jQuery(this._element).hide();

					this.set_state("off");

					// visibility has changed so raise event
					Sys.Observer.raiseEvent(this, "hidden");

					this._visible = false;

					this._pendingActions();
				}, this, true);
			}
		},
		add_on: function Toggle$add_on(handler) {
			this._addHandler("on", handler);
		},
		remove_on: function Toggle$remove_on(handler) {
			this._removeHandler("on", handler);
		},
		add_off: function Toggle$add_off(handler) {
			this._addHandler("off", handler);
		},
		remove_off: function Toggle$remove_off(handler) {
			this._removeHandler("off", handler);
		},
		add_shown: function Toggle$add_shown(handler) {
			this._addHandler("shown", handler);
		},
		remove_shown: function Toggle$remove_shown(handler) {
			this._removeHandler("shown", handler);
		},
		add_hidden: function Toggle$add_hidden(handler) {
			this._addHandler("hidden", handler);
		},
		remove_hidden: function Toggle$remove_hidden(handler) {
			this._removeHandler("hidden", handler);
		},
		get_visible: function Toggle$get_visible() {
			return this._visible;
		},

		// Enable/Disable
		//////////////////////////////////////////////////////////
		link_disable: function Toggle$link_disable() {
			if ((this._action === "disable" && jQuery(this._element).is(".toggle-on")) || (this._action === "enable" && jQuery(this._element).is(".toggle-off"))) {
				jQuery("select,input,textarea,a,button,optgroup,option", this._element).andSelf().attr("disabled", "disabled");
				this.set_state("off");
			}
			else {
				this.set_state("on");
			}
		},
		do_enable: function Toggle$do_enable() {
			jQuery("select,input,textarea,a,button,optgroup,option", this._element).andSelf().removeAttr("disabled");
			this.set_state("on");
		},
		do_disable: function Toggle$do_disable() {
			jQuery("select,input,textarea,a,button,optgroup,option", this._element).andSelf().attr("disabled", "disabled");
			this.set_state("off");
		},

		// Render/Destroy
		//////////////////////////////////////////////////////////
		link_render: function Toggle$link_render() {
			this._context = null;

			if ((this._action === "render" && jQuery(this._element).is(".toggle-on")) || (this._action === "dispose" && jQuery(this._element).is(".toggle-off"))) {
				var pctx = this.get_templateContext();

				if (!this._ctxIdx && this._element.childNodes.length > 0)
					throw new Error("A toggle control is attached to the node, which expects a template context id, but no id was specified.");

				var newContext = new Sys.UI.TemplateContext(this._ctxIdx);
				newContext.data = pctx.dataItem;
				newContext.components = [];
				newContext.nodes = [];
				newContext.dataItem = pctx.dataItem;
				newContext.index = 0;
				newContext.parentContext = pctx;
				newContext.containerElement = this._element;
				newContext.template = this._getTemplate();
				newContext.template._ensureCompiled();
				this._context = newContext;

				Sys.Application._linkContexts(pctx, this, pctx.dataItem, this._element, newContext, this._contentTemplate);

				newContext.initializeComponents();
				newContext._onInstantiated(null, true);
				this.set_state("on");
				jQuery(this._element).show();
			}
			else {
				this.set_state("off");
				jQuery(this._element).hide();
			}
		},
		init_render: function Toggle$init_render() {
			if (!this._template && !jQuery(this._element).is(".sys-template")) {
				throw new Error("When using toggle in render/dispose mode, the element should be marked with the \"sys-template\" class.");
			}

			this._template = new Sys.UI.Template(this._element);
			this._template._ensureCompiled();
			jQuery(this._element).empty();
			jQuery(this._element).removeClass("sys-template");
		},
		do_render: function Toggle$do_render() {
			jQuery(this._element).show();

			if (!this._context) {
				var pctx = this.get_templateContext();

				var renderArgs = new Sys.Data.DataEventArgs(pctx.dataItem);
				Sys.Observer.raiseEvent(this, "rendering", renderArgs);

				jQuery(this._element).empty();

				var context = this._context = this._template.instantiateIn(this._element, pctx.dataItem, pctx.dataItem, 0, null, pctx, this._contentTemplate);
				context.initializeComponents();

				Sys.Observer.raiseEvent(this, "rendered", renderArgs);
			}

			this.set_state("on");
		},
		do_dispose: function Toggle$do_dispose() {
			jQuery(this._element).hide();

			if (this._context) {
				var renderArgs = new Sys.Data.DataEventArgs();
				Sys.Observer.raiseEvent(this, "rendering", renderArgs);

				this._context.dispose();
				this._context = null;

				jQuery(this._element).empty();

				Sys.Observer.raiseEvent(this, "rendered", renderArgs);
			}

			this.set_state("off");
		},
		add_rendering: function (handler) {
			this._addHandler("rendering", handler);
		},
		remove_rendering: function (handler) {
			this._removeHandler("rendering", handler);
		},
		add_rendered: function (handler) {
			this._addHandler("rendered", handler);
		},
		remove_rendered: function (handler) {
			this._removeHandler("rendered", handler);
		},

		// addClass / removeClass
		//////////////////////////////////////////////////////////
		do_addClass: function Toggle$do_addClass() {
			var $el = jQuery(this._element);

			if (!$el.is("." + this._className)) {
				$el.addClass(this._className);
				this.set_state("on");
				Sys.Observer.raiseEvent(this, "classAdded");
			}
		},
		do_removeClass: function Toggle$do_removeClass() {
			var $el = jQuery(this._element);

			if ($el.is("." + this._className)) {
				$el.removeClass(this._className);
				this.set_state("off");
				Sys.Observer.raiseEvent(this, "classRemoved");
			}
		},
		add_classAdded: function Toggle$add_classAdded(handler) {
			this._addHandler("classAdded", handler);
		},
		remove_classAdded: function Toggle$remove_classAdded(handler) {
			this._removeHandler("classAdded", handler);
		},
		add_classRemoved: function Toggle$add_classRemoved(handler) {
			this._addHandler("classRemoved", handler);
		},
		remove_classRemoved: function Toggle$remove_classRemoved(handler) {
			this._removeHandler("classRemoved", handler);
		}
	});

	// Inverse Actions
	Toggle.mixin({
		// Hide/Show
		//////////////////////////////////////////////////////////
		link_hide: Toggle.prototype.link_show,
		init_hide: Toggle.prototype.init_show,
		undo_hide: Toggle.prototype.do_show,
		undo_show: Toggle.prototype.do_hide,

		// Enable/Disable
		//////////////////////////////////////////////////////////
		link_enabled: Toggle.prototype.link_disable,
		init_disable: Toggle.prototype.init_enable,
		undo_disable: Toggle.prototype.do_enable,
		undo_enable: Toggle.prototype.do_disable,

		// Render/Dispose
		//////////////////////////////////////////////////////////
		link_dispose: Toggle.prototype.link_render,
		init_dispose: Toggle.prototype.init_render,
		undo_render: Toggle.prototype.do_dispose,
		undo_dispose: Toggle.prototype.do_render,

		// addClass/removeClass
		//////////////////////////////////////////////////////////
		undo_addClass: Toggle.prototype.do_removeClass,
		undo_removeClass: Toggle.prototype.do_addClass
	});

	Toggle.mixin({
		_generatesContext: function Toggle$_generatesContext() {
			return this._action === "render" || this._action === "dispose";
		},
		_getTemplate: function Toggle$_getTemplate() {
			return this._template;
		},
		_setTemplate: function Toggle$_setTemplate(value) {
			this._template = value;
		},
		_setTemplateCtxId: function Toggle$_setTemplateCtxId(idx) {
			this._ctxIdx = idx;
		},

		get_templateContext: function Toggle$get_templateContext() {
			/// <value mayBeNull="false" type="Sys.UI.TemplateContext" locid="P:J#ExoWeb.UI.Toggle.templateContext"></value>
			if (!this._parentContext) {
				this._parentContext = Sys.UI.Template.findContext(this._element);
			}
			return this._parentContext;
		},
		set_templateContext: function Toggle$set_templateContext(value) {
			this._parentContext = value;
		},

		get_action: function Toggle$get_action() {
			/// <summary>
			/// The value that determines what the control should
			/// do when its state changes. Ignored if the class property is set
			/// Options:  show, hide, enable, disable, render, dispose, addClass, removeClass
			/// </summary>

			return this._action;
		},
		set_action: function Toggle$set_action(value) {
			if (!Array.contains(Toggle_allowedActions, value)) {
				throw new Error($format("Invalid toggle action \"{0}\".  Possible values are \"{1}\".", value, Toggle_allowedActions.join(", ")));
			}

			this._action = value;
			this.execute();
		},

		get_className: function Toggle$get_className() {
			/// <summary>
			/// Class to add or remove
			/// </summary>

			return this._className;
		},
		set_className: function Toggle$set_className(value) {
			this._className = value;
			if (!this._action)
				this._action = "addClass";
			this.execute();
		},

		// NOTE: Keep these properties around for backwards compatibility.
		get_class: function Toggle$get_class() {
			/// <summary>
			/// Class to add or remove
			/// </summary>

			logWarning("The toggle:class property is deprecated (see issue #1). Consider using toggle:classname instead.");

			return this._className;
		},
		set_class: function Toggle$set_class(value) {
			logWarning("The toggle:class property is deprecated (see issue #1). Consider using toggle:classname instead.");

			this._className = value;
			if (!this._action)
				this._action = "addClass";
			this.execute();
		},

		get_on: function Toggle$get_on() {
			/// <summary>
			/// The value that the control will watch to determine
			/// when its state should change.
			/// </summary>

			return this._on;
		},
		set_on: function Toggle$set_on(value) {
			var changed = value !== this._on;

			if (changed) {
				if (this._on && this._on instanceof Array) {
					Observer.removeCollectionChanged(this._on, this._collectionChangedHandler);
				}

				this._on = value;

				if (this._on && this._on instanceof Array) {
					this._collectionChangedHandler = this.execute.bind(this);
					Observer.addCollectionChanged(this._on, this._collectionChangedHandler);
				}

				this.execute();
			}
			else if (this._when && this._when instanceof Function) {
				this._on = value;
				this.execute();
			}
		},

		get_when: function Toggle$get_when() {
			/// <summary>
			/// The value to compare "on" to, this will most likely 
			/// be a static value, like true or false.
			/// </summary>

			return this._when;
		},
		set_when: function Toggle$set_when(value) {
			this._when = value;
			this.execute();
		},

		set_strictMode: function Toggle$set_strictMode(value) {
			/// <summary>
			/// If true, the "on" value will be strictly compared
			/// to the "when" value.  Otherwise, if "when" is undefined
			/// the "on" value will be checked for truthiness.
			/// </summary>

			this._strictMode = value;
		},
		get_strictMode: function Toggle$get_strictMode() {
			return this._strictMode;
		},

		get_groupName: function Toggle$get_groupName() {
			return this._groupName;
		},
		set_groupName: function Toggle$set_groupName(value) {
			this._groupName = value;
		},

		get_effect: function Toggle$get_effect() {
			return this._effect;
		},
		set_effect: function Toggle$set_effect(value) {
			this._effect = value;
		},

		get_state: function Toggle$get_state() {
			return this._state;
		},
		set_state: function Toggle$set_state(value) {
			this._state = value;
			this._stateClass(value);
			Sys.Observer.raiseEvent(this, value);
		},

		equals: function Toggle$equals() {
			if (this._when === undefined) {
				// When is not defined, so condition depends entirely on "on" property
				var onType = Object.prototype.toString.call(this._on);

				if (this._strictMode === true) {
					if (this._on.constructor !== Boolean)
						throw new Error("With strict mode enabled, toggle:on should be a value of type Boolean.");

					return this._on;
				}
				else if (onType === "[object Array]") {
					return this._on.length > 0;
				}
				else {
					// Default case when not in strict mode is truthiness.
					return !!this._on;
				}
			}
			else if (this._when instanceof Function) {
				var result = this._when(this._on);
				if (this._strictMode === true) {
					if (result === null || result === undefined || result.constructor !== Boolean)
						throw new Error("With strict mode enabled, toggle:when function should return a value of type Boolean.");
					return result;
				}
				else {
					return !!result;
				}
			}
			else {
				return this._on === this._when;
			}
		},

		canExecute: function Toggle$canExecute() {
			// Ensure that the control is initialized, has an element, and the "on" property has been set.
			// Scenario 1:  The set_on or set_when methods may be called before the control has been initialized.
			// Scenario 2:  If a lazy markup extension is used to set the "on" or "when" properties then a callback could set the 
			//				property value when the element is undefined, possibly because of template re-rendering.
			// Scenario 3:  If a lazy markup extension is used to set the "on" property then it may not have a value when initialized.
			return this.get_isInitialized() && this._element !== undefined && this._element !== null && this.hasOwnProperty("_on");
		},
		execute: function Toggle$execute() {
			if (this.canExecute()) {
				var action = this[(this.equals() === true ? "do_" : "undo_") + this._action].bind(this);
				if (this._pendingEventArgs) {
					this._pendingActions.add(action, (function () {
						return !this._pendingEventArgs;
					}).bind(this), true);
				} else {
					action();
				}
			}
		},
		addContentTemplate: function Toggle$addContentTemplate(tmpl) {
			if (this._action !== "render" && this._action !== "dispose" && this.get_templateContext() === Sys.Application._context) {
				throw Error.invalidOperation("invalidSysContentTemplate");
			}
			Sys.UI.IContentTemplateConsumer.prototype.addContentTemplate.apply(this, arguments);
		},
		dispose: function ExoWeb$UI$Toggle$dispose() {
			if (this._template) {
				this._template.dispose();
			}
			if (this._context) {
				this._context.dispose();
			}
			this._action = this._className = this._collectionChangedHandler = this._contentTemplate =
				this._context = this._ctxIdx = this._groupName = this._on = this._parentContext =
				this._state = this._strictMode = this._template = this._visible = this._when = null;
			ExoWeb.UI.Toggle.callBaseMethod(this, "dispose");
		},
		link: function Toggle$link() {
			// Perform custom link logic for the action
			var actionLink = this["link_" + this._action];
			if (actionLink) {
				actionLink.call(this);
			}

			ExoWeb.UI.Toggle.callBaseMethod(this, "link");
		},
		initialize: function Toggle$initialize() {
			Toggle.callBaseMethod(this, "initialize");

			this._pendingActions = new ExoWeb.Functor();

			if (this.get_isLinkPending()) {
				this.link();
			}
			else {
				// Perform custom init logic for the action
				var actionInit = this["init_" + this._action];
				if (actionInit) {
					actionInit.call(this);
				}

				this.execute();
			}
		},
		_stateClass: function (state) {
			if (state == "on")
				jQuery(this._element).addClass("toggle-on").removeClass("toggle-off");
			else
				jQuery(this._element).removeClass("toggle-on").addClass("toggle-off");
		}
	});

	ExoWeb.UI.Toggle = Toggle;
	Toggle.registerClass("ExoWeb.UI.Toggle", Sys.UI.Control, Sys.UI.ITemplateContextConsumer, Sys.UI.IContentTemplateConsumer);

	function ActionEventArgs() {
		this._signal = new ExoWeb.Signal();
		ActionEventArgs.initializeBase(this);
	}

	ActionEventArgs.prototype.pending = function (callback, thisPtr, executeImmediately) {
		return this._signal.pending.apply(this._signal, arguments);
	}

	ActionEventArgs.prototype.waitForAll = function (callback, thisPtr, executeImmediately) {
		this._signal.waitForAll.apply(this._signal, arguments);
	}

	ExoWeb.UI.ActionEventArgs = ActionEventArgs;
	ActionEventArgs.registerClass("ExoWeb.UI.ActionEventArgs", Sys.EventArgs);

	// #endregion

	// #region ExoWeb.UI.ToggleGroup
	//////////////////////////////////////////////////

	function ToggleGroup(element) {
		ToggleGroup.initializeBase(this, [element]);
	}

	ToggleGroup.mixin({
		_execute: function ToggleGroup$_execute() {
			if (this._visible.length === 0 && this._children.length > 0) {
				jQuery(this._element).hide();
			}
			else {
				jQuery(this._element).show();
			}
		},
		_toggleAdded: function ToggleGroup$_toggleAdded(idx, elem) {
			if (elem.control.get_groupName() === this._name && !Array.contains(this._children, elem)) {
				this._children.push(elem);

				if (elem.control.get_state() === "on") {
					this._add(elem);
				}

				elem.control.add_on(this._onHandler);
				elem.control.add_off(this._offHandler);
			}
		},
		_toggleRemoved: function ToggleGroup$_toggleRemoved(idx, elem) {
			if (Array.contains(this._children, elem)) {
				elem.control.remove_on(this._onHandler);
				elem.control.remove_off(this._offHandler);

				this._remove(elem);
				this._children.remove(elem);
				this._execute();
			}
		},
		_toggleOn: function ToggleGroup$_toggleOn(sender) {
			this._add(sender.get_element());
			this._execute();
		},
		_toggleOff: function ToggleGroup$_toggleOff(sender) {
			this._remove(sender.get_element());
			this._execute();
		},
		get_name: function ToggleGroup$get_name() {
			return this._name;
		},
		set_name: function ToggleGroup$set_name(value) {
			this._name = value;
		},
		_add: function (elem) {
			if (this._visible.indexOf(elem) < 0)
				this._visible.push(elem);
		},
		_remove: function (elem) {
			this._visible.remove(elem);
		},
		initialize: function ToggleGroup$initialize() {
			ToggleGroup.callBaseMethod(this, "initialize");

			this._children = [];
			this._visible = [];

			this._onHandler = this._toggleOn.bind(this);
			this._offHandler = this._toggleOff.bind(this);

			jQuery(":toggle", this._element).ever(this._toggleAdded.bind(this), this._toggleRemoved.bind(this));

			this._execute();
		}
	});

	ExoWeb.UI.ToggleGroup = ToggleGroup;
	ToggleGroup.registerClass("ExoWeb.UI.ToggleGroup", Sys.UI.Control);

	// #endregion

	// #region ExoWeb.UI.VueComponent
	//////////////////////////////////////////////////

	function VueComponent(element) {
		VueComponent.initializeBase(this, [element]);
		this._vm = null;
		this._eventHandlers = [];
	}

	function toKebabCase(str) {
		return str.replace(/[A-Z]/g, function (x) {
			return "-" + x.toLowerCase();
		});
	}

	VueComponent.prototype = {

		get_templateContext: function VueComponent$get_templateContext() {
			/// <value mayBeNull="false" type="Sys.UI.TemplateContext" locid="P:J#ExoWeb.UI.VueComponent.templateContext"></value>
			if (!this._parentContext) {
				this._parentContext = Sys.UI.Template.findContext(this._element);
			}
			return this._parentContext;
		},
		set_templateContext: function VueComponent$set_templateContext(value) {
			this._parentContext = value;
		},

		get_component: function() {
			return this._componentName;
		},
		set_component: function(value) {
			this._componentName = value;
		},

		get_parent: function() {
			if (!this._parent) {
				var parentVm = null;
				for (var tc = this.get_templateContext(); tc; tc = tc.parentContext) {
					if (tc.vm) {
						parentVm = tc.vm;
						break;
					}
				}
				this._parent = parentVm;
			}
			return this._parent;
		},
		set_parent: function(value) {
			this._parent = value;
		},

		get_model: function() {
			return this._model;
		},
		set_model: function(value) {
			this._model = value;
		},

		get_props: function() {
			return this._props || {};
		},
		set_props: function(value) {
			this._props = value;
			if (this._vm)
				this._bindProps();
		},

		get_setup: function() {
			return this._setup;
		},
		set_setup: function(value) {
			this._setup = value;
		},

		_bindProps: function () {
			// setup ad hoc prop bindings
			// Example: vuecomponent:xyz="{binding SomeProperty}"
			// Establishes a one way binding of SomeProperty -> component's xyz prop
			for (var prop in this._vm.$options.props) {
				if (Object.getPrototypeOf(this).hasOwnProperty("get_" + prop))
					console.warn("Prop '" + prop + "' will not be bound to " + this.get_component() + " component because it is a reserved property of the VueComponent control.");
				else
					this._bindProp(prop, this._getValue(prop));
			}
		},

		_setProp: function (propName, value) {
			this._vm[propName] = value;
		},

		_preventVueObservability: function(value) {
			if (value && typeof value === 'object') {
				if (value.length && Array.isArray(value)) {
					var _this = this;
					var hasExoWebEntities = false;
					value.forEach(function (o) {
						if (_this._preventVueObservability(o))
							hasExoWebEntities = true;
					});
					return hasExoWebEntities;
				}
				else if (value instanceof ExoWeb.Model.Entity) {
					preventVueObservability(value);
					return true;
				}
				else if (value instanceof ExoWeb.View.Adapter) {
					var hasExoWebEntities = this._preventVueObservability(value.get_rawValue());
					return hasExoWebEntities || value.get_isEntity() || value.get_isEntityList();
				}
			}
		},

		_getValue: function(vueProp) {
			var value = this[toKebabCase(vueProp)];
			if (this._preventVueObservability(value)) {
				if (ExoWeb.config.debug)
					console.warn("Don't pass ExoWeb objects to Vue components, component = " + this.get_component() + ", prop=" + vueProp + ".", value);
			}
			return value;
		},

		_bindProp: function(propName, value) {
			if (value instanceof ExoWeb.View.Adapter) {
				this._setProp(propName, value.get_rawValue());
				value.add_propertyChanged(function () {
					var rawValue = value.get_rawValue();
					this._preventVueObservability(rawValue);
					this._setProp(propName, rawValue);
				}.bind(this));
			}
			else {
				if (value !== undefined)
					this._setProp(propName, value);

				ExoWeb.Observer.addPropertyChanged(this, toKebabCase(propName), function () {
					this._setProp(propName, this._getValue(propName));
				}.bind(this));
			}
		},

		_bindModel: function() {
			// setup v-model binding
			// vuecomponent:model="{@ Property}" establishes a two way binding between Property and the component's
			// model prop. Property will be updated with the value emitted on the component's model event.
			// https://vuejs.org/v2/guide/components-custom-events.html#Customizing-Component-v-model
			var model = this.get_model();
			if (model instanceof ExoWeb.View.Adapter) {
				var modelOptions = this._vm.$options.model || { prop: "value", event: "input" };
				this._bindProp(modelOptions.prop, model);
				this._vm.$on(modelOptions.event, function (val) {
					model.set_rawValue(val);
				});
			}
		},

		_bindEventHandler: function(propName) {
			var that = this;
			this._vm.$on(propName.substring(1), function() {
				that._getValue(propName).apply(null, arguments);
			});

		},

		_bindEventHandlers: function() {
			for (var prop in this) {
				if (prop.indexOf("@") === 0 && typeof this[prop] === "function") {
					this._bindEventHandler(prop);
				}
			}
		},

		initialize: function() {
			VueComponent.callBaseMethod(this, "initialize");

			var element = this.get_element();
			var mountPoint = document.createElement(element.tagName);
			element.appendChild(mountPoint);

			if (!window.VueComponents)
				console.error("VueComponents global was not found. Please make sure the component library is loaded correctly before trying to use this control.");
			else if (!VueComponents[this.get_component()])
				console.error("No component named '" + this.get_component() + "' was found in the component library.");
			else {
				VueComponents[this.get_component()].load().then(function (Component) {
					var propsData = {};
					// ensure props are provided to component constructor
					for (var prop in Component.options.props) {
						var value = this._getValue(prop);
						if (value instanceof ExoWeb.View.Adapter)
							value = value.get_rawValue();
						propsData[prop] = value;
					}

					if (Component.options.functional) {
						this._vm = new Vue({
							parent: this.get_parent(),
							template: '<c-component-wrapper ref="component" v-bind="$props" />',
							components: { 'c-component-wrapper': Component },
							props: Object.keys(propsData),
							propsData: propsData
						});
					}
					else {
						this._vm = new Component({
							parent: this.get_parent(),
							propsData: propsData
						});
					}

					this._bindModel();
					this._bindProps();
					this._bindEventHandlers();

					if (typeof this._setup === "function")
						this._setup(this._vm, this._model);
					this._vm.$mount(mountPoint);
				}.bind(this));
			}
		},

		dispose: function () {
			if (this._vm) {
				try {
					this._vm.$destroy();
				}
				catch (e) {
					// Ignore error destroying component
				}
			}
		}
	};

	/**
	 * Prevent Vue from making an object observable.
	 * Adapted from VueModel -  https://github.com/cognitoforms/VueModel/blob/master/src/vue-model-observability.ts
	 */
	function preventVueObservability(obj) {
		if (obj && !obj.hasOwnProperty("__ob__")) {
			// Mark the object as "raw" so that Vue won't try to make it observable
			Vue.markRaw(obj);
			return true;
		}
	}

	ExoWeb.UI.VueComponent = VueComponent;
	VueComponent.registerClass("ExoWeb.UI.VueComponent", Sys.UI.Control, Sys.UI.ITemplateContextConsumer);

	// #endregion

	// #region ExoWeb.UI.Template
	//////////////////////////////////////////////////

	function Template(element) {
		/// <summary locid="M:J#ExoWeb.UI.Template.#ctor">
		/// In addition to defining template markup, also defines rules that are used
		/// to determine if it should be chosen as the template for a given element
		/// based on a CSS selector as well as a javascript filter that is evaluated 
		/// against the element in question.
		/// </summary>
		/// <param name="element"></param>
		Template.initializeBase(this, [element]);
	}

	var allTemplates = {};

	Template.prototype = {

		get_name: function Template$get_name() {
			/// <value mayBeNull="true" type="String" locid="P:J#ExoWeb.UI.Template.name"></value>
			return this._name;
		},
		set_name: function Template$set_name(value) {
			this._name = value;
		},

		get_nameArray: function Template$get_nameArray() {
			/// <value mayBeNull="true" type="String" locid="P:J#ExoWeb.UI.Template.nameArray"></value>
			if (this._name && !this._nameArray) {
				this._nameArray = this._name.trim().split(/\s+/);
			}
			return this._nameArray;
		},

		get_kind: function Template$get_kind() {
			/// <value mayBeNull="true" type="String" locid="P:J#ExoWeb.UI.Template.kind"></value>
			return this._kind;
		},
		set_kind: function Template$set_kind(value) {
			this._kind = value;
		},

		get_dataType: function Template$get_dataType() {
			/// <value mayBeNull="true" type="String" locid="P:J#ExoWeb.UI.Template.dataType"></value>
			return this._dataType;
		},
		set_dataType: function Template$set_dataType(value) {
			if (ExoWeb.isType(value, Function)) {
				this._dataType = parseFunctionName(value);
				this._dataTypeCtor = value;
			}
			else if (ExoWeb.isType(value, String)) {
				this._dataType = value;
			}
		},

		get_dataTypeCtor: function Template$get_dataTypeCtor() {
			/// <value mayBeNull="true" type="String" locid="P:J#ExoWeb.UI.Template.dataTypeCtor"></value>
			if (!this._dataTypeCtor && ExoWeb.isType(this._dataType, String)) {
				// lazy evaluate the actual constructor
				this._dataTypeCtor = ExoWeb.getCtor(this._dataType);
			}
			return this._dataTypeCtor;
		},

		get_isReference: function Template$get_isReference() {
			/// <value mayBeNull="true" type="Boolean" locid="P:J#ExoWeb.UI.Template.isReference"></value>
			return this._isReference;
		},
		set_isReference: function Template$set_isReference(value) {
			if (value && value.constructor === String) {
				var str = value.toLowerCase().trim();
				if (str === "true") {
					value = true;
				}
				else if (str === "false") {
					value = false;
				}
				else {
					this._isReferenceText = value;
					value = null;
				}
			}
			this._isReference = value;
		},

		get_isList: function Template$get_isList() {
			/// <value mayBeNull="true" type="Boolean" locid="P:J#ExoWeb.UI.Template.isList"></value>
			return this._isList;
		},
		set_isList: function Template$set_isList(value) {
			if (value && value.constructor === String) {
				var str = value.toLowerCase().trim();
				if (str === "true") {
					value = true;
				}
				else if (str === "false") {
					value = false;
				}
				else {
					this._isListText = value;
					value = null;
				}
			}
			this._isList = value;
		},

		get_aspects: function Template$get_aspects() {
			/// <value mayBeNull="true" type="Boolean" locid="P:J#ExoWeb.UI.Template.aspects"></value>
			if (!this._aspects) {
				var aspects = this._aspects = {};
				if (this._isList !== null && this._isList !== undefined) {
					aspects.isList = this._isList;
				}
				if (this._isReference !== null && this._isReference !== undefined) {
					aspects.isReference = this._isReference;
				}
				if (this.get_dataType() !== null && this.get_dataType() !== undefined) {
					aspects.dataType = this.get_dataTypeCtor();
				}
			}
			return this._aspects;
		},

		isCorrectKind: function Template$isCorrectKind(obj) {
			/// <summary locid="M:J#ExoWeb.UI.Template.isCorrectKind">
			/// Determines whether the given object is of the correct kind
			/// for the template, if a kind is specified.
			/// </summary>
			/// <param name="obj" optional="false" mayBeNull="false"></param>
			/// <returns type="Boolean"></returns>
			if (obj instanceof ExoWeb.View.Adapter) {
				return this._kind === "@";
			}
			else {
				return this._kind === undefined;
			}
		},

		_namesSatisfiedBy: function Template$_namesSatisfiedBy(names) {
			/// <summary locid="M:J#ExoWeb.UI.Template._namesSatisfiedBy">
			/// Determines whether the given names collection satisifes all
			/// required template names.
			/// </summary>
			/// <param name="names" type="Array" optional="false" mayBeNull="false"></param>
			/// <returns type="Boolean"></returns>
			return !this.get_nameArray() || !this.get_nameArray().some(function(n) { return !names.contains(n); });
		},

		_aspectsSatisfiedBy: function Template$_aspectsSatisfiedBy(aspects) {
			/// <summary locid="M:J#ExoWeb.UI.Template._aspectsSatisfiedBy">
			/// Determines whether the given data satisfies special aspects
			/// required by the template.
			/// </summary>
			/// <param name="aspects" type="Array" optional="false" mayBeNull="false"></param>
			/// <returns type="Boolean"></returns>
			var satisfied = true;
			eachProp(this.get_aspects(), function(name, value) {
				if (!aspects.hasOwnProperty(name) || (value === null || value === undefined) || (name !== "dataType" && aspects[name] !== value) || (name === "dataType" && aspects[name] !== value && !(aspects[name] && aspects[name].meta && aspects[name].meta.isSubclassOf(value.meta)))) {
					return (satisfied = false);
				}
			});
			return satisfied;
		},

		matches: function Template$matches(data, names) {
			/// <summary locid="M:J#ExoWeb.UI.Template.matches">
			/// Determines whether the given data and name array match the template.
			/// </summary>
			/// <param name="data" optional="false" mayBeNull="false"></param>
			/// <param name="names" type="Array" optional="false" mayBeNull="false"></param>
			/// <returns type="Boolean"></returns>
			if (this._namesSatisfiedBy(names)) {
				var aspects;
				if (data && data.aspects && data.aspects instanceof Function) {
					aspects = data.aspects();
				}
				else {
					aspects = {
						isList: (data && data instanceof Array),
						isReference: (data && data instanceof ExoWeb.Model.Entity)
					};
					if (data === null || data === undefined) {
						aspects.dataType = null;
					}
					else if (data instanceof ExoWeb.Model.Entity) {
						aspects.dataType = data.meta.type.get_jstype();
					}
					else if (data instanceof Array) {
						aspects.dataType = Array;
					}
					else if (data instanceof Object) {
						aspects.dataType = Object;
					}
					else {
						aspects.dataType = data.constructor;
					}
				}
				return this._aspectsSatisfiedBy(aspects);
			}
		},

		toString: function() {
			return $format("<{0} name=\"{1}\" kind=\"{2}\" datatype=\"{3}\" isreference=\"{4}\" islist=\"{5}\" />",
				this._element.tagName.toLowerCase(),
				this._name || "",
				this._kind || "",
				this._dataType || "",
				isNullOrUndefined(this._isReference) ? "" : this._isReference,
				isNullOrUndefined(this._isList) ? "" : this._isList
			);
		},

		dispose: function Template$dispose() {
			this._aspects = this._contentTemplate = this._dataType = this._dataTypeCtor = this._isList = this._isListText =
				this._isReference = this._isReferenceText = this._kind = this._name = this._nameArray = null;
			ExoWeb.UI.Template.callBaseMethod(this, "dispose");
		},

		initialize: function() {
			/// <summary locid="M:J#ExoWeb.UI.Template.initialize" />
			Template.callBaseMethod(this, "initialize");

			// add a class that can be used to search for templates 
			// and make sure that the template element is hidden
			jQuery(this._element).addClass("exoweb-template").hide();

			if (this._element.control.constructor !== String) {
				var el = this._element;
				var tagName = el.tagName.toLowerCase();
				var cache = allTemplates[tagName];
				if (!cache) {
					cache = allTemplates[tagName] = [];
				}
				cache.push(el);
			}
		}

	};

	function findTemplate(tagName, data, names) {
		/// <summary locid="M:J#ExoWeb.UI.Template.find">
		/// Finds the first field template that match the given data and names and returns the template.
		/// </summary>

		if (data === undefined || data === null) {
			logWarning("Attempting to find template for " + (data === undefined ? "undefined" : "null") + " data.");
		}

		var cache;
		if (cache = allTemplates[tagName]) {
			for (var t = cache.length - 1; t >= 0; t--) {
				var tmplEl = cache[t];
				var tmpl = tmplEl.control;
	
				if (tmpl instanceof Template) {
					var isCorrectKind = tmpl.isCorrectKind(data);
					if ((isCorrectKind === undefined || isCorrectKind === true) && tmpl.matches(data, names)) {
						return tmplEl;
					}
				}
			}
		}

		return null;
	}

	// bookkeeping for Template.load
	// TODO: consider wrapper object to clean up after templates are loaded?
	var templateCount = 0;
	var externalTemplatesSignal = new ExoWeb.Signal("external templates");
	var lastTemplateRequestSignal;

	Template.load = function Template$load(path, options) {
		/// <summary locid="M:J#ExoWeb.UI.Template.load">
		/// Loads external templates into the page.
		/// </summary>

		var id = "exoweb-templates-" + (templateCount++);

		var lastReq = lastTemplateRequestSignal;

		// set the last request signal to the new signal and increment
		var signal = lastTemplateRequestSignal = new ExoWeb.Signal(id);
		var callback = externalTemplatesSignal.pending(signal.pending(function () {
			// Activate template controls within the response.
			Sys.Application.activateElement(this);
		}));

		jQuery(function ($) {
			var tmpl = jQuery("<div id='" + id + "'/>")
					.hide()
					.appendTo("body");

			//if the template is stored locally look for the path as a div on the page rather than the cache
			if (options && options.isLocal === true) {
				var localTemplate = jQuery('#' + path);
				callback.call(localTemplate.get(0));
			}
			else {
				var html = ExoWeb.cache(path);

				if (html) {
					tmpl.append(html);
					callback.call(tmpl.get(0));
				} 
				else {
					tmpl.load(path, function(responseText, textStatus, jqXHR) {
						// Ensure that jqXHR is loaded.  'state' check for jquery 1.7+, 'isResolved' check for jQuery 1.5 - 1.7
						if ((jqXHR.state && jqXHR.state() === "resolved") || (jqXHR.isResolved && jqXHR.isResolved())) {
							// Cache the template
							ExoWeb.cache(path, responseText);

							// if there is a pending request then wait for it to complete
							if (lastReq) {
								lastReq.waitForAll(callback, this);
							}
							else {
								callback.call(this);
							}
						}
					});
				}
			}
		});
	};

	ExoWeb.UI.Template = Template;
	Template.registerClass("ExoWeb.UI.Template", Sys.UI.Control, Sys.UI.IContentTemplateConsumer);

	// #endregion

	// #region ExoWeb.UI.Content
	//////////////////////////////////////////////////

	function Content(element) {
		/// <summary locid="M:J#ExoWeb.UI.Content.#ctor">
		/// Finds its matching template and renders using the provided data as the 
		/// binding context.  It can be used as a "field control", using part of the 
		/// context data to select the appropriate control template.  Another common 
		/// usage would be to select the appropriate template for a portion of the UI,
		/// as in the example where an objects meta type determines how it is 
		/// displayed in the UI.
		/// </summary>
		/// <param name="element"></param>
		Content.initializeBase(this, [element]);
	}

	var contentControlsRendering = 0;

	registerActivity("Content rendering", function() {
		if (contentControlsRendering < 0) {
			logWarning("Number of content controls rendering should never dip below zero.");
		}

		return contentControlsRendering > 0;
	});

	Content.prototype = {

		get_template: function Content$get_template() {
			/// <value mayBeNull="true" type="String" locid="P:J#ExoWeb.UI.Content.template"></value>
			return this._template;
		},
		set_template: function (value) {
			this._template = value;
		},

		get_data: function Content$get_data() {
			/// <value mayBeNull="false" locid="P:J#ExoWeb.UI.Content.data"></value>
			return this._data;
		},
		set_data: function Content$set_data(value) {
			var removedData = ((value === undefined || value === null) && (this._data !== undefined && this._data !== null));

			if (this._changedHandler) {
				// Remove old change handler if applicable.
				Observer.removeCollectionChanged(this._data, this._changedHandler);
				delete this._changedHandler;
			}

			this._data = value;

			if (value instanceof Array) {
				// Watch for changes to an array.
				this._changedHandler = this._collectionChanged.bind(this);
				Observer.addCollectionChanged(value, this._changedHandler);
			}

			// Force rendering to occur if we previously had a value and now do not.
			this.update(removedData);
		},

		get_disabled: function Content$get_disabled() {
			/// <value mayBeNull="false" type="Boolean" locid="P:J#ExoWeb.UI.Content.disabled"></value>
			return this._disabled === undefined ? false : !!this._disabled;
		},
		set_disabled: function Content$set_disabled(value) {
			var newValue;

			if (value.constructor === Boolean) {
				newValue = value;
			}
			else if (value.constructor === String) {
				newValue = value.toLowerCase() == "true" ? true : (value.toLowerCase() == "false" ? false : undefined);
			}
			else {
				throw new Error("Invalid value for property \"disabled\": " + value);
			}

			var oldValue = this._disabled;
			this._disabled = newValue;

			if (oldValue === true && newValue === false) {
				this.update();
			}
		},

		get_contexts: function Content$get_contexts() {
			/// <value mayBeNull="false" type="Array" locid="P:J#ExoWeb.UI.Content.contexts"></value>
			return [this._context];
		},

		get_templateContext: function Content$get_templateContext() {
			/// <value mayBeNull="false" type="Sys.UI.TemplateContext" locid="P:J#ExoWeb.UI.Content.templateContext"></value>
			if (!this._parentContext) {
				this._parentContext = Sys.UI.Template.findContext(this._element);
			}
			return this._parentContext;
		},
		set_templateContext: function Context$set_templateContext(value) {
			this._parentContext = value;
		},

		get_isRendered: function Context$get_isRendered() {
			/// <value mayBeNull="false" type="Boolean" locid="P:J#ExoWeb.UI.Content.isRendered"></value>
			return this._isRendered;
		},

		add_rendering: function Content$add_rendering(handler) {
			/// <summary locid="E:J#ExoWeb.UI.Content.rendering" />
			this._addHandler("rendering", handler);
		},
		remove_rendering: function Content$remove_rendering(handler) {
			this._removeHandler("rendering", handler);
		},

		add_rendered: function Content$add_rendered(handler) {
			/// <summary locid="E:J#ExoWeb.UI.Content.rendered" />
			this._addHandler("rendered", handler);
		},
		remove_rendered: function Content$remove_rendered(handler) {
			this._removeHandler("rendered", handler);
		},

		add_error: function (handler) {
			/// <summary locid="E:J#ExoWeb.UI.Content.error" />
			this._addHandler("error", handler);
		},
		remove_error: function (handler) {
			this._removeHandler("error", handler);
		},

		_collectionChanged: function (sender, args) {
			this.update(true);
		},

		_initializeResults: function Content$_initializeResults() {
			if (this._context) {
				this._context.initializeComponents();
			}
		},

		_generatesContext: function Content$_generatesContext() {
			return true;
		},
		_setTemplateCtxId: function Content$_setTemplateCtxId(idx) {
			this._ctxIdx = idx;
		},

		_findTemplate: function Content$_findTemplate() {
			/// <summary locid="M:J#ExoWeb.UI.Content._findTemplate">
			/// Find the first matching template for the content control.
			/// </summary>
			var tmplNames;
			if (this._contentTemplate) {
				tmplNames = this._contentTemplate;
			}
			if (this._template) {
				if (tmplNames) {
					tmplNames += " ";
					tmplNames += this._template;
				}
				else {
					tmplNames = this._template;
				}
			}

			var tmplEl = findTemplate(this._element.tagName.toLowerCase(), this._data, tmplNames ? tmplNames.trim().split(/\s+/) : []);

			if (!tmplEl) {
				throw new Error($format("This content region does not match any available templates. Tag={0}, Data={1}, Template={2}", this._element.tagName.toLowerCase(), this._data, tmplNames || ""));
			}

			return tmplEl;
		},

		_canRender: function Content$_canRender(force) {
			/// <summary locid="M:J#ExoWeb.UI.Content._canRender">
			/// Ensure that the control is initialized, has an element, and the "data" property has been set.
			/// 1) The set_data method may be called before the control has been initialized.
			/// 2) If a lazy markup extension is used to set the "data" property then a callback could set the 
			/// property value when the element is undefined, possibly because of template re-rendering.
			/// 3) If a lazy markup extension is used to set the "data" property then it may not have a value when initialized.
			/// Also check that the control has not been disabled.
			/// </summary>

			return ((this._data !== undefined && this._data !== null) || force === true) &&
				this.get_isInitialized() && this._element !== undefined && this._element !== null && !this.get_disabled();
		},

		_getResultingTemplateNames: function Content$_getResultingTemplateNames(tmplEl) {
			// use sys:content-template (on content control) and content:template
			var contentTemplateNames;
			if (this._contentTemplate) {
				contentTemplateNames = this._contentTemplate;
				if (this._template) {
					contentTemplateNames += " " + this._template;
				}
			}
			else if (this._template) {
				contentTemplateNames = this._template;
			}
			else {
				contentTemplateNames = "";
			}

			var contentTemplate = contentTemplateNames.trim().split(/\s+/).distinct();

			// Remove names matched by the template
			if (contentTemplate.length > 0) {
				var tmplNames = tmplEl.control.get_nameArray();
				if (tmplNames) {
					purge(contentTemplate, function(name) {
						return tmplNames.indexOf(name) >= 0;
					});
				}
			}

			// Add sys:content-template defined on the template element
			if (tmplEl.control._contentTemplate) {
				contentTemplate.addRange(tmplEl.control._contentTemplate.trim().split(/\s+/));
			}

			return contentTemplate;
		},

		_render: function Content$_render() {
			/// <summary locid="M:J#ExoWeb.UI.Content._render">
			/// Render the content template into the container element.
			/// </summary>

			// Failing to empty content before rendering can result in invalid content since rendering 
			// content is not necessarily in order because of waiting on external templates.
			var container = this._element;

			jQuery(container).empty();

			var parentContext = this.get_templateContext();
			this._context = null;

			var data = this._data;
			if (data !== null && data !== undefined) {
				var tmplEl = this._findTemplate();
				var template = new Sys.UI.Template(tmplEl);

				// get custom classes from template
				var classes = jQuery(tmplEl).attr("class");
				if (classes) {
					classes = jQuery.trim(classes.replace("exoweb-template", "").replace("sys-template", ""));
					jQuery(container).addClass(classes);
				}

				// Get the list of template names applicable to the control's children
				var contentTemplate = this._getResultingTemplateNames(tmplEl);

				this._context = template.instantiateIn(container, this._data, this._data, 0, null, parentContext, contentTemplate.join(" "));

				this._initializeResults();
			}
		},

		_renderStart: function Content$_renderStart(force) {
			/// <summary locid="M:J#ExoWeb.UI.Content._renderStart">
			/// Start the rendering process. There may be a delay if external templates
			/// have not yet finished loading.
			/// </summary>
			if (this._canRender(force)) {
				contentControlsRendering++;

				externalTemplatesSignal.waitForAll(function () {
					if (this._element === undefined || this._element === null) {
						contentControlsRendering--;
						return;
					}

					var renderArgs = new Sys.Data.DataEventArgs(this._data);
					Sys.Observer.raiseEvent(this, "rendering", renderArgs);

					this._isRendered = false;

					try {
						this._render();
						this._isRendered = true;
						Sys.Observer.raiseEvent(this, "rendered", renderArgs);
					}
					finally {
						contentControlsRendering--;
					}
				}, this);
			}
		},

		_link: function () {
			if (!this._ctxIdx && this._element && this._element.childNodes.length > 0)
				throw new Error("A content control is attached to the node, which expects a template context id, but no id was specified.");

			if ((this._data !== null && this._data !== undefined) || (this._element && this._element.childNodes.length > 0)) {
				var pctx = this.get_templateContext();
				var tmplEl = this._findTemplate();

				var newContext = new Sys.UI.TemplateContext(this._ctxIdx);
				newContext.data = this._data;
				newContext.components = [];
				newContext.nodes = [];
				newContext.dataItem = this._data;
				newContext.index = 0;
				newContext.parentContext = pctx;
				newContext.containerElement = this._element;
				newContext.template = new Sys.UI.Template(tmplEl);
				newContext.template._ensureCompiled();

				this._context = newContext;

				// Get the list of template names applicable to the control's children
				var contentTemplate = this._getResultingTemplateNames(tmplEl);

				var element = this._element;
				Sys.Application._linkContexts(pctx, this, this._data, element, newContext, contentTemplate.join(" "));

				for (var i = 0; i < element.childNodes.length; i++) {
					newContext.nodes.push(element.childNodes[i]);
				}

				newContext._onInstantiated(null, true);
				this._initializeResults();
			}
		},

		link: function Content$link() {
			/// <summary locid="M:J#ExoWeb.UI.Content.link" />
			if (!this._linkInProgress) {
				this._linkInProgress = true;
				contentControlsRendering++;
				externalTemplatesSignal.waitForAll(function () {
					// Control has disposed.
					if (this._element === undefined || this._element === null) {
						ExoWeb.UI.Content.callBaseMethod(this, 'link');
						contentControlsRendering--;
						return;
					}

					try {
						delete this._linkInProgress;
						this._isRendered = true;
						this._context = null;
						this._link();
						ExoWeb.UI.Content.callBaseMethod(this, 'link');
					}
					finally {
						contentControlsRendering--;
					}
				}, this);
			}
		},

		update: function Content$update(force) {
			if (this.get_isLinkPending()) {
				if (this.hasOwnProperty("_data")) {
					this.link();
				}
			}
			else if (this._canRender(force)) {
				this._renderStart(force);
			}
		},

		dispose: function ExoWeb$UI$Content$dispose() {
			if (this._context) {
				this._context.dispose();
			}
			if (this._changedHandler) {
				Observer.removeCollectionChanged(this._data, this._changedHandler);
				this._changedHandler = null;
			}
			this._contentTemplate = this._context = this._ctxIdx =
				this._data = this._disabled = this._isRendered = this._parentContext = this._template = null;
			ExoWeb.UI.Content.callBaseMethod(this, "dispose");
		},

		initialize: function Content$initialize() {
			/// <summary locid="M:J#ExoWeb.UI.Content.initialize" />
			Content.callBaseMethod(this, "initialize");

			if (jQuery(this._element).is(".sys-template")) {
				if (jQuery(this._element).children().length > 0) {
					logWarning("Content control is marked with the \"sys-template\" class, which means that its children will be ignored and discarded.");
				}
				else {
					logWarning("No need to mark a content control with the \"sys-template\" class.");
				}
			}
			this.update();
		}

	};

	ExoWeb.UI.Content = Content;
	Content.registerClass("ExoWeb.UI.Content", Sys.UI.Control, Sys.UI.ITemplateContextConsumer, Sys.UI.IContentTemplateConsumer);

	// #endregion

	// #region ExoWeb.UI.DataView
	//////////////////////////////////////////////////

	var dataViewsRendering = 0;

	registerActivity("DataView rendering", function() {
		if (dataViewsRendering < 0) {
			logWarning("Number of dataview controls rendering should never dip below zero.");
		}

		return dataViewsRendering > 0;
	});

	var dataViewRefresh = Sys.UI.DataView.prototype.refresh;
	Sys.UI.DataView.prototype.refresh = function refresh() {
		dataViewsRendering++;

		if (this.get_element()) {
			dataViewRefresh.apply(this, arguments);
		}
		else {
			logWarning("Attempting to refresh, but DataView was being disposed.");
		}

		dataViewsRendering--;
	};

	// #endregion

	// #region ExoWeb.UI.Html
	//////////////////////////////////////////////////

	function Html(element) {
		/// <summary>
		/// </summary>
		/// <example>
		///		<div sys:attach="html" html:url="http://www.google.com"></div>
		/// </example>

		Html.initializeBase(this, [element]);
	}

	Html.prototype = {
		get_source: function Html$get_source() {
			return this._source;
		},
		set_source: function Html$set_source(value) {
			this._source = value;
		},
		get_loadingClass: function Html$get_loadingClass() {
			return this._loadingClass;
		},
		set_loadingClass: function Html$set_loadingClass(value) {
			this._loadingClass = value;
		},
		get_url: function Html$get_url() {
			return this._url;
		},
		set_url: function Html$set_url(value) {
			this._url = value;
		},
		get_path: function Html$get_path() {
			var source = this.get_source();
			var url = this.get_url();
			if (source instanceof ExoWeb.Model.Entity) {
				url = source.toString(url);
			}
			return $format(url, source);
		},
		initialize: function Html$initialize() {
			Html.callBaseMethod(this, "initialize");

			var path = this.get_path();
			var element = this.get_element();
			var loadingClass = this.get_loadingClass();

			jQuery(element).addClass(loadingClass);

			jQuery(element).load(path, function(responseText, status, response) {
				jQuery(element).removeClass(loadingClass);

				if (status != "success" && status != "notmodified") {
					throw new Error("Failed to load html: status = " + status);
				}
			});
		}
	};

	ExoWeb.UI.Html = Html;
	Html.registerClass("ExoWeb.UI.Html", Sys.UI.Control);

	// #endregion

	// #region ExoWeb.UI.Behavior
	//////////////////////////////////////////////////

	function Behavior(element) {
		/// <summary>
		/// </summary>
		/// <example>
		///		<div sys:attach="behavior" behavior:script="Sys.scripts.Foo" behavior:typename="My.Class" behavior:prop-foo="bar"></div>
		/// </example>

		Behavior.initializeBase(this, [element]);
	}

	Behavior.prototype = {
		get_script: function Behavior$get_script() {
			return this._script;
		},
		set_script: function Behavior$set_script(value) {
			this._script = value;
		},
		get_scriptObject: function Behavior$get_script() {
			if (!this._scriptObject) {
				var path = this._script.startsWith("window") ?
					this._script.substring(7) :
					this._script;

				this._scriptObject = ExoWeb.evalPath(window, path);
			}

			return this._scriptObject;
		},
		get_typeName: function Behavior$get_typeName() {
			return this._typeName;
		},
		set_typeName: function Behavior$set_typeName(value) {
			this._typeName = value;
		},

		// NOTE: Keep these properties around for backwards compatibility.
		get_class: function Behavior$get_class() {
			logWarning("The behavior:class property is deprecated (see issue #1). Consider using behavior:typename instead.");

			return this._typeName;
		},
		set_class: function Behavior$set_class(value) {
			logWarning("The behavior:class property is deprecated (see issue #1). Consider using behavior:typename instead.");

			this._typeName = value;
		},

		get_dontForceLoad: function Behavior$get_dontForceLoad() {
			return this._dontForceLoad;
		},
		set_dontForceLoad: function Behavior$set_dontForceLoad(value) {
			this._dontForceLoad = value;
		},
		get_ctorFunction: function Behavior$get_ctorFunction() {
			if (!this._ctorFunction) {
				this._ctorFunction = ExoWeb.getCtor(this._typeName);
			}

			return this._ctorFunction;
		},
		get_properties: function Behavior$get_properties() {
			if (!this._properties) {
				this._properties = {};
				for (var prop in this) {
					if (prop.startsWith("prop_") && !prop.startsWith("prop_add_")) {
						var ctor = this.get_ctorFunction();
						if (!ctor) {
							throw new Error($format("Could not evaulate type '{0}'.", this._typeName));
						}

						var name = Sys.Application._mapToPrototype(prop.substring(5), ctor);

						if (!name) {
							throw new Error($format("Property '{0}' could not be found on type '{1}'.", prop.substring(5), this._typeName));
						}

						this._properties[name] = this[prop];
					}
				}
			}

			return this._properties;
		},
		get_events: function Behavior$get_events() {
			if (!this._events) {
				this._events = {};
				for (var prop in this) {
					if (prop.startsWith("prop_add_")) {
						var ctor = this.get_ctorFunction();
						if (!ctor) {
							throw new Error($format("Could not evaulate type '{0}'.", this._typeName));
						}

						var name = Sys.Application._mapToPrototype(prop.substring(9), ctor);

						if (!name) {
							throw new Error($format("Event '{0}' could not be found on type '{1}'.", prop.substring(9), this._typeName));
						}

						this._events[name] = this[prop];
					}
				}
			}

			return this._events;
		},
		_create: function Behavior$create() {
			// if the element is not within the document body it 
			// probably means that it is being removed - TODO: verify
			if (!jQuery.contains(document.body, this._element)) {
				return;
			}

			this._behavior = $create(this.get_ctorFunction(), this.get_properties(), this.get_events(), null, this._element);
		},
		initialize: function Behavior$initialize() {
			Behavior.callBaseMethod(this, "initialize");

			if (!this._dontForceLoad) {
				Sys.require([this.get_scriptObject()], this._create.bind(this));
			}
			else {
				this._create();
			}
		}
	};

	ExoWeb.UI.Behavior = Behavior;
	Behavior.registerClass("ExoWeb.UI.Behavior", Sys.UI.Control);

	// #endregion

	// #region ExoWeb.UI.Utilities
	//////////////////////////////////////////////////

	function getTemplateSubContainer(childElement) {
		var element = childElement;

		function isDataViewOrContent(el) {
			return (el.control && el.control instanceof Sys.UI.DataView) ||
				(el.control && el.control instanceof ExoWeb.UI.Content);
		}

		// find the first parent that has an attached ASP.NET Ajax dataview or ExoWeb content control (ignore toggle)
		while (element.parentNode && !isDataViewOrContent(element.parentNode)) {
			element = element.parentNode;
		}

		// containing template was not found
		if (element.parentNode && isDataViewOrContent(element.parentNode)) {
			return element;
		}
	}

	function getDataForContainer(container, subcontainer, index) {
		var data = null;

		if (container) {
			if (container.control instanceof Sys.UI.DataView || container.control instanceof ExoWeb.UI.Content) {
				var containerContexts = container.control.get_contexts();
				var containerData = container.control.get_data();

				// ensure an array for conformity
				if (!(containerData instanceof Array)) {
					containerData = [containerData];
				}

				if (containerContexts) {
					// if there is only one context in the array then the index must be zero
					if (containerContexts.length == 1) {
						index = 0;
					}

					if (index !== undefined && index !== null && index.constructor === Number) {
						if (index < containerContexts.length) {
							var indexedContext = containerContexts[index];
							var indexedData = containerData[index];
							data = (indexedContext) ? indexedContext.dataItem : indexedData;
						}
					}
					else {
						// try to find the right context based on the element's position in the dom
						for (var i = 0, l = containerContexts.length; i < l; i++) {
							var childContext = containerContexts[i];
							if (!childContext) {
								var contextsFromDom = map(container.children, function(e) { return Sys.UI.Template.findContext(e.firstChild); }).distinct();
								var matchingContext = contextsFromDom.single(function(tc) { return Sys._indexOf(tc.nodes, subcontainer) >= 0; });
								if (matchingContext) {
									data = matchingContext.dataItem;
									break;
								}
							}
							else if (childContext.containerElement === container && Sys._indexOf(childContext.nodes, subcontainer) > -1) {
								data = childContext.dataItem;
								break;
							}

						}
					}
				}
			}
		}

		return data;
	}

	function getParentContext(options/*{ target, subcontainer, index, level, dataType, ifFn }*/) {
		/// <summary>
		/// 	Finds the template context data based on the given options.
		/// </summary>
		/// <param name="options" type="Object">
		/// 	The object which contains the options to use.
		/// 	target:  The target from which to start searching.  This can be an HTML
		/// 					element, a control, or a template context.
		/// 		index (optional):  The index of the desired context.  If the desired context
		/// 					is one level up and is part of a list, this argument can be used
		/// 					to specify which template context to return.
		/// 		level (optional):  The number of levels to travel.  By default this is "1",
		/// 					which means that the immediate parent context data will be returned.
		/// 		dataType (optional):  If specified, this type is used as the type of data to search
		/// 					for.  When context data of this type is encountered it is returned.
		/// 					Note that arrays are not supported.  If the data is an array and the
		/// 					type of items must be checked, use the "ifFn" argument.
		/// 		ifFn (optional):  A function that determines whether the correct data has been
		/// 					found.  The context data is returned as soon as the result of calling 
		/// 					this function with the current data and container is true.
		/// </param>
		/// <returns type="Object" />

		var target = options.target, effectiveLevel = options.level || 1, container, subcontainer = options.subcontainer, i = 0, searching = true, context, data;

		if (target.control && (target.control instanceof Sys.UI.DataView || target.control instanceof ExoWeb.UI.Content)) {
			target = target.control;
		}
		else if (target instanceof Sys.UI.Template) {
			target = target.get_element();
		}
		else if (target instanceof Sys.UI.TemplateContext) {
			target = target.containerElement;
		}

		while (searching === true) {
			// if we are starting out with a dataview then look at the parent context rather than walking 
			// up the dom (since the element will probably not be present in the dom)
			if (!container && (target instanceof Sys.UI.DataView || target instanceof ExoWeb.UI.Content)) {
				context = target.get_templateContext();

				// If the control's context is the global context, then exit here with a custom result
				if (context._global === true) {
					return { data: null, global: true, container: document.documentElement, subcontainer: target.get_element() };
				}

				container = context.containerElement;

				if (container.control instanceof Toggle)
					container = Sys.UI.Template.findContext(container).containerElement;
			
				if (options.target && options.target.tagName) {
					subcontainer = getTemplateSubContainer(options.target);
				}
			}
			else {
				var obj = container || target;
				subcontainer = getTemplateSubContainer(obj);

				if (!subcontainer) {
					// Back up and attempt to go through the control.
					if (obj.control && (obj.control instanceof Sys.UI.DataView || container.control instanceof ExoWeb.UI.Content)) {
						container = null;
						target = obj.control;
						continue;
					}

					throw Error.invalidOperation("Not within a container template.");
				}

				container = subcontainer.parentNode;
			}

			// Increment the counter to check against the level parameter.
			i++;

			// Get the context data for the current level.
			data = getDataForContainer(container, subcontainer, options.index);

			if (options.dataType) {
				// Verify that the current data is not the data type that we are looking for.
				searching = !data || !(data instanceof options.dataType || data.constructor === options.dataType);
			}
			else if (options.ifFn) {
				// Verify that the stop function conditions are not met.
				searching = !(options.ifFn.call(this, data, container));
			}
			else {
				// Finally, check the level.  If no level was specified then we will only go up one level.
				searching = i < effectiveLevel;
			}
		}

		return { data: data, container: container, subcontainer: subcontainer };
	}

	ExoWeb.UI.getParentContext = getParentContext;

	ExoWeb.UI.getParentContextData = function() {
		return getParentContext.apply(this, arguments).data;
	};

	window.$parentContextData = function $parentContextData(target, index, level, dataType, ifFn) {
		/// <summary>
		/// 	Finds the template context data based on the given options.
		/// </summary>
		/// <param name="target" type="Object">
		/// 	The target from which to start searching.  This can be an HTML element, a 
		/// 	control, or a template context.
		/// </param>
		/// <param name="index" type="Number" integer="true" optional="true">
		/// 	The index of the desired context.  If the desired context is one level
		/// 	up and is part of a list, this argument can be used to specify which
		/// 	template context to return.
		/// </param>
		/// <param name="level" type="Number" integer="true" optional="true">
		/// 	The number of levels to travel.  By default this is "1", which means that
		/// 	the immediate parent context data will be returned.
		/// </param>
		/// <param name="dataType" type="Function" optional="true">
		/// 	If specified, this type is used as the type of data to search for.  When context
		/// 	data of this type is encountered it is returned.  Note that arrays are not supported.
		/// 	If the data is an array and the type of items must be checked, use the "ifFn" argument.
		/// </param>
		/// <param name="ifFn" type="Function" optional="true">
		/// 	A function that determines whether the correct data has been found.  The context data
		/// 	is returned as soon as the result of calling this function with the current data and 
		/// 	container is true.
		/// </param>
		/// <returns type="Object" />

		return getParentContext({
			"target": target,
			"index": index,
			"level": level,
			"dataType": dataType,
			"ifFn": ifFn
		}).data;
	};

	function getIsLast(template, index) {
		/// <summary>
		/// 	Returns whether the data being rendered in the given template at the given index is 
		/// 	the last object in the list.
		///
		///		Example:
		///
		///		&lt; span sys:if="{{ $isLast(this, $index) }}" &gt;
		///
		/// </summary>
		/// <param name="template" type="Sys.UI.Template">The template that is being rendered.</param>
		/// <param name="index" type="Number" integer="true">The index of the current data item.</param>
		/// <returns type="Boolean" />

		var len = template.get_element().control.get_contexts().length;
		return index == len - 1;
	}

	window.$isLast = getIsLast;

	// #endregion

	// #region ExoWeb.View.AdapterMarkupExtension
	//////////////////////////////////////////////////

	Sys._Application.mixin(Functor.eventing);

	Sys._Application.prototype.addBeforeCreateAdapter = function Application$addBeforeCreateAdapter(handler) {
	    this._addEvent("beforeCreateAdapter", handler);
	};

	Sys._Application.prototype.removeBeforeCreateAdapter = function Application$removeBeforeCreateAdapter(handler) {
	    this._removeEvent("beforeCreateAdapter", handler);
	};

	Sys.Application.registerMarkupExtension(
		"@",
		function AdapterMarkupExtention(component, targetProperty, templateContext, properties) {
			if (properties.required) {
				logWarning("Adapter markup extension does not support the \"required\" property.");
			}

			var path = properties.path || properties.$default;
			delete properties.$default;

			var source;
			if (properties.source) {
				source = properties.source;
				delete properties.source;
			}
			else {
				source = templateContext.dataItem;
			}

			var adapter;
			if (!path) {
				if (!(source instanceof Adapter)) {
					throw new Error("No path was specified for the \"@\" markup extension, and the source is not an adapter.");
				}
				for (var prop in properties) {
					if (properties.hasOwnProperty(prop) && prop !== "isLinkPending") {
						throw new Error("Additional adapter properties cannot be specified when deferring to another adapter (no path specified). Found property \"" + prop + "\".");
					}
				}
				adapter = source;
			}
			else {
			    Sys.Application._raiseEvent("beforeCreateAdapter", [Sys.Application, { source: source, path: path, properties: properties }]);
				adapter = new Adapter(source, path, properties.format, properties);
				templateContext.components.push(adapter);
			}

			adapter.ready(function AdapterReady() {
				Observer.setValue(component, targetProperty, adapter);
			});
		},
		false
	);

	// #endregion

	// #region ExoWeb.View.MetaMarkupExtension
	//////////////////////////////////////////////////

	var bindingSetters = [];
	var setterExpr = /^set_(.*)$/;
	ExoWeb.eachProp(Sys.Binding.prototype, function(prop) {
		var name = setterExpr.exec(prop);
		if (name) {
			bindingSetters.push(name[1]);
		}
	});

	Sys.Application.registerMarkupExtension(
		"#",
		function MetaMarkupExtension(component, targetProperty, templateContext, properties) {
			if (properties.required) {
				logWarning("Meta markup extension does not support the \"required\" property.");
			}

			var options, element;

			if (Sys.Component.isInstanceOfType(component)) {
				element = component.get_element();
			}
			else if (Sys.UI.DomElement.isDomElement(component)) {
				element = component;
			}

			options = Sys._merge({
				source: templateContext.dataItem,
				templateContext: templateContext,
				target: component,
				targetProperty: targetProperty,
				property: element.nodeName === "SELECT" ? "systemValue" : "displayValue"
			}, properties);

			delete properties.$default;

			// remove properties that apply to the binding
			for (var p in properties) {
				if (properties.hasOwnProperty(p)) {
					if (bindingSetters.indexOf(p) >= 0) {
						delete properties[p];
					}
				}
			}

			options.path = options.path || options.$default;
			delete options.$default;

			var adapter = options.source = new Adapter(options.source || templateContext.dataItem, options.path, options.format, properties);

			options.path = options.property;
			delete options.property;
		
			templateContext.components.push(adapter);
			templateContext.components.push(Sys.Binding.bind(options));
		},
		false
	);

	// #endregion

	// #region ExoWeb.View.ConditionMarkupExtension
	//////////////////////////////////////////////////

	Sys.Application.registerMarkupExtension("?",
		function (component, targetProperty, templateContext, properties) {
			var options = Sys._merge({
				source: templateContext.dataItem,
				templateContext: templateContext,
				targetProperty: targetProperty
			}, properties);

			var meta = options.source.meta;

			options.type = options.type || options.$default;
			delete options.$default;

			options.single = options.single && (options.single === true || options.single.toString().toLowerCase() === "true");

			var types = options.type ? options.type.split(",") : null;

			var sets = options.set ? options.set.split(",") : null;

			var target = function () {
				if (options.target && options.target.constructor === String)
					return evalPath(options.source, options.target);
				return options.target;
			};

			function updateConditions() {
				var currentTarget = target();
				var conditions = meta.conditions().filter(function (c) {
					return (!types || types.indexOf(c.type.code) >= 0) && // check for type code match (if specified)
						(!sets || intersect(sets, c.type.sets.map(function (s) { return s.name; })).length > 0) && // check for set code match (if specified)
						(!target || c.targets.some(function (t) { return t.target === currentTarget; })); // check for target (if specified)
				});

				if (options.single === true) {
					if (conditions.length > 1) {
						throw new Error($format("Multiple conditions were found for type \"{0}\".", options.type));
					}

					conditions = conditions.length === 0 ? null : conditions[0];
				}

				Observer.setValue(component, properties.targetProperty || targetProperty, conditions);
			}

			updateConditions();
			meta.addConditionsChanged(updateConditions, meta);
		},
		false);

	// #endregion

	// #region ExoWeb.View.Binding
	//////////////////////////////////////////////////

	function Binding(templateContext, source, sourcePath, target, targetPath, options, scopeChain) {
		Binding.initializeBase(this);

		this._templateContext = templateContext;
		this._source = source;
		this._sourcePath = sourcePath;
		this._target = target;

		var pathLower = targetPath ? targetPath.toLowerCase() : targetPath;
		if (pathLower === "innertext") {
			this._targetPath = "innerText";
		}
		else if (pathLower === "innerhtml") {
			this._targetPath = "innerHTML";
		}
		else {
			this._targetPath = targetPath;
		}

		this._options = options || {};

		this._isTargetElement = Sys.UI.DomElement.isDomElement(target);

		this._updateImmediately = true;

		if (this._sourcePath) {
			// Start the initial fetch of the source value.
			this._evalSuccessHandler = this._evalSuccess.bind(this);
			this._evalFailureHandler = this._evalFailure.bind(this);
			LazyLoader.eval(this._source, this._sourcePath, this._evalSuccessHandler, this._evalFailureHandler, scopeChain);
		}
		else {
			this._evalSuccess(this._source);
		}

		this._updateImmediately = false;
	}

	function ensureArray(value) {
		return isArray(value) ? value : (isNullOrUndefined(value) ? [] : [value]);
	}

	Binding.mixin({

		// Functions concerned with setting the value of the target after
		// the source value has been retrieved and manipulated based on options.
		//////////////////////////////////////////////////////////////////////////

		_setTarget: function(value) {
			if (this._isTargetElement && (this._targetPath === "innerText" || this._targetPath === "innerHTML")) {
				if (value && !isString(value))
					value = value.toString();

				// taken from Sys$Binding$_sourceChanged
				Sys.Application._clearContent(this._target);
				if (this._targetPath === "innerHTML")
					this._target.innerHTML = value;
				else
					this._target.appendChild(document.createTextNode(value));
				Observer.raisePropertyChanged(this._target, this._targetPath);
			}
			else if (this._isTargetElement && value === null) {
				// IE would set the value to "null"
				Observer.setValue(this._target, this._targetPath, "");
			}
			else {
				Observer.setValue(this._target, this._targetPath, value);
			}
		},

		_queue: function (value) {
			if (this._pendingValue) {
				this._pendingValue = value;
				return;
			}

			this._pendingValue = value;

			Batch.whenDone(function() {
				var targetValue = this._pendingValue;
				delete this._pendingValue;

				if (this._disposed === true) {
					return;
				}

				this._setTarget(targetValue);
			}, this);
		},

		// Functions that filter or transform the value of the source before
		// setting the target.  These methods are NOT asynchronous.
		//////////////////////////////////////////////////////////////////////////

		_getValue: function(value) {
			// Use a default value if the source value is null. NOTE: Because of the way LazyLoader.eval and evalPath are used,
			// the result should never be undefined. Undefined would indicate that a property did not exist, which would be an
			// error. This also has the side-effect of being more compatible with server-side rendering.
			if (value === null) {
				if (this._options.hasOwnProperty("nullValue")) {
					return this._options.nullValue;
				}
			}
			else {
				// Attempt to format the source value using a format specifier
				if (this._options.format) {
					return getFormat(value.constructor, this._options.format).convert(value);
				}
				else if (this._options.transform) {
					// Generate the transform function
					if (!this._transformFn) {
						this._transformFn = new Function("list", "$index", "$dataItem", "return $transform(list, true)." + this._options.transform + ";");
					}
					// Transform the original list using the given options
					var transformResult = this._transformFn(value, this._templateContext.index, this._templateContext.dataItem);
					if (transformResult.live !== Transform.prototype.live) {
						throw new Error("Invalid transform result: may only contain \"where\", \"orderBy\", \"select\", \"selectMany\", and \"groupBy\".");
					}
					return transformResult.live();
				}
			}
			return value;
		},

		// Functions that deal with responding to changes, asynchronous loading,
		// and general bookkeeping.
		//////////////////////////////////////////////////////////////////////////

		_require: function (value, callback) {
			var valueRevision = this._valueRevision = ExoWeb.randomText(8, true),
				updateImmediately = true;

			LazyLoader.evalAll(value, this._options.required, function () {

				// Make sure that the data being evaluated is not stale.
				if (!this._value || this._value !== value || this._valueRevision !== valueRevision) {
					return;
				}

				if (updateImmediately) {
					callback.call(this);
				} else {
					window.setTimeout(callback.bind(this), 1);
				}
			}, null, null, this, LazyLoader.evalAll, false, value, [], true);

			updateImmediately = false;
		},

		_update: function (value, oldItems, newItems) {
			if (this._disposed === true) {
				return;
			}

			// if necessary, remove an existing collection change handler
			if (this._collectionChangedHandler) {
				Observer.removeCollectionChanged(this._value, this._collectionChangedHandler);
				delete this._value;
				delete this._collectionChangedHandler;
			}

			this._value = value;

			// if the value is an array and we will transform the value or require paths, then watch for collection change events
			if (value && value instanceof Array && this._options.required) {
				this._collectionChangedHandler = this._collectionChanged.bind(this);
				Observer.makeObservable(value);
				Observer.addCollectionChanged(value, this._collectionChangedHandler);
			}

			// If additional paths are required then load them before invoking the callback.
			if (this._options.required) {
				this._updateWatchedItems(value, oldItems, newItems, function() {
					this._queue(this._getValue(value));
				});
			}
			else {
				this._queue(this._getValue(value));
			}
		},
	
		_updateWatchedItems: function(value, oldItems, newItems, callback) {
			// Unwatch require path for items that are no longer relevant.
			if (oldItems && oldItems.length > 0) {
				oldItems.forEach(function(item) {
					Observer.removePathChanged(item, this._options.required, this._watchedItemPathChangedHandler);
				}, this);
				delete this._watchedItemPathChangedHandler;
			}

			if (value) {
				// Load required paths, then manipulate the source value and update the target.
				this._require(value, function() {
					if (this._disposed === true) {
						return;
					}

					if (newItems && newItems.length > 0) {
						// Watch require path for new items.
						this._watchedItemPathChangedHandler = this._watchedItemPathChanged.bind(this);
						forEach(newItems, function(item) {
							Observer.addPathChanged(item, this._options.required, this._watchedItemPathChangedHandler, true);
						}, this);
					}

					if (callback) {
						callback.call(this);
					}
				});
			}
			else if (callback) {
				callback.call(this);
			}
		},

		_collectionChanged: function(items, evt) {
			// In the case of an array-valued source, respond to a collection change that is raised for the source value.
			if (this._options.required) {
				var oldItems = evt.get_changes().mapToArray(function(change) { return change.oldItems || []; });
				var newItems = evt.get_changes().mapToArray(function(change) { return change.newItems || []; });
				this._updateWatchedItems(items, oldItems, newItems);
			}
		},

		_watchedItemPathChanged: function(sender, args) {
			this._update(this._sourcePathResult);
		},

		_sourcePathChanged: function() {
			// Save the previous result and evaluate and store the new one.
			var prevSourcePathResult = this._sourcePathResult;
			this._sourcePathResult = evalPath(this._source, this._sourcePath);

			// if the value is the same (which will commonly happen when the source is an array) then there is no need to update
			if (prevSourcePathResult !== this._sourcePathResult) {
				// Respond to a change that occurs at any point along the source path.
				this._update(this._sourcePathResult, ensureArray(prevSourcePathResult), ensureArray(this._sourcePathResult));
			}
		},

		_evalSuccess: function(result, performedLoading, source) {
			this._source = source;

			if (this._disposed) {
				return;
			}

			delete this._evalSuccessHandler;

			if (this._sourcePath) {
				this._sourcePathChangedHandler = this._sourcePathChanged.bind(this);
				Observer.addPathChanged(this._source, this._sourcePath, this._sourcePathChangedHandler, true);
			}

			this._sourcePathResult = result;

			if (this._updateImmediately) {
				this._update(result, null, ensureArray(result));
			} else {
				var self = this;
				window.setTimeout(function () {
					self._update(result, null, ensureArray(result));
				}, 1);
			}
		},

		_evalFailure: function(err) {
			if (this._disposed) {
				return;
			}

			delete this._evalFailureHandler;

			throw new Error($format("Couldn't evaluate path '{0}', {1}", this._sourcePath, err));
		},

		dispose: function() {
			if (!this._disposed) {
				this._disposed = true;
				if (this._collectionChangedHandler) {
					Observer.removeCollectionChanged(this._value, this._collectionChangedHandler);
					this._collectionChangedHandler = null;
				}
				if (this._sourcePathChangedHandler) {
					Observer.removePathChanged(this._source, this._sourcePath, this._sourcePathChangedHandler);
					this._sourcePathChangedHandler = null;
				}
				if (this._watchedItemPathChangedHandler) {
					ensureArray(this._sourcePathResult).forEach(function(item) {
						Observer.removePathChanged(item, this._options.required, this._watchedItemPathChangedHandler);
					}, this);
					this._watchedItemPathChangedHandler = null;
				}
				if (this._evalSuccessHandler) {
					this._evalSuccessHandler = null;
				}
				if (this._evalFailureHandler) {
					this._evalFailureHandler = null;
				}
				this._isTargetElement = this._options = this._pendingValue = this._source =
					this._sourcePath = this._sourcePathResult = this._target = this._targetPath =
					this._templateContext = this._transformFn = this._value = this._valueRevision = null;
			}
			Binding.callBaseMethod(this, "dispose");
		}

	});

	ExoWeb.View.Binding = Binding;
	Binding.registerClass("ExoWeb.View.Binding", Sys.Component, Sys.UI.ITemplateContextConsumer);

	// #endregion

	// #region ExoWeb.View.LazyMarkupExtension
	//////////////////////////////////////////////////

	Sys.Application.registerMarkupExtension(
		"~",
		function LazyMarkupExtension(component, targetProperty, templateContext, properties) {
			var source;
			var scopeChain;
			var path = properties.path || properties.$default || null;

			// if a source is specified and it is a string, then execute the source as a JavaScript expression
			if (properties.source) {
				if (properties.source.constructor === String) {
					// create a function to evaluate the binding source from the given string
					var evalSource = new Function("$element", "$index", "$dataItem", "$context", "return " + properties.source + ";");

					// get the relevant html element either as the component or the component's target element
					var element = null;
					if (Sys.Component.isInstanceOfType(component)) {
						element = component.get_element();
					}
					else if (Sys.UI.DomElement.isDomElement(component)) {
						element = component;
					}

					// evaluate the value of the expression
					source = evalSource(element, templateContext.index, templateContext.dataItem, templateContext);

					// don't try to eval the path against window
					scopeChain = [];
				}
				else {
					source = properties.source;
				}
			}
			else if (templateContext.dataItem) {
				source = templateContext.dataItem;
			}
			else {
				// No context data, so path must be global
				source = window;
				scopeChain = [];
			}

			// Build an options object that represents only the options that the binding
			// expects, and only if they were specified in the markup extension
			var options = {};
			if (properties.hasOwnProperty("required")) {
				options.required = properties.required;
			}
			if (properties.hasOwnProperty("transform")) {
				options.transform = properties.transform;
			}
			if (properties.hasOwnProperty("format")) {
				options.format = properties.format;
			}
			if (properties.hasOwnProperty("nullValue")) {
				options.nullValue = properties.nullValue;
			}

			// Construct the new binding class
			var binding = new Binding(templateContext, source, path, component, properties.targetProperty || targetProperty, options, scopeChain);

			// register with the template context as a child component
			templateContext.components.push(binding);
		},
		false
	);

	// #endregion

	// #region ExoWeb.View.Adapter
	//////////////////////////////////////////////////

	function Adapter(target, propertyPath, format, options) {
		Adapter.initializeBase(this);

		this._target = target instanceof OptionAdapter ? target.get_rawValue() : target;
		this._propertyPath = propertyPath;
		this._settingRawValue = false;
		this._readySignal = new ExoWeb.Signal("Adapter Ready");

		if (options.allowedValuesTransform) {
			this._allowedValuesTransform = options.allowedValuesTransform;
		}

		if (options.optionsTransform) {
			throw new Error($format("Option \"optionsTransform\" is obsolete, use \"allowedValuesTransform\" instead. Path = \"{0}\".", propertyPath));
		}

		if (options.allowedValuesMayBeNull) {
			this._allowedValuesMayBeNull = options.allowedValuesMayBeNull;
		}

		// Initialize the property chain.
		this._initPropertyChain();

		// Determine the display format to use
		this._format = format ? getFormat(this._propertyChain.get_jstype(), format) : this._propertyChain.get_format();

		// Load the object this adapter is bound to and then load allowed values.
		LazyLoader.eval(this._target, this._propertyChain.get_path(),
			this._readySignal.pending(null, null, true),
			this._readySignal.orPending(function(err) {
				throw new Error($format("Couldn't evaluate path '{0}', {1}", propertyPath, err));
			}, null, true)
		);

		// Add arbitrary options so that they are made available in templates.
		this._extendProperties(options);
	}

	Adapter.mixin({
		// Internal book-keeping and setup methods
		///////////////////////////////////////////////////////////////////////
		_extendProperties: function Adapter$_extendProperties(options) {
			if (options) {
				var allowedOverrides = ["label", "helptext"];

				// The "nullOption" value can be specified for booleans since options
				// are exposed and they are not treated as nullable by default.
				if (this.isType(Boolean)) {
					allowedOverrides.push("nullOption");
				}

				this._extendedProperties = [];
				for (var optionName in options) {
					// check for existing getter and setter methods
					var getter = this["get_" + optionName];
					var setter = this["set_" + optionName];

					// if the option is already defined don't overwrite critical properties (e.g.: value)
					if (getter && !Array.contains(allowedOverrides, optionName)) {
						continue;
					}

					this._extendedProperties.push(optionName);

					// create a getter and setter if they don't exist
					if (!getter || !(getter instanceof Function)) {
						getter = this["get_" + optionName] =
							(function makeGetter(adapter, optionName) {
								return function Adapter$customGetter() { return adapter["_" + optionName]; };
							})(this, optionName);
					}
					if (!setter || !(setter instanceof Function)) {
						setter = this["set_" + optionName] =
							(function makeSetter(adapter, optionName) {
								return function Adapter$customSetter(value) { adapter["_" + optionName] = value; };
							})(this, optionName);
					}

					// set the option value
					setter.call(this, options[optionName]);
				}
			}
		},
		_initPropertyChain: function Adapter$_initPropertyChain() {
			var sourceType;

			if (this._target instanceof Adapter) {
				if (!this._target.get_isEntity()) {
					throw new Error("Adapter source is not an entity.");
				}

				sourceType = this._target._propertyChain.get_jstype().meta;
			}
			else {
				var sourceObject = this._target;

				if (!(sourceObject instanceof Entity)) {
					throw new Error("Adapter source is not an entity, found " + (sourceObject != null ? typeof (sourceObject) : "null"));
				}

				sourceType = sourceObject.meta.type;
			}

			// get the property chain for this adapter starting at the source object
			this._propertyChain = Model.property(this._propertyPath, sourceType);
			if (!this._propertyChain) {
				throw new Error($format("Property \"{0}\" could not be found.", this._propertyPath));
			}

			// If the target is an adapter, prepend its property chain.  Cannot simply concatenate paths
			// since the child path could be instance-dependent (i.e. the parents value is a subtype).
			if (this._target instanceof Adapter) {
				if (this._propertyChain instanceof Property) {
					this._propertyChain = new PropertyChain(this._propertyChain.get_containingType(), [this._propertyChain], []);
				}
				this._propertyChain.prepend(this._target.get_propertyChain());
				this._parentAdapter = this._target;
				this._target = this._target.get_target();
			}
		},
		_loadForFormatAndRaiseChange: function Adapter$_loadForFormatAndRaiseChange(val) {
			EventScope$onExit(function() {
				var signal = new ExoWeb.Signal("Adapter.displayValue");
				this._doForFormatPaths(val, function(path) {
					EventScope$perform(function() {
						LazyLoader.evalAll(val, path, signal.pending(), signal.orPending(), null, null, function() {
							EventScope$perform(LazyLoader.evalAll.bind(this, arguments));
						}, false, val, []);
					}, this);
				});
				signal.waitForAll(function() {
					Observer.raisePropertyChanged(this, "displayValue");
					Observer.raisePropertyChanged(this, "systemValue");
				}, this);
			}, this);
		},
		_doForFormatPaths: function Adapter$_doForFormatPaths(val, callback, thisPtr) {
			if (val === undefined || val === null || !this._format) {
				return;
			}

			this._format.getPaths().forEach(callback, thisPtr || this);
		},
		_unsubscribeFromFormatChanges: function Adapter$_unsubscribeFromFormatChanges(val) {
			this._doForFormatPaths(val, function (path) {
				var subscription = this._formatSubscribers[path];
				if (subscription && subscription.chain) {
					subscription.chain.removeChanged(subscription.handler);
				}
			});
		},
		_subscribeToFormatChanges: function Adapter$_subscribeToFormatChanges(val) {
			this._doForFormatPaths(val, function (path) {
				Model.property(path, this._propertyChain.lastProperty().get_jstype().meta, true, function (chain) {
					var subscription = this._formatSubscribers[path] = { chain: chain, handler: this._loadForFormatAndRaiseChange.bind(this).prependArguments(val) };
					var entities = val instanceof Array ? val : [val];
					entities.forEach(function (entity) {
						chain.addChanged(subscription.handler, entity, false, true);
					});
				}, this);
			});
		},
		_ensureObservable: function Adapter$_ensureObservable() {
			var _this = this;

			if (!this._observable) {
				Observer.makeObservable(this);

				// subscribe to property changes at all points in the path
				this._targetChangedHandler = this._onTargetChanged.bind(this);
				this._propertyChain.addChanged(this._targetChangedHandler, this._target, false, true);

				this._formatSubscribers = {};

				// set up initial watching of format paths
				if (this._propertyChain.lastTarget(this._target)) {
					var rawValue = this._propertyChain.value(this._target);
					this._subscribeToFormatChanges(rawValue);
				}

				// when the value changes resubscribe
				this._propertyChain.addChanged(function (sender, args) {
					_this._unsubscribeFromFormatChanges(args.oldValue);
					_this._subscribeToFormatChanges(args.newValue);
				}, this._target, false, true);

				this._observable = true;
			}
		},
		_onTargetChanged: function Adapter$_onTargetChanged(sender, args) {
			var _this = this;
			var rawValue = this.get_rawValue();

			if (!this._settingRawValue) {
				// raise raw value changed event
				LazyLoader.eval(rawValue, null, function () {
					Observer.raisePropertyChanged(_this, "rawValue");
				});
			}

			// raise value changed event
			this._loadForFormatAndRaiseChange(rawValue);

			// Re-attach validation handlers if needed
			var properties = this._propertyChain.properties();
			var numProps = properties.length;

			// The last target does not change if this is a single-property chain,
			// so no need to update validation events
			if (numProps > 1 && args.triggeredBy !== this._propertyChain.lastProperty()) {
				// Remove event handlers for previous last target 
				if (args.oldValue) {
					// Determine the old last target
					var property,
						propIndex = properties.indexOf(args.triggeredBy) + 1,
						newLastTarget = this._propertyChain.lastTarget(this._target),
						oldLastTarget = args.oldValue;
					while (oldLastTarget && propIndex < numProps - 1) {
						property = properties[propIndex++],
						oldLastTarget = property.value(oldLastTarget);
					}

					// Remove and re-add validation handlers if the last target has changed
					if (oldLastTarget && oldLastTarget !== newLastTarget) {
						this.get_conditions().clear();
						if (this._conditionsChangedHandler) {
							oldLastTarget.meta.removeConditionsChanged(this._conditionsChangedHandler);
						}
					}
				}

				// Add the conditions for the new target and subscribe to changes
				if (this.get_conditions() && newLastTarget) {
					this.get_conditions().addRange(newLastTarget.meta.conditions(this.get_propertyChain().lastProperty()));
					if (this._conditionsChangedHandler) {
						newLastTarget.meta.addConditionsChanged(this._conditionsChangedHandler, this.get_propertyChain());
					}
				}
			}

			if (!this._settingRawValue) {
				// Raise change on options representing the old and new value in the event that the property 
				// has be changed by non-UI code or another UI component.  This will result in double raising 
				// events if the value was set by changing selected on one of the OptionAdapter objects.
				if (this._options) {
					Array.forEach(this._options, function (o) {
						// Always reload selected for options in an array since we don't know what the old values in the list were
						if (args.newValue instanceof Array || o.get_rawValue() == args.newValue || o.get_rawValue() == args.oldValue) {
							Observer.raisePropertyChanged(o, "selected");
						}
					});
				}

				// Dispose of existing event handlers related to allowed value loading
				disposeOptions.call(this);
				signalOptionsReady.call(this);
			}
		},
		_setValue: function Adapter$_setValue(value) {
			var prop = this._propertyChain;

			// Clear existing format errors before adding a new one.
			if (this._formatError) {
				this.get_conditions().remove(this._formatError);
				this._formatError = undefined;
			}

			if (value instanceof ExoWeb.Model.FormatError) {
				// Insert new format errors if the value is not valid.
				this._formatError = value.createCondition(prop.lastTarget(this._target), prop.lastProperty());
				this.get_conditions().insert(0, this._formatError);
			} else {
				// Otherwise, update the property value.
				var changed = prop.value(this._target) !== value;
				this.set_rawValue(value, changed);
			}
		},

		// Various methods.
		///////////////////////////////////////////////////////////////////////
		ready: function Adapter$ready(callback, thisPtr) {
			this._readySignal.waitForAll(callback, thisPtr, true);
		},
		toString: function Adapter$toString() {
			var targetType;
			if (this._target === null) {
				targetType = "null";
			}
			else if (this._target === undefined) {
				targetType = "undefined";
			}
			else {
				targetType = parseFunctionName(this._target.constructor);
			}

			var value;
			try {
				value = this.get_rawValue();

				if (value === null) {
					value = "null";
				}
				else if (value === undefined) {
					value = "undefined";
				}
				else if (value.constructor !== String) {
					value = value.toString();
				}
			}
			catch (e) {
				value = "[error]";
			}

			return $format("<{0}>.{1}:  {2}", [targetType, this._propertyPath, value]);
		},

		// Properties that are intended to be used by templates.
		///////////////////////////////////////////////////////////////////////
		isType: function Adapter$isType(jstype) {
			if (this._jstype && this._jstype instanceof Function) {
				return this._jstype === jstype;
			}

			for (var propType = this._propertyChain.get_jstype(); propType !== null; propType = propType.getBaseType()) {
				if (propType === jstype) {
					return true;
				}
			}

			return false;
		},
		aspects: function Adapter$aspects() {
			if (!this._aspects) {
				this._aspects = {
					"isList": this.get_isList(),
					"isReference": this.get_isEntity() || this.get_isEntityList(),
					"dataType": this.get_dataType()
				};
			}
			return this._aspects;
		},
		get_isList: function Adapter$get_isList() {
			return this._propertyChain.get_isList();
		},
		get_isEntity: function Adapter$get_isEntity() {
			return this._propertyChain.get_isEntityType();
		},
		get_isEntityList: function Adapter$get_isEntityList() {
			return this._propertyChain.get_isEntityListType();
		},
		get_isStatic: function Adapter$get_isStatic() {
			return this._propertyChain.get_isStatic();
		},
		get_target: function Adapter$get_target() {
			return this._target;
		},
		get_propertyPath: function Adapter$get_propertyPath() {
			return this._propertyPath;
		},
		get_propertyChain: function Adapter$get_propertyChain() {
			return this._propertyChain;
		},
		get_format: function Adapter$get_format() {
			return this._format;
		},
		get_dataType: function Adapter$get_dataType() {
			return this._propertyChain.get_jstype();
		},
		get_label: function Adapter$get_label() {
			// if no label is specified then use the property label
			return this._label || this._propertyChain.get_label();
		},
		get_helptext: function Adapter$get_helptext() {
			// help text may also be included in the model?
			return this._helptext || this._propertyChain.get_helptext() || "";
		},
		get_nullOption: function Adapter$get_nullOption() {
			if (this.isType(Boolean)) {
				if (this.hasOwnProperty("_nullOption")) {
					return this._nullOption;
				}

				// Booleans are not nullable by default.
				return false;
			}

			return true;
		},
		get_values: function Adapter$get_values() {
			this._ensureObservable();
			if (this.get_isList()) {
				var _this = this;
				var values = this._propertyChain.value(this._target);
				return values.map(function (v, i) { return new ListValueAdapter(_this, i) });
			}
			else {
				throw new Error("Adapter values are only available for list properties.");
			}
		},
		get_rawValue: function Adapter$get_rawValue() {
			this._ensureObservable();
			return this._propertyChain.value(this._target);
		},
		set_rawValue: function Adapter$set_rawValue(value, changed) {
			var prop = this._propertyChain, target, targetType;

			if (changed === undefined) {
				changed = prop.value(this._target) !== value;
			}

			if (changed) {
				this._settingRawValue = true;

				try {
					target = this._target;
					if (target === null) {
						targetType = "null";
					} else if (target === undefined) {
						targetType = "undefined";
					} else if (target instanceof ExoWeb.Model.Entity) {
						targetType = target.meta.type.get_fullName();
					} else if (target instanceof ExoWeb.View.Adapter) {
						targetType = "Adapter";
					} else if (target instanceof ExoWeb.View.OptionAdapter) {
						targetType = "OptionAdapter";
					} else if (target instanceof ExoWeb.View.OptionGroupAdapter) {
						targetType = "OptionGroupAdapter";
					} else {
						targetType = parseFunctionName(target.constructor);
					}

					if (ExoWeb.config.enableBatchChanges) {
						context.server.batchChanges($format("adapter: {0}.{1}", targetType, this._propertyPath), function () {
							prop.value(target, value);
						});
					}
					else {
						prop.value(target, value);
					}
				}
				finally {
					this._settingRawValue = false;
				}
			}
		},
		get_systemValue: function Adapter$get_systemValue() {
			var rawValue = this.get_rawValue();
			if (this.get_isEntity()) {
				return rawValue ? Entity.toIdString(rawValue) : "";
			}
			else if (this.isType(Boolean)) {
				if (rawValue === true) {
					return "true";
				}
				else if (rawValue === false) {
					return "false";
				}
				else {
					return "";
				}
			}
			else if (this.isType(String)) {
				return rawValue;
			}
			else {
				logWarning("Possible incorrect usage of systemValue for a type that is not supported");
				return rawValue ? rawValue.toString() : "";
			}
		},
		set_systemValue: function Adapter$set_systemValue(value) {
			if (this.get_isEntity()) {

				// set to null
				if (!value) {
					this._setValue(null);
				}
				else {
					var entity = Entity.fromIdString(value);

					// lazy load if necessary
					if (LazyLoader.isRegistered(entity)) {
						// Load the entity (in scope) before setting the value.
						LazyLoader.load(entity, null, true, function () {
							this._setValue(entity);
						}, this);
					}
					// set immediately if loaded
					else {
						this._setValue(entity);
					}
				}
			}
			else if (this.isType(Boolean)) {
				if (value === "true") {
					this._setValue(true);
				}
				else if (value === "false") {
					this._setValue(false);
				}
				else {
					this._setValue(null);
				}
			}
			else if (this.isType(String)) {
				if (!value) 
					this._setValue(null);
				else
					this._setValue(value);
			}
			else {
				throw new Error("Cannot set systemValue property of Adapters for non-entity types.");
			}
		},
		get_displayValue: function Adapter$get_displayValue() {
			var displayValue;
			var rawValue = this.get_rawValue();

			if (this._format) {
				// Use a markup or property format if available
				if (rawValue instanceof Array) {
					displayValue = rawValue.map(function (value) { return this._format.convert(value); }, this);
				}
				else {
					displayValue = this._format.convert(rawValue);
				}
			}
			else if (rawValue instanceof Array) {
				// If no format exists, then fall back to toString
				displayValue = rawValue.map(function (value) {
					if (value === null || value === undefined) {
						return "";
					}
					else {
						return value.toString();
					}
				}, this);
			}
			else if (rawValue === null || rawValue === undefined) {
				displayValue = "";
			}
			else {
				displayValue = rawValue.toString();
			}

			return displayValue instanceof Array ? displayValue.join(", ") : displayValue;
		},
		set_displayValue: function Adapter$set_displayValue(value) {
			if (this.get_isEntity()) {
				throw new Error("Cannot set displayValue property of Adapters for entity types.");
			}
			else if (this.get_isList()) {
				throw new Error("Cannot set displayValue property of Adapters for list types.");
			}
			else {
				var initialValue = value;
				value = this._format ? this._format.convertBack(value) : value;
				this._setValue(value);
				if (ExoWeb.config.autoReformat && !(value instanceof ExoWeb.Model.FormatError)) {
					var newValue = this.get_displayValue();
					if (initialValue != newValue) {
						var adapter = this;
						window.setTimeout(function () { Observer.raisePropertyChanged(adapter, "displayValue"); }, 1);
					}
				}
			}
		},

		dispose: function Adapter$dispose() {
			var disposed = this._disposed, options = null;

			if (!disposed) {
				this._disposed = true;
				disposeOptions.call(this);
				options = this._options;
				if (this._extendedProperties) {
					var ext = this._extendedProperties;
					for (var i = 0, l = ext.length; i < l; i++) {
						this["_" + ext[i]] = null;
					}
					this._extendedProperties = null;
				}
				if (this._targetChangedHandler) {
					this._propertyChain.removeChanged(this._targetChangedHandler);
					this._targetChangedHandler = null;
				}
				this._unsubscribeFromFormatChanges(this.get_rawValue());
				// Clean up validation event handlers
				var lastTarget = this._propertyChain.lastTarget(this._target);
				if (lastTarget) {
					if (this._conditionsChangedHandler) {
						lastTarget.meta.removeConditionsChanged(this._conditionsChangedHandler);
					}
				}
				this._allowedValues = this._allowedValuesMayBeNull = this._aspects =
					this._format = this._formatSubscribers = this._helptext = this._jstype = this._settingRawValue = this._label =
					this._observable = this._options = this._allowedValuesTransform = this._parentAdapter = this._propertyChain =
					this._propertyPath = this._readySignal = this._target = null;
			}

			Adapter.callBaseMethod(this, "dispose");

			if (!disposed) {
				Observer.disposeObservable(this);
				if (options) {
					options.forEach(Observer.disposeObservable);
				}
			}
		}
	});

	// #region Conditions

	function conditionsChangedHandler(conditions, sender, args) {
		if (args.add) {
			conditions.add(args.conditionTarget.condition);
		}
		else if (args.remove) {
			conditions.remove(args.conditionTarget.condition);
		}
	}

	function getFirstError(conditions, includeWarnings) {
		var firstError = null;
		for (var c = 0; c < conditions.length; c++) {
			var condition = conditions[c];
			if (condition.type instanceof ConditionType.Error || (includeWarnings === true && condition.type instanceof ConditionType.Warning)) {
				if (firstError === null || /FormatError/i.test(condition.type.code)) {
					firstError = condition;
				}
				// Ensures a format error takes precedence over a required field error
				else if (!/FormatError/i.test(firstError.type.code) && /Required/i.test(condition.type.code))
				{
					firstError = condition;
				}
			}
		}
		return firstError;
	}

	Adapter.mixin({
		get_conditions: function Adapter$get_conditions() {

			// initialize the conditions if necessary
			if (!this._conditions) {

				// get the current target
				var target = this.get_propertyChain().lastTarget(this._target);

				// get the current set of conditions
				var conditions = this._conditions = target ? target.meta.conditions(this.get_propertyChain().lastProperty()) : [];

				// make the conditions observable
				Observer.makeObservable(this._conditions);

				// subscribe to condition changes on the current target
				if (target) {
					var handler = this._conditionsChangedHandler = conditionsChangedHandler.prependArguments(conditions);
					target.meta.addConditionsChanged(handler, this.get_propertyChain());
				}
			}
			return this._conditions;
		},
		get_firstErrorOrWarning: function Adapter$get_firstErrorOrWarning() {
			// gets the first error or warning in a set of conditions, always returning format errors first followed by required field errors, and null if no errors exist
			// initialize on first access
			if (!this.hasOwnProperty("_firstErrorOrWarning")) {

				var conditions = this.get_conditions();
				this._firstErrorOrWarning = getFirstError(conditions, true);

				// automatically update when condition changes occur
				var adapter = this;
				conditions.add_collectionChanged(function (sender, args) {

					var err = getFirstError(conditions, true);

					// store the first error and raise property change if it differs from the previous first error
					if (adapter._firstErrorOrWarning !== err) {
						adapter._firstErrorOrWarning = err;
						Observer.raisePropertyChanged(adapter, "firstErrorOrWarning");
					}
				});
			}

			// return the first error
			return this._firstErrorOrWarning;
		},
		get_firstError: function Adapter$get_firstError() {
			// gets the first error in a set of conditions, always returning format errors first followed by required field errors, and null if no errors exist
			// initialize on first access
			if (!this.hasOwnProperty("_firstError")) {

				var conditions = this.get_conditions();
				this._firstError = getFirstError(conditions);

				// automatically update when condition changes occur
				var adapter = this;
				conditions.add_collectionChanged(function (sender, args) {

					var err = getFirstError(conditions);

					// store the first error and raise property change if it differs from the previous first error
					if (adapter._firstError !== err) {
						adapter._firstError = err;
						Observer.raisePropertyChanged(adapter, "firstError");
					}
				});
			}

			// return the first error
			return this._firstError;
		},
		get_hasError: function Adapter$get_hasError() {
			// initialize on first access
			if (!this.hasOwnProperty("_hasError")) {

				var conditions = this.get_conditions();
				this._hasError = !!this.get_firstError();

				// automatically update when condition changes occur
				var adapter = this;
				conditions.add_collectionChanged(function (sender, args) {

					var val = !!adapter.get_firstError();

					// store the first error and raise property change if it differs from the previous first error
					if (adapter._hasError !== val) {
						adapter._hasError = val;
						Observer.raisePropertyChanged(adapter, "hasError");
					}
				});
			}

			return this._hasError;
		}
	});

	// #endregion

	// #region Options

	function disposeOptions() {
		var lastProperty = this._propertyChain.lastProperty();
		var allowedValuesRule = lastProperty.rule(ExoWeb.Model.Rule.allowedValues);
		if (this._allowedValuesChangedHandler) {
			allowedValuesRule.removeChanged(this._allowedValuesChangedHandler);
			this._allowedValuesChangedHandler = null;
		}
		if ( this._allowedValuesRuleExistsHandler) {
			this._propertyChain.lastProperty().removeRuleRegistered(this._allowedValuesRuleExistsHandler);
			this._allowedValuesRuleExistsHandler = null;
		}
		if (this._allowedValuesExistHandler) {
			allowedValuesRule.removeChanged(this._allowedValuesExistHandler);
			this._allowedValuesExistHandler = null;
		}
		this._options = null;
	}

	// Create an option adapter from the given object
	function createOptionAdapter(item) {
		// If it is a transform group then create an option group
		if (item instanceof TransformGroup) {
			return new OptionGroupAdapter(this, item.group, item.items);
		}
		// Otherwise,create a single option
		else {
			return new OptionAdapter(this, item);
		}
	}

	// Notify subscribers that options are available
	function signalOptionsReady() {
		if (this._disposed) {
			return;
		}

		// Delete backing fields so that options can be recalculated (and loaded)
		delete this._options;

		// Raise events in order to cause subscribers to fetch the new value
		ExoWeb.Observer.raisePropertyChanged(this, "options");
	}

	// If the given rule is allowed values, signal options ready
	function checkAllowedValuesRuleExists(rule) {
		if (rule instanceof Rule.allowedValues) {
			this._propertyChain.lastProperty().removeRuleRegistered(this._allowedValuesRuleExistsHandler);
			signalOptionsReady.call(this);
		}
	}

	function checkAllowedValuesExist() {
		var lastProperty = this._propertyChain.lastProperty();
		var allowedValuesRule = lastProperty.rule(ExoWeb.Model.Rule.allowedValues);
		var targetObj = this._propertyChain.lastTarget(this._target);
		var allowedValues = allowedValuesRule.values(targetObj, !!this._allowedValuesMayBeNull);

		if (allowedValues instanceof Array) {
			allowedValuesRule.removeChanged(this._allowedValuesExistHandler);
			delete this._allowedValuesExistHandler;
			signalOptionsReady.call(this);
		}
	}

	// Update the given options source array to match the current allowed values
	function refreshOptionsFromAllowedValues(optionsSourceArray) {
		var lastProperty = this._propertyChain.lastProperty();
		var allowedValuesRule = lastProperty.rule(ExoWeb.Model.Rule.allowedValues);
		var targetObj = this._propertyChain.lastTarget(this._target);
		var allowedValues = allowedValuesRule.values(targetObj, !!this._allowedValuesMayBeNull);
		if (allowedValues) {
			optionsSourceArray.beginUpdate();
			update(optionsSourceArray, allowedValues);
			optionsSourceArray.endUpdate();
		}
		else {
			signalOptionsReady.call(this);
		}
	}

	// Perform any required loading of allowed values items
	function ensureAllowedValuesLoaded(newItems, callback, thisPtr) {
		// Wait until the "batch" of work is complete before lazy loading options. Otherwise,
		// the lazy loading could occur during processing of a response which already contains
		// the data, which could cause performance degredation due to redundant data loading.
		Batch.whenDone(function () {
			var signal = new Signal("ensureAllowedValuesLoaded");
			newItems.forEach(function(item) {
				if (LazyLoader.isRegistered(item)) {
					LazyLoader.load(item, null, true, signal.pending());
				}
			});
			signal.waitForAll(callback, thisPtr);
		});
	}

	function clearInvalidOptions(allowedValues) {
		var rawValue = this.get_rawValue();
		var isDateProp = this.isType(Date);

		function isAllowedValue(value) {
			if (isDateProp) {
				return allowedValues.some(function (v) {
					return v instanceof Date && value.valueOf() === v.valueOf();
				});
			}

			return allowedValues.indexOf(value) !== -1;
		}

		if (rawValue !== null && allowedValues) {
			// Remove option values that are no longer valid
			if (rawValue instanceof Array) {
				purge(rawValue, function (item) {
					return !isAllowedValue(item);
				}, this);
			} else if (!isAllowedValue(rawValue) && this._propertyChain.value(this._target) !== null) {
				this._propertyChain.value(this._target, null);
			}
		} else if (rawValue instanceof Array) {
			rawValue.clear();
		} else if (this._propertyChain.value(this._target) !== null) {
			this._propertyChain.value(this._target, null);
		}
	}

	function allowedValuesChanged(optionsSourceArray, sender, args) {
		var lastProperty = this._propertyChain.lastProperty();
		var allowedValuesRule = lastProperty.rule(ExoWeb.Model.Rule.allowedValues);
		var allowedValues = allowedValuesRule.values(this._propertyChain.lastTarget(this._target), !!this._allowedValuesMayBeNull);

	    // Clear out invalid selections
		if (!allowedValuesRule.ignoreValidation) {
		    clearInvalidOptions.call(this, allowedValues);
		}

		// Load allowed value items that were added
		if (args.changes) {
			// Collect all items that were added
			var newItems = [];
			args.changes.forEach(function(change) {
				if (change.newItems) {
					newItems.addRange(change.newItems);
				}
			});
			if (newItems.length > 0) {
				ensureAllowedValuesLoaded(newItems, refreshOptionsFromAllowedValues.prependArguments(optionsSourceArray), this);
			}
			else {
				refreshOptionsFromAllowedValues.call(this, optionsSourceArray);
			}
		}
		else if (!args.oldValue && args.newValue) {
			// If there was previously not a value of the path and now there is, then all items are new
			ensureAllowedValuesLoaded(allowedValues, refreshOptionsFromAllowedValues.prependArguments(optionsSourceArray), this);
		}
		else {
			refreshOptionsFromAllowedValues.call(this, optionsSourceArray);
		}

	}

	Adapter.mixin({
		get_options: function Adapter$get_options() {
			if (!this.hasOwnProperty("_options")) {
				if (this.isType(Boolean)) {
					this._options = [createOptionAdapter.call(this, true), createOptionAdapter.call(this, false)];
				}
				else {
					var lastProperty = this._propertyChain.lastProperty();
					var allowedValuesRule = lastProperty.rule(ExoWeb.Model.Rule.allowedValues);

					// Watch for the registration of an allowed values rule if it doesn't exist
					if (!allowedValuesRule) {
						this._allowedValuesRuleExistsHandler = checkAllowedValuesRuleExists.bind(this);
						lastProperty.addRuleRegistered(this._allowedValuesRuleExistsHandler);
						this._options = null;
						return;
					}

					// Cache the last target
					var targetObj = this._propertyChain.lastTarget(this._target);

					// Retrieve the value of allowed values property
					var allowedValues = allowedValuesRule.values(targetObj, !!this._allowedValuesMayBeNull);

					// Load allowed values if the path is not inited
					if (allowedValues === undefined && (allowedValuesRule.source instanceof Property || allowedValuesRule.source instanceof PropertyChain)) {
						logWarning("Adapter forced eval of allowed values. Rule: " + allowedValuesRule);
						LazyLoader.eval(allowedValuesRule.source.get_isStatic() ? null : targetObj,
							allowedValuesRule.source.get_path(),
							signalOptionsReady.bind(this));
						this._options = null;
						return;
					}

					// Watch for changes until the allowed values path has a value
					if (!allowedValues) {
						this._allowedValuesExistHandler = checkAllowedValuesExist.bind(this);
						allowedValuesRule.addChanged(this._allowedValuesExistHandler, targetObj);
						if (!allowedValuesRule.ignoreValidation) {
						    clearInvalidOptions.call(this);
						}
						this._options = null;
						return;
					}

					// Load the allowed values list if it is not already loaded
					if (LazyLoader.isRegistered(allowedValues)) {
						logWarning("Adapter forced loading of allowed values list. Rule: " + allowedValuesRule);
						LazyLoader.load(allowedValues, null, true, signalOptionsReady.bind(this), this);
						this._options = null;
						return;
					}

					if (!allowedValuesRule.ignoreValidation) {
					    clearInvalidOptions.call(this, allowedValues);
					}

					// Create an observable copy of the allowed values that we can keep up to date in our own time
					var observableAllowedValues = allowedValues.slice();
					ExoWeb.Observer.makeObservable(observableAllowedValues);

					// Respond to changes to allowed values
					this._allowedValuesChangedHandler = allowedValuesChanged.bind(this).prependArguments(observableAllowedValues);
					allowedValuesRule.addChanged(this._allowedValuesChangedHandler, targetObj, false, true);

					// Create a transform that watches the observable copy and uses the user-supplied _allowedValuesTransform if given
					if (this._allowedValuesTransform) {
						transformedAllowedValues = (new Function("$array", "{ return $transform($array, true)." + this._allowedValuesTransform + "; }"))(observableAllowedValues);
						if (transformedAllowedValues.live !== Transform.prototype.live) {
							throw new Error("Invalid options transform result: may only contain \"where\", \"orderBy\", \"select\", \"selectMany\", and \"groupBy\".");
						}
					}
					else {
						transformedAllowedValues = $transform(observableAllowedValues, true);
					}

					// Map the allowed values to option adapters
					this._options = transformedAllowedValues.select(createOptionAdapter.bind(this)).live();
				}
			}

			return this._options;
		}
	});

	// #endregion

	ExoWeb.View.Adapter = Adapter;
	Adapter.registerClass("ExoWeb.View.Adapter", Sys.Component, Sys.UI.ITemplateContextConsumer);

	// #endregion

	// #region ExoWeb.View.OptionAdapter
	//////////////////////////////////////////////////

	function OptionAdapter(parent, obj) {
		this._parent = parent;
		this._obj = obj;

		// watch for changes to properties of the source object and update the label
		this._ensureObservable();
	}

	OptionAdapter.prototype = {
		// Internal book-keeping and setup methods
		///////////////////////////////////////////////////////////////////////
		_loadForFormatAndRaiseChange: function OptionAdapter$_loadForFormatAndRaiseChange(val) {
			if (val === undefined || val === null) {
				Observer.raisePropertyChanged(this, "displayValue");
				Observer.raisePropertyChanged(this, "systemValue");
				return;
			}

			var signal = new ExoWeb.Signal("OptionAdapter.displayValue");
			this._parent._doForFormatPaths(val, function (path) {
				LazyLoader.evalAll(val, path, signal.pending());
			}, this);
			signal.waitForAll(function () {
				Observer.raisePropertyChanged(this, "displayValue");
				Observer.raisePropertyChanged(this, "systemValue");
			}, this);
		},
		_subscribeToFormatChanges: function OptionAdapter$_subscribeToFormatChanges(val) {
			this._parent._doForFormatPaths(val, function (path) {
				Model.property(path, val.meta.type, true, function (chain) {
					var subscription = this._formatSubscribers[path] = { chain: chain, handler: this._loadForFormatAndRaiseChange.bind(this).prependArguments(val) };
					chain.addChanged(subscription.handler, val);
				}, this);
			}, this);
		},
		_ensureObservable: function OptionAdapter$_ensureObservable() {
			if (!this._observable) {
				Observer.makeObservable(this);

				this._formatSubscribers = {};

				// set up initial watching of format paths
				this._subscribeToFormatChanges(this._obj);

				this._observable = true;
			}
		},

		// Properties consumed by UI
		///////////////////////////////////////////////////////////////////////////
		get_parent: function OptionAdapter$get_parent() {
			return this._parent;
		},
		get_rawValue: function OptionAdapter$get_rawValue() {
			return this._obj;
		},
		get_displayValue: function OptionAdapter$get_displayValue() {
			var format = this._parent.get_format();
			return format ? format.convert(this._obj) : this._obj;
		},
		set_displayValue: function OptionAdapter$set_displayValue(value) {
			if (this._parent.get_isEntity()) {
				throw new Error("Cannot set displayValue property of OptionAdapters for entity types.");
			}
			else {
				var selected = this.get_selected();
				// Remove old value from the list if selected
				if (selected) this.set_selected(false);

				// Set the internal option value after optional applying a conversion
				value = this._format ? this._format.convertBack(value) : value;
				this._obj = value;

				// Add new value to the list if previously selected
				if (selected) this.set_selected(true);
			}
		},
		get_systemValue: function OptionAdapter$get_systemValue() {
			if (this._obj === null || this._obj === undefined) {
				return "";
			}
			else {
				return this._parent.get_isEntity() ? Entity.toIdString(this._obj) : this._obj.toString();
			}
		},
		get_selected: function OptionAdapter$get_selected() {
			var rawValue = this._parent.get_rawValue();

			if (rawValue instanceof Array) {
				return Array.contains(rawValue, this._obj);
			}
			else {
				return rawValue === this._obj;
			}
		},
		set_selected: function OptionAdapter$set_selected(value) {
			var rawValue = this._parent.get_rawValue();

			if (rawValue instanceof Array) {
				this._parent._settingRawValue = true;

				try {
					if (value && !Array.contains(rawValue, this._obj)) {
						rawValue.add(this._obj);
					}
					else if (!value && Array.contains(rawValue, this._obj)) {
						rawValue.remove(this._obj);
					}

				} finally {
					this._parent._settingRawValue = false;
				}
			}
			else {
				if (value) {
					this._parent.set_rawValue(this._obj);
				}
				else {
					this._parent.set_rawValue(null);
				}
			}
		},
		get_conditions: function OptionAdapter$get_conditions() {
			return this._parent.get_conditions();
		}
	};

	ExoWeb.View.OptionAdapter = OptionAdapter;

	// #endregion

	// #region ExoWeb.View.ListValueAdapter
	//////////////////////////////////////////////////

	function ListValueAdapter(parent, index) {
		this._parent = parent;
		this._index = index;

		// watch for changes to properties of the source object and update the label
		this._ensureObservable();
	}

	ListValueAdapter.prototype = {
		// Internal book-keeping and setup methods
		///////////////////////////////////////////////////////////////////////
		_loadForFormatAndRaiseChange: function ListValueAdapter$_loadForFormatAndRaiseChange(val) {
			if (val === undefined || val === null) {
				Observer.raisePropertyChanged(this, "displayValue");
				Observer.raisePropertyChanged(this, "systemValue");
				return;
			}

			var signal = new ExoWeb.Signal("ListValueAdapter.displayValue");
			this._parent._doForFormatPaths(val, function (path) {
				LazyLoader.evalAll(val, path, signal.pending());
			}, this);
			signal.waitForAll(function () {
				Observer.raisePropertyChanged(this, "displayValue");
				Observer.raisePropertyChanged(this, "systemValue");
			}, this);
		},
		//_subscribeToFormatChanges: function ListValueAdapter$_subscribeToFormatChanges(val) {
		//	this._parent._doForFormatPaths(val, function (path) {
		//		Model.property(path, val.meta.type, true, function (chain) {
		//			var subscription = this._formatSubscribers[path] = { chain: chain, handler: this._loadForFormatAndRaiseChange.bind(this).prependArguments(val) };
		//			chain.addChanged(subscription.handler, val);
		//		}, this);
		//	}, this);
		//},
		_ensureObservable: function ListValueAdapter$_ensureObservable() {
			if (!this._observable) {
				Observer.makeObservable(this);

				this._formatSubscribers = {};

				// set up initial watching of format paths
				//this._subscribeToFormatChanges(this._obj);

				this._observable = true;
			}
		},

		// Properties consumed by UI
		///////////////////////////////////////////////////////////////////////////
		get_parent: function ListValueAdapter$get_parent() {
			return this._parent;
		},
		get_isEntity: function ListValueAdapter$get_isEntity() {
			return this._parent.get_isEntity();
		},
		get_options: function ListValueAdapter$get_options() {
			var _this = this;
			return this._parent.get_options().map(function (o) { return new OptionAdapter(_this, o._obj); });
		},
		get_rawValue: function ListValueAdapter$get_rawValue() {
			return this._parent.get_rawValue()[this._index];
		},
		get_displayValue: function ListValueAdapter$get_displayValue() {
			var format = this._parent._format;
			var obj = this._parent.get_rawValue()[this._index];
			return format ? format.convert(obj) : obj;
		},
		set_displayValue: function ListValueAdapter$set_displayValue(value) {
			if (this._parent.get_isEntity()) {
				throw new Error("Cannot set displayValue property of OptionAdapters for entity types.");
			}
			else {
				// Set the internal option value after optional applying a conversion
				value = this._format ? this._parent._format.convertBack(value) : value;

				var list = this._parent.get_rawValue();
				list.beginUpdate();
				list.removeAt(this._index);
				list.insert(this._index, value);
				list.endUpdate();
			}
		},
		get_systemValue: function ListValueAdapter$get_systemValue() {
			if (this._obj === null || this._obj === undefined) {
				return "";
			}
			else {
				return this._parent.get_isEntity() ? Entity.toIdString(this._obj) : this._obj.toString();
			}
		},
		get_conditions: function ListValueAdapter$get_conditions() {
			return this._parent.get_conditions();
		},
		_doForFormatPaths: function ListValueAdapter$_doForFormatPaths(val, callback, thisPtr) {
			return this._parent._doForFormatPaths(val, callback, thisPtr);
		},
		get_format: function ListValueAdapter$get_format() {
			return this._parent._format;
		}
	};

	ExoWeb.View.ListValueAdapter = ListValueAdapter;

	// #endregion

	// #region ExoWeb.View.OptionGroupAdapter
	//////////////////////////////////////////////////

	function OptionGroupAdapter(parent, obj, items) {
		this._parent = parent;
		this._obj = obj;
		this._options = $transform(items).select(parent._createOption.bind(parent)).live();

		// watch for changes to properties of the source object and update the label
		this._ensureObservable();
	}

	OptionGroupAdapter.prototype = {
		// Properties consumed by UI
		///////////////////////////////////////////////////////////////////////////
		get_parent: function OptionGroupAdapter$get_parent() {
			return this._parent;
		},
		get_rawValue: function OptionGroupAdapter$get_rawValue() {
			return this._obj;
		},
		get_displayValue: function OptionGroupAdapter$get_displayValue() {
			var result = this._obj;
			if (result !== null && result !== undefined && result.formats && result.formats.$display) {
				result = result.formats.$display.convert(result);
			}
			return result;
		},
		get_systemValue: function OptionGroupAdapter$get_systemValue() {
			var result = this._obj;
			if (result !== null && result !== undefined && result.formats && result.formats.$system) {
				result = result.formats.$system.convert(result);
			}
			return result;
		},
		get_options: function OptionGroupAdapter$get_options() {
			return this._options;
		},
		get_conditions: function OptionGroupAdapter$get_conditions() {
			return this._parent.get_conditions();
		}
	};

	ExoWeb.View.OptionGroupAdapter = OptionGroupAdapter;
	OptionGroupAdapter.registerClass("ExoWeb.View.OptionGroupAdapter");

	// #endregion

	// #region ExoWeb.View.MsAjax
	//////////////////////////////////////////////////

	/*globals Sys, jQuery */

	(function () {
		function updateLastTargetAndSourceForOtherRadios(target) {
			// Set _lastTarget=false on other radio buttons in the group, since they only 
			// remember the last target that was recieved when an event fires and radio button
			// target change events fire on click (which does not account for de-selection).  
			// Otherwise, the source value is only set the first time the radio button is selected.
			if (Sys.UI.DomElement.isDomElement(target) && jQuery(target).is("input[type=radio]:checked")) {
				jQuery("input[type=radio][name='" + target.name + "']").each(function () {
					if (this !== target && this.__msajaxbindings !== undefined) {
						var bindings = this.__msajaxbindings;
						for (var i = 0; i < bindings.length; i++)
							bindings[i]._lastTarget = bindings[i]._lastSource = false;
					}
				});
			}
		}

		var targetChangedImpl = Sys.Binding.prototype._targetChanged;
		Sys.Binding.prototype._targetChanged = function (force) {
			// Batch changes that may occur due to the target element changing.
			var source = this.get_source(),
				sourceType,
				batchChanges = ExoWeb.config.enableBatchChanges;

			if (source === null) {
				sourceType = "null";
			}
			else if (source === undefined) {
				sourceType = "undefined";
			}
			else if (source instanceof ExoWeb.Model.Entity) {
				sourceType = source.meta.type.get_fullName();
			}
			else if (source instanceof ExoWeb.View.Adapter) {
				sourceType = "Adapter";

				// Adapters handle their own batching.
				batchChanges = false;
			}
			else if (source instanceof ExoWeb.View.OptionAdapter) {
				sourceType = "OptionAdapter";

				// If the option adapter is not a list, then it will set the
				// adapter's rawValue, which will handle batching itself.
				if (!source.get_parent().get_isList()) {
					batchChanges = false;
				}
			}
			else if (source instanceof ExoWeb.View.OptionGroupAdapter) {
				sourceType = "OptionGroupAdapter";
			}
			else {
				sourceType = parseFunctionName(source.constructor);
			}

			if (batchChanges) {
				context.server._changeLog.batchChanges(
					$format("binding: {0}.{1}", sourceType, this.get_path()),
					context.server._localUser,
					targetChangedImpl.bind(this, arguments),
					true
				);
			} else {
				targetChangedImpl.apply(this, arguments);
			}

			// If the binding is not disposing, then fix backing
			// fields for other radio buttons in the same group.
			if (!this._disposed) {
				updateLastTargetAndSourceForOtherRadios(this._target);
			}
		};

		function removeCheckedAttributeToMatchSourceValue(target, sourceValue) {
			// Remove checked attribute from a radio button if the source value has been set to false.
			if (Sys.UI.DomElement.isDomElement(target) && jQuery(target).is("input[type=radio]:checked") && !sourceValue) {
				jQuery(target).removeAttr("checked");
			}
		}

		var sourceChangedImpl = Sys.Binding.prototype._sourceChanged;
		Sys.Binding.prototype._sourceChanged = function (force) {
			var link = force === false;

			// Invoke the standard method implementation.
			sourceChangedImpl.apply(this, [force]);

			if (!this._disposed && !link) {
				removeCheckedAttributeToMatchSourceValue(this._target, this._lastSource);
			}
		};

		Sys.UI.DataView.prototype._loadData = function (value) {
			this._swapData(this._data, value);
			var oldValue = this._data;
			this._data = value;
			this._setData = true;
			this._stale = false;
			// Array data should not typically be set unless some intermediate
			// process (like transform) is creating a new array from the same original.
			if ((value && value instanceof Array) && (oldValue && oldValue instanceof Array)) {
				// copy the original array
				var arr = oldValue.slice();
				var changes = update(arr, value, true);
				this._collectionChanged(value, new Sys.NotifyCollectionChangedEventArgs(changes));
			}
			else {
				this._dirty = true;
				if (this._isActive()) {
					if (this.get_isLinkPending()) {
						this.link();
					}
					else {
						this.refresh();
					}
					this.raisePropertyChanged("data");
				}
				else {
					this._changed = true;
				}
			}
		};
	})();

	// Get's the last object in the source path.  Ex: Customer.Address.Street returns the Address object.
	function getFinalSrcObject(binding) {
		var src = binding.get_source();

		for (var i = 0; i < binding._pathArray.length - 1; ++i) {
			src = src[binding._pathArray[i]] || src["get_" + binding._pathArray[i]]();
		}

		return src;
	}

	ExoWeb.View.getFinalSrcObject = getFinalSrcObject;

	function getFinalPathStep(binding) {
		return binding._pathArray[binding._pathArray.length - 1];
	}

	ExoWeb.View.getFinalPathStep = getFinalPathStep;

	function getBindingInfo(binding) {
		var srcObj = getFinalSrcObject(binding);

		var target;
		var property;

		// Option adapter defers to parent adapter
		if (srcObj instanceof ExoWeb.View.OptionAdapter) {
			srcObj = srcObj.get_parent();
		}

		if (srcObj instanceof ExoWeb.View.Adapter) {
			var chain = srcObj.get_propertyChain();
			property = chain.lastProperty();
			target = chain.lastTarget(srcObj.get_target());
		}
		else if (srcObj instanceof ExoWeb.Model.Entity) {
			var propName = getFinalPathStep(binding);
			property = srcObj.meta.property(propName);
			target = srcObj;
		}

		return {
			target: target,
			property: property
		};
	}

	ExoWeb.View.getBindingInfo = getBindingInfo;

	// #endregion

	// #region Validation
	//////////////////////////////////////////////////

	var isError = function (condition) {
		return condition.type instanceof ExoWeb.Model.ConditionType.Error;
	};

	var isValidationCondition = function (condition) {
		return condition.type instanceof ExoWeb.Model.ConditionType.Error || condition.type instanceof ExoWeb.Model.ConditionType.Warning;
	};

	var onMetaConditionsChanged = function (sender, args, property) {
		if (isValidationCondition(args.conditionTarget.condition)) {
			$(this).trigger("validated", [sender.conditions(property)]);
		}
	};

	var onConditionsCollectionChanged = function (sender, args) {
		$(this).trigger("validated", [sender.filter(isValidationCondition)]);
	};

	var ensureInited = function (element, trackData) {
		if (!window.ExoWeb) {
			return;
		}

		var $el = jQuery(element);

		if ($el.attr("__validating") === undefined) {
			// register for model validation events
			var bindings = $el.liveBindings();

			for (var i = 0; i < bindings.length; i++) {
				var binding = bindings[i];
				var srcObj = ExoWeb.View.getFinalSrcObject(binding);
				var propName = ExoWeb.View.getFinalPathStep(binding);

				var meta = srcObj.meta || srcObj;

				var validationData = null;

				if (meta instanceof ExoWeb.Model.ObjectMeta) {
					var property = meta.type.property(propName);

					var metaHandler = onMetaConditionsChanged.bind(element).spliceArguments(2, 0, property);

					if (trackData) {
						validationData = { instance: { type: meta.type.get_fullName(), id: meta.id }, handler: metaHandler };
					}

					meta.addConditionsChanged(metaHandler, property);
				}
				else if (meta && meta.get_conditions) {
					var conditions = meta.get_conditions();

					var collectionHandler = onConditionsCollectionChanged.bind(element);

					if (trackData) {
						validationData = { collection: conditions, handler: collectionHandler };
					}

					ExoWeb.Observer.addCollectionChanged(conditions, collectionHandler);
				}

				if (trackData) {
					$el.data("validated", validationData);
				}
			}

			// don't double register for events
			$el.attr("__validating", true);
		}
	};

	jQuery.fn.validated = function (f, trackData) {
		this.each(function () {
			jQuery(this).bind('validated', f);
			ensureInited(this, trackData);
		});

		return this;
	};

	// Gets all model rules associated with the property an element is bound to
	jQuery.fn.rules = function (ruleType) {
		if (!window.Sys || !window.ExoWeb || !ExoWeb.Model) return [];

		return jQuery(this).liveBindings()
			.map(function(binding) {
				return ExoWeb.View.getBindingInfo(binding);
			}).filter(function(info) {
				return !!info.property;
			}).map(function(info) {
				return info.property.rule(ruleType);
			});
	};

	jQuery.fn.errors = function () {
		if (!window.Sys || !window.ExoWeb || !ExoWeb.Model) return [];

		return jQuery(this).liveBindings().mapToArray(function (binding) {

			var source = binding.get_source();
			if (source instanceof ExoWeb.View.Adapter) {
				return source.get_conditions().filter(isError);
			}
			else {
				var info = ExoWeb.View.getBindingInfo(binding);

				// Guard against null/undefined target.  This could happen if the target is 
				// undefined, or if the path is multi-hop, and the full path is not defined.
				if (!info.target || !info.property) return [];

				return info.target.meta.conditions(info.property).filter(isError);
			}
		});
	};

	// #endregion

	// #region Selectors
	//////////////////////////////////////////////////

	var exoWebAndModel = false;

	jQuery.expr[":"].rule = function (obj, index, meta, stack) {
		if (exoWebAndModel === false) {
			if (!(window.ExoWeb && ExoWeb.Model))
				return false;
			exoWebAndModel = true;
		}

		var ruleName = meta[3];
		var ruleType = ExoWeb.Model.Rule[ruleName];

		if (!ruleType) {
			throw new Error("Unknown rule in selector: " + ruleName);
		}

		return jQuery(obj).rules(ruleType).length > 0;
	};

	jQuery.expr[":"].bound = function (obj, index, meta, stack) {
		if (exoWebAndModel === false) {
			if (!(window.ExoWeb && ExoWeb.Model))
				return false;
			exoWebAndModel = true;
		}

		return jQuery(obj).liveBindings().length > 0;
	};

	//////////////////////////////////////////////////////////////////////////////////////
	// helpers for working with controls
	var dataviewPrereqs = false;
	jQuery.expr[":"].dataview = function (obj, index, meta, stack) {
		if (dataviewPrereqs === false) {
			if (!(window.Sys !== undefined && Sys.UI !== undefined && obj.control !== undefined && Sys.UI.DataView !== undefined))
				return false;
			dataviewPrereqs = true;
		}

		return obj.control instanceof Sys.UI.DataView;
	};

	var contentPrereqs = false;
	jQuery.expr[":"].content = function (obj, index, meta, stack) {
		if (contentPrereqs === false) {
			if (!(window.ExoWeb !== undefined && ExoWeb.UI !== undefined && obj.control !== undefined && ExoWeb.UI.Content !== undefined && obj.control))
				return false;

			contentPrereqs = true;
		}

		return obj.control instanceof ExoWeb.UI.Content;
	};

	var togglePrereqs = false;
	jQuery.expr[":"].toggle = function (obj, index, meta, stack) {
		if (togglePrereqs === false) {
			if (!(window.ExoWeb !== undefined && ExoWeb.UI !== undefined && obj.control !== undefined && ExoWeb.UI.Toggle !== undefined && obj.control))
				return false;

			togglePrereqs = true;
		}

		return obj.control instanceof ExoWeb.UI.Toggle;
	};

	jQuery.expr[":"].control = function (obj, index, meta, stack) {
		var typeName = meta[3];
		var jstype = new Function("{return " + typeName + ";}");

		return obj.control instanceof jstype();
	};

	// #endregion

	// #region Helpers
	//////////////////////////////////////////////////

	jQuery.fn.control = function jQuery$control(propName, propValue) {
		if (arguments.length === 0) {
			return this.get(0).control;
		}
		else if (arguments.length == 1) {
			return this.get(0).control["get_" + propName]();
		}
		else {
			this.each(function jQuery$control$one(index, element) {
				this.control["set_" + propName](propValue);
			});
		}
	};

	jQuery.fn.commands = function jQuery$commands(commands) {
		var control = this.control();
		control.add_command(function jQuery$commands$command(sender, args) {
			var handler = commands[args.get_commandName()];
			if (handler) {
				handler(sender, args);
			}
		});
	};

	// Gets all Sys.Bindings for an element
	jQuery.fn.liveBindings = function jQuery$liveBindings() {
		var bindings = [];
		this.each(function jQuery$liveBindings$one() {
			if (this.__msajaxbindings)
				Array.addRange(bindings, this.__msajaxbindings);
		});
		return bindings;
	};

	// #endregion

	// #region Ever
	//////////////////////////////////////////////////

	// Cache lists of ever handlers by type
	var everHandlers = { added: [], deleted: [], bound: [], unbound: [] };

	var processElements = function processElements(container, els, action, source) {
		// Determine if the input is an array
		var isArr = Object.prototype.toString.call(els) === "[object Array]",

			// The number of elements to process
			numEls = isArr ? els.length : 1,

			// Cache of handlers for the action in question
			actionHandlers,

			// The number of unfiltered handlers
			numActionHandlers,

			// Handlers that are applicable to this call
			handlers,

			// The number of cached handlers
			numHandlers,

			// Determines whether to search children for matches
			doSearch,

			// Element iteration index variable
			i = 0,

			// Element iteration item variable
			el,

			// Optimization: cache the jQuery object for the element
			$el,

			// Handler iteration index variable
			j,

			// Handler iteration item variable
			handler;

		if (numEls === 0) {
			return;
		}

		actionHandlers = everHandlers[action];

		// Filter based on source and context
		i = -1;
		numActionHandlers = actionHandlers.length;
		handlers = [];
		while (++i < numActionHandlers) {
			handler = actionHandlers[i];

			// If a handler source is specified then filter by the source
			if (handler.source && handler.source !== source) {
				continue;
			}

			// If a handler context is specified then see if it contains the given container, or equals if children were passed in
			if (handler.context && !((isArr && handler.context === container) || jQuery.contains(handler.context, container))) {
				continue;
			}

			handlers.push(handler);
		}

		numHandlers = handlers.length;

		if (numHandlers === 0) {
			return;
		}

		// Only perform descendent search for added/deleted actions, since this
		// doesn't make sense for bound/unbound, which are specific to an element.
		doSearch = action === "added" || action === "deleted";

		i = -1;
		while (++i < numEls) {
			el = isArr ? els[i] : els;

			// Only process elements
			if (el.nodeType === 1) {
				j = 0;
				$el = jQuery(el);

				while (j < numHandlers) {
					handler = handlers[j++];

					// Test root
					if ($el.is(handler.selector)) {
						handler.action.apply(el, [0, el]);
					}

					if (doSearch && el.children.length > 0) {
						// Test children
						$el.find(handler.selector).each(handler.action);
					}
				}
			}
		}
	};

	var interceptingBound = false;
	var interceptingTemplates = false;
	var interceptingWebForms = false;
	var interceptingToggle = false;
	var interceptingContent = false;
	var partialPageLoadOccurred = false;

	function ensureIntercepting() {
		if (!interceptingBound && window.Sys && Sys.Binding && Sys.UI && Sys.UI.TemplateContext) {
			var addBinding = Sys.Binding.prototype._addBinding;
			if (!addBinding) {
				throw new Error("Could not find Binding._addBinding method to override.");
			}
			Sys.Binding.prototype._addBinding = function addBinding$wrap(element) {
				addBinding.apply(this, arguments);
				var ctx = this._templateContext;
				if (ctx._completed && ctx._completed.length > 0) {
					ctx.add_instantiated(function addBinding$contextInstantiated() {
						processElements(element, element, "bound");
					});
				}
				else {
					processElements(element, element, "bound");
				}
			};
			var disposeBindings = Sys.Binding._disposeBindings;
			if (!disposeBindings) {
				throw new Error("Could not find Binding._disposeBindings method to override.");
			}
			Sys.Binding._disposeBindings = function disposeBindings$wrap() {
				disposeBindings.apply(this, arguments);
				processElements(this, this, "unbound");
			};
			interceptingBound = true;
		}

		if (!interceptingTemplates && window.Sys && Sys.UI && Sys.UI.Template) {
			var instantiateInBase = Sys.UI.Template.prototype.instantiateIn;
			if (!instantiateInBase) {
				throw new Error("Could not find Template.instantiateIn method to override.");
			}
			Sys.UI.Template.prototype.instantiateIn = function instantiateIn$wrap() {
				var context = instantiateInBase.apply(this, arguments);
				if (context.nodes.length > 0) {
					processElements(context.containerElement, context.nodes, "added", "template");
				}
				return context;
			};
			// intercept Sys.UI.DataView._clearContainers called conditionally during dispose() and refresh().
			// dispose is too late because the nodes will have been cleared out.
			Sys.UI.DataView.prototype._clearContainers = function _clearContainers$override(placeholders, start, count) {
				var i, len, nodes, startNode, endNode, context;
				for (i = start || 0, len = count ? (start + count) : this._contexts.length; i < len; i++) {
					context = this._contexts[i];
					nodes = context.nodes;
					if (nodes.length > 0) {
						processElements(context.containerElement, nodes, "deleted", "template");
					}
					if (count) {
						if (!startNode) {
							startNode = nodes[0];
						}
						if (nodes.length > 0) {
							endNode = nodes[nodes.length - 1];
						}
					}
				}
				for (i = 0, len = placeholders.length; i < len; i++) {
					var ph = placeholders[i],
						container = ph ? ph.parentNode : this.get_element();
					if (!count || (startNode && endNode)) {
						this._clearContainer(container, ph, startNode, endNode, true);
					}
				}
				for (i = start || 0, len = count ? (start + count) : this._contexts.length; i < len; i++) {
					var ctx = this._contexts[i];
					ctx.nodes = null;
					ctx.dispose();
				}
			};
			Sys.UI.DataView.prototype._clearContainer = function _clearContainer$override(container, placeholder, startNode, endNode, suppressEvent) {
				var count = placeholder ? placeholder.__msajaxphcount : -1;
				if ((count > -1) && placeholder) placeholder.__msajaxphcount = 0;
				if (count < 0) {
					if (placeholder) {
						container.removeChild(placeholder);
					}
					if (!suppressEvent) {
						if (container.childNodes.length > 0) {
							processElements(container, container.childNodes, "deleted", "template");
						}
					}
					if (!startNode) {
						Sys.Application.disposeElement(container, true);
					}
					var cleared = false;
					if (!startNode) {
						try {
							container.innerHTML = "";
							cleared = true;
						}
						catch (err) { }
					}
					if (!cleared) {
						var child = startNode || container.firstChild, nextChild;
						while (child) {
							nextChild = child === endNode ? null : child.nextSibling;
							Sys.Application.disposeElement(child, false);
							container.removeChild(child);
							child = nextChild;
						}
					}
					if (placeholder) {
						container.appendChild(placeholder);
					}
				}
				else if (count > 0) {
					var i, l, start, children = container.childNodes;
					for (i = 0, l = children.length; i < l; i++) {
						if (children[i] === placeholder) {
							break;
						}
					}
					start = i - count;
					for (i = 0; i < count; i++) {
						var element = children[start];
						processElements(element, element, "deleted", "template");
						Sys.Application.disposeElement(element, false);
						container.removeChild(element);
					}
				}
			};
			interceptingTemplates = true;
		}

		if (!interceptingWebForms && window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
			Sys.WebForms.PageRequestManager.getInstance().add_pageLoading(function PageRequestManager$ever_deleted(sender, evt) {
				partialPageLoadOccurred = true;
				var updating = evt.get_panelsUpdating();
				if (updating.length > 0) {
					processElements(null, updating, "deleted", "updatePanel");
				}
			});
			Sys.WebForms.PageRequestManager.getInstance().add_pageLoaded(function PageRequestManager$ever_added(sender, evt) {
				// Only process elements for update panels that were added if we have actually done a partial update.
				// This is needed so that the "ever" handler is not called twice when a panel is added to the page on first page load.
				if (partialPageLoadOccurred) {
					var created = evt.get_panelsCreated();
					if (created.length > 0) {
						processElements(null, created, "added", "updatePanel");
					}
				}

				var updated = evt.get_panelsUpdated();
				if (updated.length > 0) {
					processElements(null, updated, "added", "updatePanel");
				}
			});
			interceptingWebForms = true;
		}

		if (!interceptingToggle && window.ExoWeb && ExoWeb.UI && ExoWeb.UI.Toggle) {
			var undoRender = ExoWeb.UI.Toggle.prototype.undo_render;
			if (!undoRender) {
				throw new Error("Could not find Toggle.undo_render method to override.");
			}
			ExoWeb.UI.Toggle.prototype.undo_render = function Toggle$undo_render$wrap() {
				var children = this._element.children;
				if (children.length > 0) {
					processElements(this._element, children, "deleted", "template");
				}
				undoRender.apply(this, arguments);
			};
			var toggleDispose = ExoWeb.UI.Toggle.prototype.do_dispose;
			if (!toggleDispose) {
				throw new Error("Could not find Toggle.do_dispose method to override.");
			}
			ExoWeb.UI.Toggle.prototype.do_dispose = function Toggle$do_dispose$wrap() {
				var children = this._element.children;
				if (children.length > 0) {
					processElements(this._element, children, "deleted", "template");
				}
				toggleDispose.apply(this, arguments);
			};
			interceptingToggle = true;
		}

		if (!interceptingContent && window.ExoWeb && ExoWeb.UI && ExoWeb.UI.Content) {
			var _render = ExoWeb.UI.Content.prototype._render;
			if (!_render) {
				throw new Error("Could not find Content._render method to override.");
			}
			ExoWeb.UI.Content.prototype._render = function Content$_render$wrap() {
				if (this._element) {
					var children = this._element.children;
					if (children.length > 0) {
						processElements(this._element, children, "deleted", "template");
					}
				}
				_render.apply(this, arguments);
			};
			interceptingContent = true;
		}
	}

	var rootContext = jQuery("body").context;

	var addEverHandler = function addEverHandler(context, selector, type, source, action) {
		var handlers, i, len, handler, existingHandler, existingFn;
		i = 0;
		handlers = everHandlers[type];
		len = handlers.length;
		while (i < len) {
			existingHandler = handlers[i++];
			if (existingHandler.context === context && existingHandler.source === source && existingHandler.selector === selector) {
				handler = existingHandler;
				break;
			}
		}
		if (!handler) {
			handler = { selector: selector, action: action };
			if (context) {
				handler.context = context;
			}
			handlers.push(handler);
		}
		else if (handler.action.add) {
			handler.action.add(action);
		}
		else {
			existingFn = handler.action;
			if (window.ExoWeb) {
				handler.action = ExoWeb.Functor();
				handler.action.add(existingFn);
				handler.action.add(action);
			}
			else {
				handler.action = function () {
					existingFn.apply(this, arguments);
					action.apply(this, arguments);
				};
			}
		}
	};

	// Matches elements as they are dynamically added to the DOM
	jQuery.fn.ever = function jQuery$ever(opts) {

		// The non-selector context that was passed into this jQuery object
		var queryContext,

			// The selector that was specified on the query
			querySelector = this.selector,

			// The jQuery objects that the action may be immediately performed for
			boundImmediate,
			addedImmediate,

			// The options the will be used to add handlers
			options;

		// Optimization: only make a record of the context if it's not the root context
		if (this.context !== rootContext) {
			queryContext = this.context;
		}

		// Handle legacy form
		if (typeof (opts) === "function") {
			addedImmediate = this;
			options = {
				context: queryContext,
				selector: querySelector,
				added: opts,
				deleted: arguments[1]
			};
		}
			// Use options argument directly
		else {
			options = opts;
			// Detect non-supported options
			if (window.ExoWeb) {
				for (var opt in options) {
					if (options.hasOwnProperty(opt) && !/^(selector|source|added|deleted|bound|unbound)$/.test(opt)) {
						logWarning("Unexpected option \"" + opt + "\"");
					}
				}
			}
			// Set the context if it was specified
			if (queryContext) {
				options.context = queryContext;
			}
			// Filter the immediate object if it will be used to invoke immediately (added/bound)
			if (options.added) {
				addedImmediate = this;
				if (options.selector) {
					addedImmediate = addedImmediate.find(options.selector);
				}
			}
			if (options.bound) {
				boundImmediate = this;
				if (options.selector) {
					boundImmediate = boundImmediate.find(options.selector);
				}
				boundImmediate = boundImmediate.filter(":bound");
			}
			// Merge the query selector with the options selector
			if (querySelector) {
				if (options.selector) {
					options.selector = querySelector.replace(/,/g, " " + options.selector + ",") + " " + options.selector;
				}
				else {
					options.selector = querySelector;
				}
			}
			else if (!options.selector) {
				throw new Error("Ever requires a selector");
			}
			if (window.ExoWeb && options.source) {
				if (!(options.added || options.deleted)) {
					logWarning("The source option only applies to added and deleted handlers");
				}
				if (options.source !== "template" && options.source !== "updatePanel") {
					logWarning("Unexpected source \"" + options.source + "\"");
				}
			}
		}

		// Add ever handlers
		if (options.added) {
			if (addedImmediate.length > 0) {
				addedImmediate.each(options.added);
			}
			addEverHandler(options.context, options.selector, "added", options.source, options.added);
		}
		if (options.deleted) {
			addEverHandler(options.context, options.selector, "deleted", options.source, options.deleted);
		}
		if (options.bound) {
			if (boundImmediate.length > 0) {
				boundImmediate.each(options.bound);
			}
			addEverHandler(options.context, options.selector, "bound", options.source, options.bound);
		}
		if (options.unbound) {
			addEverHandler(options.context, options.selector, "unbound", options.source, options.unbound);
		}

		// Ensure that code is being overriden to call ever handlers where appropriate
		ensureIntercepting();

		// Really shouldn't chain calls b/c only elements currently in the DOM would be affected
		return null;
	};

	// #endregion

	// #region ExoWeb.DotNet.WebService
	//////////////////////////////////////////////////

	var webServiceConfig = {
		/*
		 * Specify the application's root URL. Otherwise it is assumed that
		 * the root is the URL up to the first forward slash '/'.
		 */
		appRoot: null,

		/*
		 * If set to true, when requests are sent they will use the text "Save", "Roundtrip", or the
		 * specific method name as an alias for "Request".  If the method name would collide with
		 * another procedure ("GetType" or "LogError"), then "Request" will be used instead.
		 */
		aliasRequests: false
	};

	ExoWeb.DotNet.config = webServiceConfig;

	var path = window.location.pathname;
	var idx = path.lastIndexOf("/");

	if (idx > 0 && idx < path.length - 1) {
		path = path.substring(0, idx + 1);
	}
	else if (idx === 0 && path.length > 1) {
		path += "/";
	}

	var fmt = window.location.port ? "{0}//{1}:{2}" : "{0}//{1}";
	var host = $format(fmt, window.location.protocol, window.location.hostname, window.location.port);

	function getPath() {
		return host + (webServiceConfig.appRoot || path) + "ExoWeb.axd";
	}

	function sendRequest(options) {
		// Include config data in request
		options.data.config = webServiceConfig;

		jQuery.ajax({
			url: getPath() + "/" + options.path,
			type: options.type,
			data: JSON.stringify(options.data),
			processData: false,
			dataType: "text",
			contentType: "application/json",
			success: function(result) {
				options.onSuccess(JSON.parse(result));
			},
			error: function(result) {
				var error = { message: result.statusText };
				try
				{
					error = JSON.parse(result.responseText);
				}
				catch(e) {}
				options.onFailure(error);
			}
		});
	}

	ExoWeb.Mapper.setEventProvider(function (eventType, eventInstance, event, paths, changes, scopeQueries, onSuccess, onFailure) {
		sendRequest({
			type: "Post",
			path: webServiceConfig.aliasRequests && eventType !== "GetType" && eventType !== "LogError" ? eventType : "Request",
			data: {
				events: [{ type: eventType, include: paths, instance: eventInstance, event: event }],
				queries: scopeQueries,
				changes: changes
			},
			onSuccess: onSuccess,
			onFailure: onFailure
		});
	});

	ExoWeb.Mapper.setRoundtripProvider(function (root, paths, changes, scopeQueries, onSuccess, onFailure) {
		var queries = [];

		if (root) {
			queries.push({
				from: root.type,
				ids: [root.id],
				include: paths,
				inScope: true,
				forLoad: true
			});
		}

		queries.addRange(scopeQueries);

		sendRequest({
			type: "Post",
			path: webServiceConfig.aliasRequests ? "Roundtrip" : "Request",
			data: {
				changes: changes,
				queries: queries
			},
			onSuccess: onSuccess,
			onFailure: onFailure
		});
	});

	ExoWeb.Mapper.setObjectProvider(function (type, ids, paths, inScope, changes, scopeQueries, onSuccess, onFailure) {
		sendRequest({
			type: "Post",
			path: webServiceConfig.aliasRequests ? "LoadObject" : "Request",
			data: {
				queries:[{
					from: type,
					ids: ids,
					include: paths,
					inScope: inScope,
					forLoad: true
				}].concat(scopeQueries),
				changes:changes
			},
			onSuccess: onSuccess,
			onFailure: onFailure
		});
	});

	ExoWeb.Mapper.setQueryProvider(function (queries, changes, scopeQueries, onSuccess, onFailure) {
		sendRequest({
			type: "Post",
			path: webServiceConfig.aliasRequests ? "Query" : "Request",
			data: {
				changes: changes,
				queries: queries.concat(scopeQueries)
			},
			onSuccess: onSuccess,
			onFailure: onFailure
		});
	});

	ExoWeb.Mapper.setSaveProvider(function (root, changes, scopeQueries, onSuccess, onFailure) {
		sendRequest({
			type: "Post",
			path: webServiceConfig.aliasRequests ? "Save" : "Request",
			data: {
				events:[{type: "Save", instance: root}],
				queries: scopeQueries,
				changes:changes
			},
			onSuccess: onSuccess,
			onFailure: onFailure
		});
	});

	ExoWeb.Mapper.setListProvider(function (ownerType, ownerId, paths, changes, scopeQueries, onSuccess, onFailure) {
		sendRequest({
			type: "Post",
			path: webServiceConfig.aliasRequests ? "LoadList" : "Request",
			data: {
				queries: [{
					from: ownerType,
					ids: ownerId === null ? [] : [ownerId],
					include: paths,
					inScope: false,
					forLoad: true
				}].concat(scopeQueries),
				changes: changes
			},
			onSuccess: onSuccess,
			onFailure: onFailure
		});
	});

	ExoWeb.Mapper.setTypeProvider(function (types, onSuccess, onFailure) {
		if (types.length === 1) {
			var data = { type: types[0], config: webServiceConfig};

			if (ExoWeb.cacheHash) {
				data.cachehash = ExoWeb.cacheHash;
			}

			Sys.Net.WebServiceProxy.invoke(getPath(), "GetType", true, data, onSuccess, onFailure, null, 1000000, false, null);
		}
		else {
			sendRequest({
				type: "Post",
				path: webServiceConfig.aliasRequests ? "GetTypes" : "Request",
				data: { types: types },
				onSuccess: onSuccess,
				onFailure: onFailure
			});
		}
	});

	var loggingError = false;
	ExoWeb.setLogErrorProvider(function (errorData, onSuccess, onFailure) {
		if (loggingError === false) {
			try {
				loggingError = true;
				Sys.Net.WebServiceProxy.invoke(
					getPath(),
					"LogError",
					false,
					errorData,
					function () {
						if (onSuccess) {
							onSuccess.apply(this, arguments);
						}
					},
					function () {
						// Don't log errors that occur when trying to log an error.
						if (onFailure) {
							onFailure.apply(this, arguments);
						}
					},
					null,
					1000000,
					false,
					null
				);
			} finally {
				loggingError = false;
			}
		}
	});

	// #endregion

	// #region FormatProvider
	//////////////////////////////////////////////////

	setFormatProvider(function FormatProvider(type, format) {

		// Date
		if (type === Date) {
			// Add support for g and G that are not natively supported by the MSAJAX framework
			if (format === "g")
				format = Date._expandFormat(Sys.CultureInfo.CurrentCulture.dateTimeFormat, "d") + " " + Date._expandFormat(Sys.CultureInfo.CurrentCulture.dateTimeFormat, "t");
			else if (format === "G")
				format = Date._expandFormat(Sys.CultureInfo.CurrentCulture.dateTimeFormat, "d") + " " + Date._expandFormat(Sys.CultureInfo.CurrentCulture.dateTimeFormat, "T");

			return new Format({
				description: "",
				specifier: format,
				convert: function (val) {
					return val.localeFormat(format);
				},
				convertBack: function (str) {
					var date;
					// Time value, set default date to 1/1/1970 to easily compare time values
					if (format === "t") {
						var timeFormat = Date._expandFormat(Sys.CultureInfo.CurrentCulture.dateTimeFormat, "d") + " " + Date._expandFormat(Sys.CultureInfo.CurrentCulture.dateTimeFormat, "t");
						var startDate = new Date(1970, 0, 1).localeFormat("d");
						date = Date.parseLocale(startDate + " " + str, timeFormat);
					}
					else
						date = Date.parseLocale(str, format);

					if (date === null)
						throw new Error("Invalid date format");
					return date;
				}
			});
		}

		// Number
		if (type === Number) {
			var isCurrencyFormat = format.match(/[$c]+/i);
			var isPercentageFormat = format.match(/[%p]+/i);
			var isIntegerFormat = format.match(/[dnfg]0/i);
			var currencyDecimalDigits = Sys.CultureInfo.CurrentCulture.numberFormat.CurrencyDecimalDigits;

			return new Format({
				description: isCurrencyFormat ? Resource["format-currency"] : isPercentageFormat ? Resource["format-percentage"] : isIntegerFormat ? Resource["format-integer"] : Resource["format-decimal"],
				specifier: format,
				convert: function (val) {
					// Default to browser formatting for general format
					if (format.toLowerCase() === "g")
						return val.toString();

					// Otherwise, use the localized format
					return val.localeFormat(format);
				},
				convertBack: function (str) {
					// Handle use of () to denote negative numbers
					var sign = 1;
					if (str.match(/^\(.*\)$/)) {
						str = str.substring(1, str.length - 1);
						sign = -1;
					}
					var result;

					// Remove currency symbols before parsing
					if (isCurrencyFormat) {
						result = Number.parseLocale(str.replace(Sys.CultureInfo.CurrentCulture.numberFormat.CurrencySymbol, "")) * sign;

						// if there is a decimal place, check the precision isnt greater than allowed for currency. 
						// Floating points in js can be skewed under certain circumstances, we are just checking the decimals instead of multiplying results.
						var resultStr = result.toString();
						if (resultStr.indexOf('.') > -1 && (resultStr.length - (resultStr.indexOf('.') + 1)) > currencyDecimalDigits) {
							result = NaN;
						}
					}
						// Remove percentage symbols before parsing and divide by 100
					else if (isPercentageFormat)
						result = Number.parseLocale(str.replace(Sys.CultureInfo.CurrentCulture.numberFormat.PercentSymbol, "")) / 100 * sign;

						// Ensure integers are actual whole numbers
					else if (isIntegerFormat && !isInteger(Number.parseLocale(str)))
						result = NaN;

						// Just parse a simple number
					else
						result = Number.parseLocale(str) * sign;

					if (isNaN(result))
						throw new Error("Invalid format");

					return result;
				}
			});
		}

		// Boolean
		if (type === Boolean) {
			// Format strings used for true, false, and null (or undefined) values
			var trueFormat, falseFormat, nullFormat;

			if (format && format.toLowerCase() === "g") {
				trueFormat = "True";
				falseFormat = "False";
				nullFormat = ""
			}
			else {
				var formats = format.split(';');
				trueFormat = formats.length > 0 ? formats[0] : "";
				falseFormat = formats.length > 1 ? formats[1] : "";
				nullFormat = formats.length > 2 ? formats[2] : "";
			}

			return new Format({
				description: "",
				specifier: format,
				convert: function (val) {
					if (val === true)
						return trueFormat;
					else if (val === false)
						return falseFormat;
					else
						return nullFormat;
				},
				convertBack: function (str) {
					if (str.toLowerCase() === trueFormat.toLowerCase())
						return true;
					else if (str.toLowerCase() === falseFormat.toLowerCase())
						return false;
					else
						return null;
				}
			});
		}

		// Default
		return new Format({
			description: "",
			specifier: "",
			convert: function (val) {
				return val.toString();
			},
			convertBack: function (str) {
				return str;
			}
		});

	});

	// #endregion

	// #region ObserverProvider
	//////////////////////////////////////////////////

	function raiseSpecificPropertyChanged(target, args) {
		var func = target.__propertyChangeHandlers[args.get_propertyName()];
		if (func && func instanceof Function) {
			func.apply(this, arguments);
		}
	}

	setObserverProvider({

		makeObservable: Sys.Observer.makeObservable,

		disposeObservable: Sys.Observer.disposeObservable,

		addCollectionChanged: Sys.Observer.addCollectionChanged,

		removeCollectionChanged: Sys.Observer.removeCollectionChanged,

		addPropertyChanged: function Sys$Observer$addPropertyChanged(target, property, handler) {
			if (!target.__propertyChangeHandlers) {
				target.__propertyChangeHandlers = {};
				Sys.Observer.addPropertyChanged(target, raiseSpecificPropertyChanged);
			}

			var func = target.__propertyChangeHandlers[property];

			if (!func) {
				target.__propertyChangeHandlers[property] = func = ExoWeb.Functor();
			}

			func.add(handler);
		},

		removePropertyChanged: function Sys$Observer$removePropertyChanged(target, property, handler) {
			var func = target.__propertyChangeHandlers ? target.__propertyChangeHandlers[property] : null;

			if (func) {
				func.remove(handler);

				// if the functor is empty then remove the callback as an optimization
				if (func.isEmpty()) {
					delete target.__propertyChangeHandlers[property];

					var hasHandlers = false;
					for (var remainingHandler in target.__propertyChangeHandlers) {
						if (target.__propertyChangeHandlers.hasOwnProperty(remainingHandler)) {
							hasHandlers = true;
						}
					}

					if (!hasHandlers) {
						target.__propertyChangeHandlers = null;
						Sys.Observer.removePropertyChanged(target, raiseSpecificPropertyChanged);
					}
				}
			}
		},

		raisePropertyChanged: Sys.Observer.raisePropertyChanged,

		setValue: Sys.Observer.setValue
	});

	ExoWeb.updateArray = function updateArray(array, items) {
		if (array.beginUpdate && array.endUpdate) {
			array.beginUpdate();
		}
		update(array, items);
		if (array.beginUpdate && array.endUpdate) {
			array.endUpdate();
		}
	};

	// #endregion
})(window.ExoJQuery || jQuery);
