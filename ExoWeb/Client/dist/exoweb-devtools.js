/*globals window, console, ExoWeb, $format */

(function (exports) {
	"use strict";

	var currentNestedActivity = null,
		loggerCache = {},
		defaultLogger = null,
		defaultOptions = {
			prefix: null,
			timestamp: true
		};

	function beginNestedActivity() {
		var act = {
			parent: currentNestedActivity,
			depth: currentNestedActivity ? currentNestedActivity.depth + 1 : 0,
			started: new Date(),
			isActive: true,
			end: function () {
				this.ended = new Date();
				if (currentNestedActivity !== this) {
					if (window.console) {
						console.warn("improper nesting?");
					}
				} else {
					currentNestedActivity = this.parent;
				}
			}
		};

		currentNestedActivity = act;

		return act;
	}

	function elemToString(elem) {
		var str = $format("<{0}", elem.tagName.toLowerCase());
		if (elem.id) {
			str += $format(" id=\"{0}\"", elem.id);
		}
		if (elem.className) {
			str += $format(" class=\"{0}\"", elem.className);
		}
		return str + " />";
	}

	function expandText(str, num) {
		var i, result = "";
		for (i = 0; i < num; i += 1) {
			result += str;
		}
		return result;
	}

	function writeToConsole(message, level) {
		if (window.console) {
			if (level === "warn" && console.warn) {
				console.warn(message);
			} else {
				console.log(message);
			}
		}
	}

	function createLogger(name, customOptions) {
		if (loggerCache.hasOwnProperty(name)) {
			throw new Error("The \"" + name + "\" logger has already been created.");
		}

		if (name in loggerCache) {
			throw new Error("The text \"" + name + "\" is not an allowed logger name because it conflicts with a native property.");
		}

		var enabled = customOptions && customOptions.autoEnable,
			logger = {
				enable: function () {
					enabled = true;
				},
				disable: function () {
					enabled = false;
				},
				write: function (ts, padding, msg) {

					if (!enabled) {
						return;
					}

					var formatArgs,
						toString = Object.prototype.toString,
						tsArgType = toString.call(ts),
						paddingArgType = toString.call(padding),
						msgArgType = toString.call(msg),
						options = customOptions || defaultOptions,
						messageText;

					if (tsArgType === "[object Date]") {
						if (options.timestamp !== true) {
							throw new Error("A timestamp was passed to 'write()', but the \"" + name + "\" logger is not configured to use a timestamp.");
						}
						if (paddingArgType === "[object Number]") {
							if (msgArgType === "[object String]") {
								formatArgs = Array.prototype.slice.call(arguments, 3);
							} else {
								throw new ArgumentError("msg", "expected type String but found " + msgArgType);
							}
						} else if (paddingArgType === "[object String]") {
							formatArgs = Array.prototype.slice.call(arguments, 2);
							msg = padding;
							padding = 0;
						} else {
							throw new ArgumentError("padding", "expected type Number|String but found " + paddingArgType);
						}
					} else if (tsArgType === "[object Number]") {
						if (paddingArgType === "[object String]") {
							formatArgs = Array.prototype.slice.call(arguments, 2);
							msg = padding;
							padding = ts;
							ts = new Date();
						} else {
							throw new ArgumentError("padding", "expected type Number|String but found " + paddingArgType);
						}
					} else if (tsArgType === "[object String]") {
						formatArgs = Array.prototype.slice.call(arguments, 1);
						msg = ts;
						ts = new Date();
						padding = 0;
					} else {
						throw new ArgumentError("ts", "expected type Date|Number|String but found " + tsArgType);
					}

					formatArgs = formatArgs.map(function (a) {
						return a && window.Sys && Sys.UI.DomElement.isDomElement(a) ? elemToString(a) : a;
					});

					messageText = (options.timestamp === true ? "[" + (ts.localeFormat ? ts.localeFormat("h:mm:ss.fff") : ts) + "] " : "") +    // timestamp
						expandText("  ", padding) +                                                                    // padding
						(options.prefix === null || options.prefix === undefined ? "" : options.prefix + ": ") +       // message prefix
						$format(msg, formatArgs);                                                                      // message text

					writeToConsole(messageText, options.level || "log");

				}
			};

		loggerCache[name] = logger;
		return logger;
	}

	function trace(funPath, options) {
		if (!funPath || !funPath.length) {
			throw new Error("Cannot trace path " + funPath + ".");
		}

		// split the path into tokens
		var tokens = funPath.split("."),

			// the object that contains the function to trace, initially the global window object
			source = window,

			// the name of the function to trace
			funName,

			// the function object to trace
			fun;

		tokens.forEach(function (token, index) {
			if (index === tokens.length - 1) {
				funName = token;
			} else {
				source = source[token];
			}
		});

		if (defaultLogger === null) {
			defaultLogger = createLogger(ExoWeb.randomText(8));
		}

		fun = source[funName];
		source[funName] = function () {
			if (!options || !options.filter || options.filter.apply(this, arguments) === true) {
				var act = beginNestedActivity();
				defaultLogger.write("Trace", act.started, act.depth, options && options.message ? options.message.apply(this, arguments) : funPath);
				try {
					return fun.apply(this, arguments);
				} finally {
					act.end();
				}
			} else {
				return fun.apply(this, arguments);
			}
		};
	}

	function typeName(obj) {
		var objType;
		if (obj === null) {
			objType = "null";
		} else if (obj === undefined) {
			objType = "undefined";
		} else if (obj instanceof ExoWeb.Model.Entity) {
			objType = obj.meta.type.get_fullName();
		} else if (obj instanceof ExoWeb.View.Adapter) {
			objType = "Adapter(" + typeName(obj.get_target()) + ")";
		} else if (obj instanceof ExoWeb.View.OptionAdapter) {
			objType = "OptionAdapter(" + typeName(obj.get_parent().get_target()) + ")";
		} else if (obj instanceof ExoWeb.View.OptionGroupAdapter) {
			objType = "OptionGroupAdapter(" + typeName(obj.get_parent().get_target()) + ")";
		} else {
			objType = ExoWeb.type(obj);
		}
		return objType;
	}

	function getBindingDescription(binding) {
		var source = typeName(binding.get_source()),
			path = binding.get_path();

		if (binding.get_source() instanceof ExoWeb.View.Adapter) {
			path += "(" + binding.get_source().get_propertyPath() + ")";
		}

		return source + "." + path;
	}

	exports.elemToString = elemToString;

	exports.trace = trace;

	exports.typeName = typeName;

	exports.getBindingDescription = getBindingDescription;

	exports.createLogger = createLogger;

	exports.message = function () {
		if (window.console) {
			var warning = "The method 'ExoWeb.Tools.message' is obsolete. Use 'ExoWeb.Tools.createLogger' instead.";
			if (console.warn) {
				console.warn(warning);
			} else {
				console.log("WARNING: " + warning);
			}
		}

		if (defaultLogger === null) {
			defaultLogger = createLogger(ExoWeb.randomText(8));
		}

		defaultLogger.write.apply(defaultLogger, arguments);
	};

}(ExoWeb.Tools = {}));
