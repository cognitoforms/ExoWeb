var errorHandler = function noOpErrorHandler(message, e) { };
function setErrorHandler(fn) {
	errorHandler = fn;
}
ExoWeb.setErrorHandler = setErrorHandler;

ExoWeb.config = {
	 signalTimeout: false,
	 signalDebug: false,
	 aggressiveLog: false,
	 useChangeSets: false
}

ExoWeb.trace = {
	// The following flags can be turned on to see debugging info.
	// Rather than editing the code below, set them in your application's page
	flags: {
		all: false,
		batch: false,
		signal: false,
		typeInit: false,
		objectInit: false,
		propInit: false,
		listInit: false,
		lazyLoad: false,
		markupExt: false,
		"~": false,
		"@": false,
		context: false,
		tests: false,
		mocks: false,
		server: false,
		ui: false,
		templates: false,
		rule: false,
		model: false,
		conditions: false
	},
	_isEnabled: function _isEnabled(category) {
		if (ExoWeb.trace.flags.all) {
			return true;
		}

		if (category instanceof Array) {
			for (var i = 0; i < category.length; ++i) {
				if (ExoWeb.trace.flags[category[i]]) {
					return true;
				}
			}
			return false;
		}
		else {
			return !!ExoWeb.trace.flags[category];
		}
	},
	_formatMessage: function _formatMessage(category, message, args) {
		if (!(category instanceof Array)) {
			category = [category];
		}

		var catStr = category.join(", ");

		return "[" + catStr + "]: " + $format(message, args);
	},
	log: function trace$log(category, message, args) {
		if (typeof (console) === "undefined") {
			return;
		}

		if (ExoWeb.trace._isEnabled(category)) {
			console.log(ExoWeb.trace._formatMessage(category, message, args));
		}
	},
	logWarning: function trace$logWarning(category, message, args) {
		// append the warning category
		if (!(category instanceof Array)) {
			category = [category, "warning"];
		}
		else {
			category.push("warning");
		}

		// if the console is defined then log the message
		if (typeof (console) !== "undefined") {
			console.warn(ExoWeb.trace._formatMessage(category, message, args));
		}
	},
	logError: function trace$logError(category, message, args) {
		// append the error category
		if (!(category instanceof Array)) {
			category = [category, "error"];
		}
		else {
			category.push("error");
		}

		// format the message text
		var msg = ExoWeb.trace._formatMessage(category, message, args);

		// handle the error
		errorHandler(msg, message instanceof Error ? message : null);

		// if the console is defined then log the message
		if (typeof (console) !== "undefined") {
			console.error(msg);
		}
	},
	throwAndLog: function trace$throwAndLog(category, message, args) {
		ExoWeb.trace.logError(category, message, args);

		throw $format(message, args);
	},
	getCallStack: function getCallStack() {
		var result = [];

		// process the callees until the end of the stack or until the depth limit is reached
		for (var f = arguments.callee, depth = 0, _f = null; f && depth < 25; _f = f, f = f.arguments.callee.caller, depth++) {

			// format the function name and arguments
			var name = parseFunctionName(f);
			var args = Array.prototype.slice.call(f.arguments).map(function formatArg(arg) {
				try {
					if (arg === undefined) {
						return "undefined";
					}
					else if (arg === null) {
						return "null";
					}
					else if (arg instanceof Array) {
						return "[" + arg.map(arguments.callee).join(", ") + "]";
					}
					else if (arg instanceof Function) {
						return parseFunctionName(arg) + "()";
					}
					else if (arg.constructor === String) {
						return "\"" + arg + "\"";
					}
					else {
						var fmt = arg.constructor && arg.constructor.formats && arg.constructor.formats.$system;
						return fmt ? fmt.convert(arg) : (arg.toString ? arg.toString() : "~unknown");
					}
				}
				catch (e) {
					return "ERROR (" + parseFunctionName(arg.constructor) + "): " + e.toString();
				}
			}).join(", ");

			// append the new item
			result.push(name + "(" + args + ")");

			// Calling a function recursively will prevent this loop from terminating since arguments.callee.caller
			// will always refer to the current function.  This is because the property path arguments.callee.caller
			// is attached to the function definition rather than the function "activation object".  Allow the call
			// line to be written again to suggest the reason that the call stack could not be inspected further.
			// see http://bytes.com/topic/javascript/answers/470251-recursive-functions-arguments-callee-caller
			if (_f !== null & _f === f) {
				result.push("non-terminating loop detected...");
				break;
			}
		}

		return result;
	}
};

var funcRegex = /function\s*([\w_\$]*)/i;
function parseFunctionName(f) {
	var result = funcRegex.exec(f);
	return result ? (result[1] || "{anonymous}") : "{anonymous}";
}
ExoWeb.parseFunctionName = parseFunctionName;

var log = ExoWeb.trace.log;
var logError = ExoWeb.trace.logError;
var throwAndLog = ExoWeb.trace.throwAndLog;
