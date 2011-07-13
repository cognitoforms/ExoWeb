Type.registerNamespace("ExoWeb");
Type.registerNamespace("ExoWeb.Model");
Type.registerNamespace("ExoWeb.Mapper");

(function() {

	// #region Function
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

	Function.prototype.mixin = function mixin(methods, object) {
		if (!object) {
			object = this.prototype;
		}

		for (var m in methods) {
			if (methods.hasOwnProperty(m))
				object[m] = methods[m];
		}

		// IE's "in" operator doesn't return keys for native properties on the Object prototype
		overridableNonEnumeratedMethods.forEach(function (m) {
			if (methods.hasOwnProperty(m))
				object[m] = methods[m];
		});
	};

	Function.prototype.dontDoubleUp = function Function$dontDoubleUp(options) {
		var proceed = this;
		var calls = [];

		return function dontDoubleUp() {
			// is the function already being called with the same arguments?

			var origCallback;
			var origThisPtr;

			if (options.callbackArg < arguments.length) {
				origCallback = arguments[options.callbackArg];
			}

			if (options.thisPtrArg < arguments.length) {
				origThisPtr = arguments[options.thisPtrArg];
			}

			// determine what values to use to group callers
			var groupBy;

			if (options.groupBy) {
				groupBy = options.groupBy.apply(this, arguments);
			}
			else {
				groupBy = [this];
				for (var i = 0; i < arguments.length; ++i) {
					if (i !== options.callbackArg && i !== options.thisPtrArg) {
						groupBy.push(arguments[i]);
					}
				}
			}

			// is this call already in progress?
			var callInProgress, call;

			for (var c = 0; !callInProgress && c < calls.length; ++c) {
				call = calls[c];

				// TODO: handle optional params better
				if (groupBy.length != call.groupBy.length) {
					continue;
				}

				callInProgress = call;
				for (var j = 0; j < groupBy.length; ++j) {
					if (groupBy[j] !== call.groupBy[j]) {
						callInProgress = null;
						break;
					}
				}
			}

			if (!callInProgress) {
				// track the next call that is about to be made
				call = { callback: Functor(), groupBy: groupBy };
				calls.push(call);

				// make sure the original callback is invoked and that cleanup occurs
				call.callback.add(function() {
					Array.remove(calls, call);
					if (origCallback) {
						origCallback.apply(origThisPtr || this, arguments);
					}
				});

				// pass the new callback to the inner function
				var args = Array.prototype.slice.call(arguments);
				args[options.callbackArg] = call.callback;
				proceed.apply(this, args);
			}
			else if (origCallback) {
				// wait for the original call to complete
				var batch = Batch.suspendCurrent("dontDoubleUp");
				callInProgress.callback.add(function() {
					ExoWeb.Batch.resume(batch);
					origCallback.apply(origThisPtr || this, arguments);
				});
			}
		};
	};

	Function.prototype.cached = function Function$cached(options) {
		var proceed = this;
		var cache = {};

		return function cached() {
			var key = options.key.apply(this, arguments);

			var result = cache[key];

			if (result === undefined) {
				result = proceed.apply(this, arguments);
				cache[key] = result;
			}

			return result;
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
			args.addRange(additional);
			args.addRange(Array.prototype.slice.call(arguments));
			return func.apply(this, args);
		};
	};

	Function.prototype.appendArguments = function appendArguments(/* arg1, arg2, ... */) {
		var func = this;
		var additional = Array.prototype.slice.call(arguments);
		return function appendArguments$fn() {
			var args = Array.prototype.slice.call(arguments);
			args.addRange(additional);
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

				if (!callback || !(callback instanceof Function))
					ExoWeb.trace.throwAndLog("functions",
						"Unable to merge async functions: the argument at index {0}{1} is not a function.",
						[idx, options.callbackIndex ? "" : " (default)"]);

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

	// #endregion

	// #region Array
	//////////////////////////////////////////////////

	function assertArrayArg(arr, functionName) {
		if (!(arr instanceof Array))
			throw new TypeError("An array must be passed to \"" + functionName + "\".");
	}

	function assertFunctionArg(fun, allowNull, functionName) {
		if (allowNull.constructor !== Boolean) {
			functionName = allowNull;
			allowNull = false;
		}

		if (allowNull && (fun === null || fun === undefined))
			return;

		if (!(fun instanceof Function))
			throw new TypeError("A callback function must be passed to \"" + functionName + "\".");
	}

	function addRange(arr, items) {
		assertArrayArg(arr, "addRange");
		assertArrayArg(items, "addRange");

		Array.prototype.push.apply(arr, items);
	}

	function contains(arr, elt, from) {
		assertArrayArg(arr, "contains");
		return arr.indexOf(elt, from) > -1 ? true : false;
	}

	// Filters out duplicate items from the given array.
	/////////////////////////////////////////////////////
	function distinct(arr) {
		assertArrayArg(arr, "distinct");

		var result = [];

		for(var i = 0, len = arr.length; i < len; i++)
			if (result.indexOf(arr[i]) < 0)
				result.push(arr[i]);

		return result;
	}

	function every(arr, callback, thisPtr) {
		assertArrayArg(arr, "every");
		assertFunctionArg(callback, "every");

		for (var i = 0, len = arr.length; i < len; i++)
			if (i in arr && !callback.call(thisPtr || this, arr[i], i, arr))
				return false;

		return true;
	}

	function fill(arr, value, times) {
		for (var i = 0; i < times; i++)
			arr.push(value);
		return arr;
	}

	function filter(arr, callback, thisPtr) {
		assertArrayArg(arr, "filter");
		assertFunctionArg(callback, "filter");

		var result = [];
		for (var i = 0, len = arr.length; i < len; i++) {
			if (i in arr) {
				var val = arr[i]; // callback may mutate original item
				if (callback.call(thisPtr || this, val, i, arr) === true)
					result.push(val);
			}
		}

		return result;
	}

	function first(arr, callback, thisPtr) {
		assertArrayArg(arr, "first");
		assertFunctionArg(callback, true, "first");

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

	function forEach(arr, callback, thisPtr) {
		assertArrayArg(arr, "forEach");
		assertFunctionArg(callback, "forEach");

		for (var i = 0, len = arr.length; i < len; i++)
			if (i in arr)
				callback.call(thisPtr || this, arr[i], i, arr);
	}

	function indexOf(arr, elt, from) {
		assertArrayArg(arr, "indexOf");
		var len = arr.length;
		from = Number(from) || 0;
		from = (from < 0) ? Math.ceil(from) : Math.floor(from);
		if (from < 0) from += len;

		for (; from < len; from++)
			if (from in arr && arr[from] === elt)
				return from;

		return -1;
	}

	// Finds the set intersection of the two given arrays.  The items
	// in the resulting list are distinct and in no particular order.
	///////////////////////////////////////////////////////////////////
	function intersect(arr1, arr2) {
		return distinct(filter(arr1, function(item) {
			return arr2.indexOf(item) >= 0;
		}));
	}

	function lastIndexOf(arr, item, from) {
		assertArrayArg(arr, "lastIndexOf");

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
			if (k in t && t[k] === searchElement)
				return k;

		return -1;
	}

	function map(arr, callback, thisPtr) {
		assertArrayArg(arr, "map");
		assertFunctionArg(callback, "map");

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

	function peek(arr) {
		var peekVal = arr.pop();
		arr.push(peekVal);
		return peekVal;
	}

	function purge(arr, callback, thisPtr) {
		assertArrayArg(arr, "purge");
		assertFunctionArg(callback, "purge");

		var result;

		for (var i = 0; i < arr.length; i++) {
			if (callback.call(thisPtr || this, arr[i], i, arr) === true) {
				// Invoke removeAt method if it exists.
				if (arr.removeAt)
					arr.removeAt(i);
				else
					arr.splice(i, 1);

				// Lazy create array and add index (accounting for previously removed).
				if (!result) result = [];
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

	function some(arr, callback, thisPtr) {
		assertArrayArg(arr, "some");
		assertFunctionArg(callback, true, "some");

		for (var i = 0, len = arr.length; i < len; i++)
			if (i in arr && callback.call(thisPtr || this, arr[i], i, arr))
				return true;

		return false;
	}

	if (!Array.prototype.addRange)
		Array.prototype.addRange = function(items) { addRange(this, items); };
	if (!Array.prototype.copy)
		Array.prototype.copy = function() { return Array.prototype.splice.apply([], [0, 0].concat(this)); };
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
	if (!Array.prototype.first)
		Array.prototype.first = function(fun/*, thisp */) { return first(this, fun, arguments[1]); };
	if (!Array.prototype.forEach)
		Array.prototype.forEach = function(fun /*, thisp*/) { forEach(this, fun, arguments[1]); };
	if (!Array.prototype.indexOf)
		Array.prototype.indexOf = function(elt/*, from*/) { return indexOf(this, elt, arguments[1]); };
	if (!Array.prototype.intersect)
		Array.prototype.intersect = function(items) { return intersect(this, items); };
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
	if (!Array.prototype.some)
		Array.prototype.some = function(fun /*, thisp*/) { return some(this, fun, arguments[1]); };


	// #endregion

	// #region String
	//////////////////////////////////////////////////

	if (!String.prototype.endsWith) {
		String.prototype.endsWith = function endsWith(text) {
			return this.length === (this.indexOf(text) + text.length);
		};
	}

	function isNullOrEmpty(str) {
		return str === null || str === undefined || str === "";
	}

	// #endregion

	// #region Trace
	//////////////////////////////////////////////////

	var errorHandler = function noOpErrorHandler(message, e) { };
	function setErrorHandler(fn) {
		errorHandler = fn;
	}
	ExoWeb.setErrorHandler = setErrorHandler;

	ExoWeb.config = {
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
			conditions: false,
			responseHandler: false
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
		_formatMessage: function _formatMessage(category, message, args/*, ...*/) {
			if (!(category instanceof Array)) {
				category = [category];
			}

			var catStr = category.join(", ");

			var formatArgs = Array.prototype.slice.call(arguments, 1);
			return "[" + catStr + "]: " + $format.apply(null, formatArgs);
		},
		log: function trace$log(category, message, args) {
			if (typeof (console) === "undefined") {
				return;
			}

			if (ExoWeb.trace._isEnabled(category)) {
				console.log(ExoWeb.trace._formatMessage.apply(this, arguments));
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
				console.warn(ExoWeb.trace._formatMessage.apply(this, arguments));
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
			var msg = ExoWeb.trace._formatMessage.apply(this, arguments);

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
				var args = Array.prototype.slice.call(f.arguments).map(formatArgument).join(", ");

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

	function formatArgument(arg) {
		try {
			if (arg === undefined) {
				return "undefined";
			}
			else if (arg === null) {
				return "null";
			}
			else if (arg instanceof Array) {
				return "[" + arg.map(formatArgument).join(", ") + "]";
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
	}

	var funcRegex = /function\s*([\w_\$]*)/i;
	function parseFunctionName(f) {
		var result = funcRegex.exec(f);
		return result ? (result[1] || "{anonymous}") : "{anonymous}";
	}
	ExoWeb.parseFunctionName = parseFunctionName;

	var log = ExoWeb.trace.log;
	var logError = ExoWeb.trace.logError;
	var throwAndLog = ExoWeb.trace.throwAndLog;

	// #endregion

	// #region Cache
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

	// Setup Caching
	if (window.localStorage) {

		// Cache
		ExoWeb.cache = function (key, value) {
			var localKey = key;

			// defer init of the cache so that the appInstanceId can be set
			if (!cacheInited) {
				cacheInited = true;

				// if there's an older version of caching, clear the entire cache (the old way)
				if (window.localStorage.getItem("cacheHash"))
					window.localStorage.clear();

				// Flush the local storage cache if the cache hash has changed
				if (ExoWeb.cache("cacheHash") != cacheHash) {
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
					ExoWeb.trace.logWarning("cache", e);
				}
				return value;
			}
		};

		// Clear
		ExoWeb.clearCache = function () {
			// There's a bug in IE 8 that causes localStorage to appear like its been
			// cleared but the quota to not decrease.  Attempt to delete one key at a time rather than
			// use the clear() method in an attempt to work around the bug.
			for (var i = localStorage.length-1; i>=0; i--) {
				var key = localStorage.key(i);

				// Only clear ExoWeb keys. Clear them across all application instances
				// to prevent leaked data if/when an appInstanceId changes.
				if (key.substring(0, "ExoWeb:cache".length) == "ExoWeb:cache") {
					window.localStorage.removeItem(key);
				}
			}
		};
	}

	// Caching Not Supported
	else {
		ExoWeb.cache = function (key, value) { return null; };
		ExoWeb.clearCache = function () { };
	}

	// #endregion

	// #region Activity
	//////////////////////////////////////////////////

	var activityCallbacks = [];

	function registerActivity(callback, thisPtr) {
		if (callback === undefined || callback === null) {
			ExoWeb.trace.throwAndLog("activity", "Activity callback cannot be null or undefined.");
		}

		if (!(callback instanceof Function)) {
			ExoWeb.trace.throwAndLog("activity", "Activity callback must be a function.");
		}

		var item = { callback: callback };

		if (thisPtr) {
			callback.thisPtr = thisPtr;
		}

		activityCallbacks.push(item);
	}

	ExoWeb.registerActivity = registerActivity;

	function isBusy() {
		for (var i = 0, len = activityCallbacks.length; i < len; i++) {
			var item = activityCallbacks[i];

			if (item.callback.call(item.thisPtr || this) === true) {
				return true;
			}
		}

		return false;
	}

	ExoWeb.isBusy = isBusy;

	// #endregion

	// #region Batch
	//////////////////////////////////////////////////

	var batchIndex = 0;
	var allBatches = [];
	var currentBatch = null;

	function Batch(label) {
		this._index = batchIndex++;
		this._labels = [label];
		this._rootLabel = label;
		this._subscribers = [];

		ExoWeb.trace.log("batch", "[{0}] {1} - created.", [this._index, this._rootLabel]);

		allBatches.push(this);
	}

	ExoWeb.registerActivity(function() {
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
			ExoWeb.trace.log("batch", "[{0}] {1} - suspending {2}.", [currentBatch._index, currentBatch._rootLabel, message || ""]);
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
			ExoWeb.trace.log("batch", "[{0}] {1} - beginning label {2}.", [this._index, this._rootLabel, label]);

			this._labels.push(label);

			return this;
		},
		_end: function Batch$_end() {
			// Cannot end a batch that has already been ended.
			if (this.isEnded()) {
				ExoWeb.trace.logWarning("batch", "[{0}] {1} - already ended.", [this._index, this._rootLabel]);
				return this;
			}

			// Remove the last label from the list.
			var label = this._labels.pop();

			ExoWeb.trace.log("batch", "[{0}] {1} - ending label {2}.", [this._index, this._rootLabel, label]);

			if (this.isEnded()) {
				ExoWeb.trace.log("batch", "[{0}] {1} - complete.", [this._index, this._rootLabel]);

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

			ExoWeb.trace.log("batch", "transferring from [{2}] {3} to [{0}] {1}.", [this._index, this._rootLabel, otherBatch._index, otherBatch._rootLabel]);

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

			ExoWeb.trace.log("batch", "[{0}] {1} - resuming.", [this._index, this._rootLabel]);
			currentBatch = this;

			return this;
		},
		isEnded: function Batch$isEnded() {
			return this._labels.length === 0;
		},
		whenDone: function Batch$whenDone(fn, thisPtr) {
			ExoWeb.trace.log("batch", "[{0}] {1} - subscribing to batch done.", [this._index, this._rootLabel]);

			this._subscribers.push({ fn: fn, thisPtr: thisPtr });

			return this;
		}
	});

	ExoWeb.Batch = Batch;

	// #endregion

	// #region Signal
	//////////////////////////////////////////////////

	var pendingSignalTimeouts;

	function Signal(debugLabel) {
		this._waitForAll = [];
		this._pending = 0;
		var _this = this;
		this._oneDoneFn = function Signal$_oneDoneFn() { ExoWeb.Signal.prototype.oneDone.apply(_this, arguments); };

		this._debugLabel = debugLabel;
	}

	function doCallback(name, thisPtr, callback, args, executeImmediately) {
		if (executeImmediately === false || (ExoWeb.config.signalTimeout === true && executeImmediately !== true)) {
			var batch = Batch.suspendCurrent("_doCallback");

			// manage a queue of callbacks to ensure the order of execution
			function timeoutCallback() {
				ExoWeb.Batch.resume(batch);
				callback.apply(thisPtr, args || []);
			}

			if (!pendingSignalTimeouts) {
				pendingSignalTimeouts = [timeoutCallback];

				window.setTimeout(function () {
					var callbacks = pendingSignalTimeouts;
					pendingSignalTimeouts = null;

					callbacks.forEach(function (cb) {
						cb();
					});
				}, 1);
			}
			else {
				pendingSignalTimeouts.push(timeoutCallback);
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
			//ExoWeb.trace.log("signal", "(++{_pending}) {_debugLabel}", this);
			return this._genCallback(callback, thisPtr, executeImmediately);
		},
		orPending: function Signal$orPending(callback, thisPtr, executeImmediately) {
			return this._genCallback(callback, thisPtr, executeImmediately);
		},
		_doCallback: function Signal$_doCallback(name, thisPtr, callback, args, executeImmediately) {
			if (ExoWeb.config.signalDebug === true || ExoWeb.config.debug === true) {
				doCallback.apply(this, arguments);
			}
			else {
				try {
					doCallback.apply(this, arguments);
				}
				catch (e) {
					logError("signal", "({0}) {1} callback threw an exception: {2}", [this._debugLabel, name, e]);
				}
			}
		},
		_genCallback: function Signal$_genCallback(callback, thisPtr, executeImmediately) {
			if (callback) {
				var signal = this;
				return function Signal$_genCallback$result() {
					signal._doCallback("pending", thisPtr || this, function Signal$_genCallback$fn() {
						callback.apply(this, arguments);
						signal.oneDone();
					}, arguments, executeImmediately);
				};
			}
			else {
				return this._oneDoneFn;
			}
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
			//ExoWeb.trace.log("signal", "(--{0}) {1}", [this._pending - 1, this._debugLabel]);

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

	ExoWeb.Signal = Signal;

	// #endregion

	// #region Functor
	//////////////////////////////////////////////////

	function Functor() {
		var funcs = [];

		var f = function Functor$fn() {
			for (var i = 0; i < funcs.length; ++i) {
				var item = funcs[i];

				// Ensure that there is either no filter or the filter passes.
				if (!item.filter || item.filter.apply(this, arguments) === true) {
					// Call the handler function.
					item.fn.apply(this, arguments);

					// If handler is set to execute once,
					// remove the handler after calling.
					if (item.once === true) {
						funcs.splice(i--, 1);
					}
				}
			}
		};

		f._funcs = funcs;
		f.add = Functor.add;
		f.remove = Functor.remove;
		f.isEmpty = Functor.isEmpty;

		return f;
	}

	Functor.add = function Functor$add(fn, filter, once) {
		var item = { fn: fn };

		if (filter !== undefined) {
			item.filter = filter;
		}

		if (once !== undefined) {
			item.once = once;
		}

		this._funcs.push(item);
	};

	Functor.remove = function Functor$remove(old) {
		for (var i = this._funcs.length - 1; i >= 0; --i) {
			if (this._funcs[i].fn === old) {
				this._funcs.splice(i, 1);
				break;
			}
		}
	};

	Functor.isEmpty = function Functor$isEmpty() {
		return this._funcs.length === 0;
	};

	var eventsInProgress = 0;

	// busy if there are any events in progress
	ExoWeb.registerActivity(function() {
		return eventsInProgress > 0;
	});

	Functor.eventing = {
		_addEvent: function Functor$_addEvent(name, func, filter, once) {
			if (!this["_" + name]) {
				this["_" + name] = new Functor();
			}

			this["_" + name].add(func, filter, once);
		},
		_removeEvent: function Functor$_removeEvent(name, func) {
			var handler = this["_" + name];
			if (handler) {
				handler.remove(func);
			}
		},
		_raiseEvent: function Functor$_raiseEvent(name, argsArray) {
			var handler = this["_" + name];
			if (handler) {
				try {
					eventsInProgress++;
					handler.apply(this, argsArray || []);
				}
				finally {
					eventsInProgress--;
				}
			}
		},
		_getEventHandler: function Functor$_getEventHandler(name) {
			return this["_" + name];
		}
	};

	ExoWeb.Functor = Functor;

	// #endregion

	// #region FunctionChain
	//////////////////////////////////////////////////

	function FunctionChain(steps, thisPtr) {
		if (!(steps instanceof Array)) {
			ExoWeb.trace.throwAndLog("functionChain", "Steps must be an array of functions.");
		}

		this._steps = steps;
		this._thisPtr = thisPtr;
	}

	FunctionChain.prepare = function FunctionChain$_invoke() {
		// Return a function that can be invoked with callback and thisPtr.
		// Useful for assigning to a prototype member, since "this" is used
		// as the thisPtr for the chain if "thisPtr" argument is not supplied,
		// while "thisPtr" of invocation is used as the argument to "invoke".

		var steps = null,
			thisPtrOuter = null;

		// no args => empty chain
		if (arguments.length === 0) {
			steps = [];
		}
		// one array arg => array of steps
		else if (arguments.length === 1 && arguments[0] instanceof Array) {
			steps = arguments[0];
		}
		// two args (first array) => array of steps and this pointer
		else if (arguments.length === 2 && arguments[0] instanceof Array) {
			steps = arguments[0];
			thisPtrOuter = arguments[1];
		}
		// otherwise, assume arguments correspond to steps
		else {
			steps = Array.prototype.slice.call(arguments);
		}

		return function(callback, thisPtr) {
			var chain = new FunctionChain(steps, thisPtrOuter || this);
			chain.invoke(callback, thisPtr);
		};
	};

	function doStep(idx, callback, thisPtr) {
		var _callback = callback;
		var _thisPtr = thisPtr;
		var nextStep = idx + 1 < this._steps.length ?
			doStep.prependArguments(idx + 1, _callback, _thisPtr) :
			function() {
				if (_callback && _callback instanceof Function) {
					_callback.apply(_thisPtr || this, arguments);
				}
			};

		this._steps[idx].call(this._thisPtr || this, nextStep, this);
	}

	FunctionChain.mixin({
		invoke: function(callback, thisPtr) {
			doStep.call(this, 0, callback, thisPtr);
		}
	});

	ExoWeb.FunctionChain = FunctionChain;

	// #endregion

	// #region EventQueue
	//////////////////////////////////////////////////

	function EventQueue(raise, areEqual) {
		this._queueing = 0;
		this._queue = [];
		this._raise = raise;
		this._areEqual = areEqual;
	}

	EventQueue.prototype = {
		startQueueing: function EventQueue$startQueueing() {
			++this._queueing;
		},
		stopQueueing: function EventQueue$stopQueueing() {
			if (--this._queueing === 0) {
				this.raiseQueue();
			}
		},
		push: function EventQueue$push(item) {
			// NOTE:  If a queued event triggers other events when raised, 
			// the new events will be raised before the events that follow 
			// after the triggering event.  This means that events will be 
			// raised in the correct sequence, but they may occur out of order.
			if (this._queueing) {
				if (this._areEqual) {
					for (var i = 0; i < this._queue.length; ++i) {
						if (this._areEqual(item, this._queue[i])) {
							return;
						}
					}
				}

				this._queue.push(item);
			}
			else {
				this._raise(item);
			}
		},
		raiseQueue: function EventQueue$raiseQueue() {
			var nextQueue = [];
			try {
				for (var i = 0; i < this._queue.length; ++i) {
					if (this._raise(this._queue[i]) === false) {
						nextQueue.push(this._queue[i]);
					}
				}
			}
			finally {
				if (this._queue.length > 0) {
					this._queue = nextQueue;
				}
			}
		}
	};

	ExoWeb.EventQueue = EventQueue;

	// #endregion

	// #region MessageQueue
	//////////////////////////////////////////////////

	function MessageQueue(handler, thisPtr) {

		// Require that a callback function is given.
		if (!handler || Object.prototype.toString.call(handler) !== "[object Function]")
			ExoWeb.trace.throwAndLog("messageQueue", "A callback must be provided to handle queued messages.");

		// Construct an array to store messages that are queued.
		var messages = [];
	
		// Number of milliseconds to wait before flushing the queue.
		var interval = null;

		// Timeout used for autoflush.
		var timeout = null;

		// Whether or not the interval resets when new items are enqueued.
		var rolling;

		// Starts or resets the timer when an item is enqueued.
		function startTimer() {
			if (timeout) {
				clearTimeout(timeout);
			}

			timeout = setTimeout(function() {
				timeout = null;
				queue.flush();
			}, interval);
		}

		var queue = {

			/*
			* Adds a new message to the queue.  If an interval is enabled
			* it will either be started or reset (if rolling).
			*/
			add: function(message) {
				if (rolling === true || (timeout === null && rolling === false)) {
					startTimer();
				}

				messages.push(message);
			},

			/*
			* Returns the number of messages that have been enqueued.
			*/
			count: function() {
				return messages.length;
			},

			/*
			* Invokes the callback with all messages that have been queued to date.
			*/
			flush: function() {
				if (messages.length > 0) {
					if (thisPtr)
						handler.call(thisPtr, messages.splice(0, messages.length));
					else
						handler(messages.splice(0, messages.length));
				}
			},

			/*
			* Enables flushing the queue after a given number of milliseconds.
			*/
			autoFlush: function(every/*, rolling*/) {
				if (interval !== null)
					ExoWeb.trace.throwAndLog("messageQueue", "Autoflush is already enabled after {0} milliseconds.", [interval]);

				// Set interval and rolling options.
				rolling = arguments[1] ? true : false;
				interval = every;

				// Start the timer now if we already have messages.
				if (messages.length > 0) {
					startTimer();
				}
			}
		};

		return queue;
	}

	ExoWeb.MessageQueue = MessageQueue;

	// #endregion

	// #region EvalWrapper
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

	// #region Transform
	//////////////////////////////////////////////////

	function Transform(root) {
		this.array = root;
	}

	function Transform$compileFilterFunction(filter) {
		var parser = /(([a-z_$][0-9a-z_$]*)([.]?))|(('([^']|\')*')|("([^"]|\")*"))/gi;
		var skipWords = ["true", "false", "$index", "null"];

		filter = filter.replace(parser, function(match, ignored, name, more, strLiteral) {
			if ((strLiteral !== undefined && strLiteral !== null && strLiteral.length > 0) || skipWords.indexOf(name) >= 0) {
				return match;
			}

			if (name === "$item") {
				return "";
			}

			if (more.length > 0) {
				return "get('" + name + "')" + more;
			}

			return "get('" + name + "').value";
		});

		return new Function("$item", "$index", "with(new ExoWeb.EvalWrapper($item)){ return (" + filter + ");}");
	}

	var compileFilterFunction = Transform$compileFilterFunction.cached({ key: function(filter) { return filter; } });

	function Transform$compileGroupsFunction(groups) {
		return new Function("$item", "$index", "return ExoWeb.evalPath($item, '" + groups + "');");
	}

	var compileGroupsFunction = Transform$compileGroupsFunction.cached({ key: function(groups) { return groups; } });

	function Transform$compileOrderingFunction(ordering) {
		var orderings = [];
		var parser = / *([a-z0-9_.]+)( +null)?( +(asc|desc))?( +null)? *(,|$)/gi;

		ordering.replace(parser, function(match, path, nullsFirst, ws, dir, nullsLast) {
			orderings.push({
				path: path,
				ab: dir === "desc" ? 1 : -1,
				nulls: (nullsLast !== undefined && nullsLast !== null && nullsLast.length > 0) ? 1 : -1
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
	}

	var compileOrderingFunction = Transform$compileOrderingFunction.cached({ key: function(ordering) { return ordering; } });

	Transform.mixin({
		_next: function Transform$_next(fn, args, output) {
			Function.mixin(Transform.prototype, output);
			output.prior = this;
			output.transform = { fn: fn, args: args };
			return output;
		},
		input: function Transform$input() {
			return this.array || this;
		},
		where: function Transform$where(filter, thisPtr) {
			if (!(filter instanceof Function)) {
				filter = compileFilterFunction(filter);
			}

			var output = [];

			var input = this.input();

			var len = input.length;
			for (var i = 0; i < len; ++i) {
				var item = input[i];

				if (filter.apply(thisPtr || item, [item, i])) {
					output.push(item);
				}
			}

			return this._next(this.where, arguments, output);
		},
		groupBy: function Transform$groupBy(groups, thisPtr) {
			if (!(groups instanceof Function)) {
				groups = compileGroupsFunction(groups);
			}

			var output = [];

			var input = this.input();
			var len = input.length;
			for (var i = 0; i < len; i++) {
				var item = input[i];
				var groupKey = groups.apply(thisPtr || item, [item, i]);

				var group = null;
				for (var g = 0; g < output.length; ++g) {
					if (output[g].group == groupKey) {
						group = output[g];
						group.items.push(item);
						break;
					}
				}

				if (!group) {
					output.push({ group: groupKey, items: [item] });
				}
			}
			return this._next(this.groupBy, arguments, output);
		},
		orderBy: function Transform$orderBy(ordering, thisPtr) {
			if (!(ordering instanceof Function)) {
				ordering = compileOrderingFunction(ordering);
			}

			var input = this.input();
			var output = new Array(input.length);

			// make new array
			var len = input.length;
			for (var i = 0; i < len; i++) {
				output[i] = input[i];
			}

			// sort array in place
			if (!thisPtr) {
				output.sort(ordering);
			}
			else {
				output.sort(function() { return ordering.apply(thisPtr, arguments); });
			}

			return this._next(this.orderBy, arguments, output);
		},
		// Watches for changes on the root input into the transform
		// and raises observable change events on this item as the 
		// results change.
		live: function Transform$live() {
			var chain = [];
			for (var step = this; step; step = step.prior) {
				Array.insert(chain, 0, step);
			}

			// make a new observable array
			var input = this.input();
			var output = Sys.Observer.makeObservable(new Array(input.length));

			var len = input.length;
			for (var i = 0; i < len; i++) {
				output[i] = input[i];
			}

			// watch for changes to root input and rerun transform chain as needed
			Sys.Observer.addCollectionChanged(chain[0].input(), function Transform$live$collectionChanged() {
				// re-run the transform on the newly changed input
				var newResult = $transform(chain[0].input());

				for (var i = 1; i < chain.length; ++i) {
					var step = chain[i];
					newResult = step.transform.fn.apply(newResult, step.transform.args);
				}

				// apply the changes to the output.
				// must use the original list so that the events can be seen
				output.beginUpdate();
				output.clear();
				Array.addRange(output, newResult);
				output.endUpdate();
			});

			return this._next(this.live, arguments, output);
		}
	});

	ExoWeb.Transform = Transform;
	window.$transform = function transform(array) { return new Transform(array); };

	// #endregion

	// #region Translator
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

	// #region Utilities
	//////////////////////////////////////////////////

	function evalPath(obj, path, nullValue, undefinedValue) {
		var steps = path.split(".");

		if (obj === null) {
			return arguments.length >= 3 ? nullValue : null;
		}
		if (obj === undefined) {
			return arguments.length >= 4 ? undefinedValue : undefined;
		}

		for (var i = 0; i < steps.length; ++i) {
			var name = steps[i];
			obj = ExoWeb.getValue(obj, name);

			if (obj === null) {
				return arguments.length >= 3 ? nullValue : null;
			}
			if (obj === undefined) {
				return arguments.length >= 4 ? undefinedValue : undefined;
			}
		}

		if (obj === null) {
			return arguments.length >= 3 ? nullValue : null;
		}
		if (obj === undefined) {
			return arguments.length >= 4 ? undefinedValue : undefined;
		}

		return obj;
	}

	ExoWeb.evalPath = evalPath;

	function getLastTarget(target, propertyPath) {
		var path = propertyPath;
		var finalTarget = target;

		if (path.constructor == String) {
			path = path.split(".");
		}
		else if (!(path instanceof Array)) {
			ExoWeb.trace.throwAndLog(["$lastTarget", "core"], "invalid parameter propertyPath");
		}

		for (var i = 0; i < path.length - 1; i++) {
			if (finalTarget) {
				finalTarget = getValue(finalTarget, path[i]);
			}
		}

		return finalTarget;
	}

	ExoWeb.getLastTarget = getLastTarget;
	window.$lastTarget = getLastTarget;

	function isObject(obj) {
		//
		return obj !== null && obj !== undefined && (obj instanceof Object || typeof(obj) === "object" || Object.prototype.toString.call(obj) === "[object Object]");
	}

	// If a getter method matching the given property name is found on the target it is invoked and returns the 
	// value, unless the the value is undefined, in which case null is returned instead.  This is done so that 
	// calling code can interpret a return value of undefined to mean that the property it requested does not exist.
	// TODO: better name
	function getValue(target, property) {
		var getter = target["get_" + property];
		if (getter) {
			var value = getter.call(target);
			return value === undefined ? null : value;
		}
		else {
			if ((isObject(target) && property in target) ||
				(target.constructor === String && /^[0-9]+$/.test(property) && parseInt(property, 10) < target.length)) {
				var value = target[property];
				return value === undefined ? null : value;
			}
			else if (/\./.test(property)) {
				ExoWeb.trace.logWarning("", "Possible incorrect usage of \"getValue()\", the path \"{0}\" does not exist on the target and appears to represent a multi-hop path.", [property]);
			}
		}
	}

	ExoWeb.getValue = getValue;

	var ctorProviders = ExoWeb._ctorProviders = {};

	function addCtorProvider(type, provider) {
		var key;

		// given type is a string, then use it as the dictionary key
		if (isType(type, String)) {
			key = type;
		}
		// given type is a function, then parse the name
		else if (isType(type, Function)) {
			key = parseFunctionName(type);
		}
		else {
			// TODO
		}

		if (!isType(provider, Function)) {
			// TODO
		}

		if (key !== undefined && key !== null) {
			ctorProviders[key] = provider;
		}
	}

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
				else {
					// Look for a registered provider for the argument's type.
					// TODO:  account for inheritance when determining provider?
					var providerKey = parseFunctionName(type.constructor);
					var provider = ctorProviders[providerKey];

					if (provider !== undefined && provider !== null) {
						// invoke the provider to obtain the constructor
						ctor = provider(type);
					}
				}

				// warn (and implicitly return undefined) if the result is not a javascript function
				if (ctor !== undefined && ctor !== null && !isType(ctor, Function)) {
					ExoWeb.trace.logWarning("", "The given type \"{0}\" is not a function.", [type]);
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
		for (var prop in obj)
			if (obj.hasOwnProperty(prop))
				if (callback.apply(thisPtr || this, [prop, obj[prop]]) === false)
					break;
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
		if (!values) return str;

		var source = null,
			arrayMode = false;

		if (arguments.length > 2) {
			// use arguments passed to function as array
			source = Array.prototype.slice.call(arguments, 1);
			arrayMode = true;
		}
		else {
			source = values;
			if (values && values instanceof Array) {
				// if the values are already an array there is no need to transform
				// them into an array later on, in fact this would be unexpected behavior
				arrayMode = true;
			}
		}

		return str.replace(/\{([a-z0-9_.]+)\}/ig, function $format$token(match, expr) {
			// Attempt to determine that single arg was passed, but
			// "arguments mode" was intended based on the format string.
			if (arrayMode === false && expr === "0") {
				var allOneIndex = true;
				str.replace(/\{([a-z0-9_.]+)\}/ig, function $format$token(match, expr) {
					if (expr !== "0") {
						allOneIndex = false;
					}
				});
				if (allOneIndex === true) {
					source = [values];
					arrayMode = true;
				}
			}

			return evalPath(source, expr, "", match).toString();
		});
	}

	window.$format = $format;

	function makeHumanReadable(text) {
		return text.replace(/([^A-Z]+)([A-Z])/g, "$1 $2");
	}

	ExoWeb.makeHumanReadable = makeHumanReadable;

	function isNullOrUndefined(obj) {
		return obj === null || obj === undefined;
	}
	ExoWeb.isNullOrUndefined = isNullOrUndefined;

	ExoWeb.isNullOrUndefined = isNullOrUndefined;

	// #endregion

	// #region TimeSpan
	//////////////////////////////////////////////////

	function TimeSpan(ms) {
		this.totalMilliseconds = ms;
		this.totalSeconds = this.totalMilliseconds / 1000;
		this.totalMinutes = this.totalSeconds / 60;
		this.totalHours = this.totalMinutes / 60;
		this.totalDays = this.totalHours / 24;

		this.milliseconds = Math.floor(ms % 1000);
		ms = ms / 1000;
		this.seconds = Math.floor(ms % 60);
		ms = ms / 60;
		this.minutes = Math.floor(ms % 60);
		ms = ms / 60;
		this.hours = Math.floor(ms % 24);
		ms = ms / 24;
		this.days = Math.floor(ms);
	}

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

	// #region Date
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

	Date.prototype.addHours = function (h) {
		this.setHours(this.getHours() + h);
		return this;
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

	// #region Object
	//////////////////////////////////////////////////

	// original code grabbed from http://oranlooney.com/functional-javascript/
	Object.copy = function Object$Copy(obj, options/*, level*/) {

		var undefined;

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
					if (ExoWeb.Model && obj instanceof ExoWeb.Model.Entity) {
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
	// #endregion

	// #region PropertyObserver
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
					Sys.Observer.removeCollectionChanged(this._collectionTarget, this._collectionHandler);
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

				Sys.Observer.addCollectionChanged(this._collectionTarget, this._collectionHandler);
			}
			else {
				this._raiseEvent("valueCaptured", [value]);
			}
		},
		start: function PropertyObserver$start(source, handler) {
			if (this._source) {
				ExoWeb.trace.throwAndLog(["observer"], "Cannot start an observer that is already started.");
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

			Sys.Observer.addSpecificPropertyChanged(this._source, this._prop, this._propHandler);

			// If we currently have a value, then notify subscribers
			if (value !== undefined && value !== null) {
				this.capture(value);
			}
		},
		stop: function PropertyObserver$stop() {
			if (this._source) {
				// Remove the registered event(s)
				Sys.Observer.removeSpecificPropertyChanged(this._source, this._prop, this._propHandler);

				// Have to store the array since if the value changes we won't necessarily be able to retrieve the original array
				if (this._collectionTarget !== undefined && this._collectionTarget !== null) {
					Sys.Observer.removeCollectionChanged(this._collectionTarget, this._collectionHandler);
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

	// #region MsAjax
	//////////////////////////////////////////////////

	function _raiseSpecificPropertyChanged(target, args) {
		var func = target.__propertyChangeHandlers[args.get_propertyName()];
		if (func && func instanceof Function) {
			func.apply(this, arguments);
		}
	}

	// Converts observer events from being for ALL properties to a specific one.
	// This is an optimization that prevents handlers interested only in a single
	// property from being run when other, unrelated properties change.
	Sys.Observer.addSpecificPropertyChanged = function Sys$Observer$addSpecificPropertyChanged(target, property, handler) {
		if (!target.__propertyChangeHandlers) {
			target.__propertyChangeHandlers = {};

			Sys.Observer.addPropertyChanged(target, _raiseSpecificPropertyChanged);
		}

		var func = target.__propertyChangeHandlers[property];

		if (!func) {
			target.__propertyChangeHandlers[property] = func = ExoWeb.Functor();
		}

		func.add(handler);
	};

	Sys.Observer.removeSpecificPropertyChanged = function Sys$Observer$removeSpecificPropertyChanged(target, property, handler) {
		var func = target.__propertyChangeHandlers ? target.__propertyChangeHandlers[property] : null;

		if (func) {
			func.remove(handler);

			// if the functor is empty then remove the callback as an optimization
			if (func.isEmpty()) {
				delete target.__propertyChangeHandlers[property];

				var hasHandlers = false;
				for (var handler in target.__propertyChangeHandlers) {
					hasHandlers = true;
				}

				if (!hasHandlers) {
					delete target.__propertyChangeHandlers;
					Sys.Observer.removePropertyChanged(target, _raiseSpecificPropertyChanged);
				}
			}
		}
	};


	Sys.Observer.addPathChanged = function Sys$Observer$addPathChanged(target, path, handler, allowNoTarget) {
		// Throw an error if the target is null or undefined, unless the calling code specifies that this is ok
		if (target === undefined || target === null) {
			if (allowNoTarget === true) {
				return;
			}
			else {
				ExoWeb.trace.throwAndLog("observer", "Cannot watch for changes to \"{0}\" on a null or undefined target.", [path instanceof Array ? path.join(".") : path]);
			}
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
						Sys.Observer.addCollectionChanged(source, function(sender, args) {
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

	Sys.Observer.removePathChanged = function Sys$Observer$removePathChanged(target, path, handler) {
		path = (path instanceof Array) ? path.join(".") : path;

		var pathChangeHandlers = target.__pathChangeHandlers ? target.__pathChangeHandlers[path] : null;

		if (pathChangeHandlers) {
			// Search the list for handlers that match the given handler and stop and remove them
			for (var i = 0; i < pathChangeHandlers.length; i++) {
				var pathChangeHandler = pathChangeHandlers[i];
				if (pathChangeHandler.handler === handler) {
					Array.forEach(pathChangeHandler.roots, function(observer) {
						observer.stop();
					});
					Array.removeAt(pathChangeHandlers, i--);
				}
			}

			// If there are no more handlers for this path then remove it from the cache
			if (pathChangeHandlers.length === 0) {
				// delete the data specific to this path
				delete target.__pathChangeHandlers[path];

				// determine if there are any other paths being watched
				var hasHandlers = false;
				for (var handler in target.__pathChangeHandlers) {
					hasHandlers = true;
				}

				// delete the property from the object if there are no longer any paths being watched
				if (!hasHandlers) {
					delete target.__pathChangeHandlers;
				}
			}
		}
	};

	// Supress raising of property changed when a generated setter is already raising the event
	Sys.Observer._setValue = function Sys$Observer$_setValue$override(target, propertyName, value) {
		var getter, setter, mainTarget = target, path = propertyName.split('.');
		for (var i = 0, l = (path.length - 1); i < l; i++) {
			var name = path[i];
			getter = target["get_" + name];
			if (typeof (getter) === "function") {
				target = getter.call(target);
			}
			else {
				target = target[name];
			}
			var type = typeof (target);
			if ((target === null) || (type === "undefined")) {
				throw Error.invalidOperation(String.format(Sys.Res.nullReferenceInPath, propertyName));
			}
		}

		var notify = true; // added
		var currentValue, lastPath = path[l];
		getter = target["get_" + lastPath];
		setter = target["set_" + lastPath];
		if (typeof (getter) === 'function') {
			currentValue = getter.call(target);
		}
		else {
			currentValue = target[lastPath];
		}
		if (typeof (setter) === 'function') {
			notify = !setter.__notifies; // added
			setter.call(target, value);
		}
		else {
			target[lastPath] = value;
		}
		if (currentValue !== value) {
			var ctx = Sys.Observer._getContext(mainTarget);
			if (ctx && ctx.updating) {
				ctx.dirty = true;
				return;
			}
			if (notify) {
				Sys.Observer.raisePropertyChanged(mainTarget, path[0]);
			}
		}
	};

	// #endregion

	// #region Format
	//////////////////////////////////////////////////

	function Format(options) {
		this._paths = options.paths;
		this._convert = options.convert;
		this._convertBack = options.convertBack;
		this._description = options.description;
		this._nullString = options.nullString || "";
		this._undefinedString = options.undefinedString || "";
	}

	Format.fromTemplate = (function Format$fromTemplate(convertTemplate) {
		var paths = [];
		convertTemplate.replace(/\{([a-z0-9_.]+)\}/ig, function(match, expr) {
			paths.push(expr);
			return expr;
		});

		return new Format({
			paths: paths,
			convert: function convert(obj) {
				if (obj === null || obj === undefined) {
					return "";
				}

				return $format(convertTemplate, obj);
			}
		});
	}).cached({ key: function(convertTemplate) { return convertTemplate; } });

	Format.mixin({
		getPaths: function() {
			return this._paths || [];
		},
		convert: function(val) {
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
		convertBack: function(val) {
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
				return new FormatError(this._description ?
							"{value} must be formatted as " + this._description :
							"{value} is not properly formatted",
							val);
			}
		}
	});

	ExoWeb.Model.Format = Format;
	Format.registerClass("ExoWeb.Model.Format");

	// #endregion

	// #region Model
	//////////////////////////////////////////////////

	function Model() {
		this._types = {};

		this._validatingQueue = new ExoWeb.EventQueue(
			function(e) {
				var meta = e.sender;
				meta._raiseEvent("propertyValidating:" + e.propName, [meta, e.propName]);
			},
			function(a, b) {
				return a.sender == b.sender && a.propName == b.propName;
			}
		);

		this._validatedQueue = new ExoWeb.EventQueue(
			function(e) {
				var meta = e.sender;
				var propName = e.property;

				var conditions = [];
				Sys.Observer.makeObservable(conditions);
				Array.addRange(conditions, meta._propertyConditions[propName] || []);
				meta._raiseEvent("propertyValidated:" + propName, [meta, conditions]);
			},
			function(a, b) {
				return a.sender == b.sender && a.property == b.property;
			}
		);
	}

	Model.property = function Model$property(path, thisType/*, lazyLoadTypes, callback, thisPtr*/) {
		var tokens = new PathTokens(path);
		var firstStep = tokens.steps[0];
		var isGlobal = firstStep.property !== "this";

		var type;

		var lazyLoadTypes = arguments.length >= 3 && arguments[2] && arguments[2].constructor === Boolean ? arguments[2] : false;
		var callback = arguments[3];
		var thisPtr = arguments[4];

		if (isGlobal) {
			// Get all but the last step in the path.
			var typePathSteps = tokens.steps.filter(function(item, i) { return i != tokens.steps.length - 1; });

			// Construct a string from these steps.
			var typeName = typePathSteps.map(function(item) { return item.property; }).join(".");

			// Empty type name is an error.  The type name must be included as a part of the path.
			if (typeName.length === 0) {
				ExoWeb.trace.throwAndLog(["model"], "Invalid static property path \"{0}\":  type name must be included.", [path]);
			}

			// Retrieve the javascript type by name.
			type = Model.getJsType(typeName, true);

			// If the type is not found then the path must be bad.
			if (!type) {
				if (lazyLoadTypes) {
					// Retry when type is loaded
					$extend(typeName, Model.property.prepare(this, Array.prototype.slice.call(arguments)));
					return;
				}
				else {
					ExoWeb.trace.throwAndLog(["model"], "Invalid static property path \"{0}\":  type \"{1}\" could not be found.", [path, typeName]);
				}
			}

			// Get the corresponding meta type.
			type = type.meta;

			// Chop off type portion of property path.
			tokens.steps.splice(0, tokens.steps.length - 1);
		}
		else {
			if (firstStep.cast) {
				var jstype = Model.getJsType(firstStep.cast);

				if (!jstype) {
					ExoWeb.trace.throwAndLog("model", "Path '{0}' references an unknown type: {1}", [path, firstStep.cast]);
				}
				type = jstype.meta;
			}
			else if (thisType instanceof Function) {
				type = thisType.meta;
			}
			else {
				type = thisType;
			}

			Array.dequeue(tokens.steps);
		}

		if (tokens.steps.length === 1) {
			var name = tokens.steps[0].property;
			if (lazyLoadTypes) {
				if (!LazyLoader.isLoaded(type)) {
					LazyLoader.load(type, null, function() {
						callback.call(thisPtr || this, type.property(name, true));
					});
				}
				else {
					callback.call(thisPtr || this, type.property(name, true));
				}
			}
			else {
				return type.property(name, true);
			}
		}
		else {
			return new PropertyChain(type, tokens, lazyLoadTypes, thisPtr ? callback.bind(thisPtr) : callback);
		}
	};

	Model.prototype = {
		dispose: function Model$dispose() {
			for(var key in this._types) {
				delete window[key];
			}
		},
		addType: function Model$addType(name, base, origin) {
			var type = new Type(this, name, base, origin);
			this._types[name] = type;
			return type;
		},
		beginValidation: function Model$beginValidation() {
			this._validatingQueue.startQueueing();
			this._validatedQueue.startQueueing();
		},
		endValidation: function Model$endValidation() {
			this._validatingQueue.stopQueueing();
			this._validatedQueue.stopQueueing();
		},
		get_types: function() {
			return Array.prototype.slice.call(this._types);
		},
		type: function(name) {
			return this._types[name];
		},
		addBeforeContextReady: function(handler) {
			if (!this._contextReady) {
				this._addEvent("beforeContextReady", handler);
			}
			else {
				handler();
			}
		},
		notifyBeforeContextReady: function() {
			this._contextReady = true;
			this._raiseEvent("beforeContextReady", []);
		},
		addAfterPropertySet: function(handler) {
			this._addEvent("afterPropertySet", handler);
		},
		notifyAfterPropertySet: function(obj, property, newVal, oldVal) {
			this._raiseEvent("afterPropertySet", [obj, property, newVal, oldVal]);
		},
		addObjectRegistered: function(func, objectOrFunction, once) {
			this._addEvent("objectRegistered", func, objectOrFunction ? (objectOrFunction instanceof Function ? objectOrFunction : equals(objectOrFunction)) : null, once);
		},
		removeObjectRegistered: function(func) {
			this._removeEvent("objectRegistered", func);
		},
		notifyObjectRegistered: function(obj) {
			this._raiseEvent("objectRegistered", [obj]);
		},
		addObjectUnregistered: function(func) {
			this._addEvent("objectUnregistered", func);
		},
		notifyObjectUnregistered: function(obj) {
			this._raiseEvent("objectUnregistered", [obj]);
		},
		addListChanged: function(func) {
			this._addEvent("listChanged", func);
		},
		notifyListChanged: function(obj, property, changes) {
			this._raiseEvent("listChanged", [obj, property, changes]);
		},
		_ensureNamespace: function Model$_ensureNamespace(name, parentNamespace) {
			var target = parentNamespace;

			if (target.constructor === String) {
				var nsTokens = target.split(".");
				target = window;
				Array.forEach(nsTokens, function(token) {
					target = target[token];

					if (target === undefined) {
						ExoWeb.trace.throwAndLog("model", "Parent namespace \"{0}\" could not be found.", parentNamespace);
					}
				});
			}
			else if (target === undefined || target === null) {
				target = window;
			}

			// create the namespace object if it doesn't exist, otherwise return the existing namespace
			if (!(name in target)) {
				var result = target[name] = {};
				return result;
			}
			else {
				return target[name];
			}
		}
	};

	Model.mixin(ExoWeb.Functor.eventing);

	Model.getJsType = function Model$getJsType(name, allowUndefined) {
		/// <summary>
		/// Retrieves the JavaScript constructor function corresponding to the given full type name.
		/// </summary>
		/// <returns type="Object" />

		var obj = window;
		var steps = name.split(".");
		for (var i = 0; i < steps.length; i++) {
			var step = steps[i];
			obj = obj[step];
			if (obj === undefined) {
				if (allowUndefined) {
					return;
				}
				else {
					throw Error($format("The type \"{0}\" could not be found.  Failed on step \"{1}\".", [name, step]));
				}
			}
		}
		return obj;
	};

	ExoWeb.Model.Model = Model;

	// #endregion

	// #region Entity
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
			forEachProperty(getProperties.apply(this, arguments), function(name, value) {
				var prop = this.meta.type.property(name, true);

				if (!prop) {
					ExoWeb.trace.throwAndLog("propInit", "Could not find property \"{0}\" on type \"{1}\".", [name, this.meta.type.get_fullName()]);
				}

				// Initialization is not force.  If the propery already has a value it will be ignored.
				prop.init(this, value);
			}, this);
		},
		set: function Entity$set(/*[properties] or [propName, propValue] */) {
			forEachProperty(getProperties.apply(this, arguments), function(name, value) {
				this._accessor("set", name).call(this, value);
			}, this);
		},
		get: function Entity$get(propName) {
			return this._accessor("get", propName).call(this);
		},
		_accessor: function Entity$_accessor(getOrSet, property) {
			var fn = this[getOrSet + "_" + property];

			if (!fn) {
				ExoWeb.trace.throwAndLog("model", "Unknown property: {0}.{1}", [this.meta.type.get_fullName(), property]);
			}

			return fn;
		},
		toString: function Entity$toString(formatName) {
			var format;

			if (formatName) {
				format = this.constructor.formats[formatName];

				if (!format) {
					ExoWeb.trace.throwAndLog(["formatting"], "Invalid format: {0}", arguments);
				}
			}
			else {
				format = this.constructor.formats.$display || this.constructor.formats.$system;
			}

			return format.convert(this);
		}
	});

	Entity.formats = {
		$system: new Format({
			undefinedString: "",
			nullString: "",
			convert: function(obj) {
				return obj.meta.type.toIdString(obj.meta.id);
			},
			convertBack: function(str) {
				// indicates "no value", which is distinct from "no selection"
				var ids = str.split("|");
				var jstype = Model.getJsType(ids[0]);
				if (jstype && jstype.meta) {
					return jstype.meta.get(ids[1]);
				}
			}
		}),
		$display: new Format({
			convert: function(obj) {
				if (obj.get_Label)
					return obj.get_Label();

				if (obj.get_Name)
					return obj.get_Name();

				if (obj.get_Text)
					return obj.get_Text();

				return $format("{0}|{1}", [obj.meta.type.get_fullName(), obj.meta.id]);
			}
		})
	};

	ExoWeb.Model.Entity = Entity;
	Entity.registerClass("ExoWeb.Model.Entity");

	// #endregion

	// #region Type
	//////////////////////////////////////////////////

	function Type(model, name, baseType, origin) {
		this._rules = {};
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
		this._model = model;
		this._initNewProps = [];
		this._initExistingProps = [];

		// generate class and constructor
		var jstype = Model.getJsType(name, true);

		if (jstype) {
			ExoWeb.trace.throwAndLog(["model"], "'{1}' has already been declared", arguments);
		}

		// create namespaces as needed
		var nameTokens = name.split("."),
			token = Array.dequeue(nameTokens),
			namespaceObj = window;
		while (nameTokens.length > 0) {
			namespaceObj = model._ensureNamespace(token, namespaceObj);
			token = Array.dequeue(nameTokens);
		}

		// the final name to use is the last token
		var finalName = token;
		jstype = generateClass(this);

		this._jstype = namespaceObj[finalName] = jstype;

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

		// formats
		var formats = function() { };
		formats.prototype = baseJsType.formats;
		this._jstype.formats = new formats();

		// helpers
		jstype.meta = this;

		// done...
		this._jstype.registerClass(name, baseJsType);
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
			ExoWeb.trace.throwAndLog("model",
				"Id cannot be {0} (entity = {1}).",
				[id === null ? "null" : "undefined", type.get_fullName()]
			);
		}
		else if (id.constructor !== String) {
			ExoWeb.trace.throwAndLog("model",
				"Id must be a string:  encountered id {0} of type \"{1}\" (entity = {2}).",
				[id.toString(), ExoWeb.parseFunctionName(id.constructor), type.get_fullName()]
			);
		}
		else if (id === "") {
			ExoWeb.trace.throwAndLog("model",
				"Id cannot be a blank string (entity = {0}).",
				[type.get_fullName()]
			);
		}
	};

	function generateClass(type)
	{
		function construct(idOrProps, props) {
			if (!disableConstruction) {
				if (idOrProps && idOrProps.constructor === String) {
					var id = idOrProps;
					var obj = type.get(id);
					if (obj) {
						if (props) {
							obj.init(props);
						}
						return obj;
					}

					type.register(this, id);
					type._initProperties(this, "_initExistingProps");

					if (props) {
						this.init(props);
					}
				}
				else {
					type.register(this);
					type._initProperties(this, "_initNewProps");

					// set properties passed into constructor
					if (idOrProps) {
						this.set(idOrProps);
					}
				}
			}
		}

		return construct;
	}

	Type.prototype = {
		toIdString: function Type$toIdString(id) {
			if (id) {
				return $format("{0}|{1}", [this.get_fullName(), id]);
			}
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
			return "+c" + nextId;
		},
		register: function Type$register(obj, id) {
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
			Sys.Observer.makeObservable(obj);

			for (var t = this; t; t = t.baseType) {
				if (t._pool.hasOwnProperty(key)){
					ExoWeb.trace.throwAndLog("model", "Object \"{0}|{1}\" has already been registered.", [this.get_fullName(), id]);
				}

				t._pool[key] = obj;
				if (t._known) {
					t._known.add(obj);
				}
			}

			this._model.notifyObjectRegistered(obj);
		},
		changeObjectId: function Type$changeObjectId(oldId, newId) {
			validateId(this, oldId);
			validateId(this, newId);

			var oldKey = oldId.toLowerCase();
			var newKey = newId.toLowerCase();

			var obj = this._pool[oldKey];

			if (obj) {
				for (var t = this; t; t = t.baseType) {
					t._pool[newKey] = obj;

					delete t._pool[oldKey];

					t._legacyPool[oldKey] = obj;
				}

				obj.meta.id = newId;

				return obj;
			}
			else {
				ExoWeb.trace.logWarning("model",
					"Attempting to change id: Instance of type \"{0}\" with id = \"{1}\" could not be found.",
					[this.get_fullName(), oldId]
				);
			}
		},
		unregister: function Type$unregister(obj) {
			this._model.notifyObjectUnregistered(obj);

			for (var t = this; t; t = t.baseType) {
				delete t._pool[obj.meta.id.toLowerCase()];

				if (t._known) {
					t._known.remove(obj);
				}
			}

			delete obj.meta._obj;
			delete obj.meta;
		},
		get: function Type$get(id) {
			validateId(this, id);

			var key = id.toLowerCase();
			return this._pool[key] || this._legacyPool[key];
		},
		// Gets an array of all objects of this type that have been registered.
		// The returned array is observable and collection changed events will be raised
		// when new objects are registered or unregistered.
		// The array is in no particular order so if you need to sort it, make a copy or use $transform.
		known: function Type$known() {
			var list = this._known;
			if (!list) {
				list = this._known = [];

				for (var id in this._pool) {
					list.push(this._pool[id]);
				}

				Sys.Observer.makeObservable(list);
			}

			return list;
		},
		addPropertyAdded: function(handler) {
			this._addEvent("propertyAdded", handler);
		},
		addProperty: function Type$addProperty(def) {
			var format = def.format;
			if (format && format.constructor === String) {
				format = def.type.formats[format];

				if (!format) {
					ExoWeb.trace.throwAndLog("model", "Cannot create property {0}.{1} because there is not a '{2}' format defined for {3}", [this._fullName, def.name, def.format, def.type]);
				}
			}

			var prop = new Property(this, def.name, def.type, def.isList, def.label, format, def.isStatic, def.index);

			this._properties[def.name] = prop;
			(def.isStatic ? this._staticProperties : this._instanceProperties)[def.name] = prop;

			// modify jstype to include functionality based on the type definition
			function genPropertyShortcut(mtype, overwrite) {
				var shortcutName = "$" + def.name;
				if (!(shortcutName in mtype._jstype) || overwrite) {
					mtype._jstype[shortcutName] = prop;
				}

				mtype.derivedTypes.forEach(function(t) {
					genPropertyShortcut(t, false);
				});
			}
			genPropertyShortcut(this, true);

			// does this property need to be inited during object construction?
			// note: this is an optimization so that all properties defined for a type and 
			// its sub types don't need to be iterated over each time the constructor is called.
			if (!prop.get_isStatic()) {
				if (prop.get_isList()) {
					this._initNewProps.push({ property: prop, valueFn: function() { return []; } });

					if (prop.get_origin() !== "server") {
						this._initExistingProps.push({ property: prop, valueFn: function() { return []; } });
						Array.forEach(this.known(), function(obj) {
							prop.init(obj, []);
						});
					}
				}
				// Presumably the reason for this is that property calculation could be based on init of
				// this property, though it seems unlikely that this would solve more problems that it causes.
				else if (prop.get_origin() === "server") {
					this._initNewProps.push({ property: prop, valueFn: function() { return undefined; } });
				}
			}
			// initially client-based static list properties when added
			else if (prop.get_isList() && prop.get_origin() === "client") {
				prop.init(null, []);
			}


			if (prop.get_isStatic()) {
				// for static properties add member to javascript type
				this._jstype["get_" + def.name] = this._makeGetter(prop, prop._getter, true);
			}
			else {
				// for instance properties add member to all instances of this javascript type
				this._jstype.prototype["get_" + def.name] = this._makeGetter(prop, prop._getter, true);
			}

			if (!prop.get_isList()) {
				if (prop.get_isStatic()) {
					this._jstype["set_" + def.name] = this._makeSetter(prop);
				}
				else {
					this._jstype.prototype["set_" + def.name] = this._makeSetter(prop);
				}
			}

			this._raiseEvent("propertyAdded", [this, { property: prop }]);

			return prop;
		},
		addMethod: function Type$addMethod(def) {
			this._jstype.prototype[def.name] = function () 
			{
				// Detect the optional success and failure callback delegates
				var onSuccess;
				var onFail;
				var paths = null;					

				if (arguments.length > 1)
				{
					onSuccess = arguments[arguments.length-2];
					if (onSuccess instanceof Function) {
						onFail = arguments[arguments.length-1];
					}
					else {
						onSuccess = arguments[arguments.length-1];
					}						
				}
				else if (arguments.length > 0)
					onSuccess = arguments[arguments.length-1];

				if (!onSuccess instanceof Function)
					onSuccess = undefined;

				var onSuccessFn = function(result) {
					if(onSuccess !== undefined) {
						onSuccess(result.event);
					}
				};

				var argCount = arguments.length - (onSuccess === undefined ? 0 : 1) - (onFail === undefined ? 0 : 1);
				var firstArgCouldBeParameterSet = argCount > 0 && arguments[0] instanceof Object && !(def.parameters.length === 0 || arguments[0][def.parameters[0]] === undefined);

				if (argCount >= 1 && argCount <= 2 && arguments[0] instanceof Object &&
						((argCount == 1 && (def.parameters.length != 1 || firstArgCouldBeParameterSet)) ||
						((argCount == 2 && (def.parameters.length != 2 || (firstArgCouldBeParameterSet && arguments[1] instanceof Array))))))
				{

					// Invoke the server event
					context.server.raiseServerEvent(def.name, this, arguments[0], false, onSuccessFn, onFail, argCount == 2 ? arguments[1] : null);
				}

				// Otherwise, assume that the parameters were all passed in sequential order
				else {
					// Throw an error if the incorrect number of arguments were passed to the method
					if (def.parameters.length == argCount - 1 && arguments[argCount - 1] instanceof Array)
						paths = arguments[argCount - 1];
					else if (def.parameters.length != argCount)
						ExoWeb.trace.throwAndLog("type", "Invalid number of arguments passed to \"{0}.{1}\" method.", [this._fullName, def.name]);

					// Construct the arguments to pass
					var args = {};
					for (var parameter in def.parameters)
						args[def.parameters[parameter]] = arguments[parameter];

					// Invoke the server event
					context.server.raiseServerEvent(def.name, this, args, false, onSuccessFn, onFail, paths);
				}
			};
		},
		_makeGetter: function Type$_makeGetter(receiver, fn, skipTypeCheck) {
			return function() {
				return fn.call(receiver, this, skipTypeCheck);
			};
		},
		_makeSetter: function Type$_makeSetter(prop) {
			var setter = function(val) {
				if (prop.isInited(this))
					prop._setter(this, val, true);
				else
					prop.init(this, val);
			};

			setter.__notifies = true;

			return setter;
		},
		_initProperties: function Type$_initProperties(obj, initsArrayName) {
			for (var t = this; t !== null; t = t.baseType) {
				var inits = t[initsArrayName];

				for (var i = 0; i < inits.length; ++i) {
					var init = inits[i];
					init.property.init(obj, init.valueFn());
				}
			}
		},
		get_model: function Type$get_model() {
			return this._model;
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
		get_staticProperties: function Type$get_staticProperties() {
			return this._staticProperties;
		},
		get_instanceProperties: function Type$get_instanceProperties() {
			return this._instanceProperties;
		},
		property: function Type$property(name, thisOnly) {
			if (!thisOnly) {
				return new PropertyChain(this, new PathTokens(name));
			}

			var prop;
			for (var t = this; t && !prop; t = t.baseType) {
				prop = t._properties[name];

				if (prop) {
					return prop;
				}
			}

			return null;
		},
		addRule: function Type$addRule(rule) {
			function Type$addRule$init(sender, args) {
				if (!args.wasInited && (rule.canExecute ? rule.canExecute(sender, args.property) : Rule.canExecute(rule, sender, args.property))) {
					Type$addRule$fn(sender, args.property, rule.execute);
				}
			}
			function Type$addRule$changed(sender, args) {
				if (args.wasInited && (rule.canExecute  ? rule.canExecute(sender, args.property) : Rule.canExecute(rule, sender, args.property))) {
					Type$addRule$fn(sender, args.property, rule.execute);
				}
			}
			function Type$addRule$get(sender, args) {
				try {
					// Only execute rule on property get if the property has not been initialized.
					// This is based on the assumption that a rule should only fire on property
					// get for the purpose of lazy initializing the property value.
					if (!args.isInited) {
						Type$addRule$fn(sender, args.property, rule.execute);
					}
				}
				catch (e) {
					ExoWeb.trace.log("model", e);
				}
			}

			function Type$addRule$fn(obj, prop, fn) {
				try {
					prop.get_containingType().get_model().beginValidation();
					rule._isExecuting = true;						
					ExoWeb.trace.log("rule", "executing rule '{0}' that depends on property '{1}'", [rule, prop]);

					if (prop.get_isStatic() === true) {
						Array.forEach(jstype.meta.known(), function (obj) {
							if (rule.inputs.every(function (input) { return !input.get_dependsOnInit() || input.property.isInited(obj); })) {
								fn.call(rule, obj);
							}
						});
					}
					else {
						fn.call(rule, obj);
					}
				}
				catch (err) {
					ExoWeb.trace.throwAndLog("rules", "Error running rule '{0}': {1}", [rule, err]);
				}
				finally {
					rule._isExecuting = false;
					prop.get_containingType().get_model().endValidation();
				}
			}

			// Store off javascript type to use for comparison
			var jstype = this.get_jstype();

			for (var i = 0; i < rule.inputs.length; ++i) {
				var input = rule.inputs[i];
				var prop = input.property;

				// If the containing type of the input is the same as the type 
				// that the rule is attached to, then we do not need to check types.
				var isSameType = this === prop.get_containingType();

				if (input.get_dependsOnChange()) {
					prop.addChanged(isSameType ?
						Type$addRule$changed :
						function(sender, args) {
							if (sender instanceof jstype) {
								Type$addRule$changed.apply(this, arguments);
							}
						}
					);
				}

				if (input.get_dependsOnInit()) {
					prop.addChanged(isSameType ?
						Type$addRule$init :
						function(sender, args) {
							if (sender instanceof jstype) {
								Type$addRule$init.apply(this, arguments);
							}
						}
					);
				}

				if (input.get_dependsOnGet()) {
					prop.addGet(isSameType ?
						Type$addRule$get :
						function(obj, prop, value, isInited) {
							if (obj instanceof jstype) {
								Type$addRule$get.apply(this, arguments);
							}
						}
					);
				}

				(prop instanceof PropertyChain ? prop.lastProperty() : prop)._addRule(rule, input.get_isTarget());
			}
		},
		// Executes all rules that have a particular property as input
		executeRules: function Type$executeRules(obj, prop, callback, start) {

			var processing;

			if (start === undefined) {
				this._model.beginValidation();
			}

			try {
				var i = (start ? start : 0);

				var rules = prop.rules(true);
				if (rules) {
					processing = (i < rules.length);
					while (processing) {
						var rule = rules[i];

						// Only execute a rule if it is not currently executing and can be executed for the target object.
						// If rule doesn't define a custom canExecute this will simply check that all init inputs are inited.
						if (!rule._isExecuting && (rule.canExecute ? rule.canExecute(obj) : Rule.canExecute(rule, obj))) {
							rule._isExecuting = true;

							if (rule.isAsync) {
								// run rule asynchronously, and then pickup running next rules afterwards
								var _this = this;
//									ExoWeb.trace.log("rule", "executing rule '{0}' that depends on property '{1}'", [rule, prop]);
								rule.execute(obj, function() {
									rule._isExecuting = false;
									_this.executeRules(obj, prop, callback, i + 1);
								});
								break;
							}
							else {
								try {
//										ExoWeb.trace.log("rule", "executing rule '{0}' that depends on property '{1}'", [rule, prop]);
									rule.execute(obj);
								}
								finally {
									rule._isExecuting = false;
								}
							}
						}

						++i;
						processing = (i < rules.length);
					}
				}
			}
			finally {
				if (!processing) {
					this._model.endValidation();
				}
			}

			if (!processing && callback && callback instanceof Function) {
				callback();
			}

			return !processing;
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
		eachBaseType: function Type$eachBaseType(callback, thisPtr) {
			for (var baseType = this.baseType; !!baseType; baseType = baseType.baseType) {
				if (callback.call(thisPtr || this, baseType) === false) {
					return;
				}
			}
		},
		isSubclassOf: function Type$isSubclassOf(mtype) {
			var result = false;

			this.eachBaseType(function(baseType) {
				if (baseType === mtype) {
					result = true;
					return false;
				}
			});

			return result;
		},
		toString: function Type$toString() {
			return this.get_fullName();
		}
	};

	Type.mixin(ExoWeb.Functor.eventing);
	ExoWeb.Model.Type = Type;
	Type.registerClass("ExoWeb.Model.Type");

	// #endregion

	// #region Property
	//////////////////////////////////////////////////

	//////////////////////////////////////////////////////////////////////////////////////
	/// <remarks>
	/// If the interface for this class is changed it should also be changed in
	/// PropertyChain, since PropertyChain acts as an aggregation of properties 
	/// that can be treated as a single property.
	/// </remarks>
	///////////////////////////////////////////////////////////////////////////////
	function Property(containingType, name, jstype, isList, label, format, isStatic, index) {
		this._containingType = containingType;
		this._name = name;
		this._fieldName = "_" + name;
		this._jstype = jstype;
		this._label = label || ExoWeb.makeHumanReadable(name);
		this._format = format;
		this._isList = !!isList;
		this._isStatic = !!isStatic;
		this._index = index;
		this._rules = [];

		if (containingType.get_originForNewProperties()) {
			this._origin = containingType.get_originForNewProperties();
		}
	}

	Property.mixin({
		defaultValue: function Property$defaultValue(value) {
			function getValue() {
				return value;
			}

			this._containingType._initNewProps.push({ property: this, valueFn: getValue });
			this._containingType._initExistingProps.push({ property: this, valueFn: getValue });

			// Initialize existing instances
			Array.forEach(this._containingType.known(), function (obj) {
				if (!this.isInited(obj)) {
					this.init(obj, value);
				}
			}, this);

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
		rule: function (type, onlyTargets) {
			if (!type || !(type instanceof Function)) {
				ExoWeb.trace.throwAndLog("rule", "{0} is not a valid rule type.", [type ? type : (type === undefined ? "undefined" : "null")]);
			}

			var rule = first(this._rules, function (rule) {
				if (rule.value instanceof type)
					if (!onlyTargets || rule.isTarget === true)
						return true;
			});

			return rule ? rule.value : null;
		},
		isDefinedBy: function Property$isDefinedBy(mtype) {
			return this._containingType === mtype || mtype.isSubclassOf(this._containingType);
		},
		_addRule: function Property$_addRule(rule, isTarget) {
			this._rules.push({ value: rule, isTarget: isTarget });
		},
		rules: function (targetsThis) {
			return this._rules
				.filter(function (rule) {
					return (!targetsThis && targetsThis !== false) || // no filter
						(targetsThis === true && rule.isTarget === true) || // only targets
						(targetsThis === false && rule.isTarget === false); // only non-targets
				}).map(function (rule) {
					return rule.value;
				});
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

		get_jstype: function Property$get_jstype() {
			return this._jstype;
		},
		get_index: function Property$get_index() {
			return this._index;
		},
		get_format: function Property$get_format() {
			return this._format;
		},
		format: function (val) {
			return this.get_format() ? this.get_format().convert(val) : val;
		},
		get_origin: function Property$get_origin() {
			return this._origin ? this._origin : this._containingType.get_origin();
		},
		// <DEBUG>
		_assertType: function Property$_assertType(obj) {
			if (this._isStatic === true) {
				if (!ExoWeb.isType(obj.meta, Type)) {
					ExoWeb.trace.throwAndLog(["model", "entity"], "A model type was expected, found \"{0}\".", [ExoWeb.parseFunctionName(obj.constructor)]);
				}

				if (!this.isDefinedBy(obj.meta)) {
					ExoWeb.trace.throwAndLog(["model", "entity"], "Type {0} does not define static property {1}.{2}.", [
						obj.get_fullName(),
						this._containingType.get_fullName(),
						this.get_label()
					]);
				}
			}
			else {
				if (!ExoWeb.isType(obj, Entity)) {
					ExoWeb.trace.throwAndLog(["model", "entity"], "An entity was expected, found \"{0}\".", [ExoWeb.parseFunctionName(obj.constructor)]);
				}

				if (!this.isDefinedBy(obj.meta.type)) {
					ExoWeb.trace.throwAndLog(["model", "entity"], "Type {0} does not define non-static property {1}.{2}.", [
						obj.meta.type.get_fullName(),
						this._containingType.get_fullName(),
						this.get_label()
					]);
				}
			}
		},
		// </DEBUG>

		_getter: function Property$_getter(obj, skipTypeCheck) {
			//				var key = this.get_containingType().get_fullName() + ":" + this._name + ":" + (obj ? obj.meta.id : "STATIC");
			//				if(!window.entities[key]){
			//					window.entities[key] = 1;
			//				}
			//				else {
			//					++window.entities[key];
			//				}

			// Generated setter added to entities can skip type validation since it is 
			// unlikely to be called on an invalid object.

			// <DEBUG>
			//				if (!skipTypeCheck) {
			//					if (obj === undefined || obj === null) {
			//						ExoWeb.trace.throwAndLog(["model", "entity"], "Target object cannot be <{0}>.", [obj === undefined ? "undefined" : "null"]);
			//					}

			//					this._assertType(obj);
			// </DEBUG>

			var handler = this._getEventHandler("get");
			if (handler)
				handler(obj, { property: this, value: obj[this._fieldName], isInited: obj.hasOwnProperty(this._fieldName) });

			// <DEBUG>
			//				if (this._name !== this._fieldName && obj.hasOwnProperty(this._name)) {
			//					ExoWeb.trace.logWarning("model",
			//						"Possible incorrect property usage:  property \"{0}\" is defined on object but field name should be \"{1}\", make sure you are using getters and setters.",
			//						[this._name, this._fieldName]
			//					);
			//				}
			// </DEBUG>

			return obj[this._fieldName];
		},

		_setter: function Property$_setter(obj, val, skipTypeCheck, args) {
			// Generated setter added to entities can skip type validation since it is 
			// unlikely to be called on an invalid object.
			// <DEBUG>
			//				if (!skipTypeCheck) {
			//					if (obj === undefined || obj === null) {
			//						ExoWeb.trace.throwAndLog(["model", "entity"], "Target object cannot be <{0}>.", [obj === undefined ? "undefined" : "null"]);
			//					}

			//					this._assertType(obj);
			//				}
			// </DEBUG>

			if (!this.canSetValue(obj, val)) {
				ExoWeb.trace.throwAndLog(["model", "entity"], "Cannot set {0}={1}. A value of type {2} was expected", [this._name, val === undefined ? "<undefined>" : val, this._jstype.getName()]);
			}

			var old = obj[this._fieldName];

			// compare values so that this check is accurate for primitives
			var oldValue = (old === undefined || old === null) ? old : old.valueOf();
			var newValue = (val === undefined || val === null) ? val : val.valueOf();

			if (oldValue !== newValue) {
				var wasInited = this.isInited(obj);

				obj[this._fieldName] = val;

				// NOTE: property change should be broadcast before rules are run so that if 
				// any rule causes a roundtrip to the server these changes will be available
				this._containingType.get_model().notifyAfterPropertySet(obj, this, val, old, wasInited);

				var handler = this._getEventHandler("changed");
				if (handler)
					handler(obj, $.extend({ property: this, newValue: val, oldValue: old, wasInited: wasInited }, args));

				Sys.Observer.raisePropertyChanged(obj, this._name);
			}
		},

		get_isEntityType: function Property$get_isEntityType() {
			return !!this.get_jstype().meta && !this._isList;
		},

		get_isEntityListType: function Property$get_isEntityListType() {
			return !!this.get_jstype().meta && this._isList;
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

		get_label: function Property$get_label() {
			return this._label;
		},

		get_name: function Property$get_name() {
			return this._name;
		},
		get_path: function Property$get_path() {
			return this._isStatic ? (this._containingType.get_fullName() + "." + this._name) : this._name;
		},
		canSetValue: function Property$canSetValue(obj, val) {
			// only allow values of the correct data type to be set in the model
			if (val === null || val === undefined) {
				return true;
			}

			if (val.constructor) {
				// for entities check base types as well
				if (val.constructor.meta) {
					for (var valType = val.constructor.meta; valType; valType = valType.baseType) {
						if (valType._jstype === this._jstype) {
							return true;
						}
					}

					return false;
				}
				else {
					return val.constructor === this._jstype;
				}
			}
			else {
				var valObjectType;

				switch (typeof (val)) {
					case "string": valObjectType = String; break;
					case "number": valObjectType = Number; break;
					case "boolean": valObjectType = Boolean; break;
				}

				return valObjectType === this._jstype;
			}
		},
		value: function Property$value(obj, val, args) {
			var target = (this._isStatic ? this._containingType.get_jstype() : obj);

			if (target === undefined || target === null) {
				ExoWeb.trace.throwAndLog(["model"],
					"Cannot {0} value for {1}static property \"{2}\" on type \"{3}\": target is null or undefined.",
					[(arguments.length > 1 ? "set" : "get"), (this._isStatic ? "" : "non-"), this.get_path(), this._containingType.get_fullName()]);
			}

			if (arguments.length > 1) {
				if (this.isInited(target))
					this._setter(target, val, false, args);
				else
					this.init(target, val);
			}
			else {
				return this._getter(target);
			}
		},
		init: function Property$init(obj, val, force) {
			var target = (this._isStatic ? this._containingType.get_jstype() : obj);
			var curVal = target[this._fieldName];

			if (curVal !== undefined && !(force === undefined || force)) {
				return;
			}

			//				if(!window.entities)
			//					window.entities = {};

			//				var key = this.get_containingType().get_fullName() + ":" + this._name + ":" + (obj ? obj.meta.id : "STATIC");
			//				if(!window.entities[key]){
			//					window.entities[key] = 0;
			//				}

			target[this._fieldName] = val;

			if (val instanceof Array) {
				var _this = this;
				Sys.Observer.makeObservable(val);
				Sys.Observer.addCollectionChanged(val, function Property$collectionChanged(sender, args) {
					if (!LazyLoader.isLoaded(val)) {
						ExoWeb.trace.logWarning("model", "{0} list {1}.{2} was modified but it has not been loaded.", [
							_this._isStatic ? "Static" : "Non-static",
							_this._isStatic ? _this._containingType.get_fullName() : "this<" + _this._containingType.get_fullName() + ">",
							_this._name
						]);
					}

					// NOTE: property change should be broadcast before rules are run so that if 
					// any rule causes a roundtrip to the server these changes will be available
					_this._containingType.get_model().notifyListChanged(target, _this, args.get_changes());

					// NOTE: oldValue is not currently implemented for lists
					_this._raiseEvent("changed", [target, { property: _this, newValue: val, oldValue: undefined, changes: args.get_changes(), wasInited: true, collectionChanged: true}]);

					Sys.Observer.raisePropertyChanged(target, _this._name);
				});
			}
			var handler = this._getEventHandler("changed");
			if (handler)
				handler(target, { property: this, newValue: val, oldValue: undefined, wasInited: false });

			Sys.Observer.raisePropertyChanged(target, this._name);

			// Return the property to support method chaining
			return this;
		},
		isInited: function Property$isInited(obj) {
			var target = (this._isStatic ? this._containingType.get_jstype() : obj);
			return target.hasOwnProperty(this._fieldName);
		},

		// starts listening for get events on the property. Use obj argument to
		// optionally filter the events to a specific object
		addGet: function Property$addGet(handler, obj) {
			var f;

			if (obj) {
				f = function (target, property, value, isInited) {
					if (obj === target) {
						handler(target, property, value, isInited);
					}
				};
			}
			else {
				f = handler;
			}

			this._addEvent("get", f);

			// Return the property to support method chaining
			return this;
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
		// Adds a rule to the property that will update its value based on a calculation.
		calculated: function (options, conditionType) {
			new CalculatedPropertyRule(options.rootType ? options.rootType.meta : this._containingType, {
				property: this._name,
				basedOn: options.basedOn,
				fn: options.fn,
				isAsync: options.isAsync
			}, conditionType);

			return this;
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
				return (this._isStatic ? this._containingType.get_fullName() : "this") + "." + this._name;
			}
		},
		label: function (label) {
			this._label = label;
			return this;
		},
		required: function (conditionType) {
			new ExoWeb.Model.Rule.required(this._containingType, { property: this._name }, conditionType);
			return this;
		},
		allowedValues: function (source, conditionType) {
			new ExoWeb.Model.Rule.allowedValues(this._containingType, { property: this._name, source: source }, conditionType);
			return this;
		},
		compare: function (operator, source, conditionType) {
			new ExoWeb.Model.Rule.compare(this._containingType, { property: this._name, compareOperator: operator, compareSource: source }, conditionType);
			return this;
		},
		range: function (min, max, conditionType) {
			new ExoWeb.Model.Rule.range(this._containingType, { property: this._name, min: min, max: max }, conditionType);
			return this;
		},
		requiredIf: function (source, operator, value, conditionType) {
			if (typeof (source) === "string") {
				new ExoWeb.Model.Rule.requiredIf(this._containingType, { property: this._name, compareSource: source, compareOperator: operator, compareValue: value }, conditionType);
			}
			else {
				new ExoWeb.Model.Rule.requiredIfExpressions(this._containingType, { property: this._name, fn: source.fn, dependsOn: source.dependsOn }, conditionType);
			}
			return this;
		},
		requiredIfExpressions: function (options, conditionType) {
			new ExoWeb.Model.Rule.requiredIfExpressions(this._containingType, { property: this._name, fn: options.fn, dependsOn: options.dependsOn }, conditionType);
			return this;
		},
		errorIfExpressions: function (options, conditionType) {
			new ExoWeb.Model.Rule.errorIfExpressions(this._containingType, { property: this._name, fn: options.fn, dependsOn: options.dependsOn, errorMessage: options.errorMessage, isWarning: options.isWarning }, conditionType);
			return this;
		},
		stringLength: function (min, max, conditionType) {
			new ExoWeb.Model.Rule.stringLength(this._containingType, { property: this._name, min: min, max: max }, conditionType);
			return this;
		}
	});
	Property.mixin(ExoWeb.Functor.eventing);
	ExoWeb.Model.Property = Property;
	Property.registerClass("ExoWeb.Model.Property");

	// #endregion

	// #region PathTokens
	//////////////////////////////////////////////////

	function PathTokens(expression) {
		this.expression = expression;

		// replace "." in type casts so that they do not interfere with splitting path
		expression = expression.replace(/<[^>]*>/ig, function(e) { return e.replace(/\./ig, function() { return "$_$"; }); });

		if (expression.length > 0) {
			this.steps = expression.split(".").map(function(step) {
				var parsed = step.match(/^([a-z0-9_]+)(<([a-z0-9_$]+)>)?$/i);

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
			paths.forEach(function(p) {
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
					ExoWeb.trace.throwAndLog("model", "Unclosed '{' in path: {0}", [p]);
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

	// #region PropertyChain
	//////////////////////////////////////////////////

	function PropertyChain(rootType, pathTokens/*, lazyLoadTypes, callback*/) {
		/// <summary>
		/// Encapsulates the logic required to work with a chain of properties and
		/// a root object, allowing interaction with the chain as if it were a 
		/// single property of the root object.
		/// </summary>

		this._rootType = rootType;
		var type = rootType;
		var chain = this;

		this._properties = [];
		this._filters = [];

		// initialize optional arguments
		var lazyLoadTypes = arguments.length >= 3 && arguments[2] && arguments[2].constructor === Boolean ? arguments[2] : false;
		var callback = arguments.length >= 4 && arguments[3] && arguments[3] instanceof Function ? arguments[3] : null;
		var allowAsync = !!(lazyLoadTypes && callback);

		// process each step in the path either synchronously or asynchronously depending on arguments
		var processStep = function PropertyChain$processStep() {
			var step = Array.dequeue(pathTokens.steps);

			if (!step) {
				ExoWeb.trace.throwAndLog("model", "Syntax error in property path: {0}", [pathTokens.expression]);
			}

			var prop = type.property(step.property, true);

			if (!prop) {
				ExoWeb.trace.throwAndLog("model", "Path '{0}' references an unknown property: {1}.{2}." +
					(ExoWeb.Model.LazyLoader.isLoaded(type) ? "" : " The type is not loaded."),
					[pathTokens.expression, type.get_fullName(), step.property]);
			}

			chain._properties.push(prop);

			if (step.cast) {
				type = type.get_model().type(step.cast);

				if (!type) {
					ExoWeb.trace.throwAndLog("model", "Path '{0}' references an unknown type: {1}", [pathTokens.expression, step.cast]);
				}

				var jstype = type.get_jstype();
				chain._filters[chain._properties.length] = function(target) {
					return target instanceof jstype;
				};
			}
			else {
				type = prop.get_jstype().meta;
			}

			if (pathTokens.steps.length === 0) {
				// processing the path is complete, verify that chain is not zero-length
				if (chain._properties.length === 0) {
					ExoWeb.trace.throwAndLog(["model"], "PropertyChain cannot be zero-length.");
				}

				// if asynchronous processing was allowed, invoke the callback
				if (allowAsync) {
					callback(chain);
				}
			}
			else {
				// process the next step in the path, first ensuring that the type is loaded if lazy loading is allowed
				if (allowAsync && !LazyLoader.isLoaded(type)) {
					LazyLoader.load(type, null, processStep);
				}
				else {
					processStep();
				}
			}
		};

		// begin processing steps in the path
		if (!LazyLoader.isLoaded(type)) {
			LazyLoader.load(type, null, processStep);
		}
		else {
			processStep();
		}
	}

	PropertyChain.prototype = {
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
		each: function PropertyChain$each(obj, callback, propFilter /*, target, p, lastProp*/) {
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
			///     chain.each(target, callback, ListPropB);
			/// ...will iterate of the values of the list property only.
			/// </param>

			if (!callback || typeof (callback) != "function") {
				ExoWeb.trace.throwAndLog(["model"], "Invalid Parameter: callback function");
			}

			if (!obj) {
				ExoWeb.trace.throwAndLog(["model"], "Invalid Parameter: source object");
			}

			// invoke callback on obj first
			var target = arguments[3] || obj;
			var lastProp = arguments[5] || null;
			for (var p = arguments[4] || 0; p < this._properties.length; p++) {
				var prop = this._properties[p];
				var canSkipRemainingProps = propFilter && lastProp === propFilter;
				var enableCallback = (!propFilter || lastProp === propFilter);

				if (target instanceof Array) {
					// if the target is a list, invoke the callback once per item in the list
					for (var i = 0; i < target.length; ++i) {
						// take into account any any chain filters along the way
						if (!this._filters[p] || this._filters[p](target[i])) {

							if (enableCallback && callback(target[i], prop) === false) {
								return false;
							}

							// continue along the chain for this list item
							if (!canSkipRemainingProps && this.each(obj, callback, propFilter, target[i]["get_" + prop.get_name()](), p + 1, prop) === false) {
								return false;
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
					if (enableCallback && callback(target, prop) === false) {
						return false;
					}
				}

				// if a property filter is used and was just evaluated, stop early
				if (canSkipRemainingProps) {
					break;
				}

				// move to next property in the chain
				target = target["get_" + prop.get_name()]();

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
			var parts = [];
			if (this._properties[startIndex].get_isStatic()) {
				parts.push(this._properties[startIndex].get_containingType().get_fullName());
			}

			this._properties.slice(startIndex).forEach(function(p) { parts.push(p.get_name()); });

			return parts.join(".");
		},
		firstProperty: function PropertyChain$firstProperty() {
			return this._properties[0];
		},
		lastProperty: function PropertyChain$lastProperty() {
			return this._properties[this._properties.length - 1];
		},
		lastTarget: function PropertyChain$lastTarget(obj, exitEarly) {
			for (var p = 0; p < this._properties.length - 1; p++) {
				var prop = this._properties[p];

				// exit early (and return undefined) on null or undefined
				if (exitEarly === true && (obj === undefined || obj === null)) {
					return;
				}

				obj = prop.value(obj);
			}
			return obj;
		},
		prepend: function PropertyChain$prepend(prop) {
			var newProps = prop.all();
			for (var p = newProps.length - 1; p >= 0; p--) {
				Array.insert(this._properties, 0, newProps[p]);
			}
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

			this.each(fromRoot, function(target) {
				if (target === toObj) {
					connected = true;
					return false;
				}
			}, viaProperty);

			return connected;
		},
		rootedPath: function PropertyChain$rootedPath(rootType) {
			for (var i = 0; i < this._properties.length; i++) {
				if (this._properties[i].isDefinedBy(rootType)) {
					var path = this._getPathFromIndex(i);
					return (this._properties[i]._isStatic ? this._properties[i].get_containingType().get_fullName() : "this") + "." + path;
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
		// starts listening for change events along the property chain on any known instances. Use obj argument to
		// optionally filter the events to a specific object
		addChanged: function PropertyChain$addChanged(handler, obj, once, tolerateNulls) {
			var chain = this;

			function raiseHandler(sender, args) {
				// Copy the original arguments so that we don't affect other code
				var newArgs = Object.copy(args);

				// Reset property to be the chain, but store the original property as "triggeredBy"
				newArgs.triggeredBy = newArgs.property;
				newArgs.property = chain;

				// Call the handler, passing through the arguments
				handler(sender, newArgs);
			}

			if (this._properties.length == 1) {
				// OPTIMIZATION: no need to search all known objects for single property chains
				this._properties[0].addChanged(raiseHandler, obj, once);
			}
			else {
				Array.forEach(this._properties, function(prop, index) {
					var priorProp = (index === 0) ? undefined : chain._properties[index - 1];
					if (obj) {
						// CASE: using object filter
						prop.addChanged(function PropertyChain$_raiseChanged$1Obj(sender, args) {
							if (chain.connects(obj, sender, priorProp)) {
								args.originalSender = sender;
								raiseHandler(obj, args);
							}
						}, null, once);
					}
					else {
						// CASE: no object filter
						prop.addChanged(function PropertyChain$_raiseChanged$Multi(sender, args) {
							// scan all known objects of this type and raise event for any instance connected
							// to the one that sent the event.
							Array.forEach(chain._rootType.known(), function(known) {
								if (chain.isInited(known, tolerateNulls) && chain.connects(known, sender, priorProp)) {
									args.originalSender = sender;
									raiseHandler(known, args);
								}
							});
						}, null, once);
					}
				});
			}

			// Return the property to support method chaining
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
		rules: function(targetsThis) {
			return this.lastProperty().rules(targetsThis);
		},
		value: function PropertyChain$value(obj, val, customInfo) {
			var target = this.lastTarget(obj, true);
			var prop = this.lastProperty();

			if (arguments.length > 1) {
				prop.value(target, val, customInfo);
			}
			else {
				return (target !== undefined && target !== null) ? prop.value(target) : null;
			}
		},
		// tolerateNull added to accomodate situation where calculated rules where not
		// executing due to empty values before the end of the PropertyChain.  When tolerateNull
		// is true, isInited will not return false if the entire chain isn't inited.
		isInited: function PropertyChain$isInited(obj, tolerateNull) {
			var allInited = true;
			var numProperties = 0;
			var emptyList = false;

			this.each(obj, function(target, property) {
				numProperties++;
				if (!property.isInited(target)) {
					allInited = false;
					return false;
				}
				else if (property.get_isList() === true) {
					// Break early on empty list that has been loaded.
					var value = property.value(target);
					if (value.length === 0 && LazyLoader.isLoaded(value)) {
						emptyList = true;
						return false;
					}
				}
			});

			if (numProperties < this._properties.length && !tolerateNull && !emptyList) {
				allInited = false;
//					ExoWeb.trace.log("model", "Path \"{0}\" is not inited since \"{1}\" is undefined.", [this.get_path(), this._properties[numProperties - 1].get_name()]);
			}
			else if (allInited) {
//					ExoWeb.trace.log("model", "Path \"{0}\" has been inited.", [this.get_path()]);
			}
			else {
//					ExoWeb.trace.log("model", "Path \"{0}\" has NOT been inited.", [this.get_path()]);
			}

			return allInited;
		},
		toString: function PropertyChain$toString() {
			if (this._isStatic) {
				return this.get_path();
			}
			else {
				var path = this._properties.map(function(e) { return e.get_name(); }).join(".");
				return $format("this<{0}>.{1}", [this.get_containingType(), path]);
			}
		}
	};

	ExoWeb.Model.PropertyChain = PropertyChain;
	PropertyChain.registerClass("ExoWeb.Model.PropertyChain");

	// #endregion

	// #region ObjectMeta
	//////////////////////////////////////////////////

	function ObjectMeta(type, obj) {
		this._obj = obj;
		this.type = type;
		this._conditions = [];
		this._propertyConditions = {};
	}

	ObjectMeta.mixin({
		get_entity: function() {
			return this._obj;
		},
		executeRules: function ObjectMeta$executeRules(prop) {
			this.type.get_model()._validatedQueue.push({ sender: this, property: prop.get_name() });
			this._raisePropertyValidating(prop.get_name());

			this.type.executeRules(this._obj, prop);
		},
		property: function ObjectMeta$property(propName, thisOnly) {
			return this.type.property(propName, thisOnly);
		},
		clearConditions: function ObjectMeta$clearConditions(origin) {
			var conditions = this._conditions;

			for (var i = conditions.length - 1; i >= 0; --i) {
				var condition = conditions[i];

				if (!origin || condition.get_origin() == origin) {
					this._removeCondition(i);
					this._raisePropertiesValidated(condition.get_properties());
				}
			}
		},

		conditionIf: function ObjectMeta$conditionIf(condition, when) {
			// always remove and re-add the condition to preserve order
			var idx = -1;
			for (var i = 0; i < this._conditions.length; i++) {
				if (this._conditions[i].get_type() === condition.get_type()) {
					idx = i;
					break;
				}
			}

			if (idx >= 0) {
				this._removeCondition(idx);
			}

			if (when) {
				this._addCondition(condition);
			}

			if ((idx < 0 && when) || (idx >= 0 && !when)) {
				this._raisePropertiesValidated(condition.get_properties());
			}
		},

		_addCondition: function (condition) {
			condition.get_targets().add(this);
			this._conditions.push(condition);

			// update _propertyConditions
			var props = condition.get_properties();
			for (var i = 0; i < props.length; ++i) {
				var propName = props[i].get_name();
				var pi = this._propertyConditions[propName];

				if (!pi) {
					pi = [];
					this._propertyConditions[propName] = pi;
				}

				pi.push(condition);
			}

			this._raiseEvent("conditionsChanged", [this, { condition: condition, add: true, remove: false }]);
		},

		_removeCondition: function (idx) {
			var condition = this._conditions[idx];
			condition.get_targets().remove(this);
			this._conditions.splice(idx, 1);

			// update _propertyConditions
			var props = condition.get_properties();
			for (var i = 0; i < props.length; ++i) {
				var propName = props[i].get_name();
				var pi = this._propertyConditions[propName];

				var piIdx = $.inArray(condition, pi);
				pi.splice(piIdx, 1);
			}

			this._raiseEvent("conditionsChanged", [this, { condition: condition, add: false, remove: true }]);
		},

		_isAllowedOne: function ObjectMeta$_isAllowedOne(code) {
			var conditionType = ConditionType.get(code);

			if (conditionType !== undefined) {
				if (!(conditionType instanceof ConditionType.Permission)) {
					ExoWeb.trace.throwAndLog(["conditions"], "Condition type \"{0}\" should be a Permission.", [code]);
				}

				for (var i = 0; i < this._conditions.length; i++) {
					var condition = this._conditions[i];
					if (condition.get_type() == conditionType) {
						return conditionType.get_isAllowed();
					}
				}

				return !conditionType.get_isAllowed();
			}

			return undefined;
		},

		isAllowed: function ObjectMeta$isAllowed(/*codes*/) {
			if (arguments.length === 0) {
				return undefined;
			}

			for (var i = 0; i < arguments.length; i++) {
				var allowed = this._isAllowedOne(arguments[i]);
				if (!allowed) {
					return allowed;
				}
			}

			return true;
		},

		conditions: function ObjectMeta$conditions(propOrOptions) {
			if (!propOrOptions) return this._conditions;

			// backwards compatible with original property-only querying
			var options = (propOrOptions instanceof Property || propOrOptions instanceof PropertyChain) ?
				{ property: propOrOptions } :
				propOrOptions;

			return filter(this._conditions, function(condition) {
				return (!options.property || condition.get_properties().some(function(p) { return p.equals(options.property); })) &&
					(!options.set || condition.get_type().get_sets().indexOf(options.set) >= 0) &&
					(!options.target || condition.get_targets().some(function(t) { return t.get_entity() === options.target; })) &&
					(!options.type || condition.get_type() === options.type);
			});
		},

		_raisePropertiesValidated: function (properties) {
			var queue = this.type.get_model()._validatedQueue;
			for (var i = 0; i < properties.length; ++i) {
				queue.push({ sender: this, property: properties[i].get_name() });
			}
		},
		addPropertyValidated: function (propName, handler) {
			this._addEvent("propertyValidated:" + propName, handler);
		},
		_raisePropertyValidating: function (propName) {
			var queue = this.type.get_model()._validatingQueue;
			queue.push({ sender: this, propName: propName });
		},
		addPropertyValidating: function (propName, handler) {
			this._addEvent("propertyValidating:" + propName, handler);
		},
		destroy: function () {
			this.type.unregister(this.obj);
		},
		// starts listening for change events on the conditions array. Use obj argument to
		// optionally filter the events to a specific condition type by passing either
		// the condition type code or type itself.
		addConditionsChanged: function ObjectMeta$addConditionsChanged(handler, obj) {
			var filter;
			if (obj) {
				//check for condition type code.
				if (obj.constructor === String)
					obj = ConditionType.get(obj);

				if (!obj)
					throw obj + " not found";

				filter = function (target, args) {
					if (args.condition._type === obj) {
						handler.apply(this, arguments);
					}
				};
			}

			this._addEvent("conditionsChanged", handler, filter); ;

			// Return the object meta to support method chaining
			return this;
		},
		removeConditionsChanged: function ObjectMeta$removeConditionsChanged(handler) {
			this._removeEvent("conditionsChanged", handler);
		}
	});

	ObjectMeta.mixin(ExoWeb.Functor.eventing);
	ExoWeb.Model.ObjectMeta = ObjectMeta;
	ObjectMeta.registerClass("ExoWeb.Model.ObjectMeta");

	// #endregion

	// #region Rule
	//////////////////////////////////////////////////

	function Rule() { }

	Rule.register = function Rule$register(rule, inputs, isAsync, typeFilter, callback, thisPtr) {
		rule.isAsync = !!isAsync;

		rule.inputs = inputs.map(function(item) {
			if (item instanceof RuleInput) {
				return item;
			}
			else {
				var input = new RuleInput(item);
				if(item.get_origin() === "client")
					input.set_dependsOnInit(true);

				// If inputs are not setup up front then they are 
				// assumed to be a target of the rule.

				input.set_isTarget(true);
				return input;
			}
		});

		// If the type filter was not specified then assume 
		// the containing type of the first input property.
		if (arguments.length < 4) {
			typeFilter = rule.inputs[0].property.get_containingType();
		}

		// register the rule after loading has completed
		typeFilter.get_model().addBeforeContextReady(function() {
			typeFilter.addRule(rule);
			if(callback)
				callback.apply(thisPtr || this);
		});
	};

	Rule.canExecute = function(rule, sender, property) {
		return rule.inputs.every(function(input) { return input.property === property || !input.get_dependsOnInit() || input.property.isInited(sender, true); });
	};

	Rule.ensureError = function Rule$ensureError(ruleName, prop) {
		var generatedCode = $format("{0}.{1}.{2}", [prop.get_containingType().get_fullName(), prop.get_label(), ruleName]);
		var counter = "";

		while(ConditionType.get(generatedCode + counter))
			counter++;

		return new ConditionType.Error(generatedCode + counter, $format("Generated condition type for {0} rule.", [ruleName]));
	};

	Rule.ensureWarning = function Rule$ensureWarning(ruleName, prop, dependsOn) {
		var generatedCode = $format("{0}.{1}.{2}", [prop.get_containingType().get_fullName(), prop.get_label(), ruleName]);
		var counter = "";

		while(ConditionType.get(generatedCode + counter))
			counter++;

		return new ConditionType.Warning(generatedCode + counter, $format("Generated condition type for {0} rule.", [ruleName]));
	};

	Rule.inferInputs = function Rule$inferInputs(rootType, func) {
		var inputs = [];
		var expr = /this\.get_([a-zA-Z0-9_.]+)/g;

		var match = expr.exec(func.toString());
		while (match) {
			inputs.push(new RuleInput(rootType.property(match[1]).lastProperty()));
			match = expr.exec(func.toString());
		}

		return inputs;
	};

	ExoWeb.Model.Rule = Rule;
	Rule.registerClass("ExoWeb.Model.Rule");

	// #endregion

	// #region RuleInput
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
	RuleInput.registerClass("ExoWeb.Model.RuleInput");

	// #endregion

	// #region RequiredRule
	//////////////////////////////////////////////////

	function RequiredRule(mtype, options, ctype) {
		this.prop = mtype.property(options.property, true);

		if (!ctype) {
			ctype = Rule.ensureError("required", this.prop);
		}

		this.err = new Condition(ctype, this.prop.get_label() + " is required", [ this.prop ], this);

		Rule.register(this, [ this.prop ]);
	}

	RequiredRule.hasValue = function RequiredRule$hasValue(obj, prop) {
		var val = arguments.length === 1 ? obj : prop.value(obj);

		if (val instanceof Array) {
			return val.length > 0;
		}
		else if (val === undefined || val === null) {
			return false;
		}
		else if (val.constructor === String) {
			return $.trim(val) !== "";
		}
		else {
			return true;
		}
	};

	RequiredRule.prototype = {
		execute: function(obj) {
			obj.meta.conditionIf(this.err, !RequiredRule.hasValue(obj, this.prop));
		},
		toString: function() {
			return $format("{0}.{1} is required", [this.prop.get_containingType().get_fullName(), this.prop.get_name()]);
		}
	};

	Rule.required = RequiredRule;

	// #endregion

	// #region RangeRule
	//////////////////////////////////////////////////

	function RangeRule(mtype, options, ctype) {
		this.prop = mtype.property(options.property, true);
		var properties = [ this.prop ];

		if (!ctype)
			ctype = Rule.ensureError("range", this.prop);

		this.ctype = ctype;

		this.min = options.min;
		this.max = options.max;

		var hasMin = (this.min !== undefined && this.min !== null);
		var hasMax = (this.max !== undefined && this.max !== null);

		if (hasMin && hasMax) {
			this._formatString = "{0} must be between {1} and {2}";
			this._formatArgs = function() { return [this.prop.format(this.min), this.prop.format(this.max)]; };
			this._test = this._testMinMax;
		}
		else if (hasMin) {
			this._formatString = "{0} must be at least {1}";
			this._formatArgs = function() { return [this.prop.format(this.min)]; };
			this._test = this._testMin;
		}
		else if (hasMax) {
			this._formatString = "{0} must be no more than {1}";
			this._formatArgs = function() { return [this.prop.format(this.max)]; };
			this._test = this._testMax;
		}

		Rule.register(this, properties);
	}

	RangeRule.prototype = {
		err: function () {
			return new Condition(this.ctype, $format(this._formatString, [this.prop.get_label()].concat(this._formatArgs.call(this))), [this.prop], this);
		},
		execute: function (obj) {
			var val = this.prop.value(obj);
			var isNull = val == null || val == undefined;
			obj.meta.conditionIf(this.err(), !isNull && this._test(val));
		},
		_testMinMax: function (val) {
			return val < this.min || val > this.max;
		},
		_testMin: function (val) {
			return val < this.min;
		},
		_testMax: function (val) {
			return val > this.max;
		},
		toString: function () {
			return $format("{0}.{1} in range, min: {2}, max: {3}",
				[this.prop.get_containingType().get_fullName(),
				this.prop.get_name(),
				this.min === undefined ? "" : this.min,
				this.max === undefined ? "" : this.max]);
		}
	};

	Rule.range = RangeRule;

	// #endregion

	// #region AllowedValuesRule
	//////////////////////////////////////////////////

	function AllowedValuesRule(mtype, options, ctype) {
		this.prop = mtype.property(options.property, true);
		var properties = [ this.prop ];

		if (!ctype) {
			ctype = Rule.ensureError("allowedValues", this.prop);
		}

		this._allowedValuesPath = options.source;
		this._inited = false;

		this.err = new Condition(ctype, $format("{0} has an invalid value", [this.prop.get_label()]), properties, this);

		var register = (function AllowedValuesRule$register(type) { AllowedValuesRule.load(this, type); }).bind(this);

		// If the type is already loaded, then register immediately.
		if (LazyLoader.isLoaded(this.prop.get_containingType())) {
			register(this.prop.get_containingType().get_jstype());
		}
		// Otherwise, wait until the type is loaded.
		else {
			$extend(this.prop.get_containingType().get_fullName(), register);
		}
	}
	AllowedValuesRule.load = function AllowedValuesRule$load(rule, loadedType) {
		if (!loadedType.meta.baseType || LazyLoader.isLoaded(loadedType.meta.baseType)) {
			var inputs = [];

			var targetInput = new RuleInput(rule.prop);
			targetInput.set_isTarget(true);
			if (rule.prop.get_origin() === "client")
				targetInput.set_dependsOnInit(true);
			inputs.push(targetInput);

			Model.property(rule._allowedValuesPath, rule.prop.get_containingType(), true, function(chain) {
				rule._allowedValuesProperty = chain;

				var allowedValuesInput = new RuleInput(rule._allowedValuesProperty);
				inputs.push(allowedValuesInput);

				Rule.register(rule, inputs);

				rule._inited = true;
			});
		}
		else {
			$extend(loadedType.meta.baseType.get_fullName(), function(baseType) {
				AllowedValuesRule.load(rule, baseType);
			});
		}
	};
	AllowedValuesRule.prototype = {
		_enforceInited: function AllowedValues$_enforceInited() {
			if (this._inited !== true) {
				ExoWeb.trace.logWarning("rule", "AllowedValues rule on type \"{0}\" has not been initialized.", [this.prop.get_containingType().get_fullName()]);
			}
			return this._inited;
		},
		addChanged: function AllowedValues$addChanged(handler, obj) {
			this._allowedValuesProperty.addChanged(handler, obj);
		},
		execute: function AllowedValuesRule$execute(obj) {
			if (this._enforceInited() === true) {
				// get the current value of the property for the given object
				var val = this.prop.value(obj);
				var allowed = this.values(obj);
				if (allowed !== undefined && LazyLoader.isLoaded(allowed)) {
					obj.meta.conditionIf(this.err, !this.satisfies(obj, val));
				}
			}
		},
		satisfies: function AllowedValuesRule$satisfies(obj, value) {
			this._enforceInited();

			if (value === undefined || value === null) {
				return true;
			}

			// get the list of allowed values of the property for the given object
			var allowed = this.values(obj);

			if (allowed === undefined || !LazyLoader.isLoaded(allowed)) {
				return false;
			}

			// ensure that the value or list of values is in the allowed values list (single and multi-select)				
			if (value instanceof Array) {
				return value.every(function(item) { return Array.contains(allowed, item); });
			}
			else {
				return Array.contains(allowed, value);
			}
		},
		satisfiesAsync: function AllowedValuesRule$satisfiesAsync(obj, value, exitEarly, callback) {
			this._enforceInited();

			this.valuesAsync(obj, exitEarly, function(allowed) {
				if (value === undefined || value === null) {
					callback(true);
				}
				else if (allowed === undefined) {
					callback(false);
				}
				else if (value instanceof Array) {
					callback(value.every(function(item) { return Array.contains(allowed, item); }));
				}
				else {
					callback(Array.contains(allowed, value));
				}
			});

		},
		values: function AllowedValuesRule$values(obj, exitEarly) {
			if (this._enforceInited() && this._allowedValuesProperty && (this._allowedValuesProperty.get_isStatic() || this._allowedValuesProperty instanceof Property || this._allowedValuesProperty.lastTarget(obj, exitEarly))) {

				// get the allowed values from the property chain
				var values = this._allowedValuesProperty.value(obj);

				// ignore if allowed values list is undefined (non-existent or unloaded type) or has not been loaded
				return values;
			}
		},
		valuesAsync: function AllowedValuesRule$valuesAsync(obj, exitEarly, callback) {
			if (this._enforceInited()) {

				var values;

				if (this._allowedValuesProperty.get_isStatic() || this._allowedValuesProperty instanceof Property || this._allowedValuesProperty.lastTarget(obj, exitEarly)) {
					// get the allowed values from the property chain
					values = this._allowedValuesProperty.value(obj);
				}

				if (values !== undefined) {
					LazyLoader.load(values, null, function() {
						callback(values);
					});
				}
				else {
					callback(values);
				}
			}
		},
		toString: function AllowedValuesRule$toString() {
			return $format("{0}.{1} allowed values = {2}", [this.prop.get_containingType().get_fullName(), this.prop.get_name(), this._allowedValuesPath]);
		}
	};

	Rule.allowedValues = AllowedValuesRule;

	// #endregion

	// #region CompareRule
	//////////////////////////////////////////////////

	function CompareRule(mtype, options, ctype) {
		this.prop = mtype.property(options.property, true);
		var properties = [ this.prop ];

		if (!ctype) {
			ctype = Rule.ensureError($format("compare {0} {1}", [options.compareOperator, options.compareSource]), this.prop);
		}
		this.ctype = ctype;

		this._comparePath = options.compareSource;
		this._compareOp = options.compareOperator;

		this._inited = false;

		// Function to register this rule when its containing type is loaded.
		var register = (function CompareRule$register(ctype) { CompareRule.load(this, ctype); }).bind(this);

		// If the type is already loaded, then register immediately.
		if (LazyLoader.isLoaded(this.prop.get_containingType())) {
			CompareRule.load(this, this.prop.get_containingType().get_jstype());
		}
		// Otherwise, wait until the type is loaded.
		else {
			$extend(this.prop.get_containingType().get_fullName(), register);
		}
	}

	CompareRule.load = function CompareRule$load(rule, loadedType) {
		if (!loadedType.meta.baseType || LazyLoader.isLoaded(loadedType.meta.baseType)) {
			var inputs = [];

			var targetInput = new RuleInput(rule.prop);
			targetInput.set_isTarget(true);
			if (rule.prop.get_origin() === "client")
				targetInput.set_dependsOnInit(true);
			inputs.push(targetInput);

			Model.property(rule._comparePath, rule.prop.get_containingType(), true, function(chain) {
				rule._compareProperty = chain;

				var compareInput = new RuleInput(rule._compareProperty);
				inputs.push(compareInput);

				Rule.register(rule, inputs);

				rule._inited = true;

				if (chain.get_jstype() === Boolean && rule._compareOp == "NotEqual" && (rule._compareValue === undefined || rule._compareValue === null)) {
					rule._compareOp = "Equal";
					rule._compareValue = true;
				}
			});
		}
		else {
			$extend(loadedType.meta.baseType.get_fullName(), function(baseType) {
				CompareRule.load(rule, baseType);
			});
		}
	};

	CompareRule.compare = function CompareRule$compare(srcValue, cmpOp, cmpValue, defaultValue) {
		if (cmpValue === undefined || cmpValue === null) {
			switch (cmpOp) {
				case "Equal": return !RequiredRule.hasValue(srcValue);
				case "NotEqual": return RequiredRule.hasValue(srcValue);
			}
		}

		if (srcValue !== undefined && srcValue !== null && cmpValue !== undefined && cmpValue !== null) {
			switch (cmpOp) {
				case "Equal": return srcValue == cmpValue;
				case "NotEqual": return srcValue != cmpValue;
				case "GreaterThan": return srcValue > cmpValue;
				case "GreaterThanEqual": return srcValue >= cmpValue;
				case "LessThan": return srcValue < cmpValue;
				case "LessThanEqual": return srcValue <= cmpValue;
			}
			// Equality by default.
			return srcValue == cmpValue;
		}

		return defaultValue;
	};

	CompareRule.prototype = {
		satisfies: function Compare$satisfies(obj) {
			if (!this._compareProperty) {
				return true;
			}

			var srcValue = this.prop.value(obj);
			var cmpValue = this._compareProperty.value(obj);
			return CompareRule.compare(srcValue, this._compareOp, cmpValue, true);
		},
		execute: function CompareRule$execute(obj) {
			if (this._inited === true) {

				var isValid = this.satisfies(obj);

				var message = isValid ? '' : $format("{0} must be {1}{2} {3}", [
					this.prop.get_label(),
					ExoWeb.makeHumanReadable(this._compareOp).toLowerCase(),
					(this._compareOp === "GreaterThan" || this._compareOp == "LessThan") ? "" : " to",
					this._compareProperty.get_label()
				]);
				this.err = new Condition(this.ctype, message, [this.prop], this);


				obj.meta.conditionIf(this.err, !isValid);
			}
			else {
				ExoWeb.trace.logWarning("rule", "Compare rule on type \"{0}\" has not been initialized.", [this.prop.get_containingType().get_fullName()]);
			}
		}
	};

	Rule.compare = CompareRule;

	// #endregion

	// #region ErrorIfExpressionsRule
	//////////////////////////////////////////////////

	﻿function ErrorIfExpressionsRule(mtype, options, ctype) {
			this.prop = mtype.property(options.property, true);
			var properties = [ this.prop ];

			this._evaluationFunction = options.fn;
			this._dependsOn = options.dependsOn;
			this._errorMessage = options.errorMessage;
			this._isWarning = options.isWarning;

			if (!ctype && !this._isWarning) {
				ctype = Rule.ensureError("errorIfExpressions", this.prop);
			}
			else if(!ctype && this._isWarning) {
				ctype = Rule.ensureWarning("errorIfExpressions", this.prop);
			}

			if(this._evaluationFunction === undefined || this._evaluationFunction === null || !(this._evaluationFunction instanceof Function)) {
				ExoWeb.trace.logError("rule",
						"Rule configuration error - {0}:  you must define an evaluation function.",
						[this._expressions]);
				return;
			}

			if(this._dependsOn === undefined || this._dependsOn === null || !(this._dependsOn instanceof Array)) {
				ExoWeb.trace.logError("rule",
						"Rule configuration error - {0}:  you must setup dependencies for ErrorIfExpression",
						[this._expressions]);
				return;
			}

			this._inited = false;
			this.err = new Condition(ctype, this._errorMessage, properties, this);

			// Function to register this rule when its containing type is loaded.
			var register = (function ErrorIfExpressionsRule$register(ctype) { this.load(this, ctype); }).bind(this);

			// If the type is already loaded, then register immediately.
			if (LazyLoader.isLoaded(this.prop.get_containingType())) {
				register(this.prop.get_containingType().get_jstype());
			}
			// Otherwise, wait until the type is loaded.
			else {
				$extend(this.prop.get_containingType().get_fullName(), register);
			}
		}

		ErrorIfExpressionsRule.prototype = {
			load: function ErrorIfExpressionsRule$load(rule, loadedType) {
				if (!loadedType.meta.baseType || LazyLoader.isLoaded(loadedType.meta.baseType)) {
					var inputs = [];

					var targetInput = new RuleInput(rule.prop);
					targetInput.set_isTarget(true);
					if (rule.prop.get_origin() === "client")
						targetInput.set_dependsOnInit(true);
					inputs.push(targetInput);

					for(var i = 0; i < rule._dependsOn.length; i++) {
						Model.property(rule._dependsOn[i], rule.prop.get_containingType(), true, function(chain) {
							rule._dependsOn[i] = chain;

							var watchPathInput = new RuleInput(rule._dependsOn[i]);
							inputs.push(watchPathInput);

							Rule.register(rule, inputs);

							rule._inited = true;
						});
					}
				}
				else {
					$extend(loadedType.meta.baseType.get_fullName(), function(baseType) {
						ErrorIfExpressionsRule.load(rule, baseType);
					});
				}
			},
			evaluate: function ErrorIfExpressionsRule$required(obj) {
				return this._evaluationFunction.apply(obj,[ obj["get_" + this.prop.get_name()]() ]);
			},
			satisfies: function ErrorIfRule$satisfies(obj) {
				return !this.evaluate(obj);
			},
			execute: function ErrorIfRule$execute(obj) {
				if (this._inited === true) {
					obj.meta.conditionIf(this.err, !this.satisfies(obj));
				}
				else {
					ExoWeb.trace.logWarning("rule", "ErrorIf rule on type \"{0}\" has not been initialized.", [this.prop.get_containingType().get_fullName()]);
				}
			}
		};

		Rule.errorIfExpressions = ErrorIfExpressionsRule;
	// #endregion

	// #region RequiredIfRule
	//////////////////////////////////////////////////

	function RequiredIfRule(mtype, options, ctype) {
		this.prop = mtype.property(options.property, true);
		var properties = [ this.prop ];

		if (!ctype) {
			ctype = Rule.ensureError("requiredIf", this.prop);
		}

		this._comparePath = options.compareSource;
		this._compareOp = options.compareOperator;
		this._compareValue = options.compareValue;

		if (this._compareOp === undefined || this._compareOp === null) {
			if (this._compareValue !== undefined && this._compareValue !== null) {
				ExoWeb.trace.logWarning("rule",
					"Possible rule configuration error - {0}:  if a compare value is specified, " +
					"then an operator should be specified as well.  Falling back to equality check.",
					[type.get_code()]);
			}
			else {
				this._compareOp = "NotEqual";
			}
		}

		this._inited = false;

		this.err = new Condition(ctype, $format("{0} is required", [this.prop.get_label()]), properties, this);

		// Function to register this rule when its containing type is loaded.
		var register = (function RequiredIfRule$register(ctype) { CompareRule.load(this, ctype); }).bind(this);

		// If the type is already loaded, then register immediately.
		if (LazyLoader.isLoaded(this.prop.get_containingType())) {
			register(this.prop.get_containingType().get_jstype());
		}
		// Otherwise, wait until the type is loaded.
		else {
			$extend(this.prop.get_containingType().get_fullName(), register);
		}
	}

	RequiredIfRule.prototype = {
		required: function RequiredIfRule$required(obj) {
			if (!this._compareProperty) {
				ExoWeb.trace.logWarning("rule",
					"Cannot determine requiredness since the property for path \"{0}\" has not been loaded.",
					[this._comparePath]);
				return;
			}

			var cmpValue = this._compareProperty.value(obj);
			if (cmpValue && cmpValue instanceof String) {
				cmpValue = $.trim(cmpValue);
			}

			return CompareRule.compare(cmpValue, this._compareOp, this._compareValue, false);
		},
		satisfies: function RequiredIfRule$satisfies(obj) {
			return !this.required(obj) || RequiredRule.hasValue(obj, this.prop);
		},
		execute: function RequiredIfRule$execute(obj) {
			if (this._inited === true) {
				obj.meta.conditionIf(this.err, !this.satisfies(obj));
			}
			else {
				ExoWeb.trace.logWarning("rule", "RequiredIf rule on type \"{0}\" has not been initialized.", [this.prop.get_containingType().get_fullName()]);
			}
		}
	};

	Rule.requiredIf = RequiredIfRule;

	// #endregion

	// #region RequiredIfExpressionsRule
	//////////////////////////////////////////////////

	﻿function RequiredIfExpressionsRule(mtype, options, ctype) {
		this.prop = mtype.property(options.property, true);
		var properties = [ this.prop ];

		if (!ctype) {
			ctype = Rule.ensureError("requiredIfExpressions", this.prop);
		}

		this._evaluationFunction = options.fn;
		this._dependsOn = options.dependsOn;

		if(this._evaluationFunction === undefined || this._evaluationFunction === null || !(this._evaluationFunction instanceof Function)) {
			ExoWeb.trace.logError("rule",
					"Rule configuration error - {0}:  you must define an evaluation function.",
					[this._expressions]);
			return;
		}

		if(this._dependsOn === undefined || this._dependsOn === null || !(this._dependsOn instanceof Array)) {
			ExoWeb.trace.logError("rule",
					"Rule configuration error - {0}:  you must setup depencies for RequiredIfExpression",
					[this._expressions]);
			return;
		}

		this._inited = false;
		this.err = new Condition(ctype, $format("{0} is required", [this.prop.get_label()]), properties, this);

		// Function to register this rule when its containing type is loaded.
		var register = (function RequiredIfExpressionsRule$register(ctype) { this.load(this, ctype); }).bind(this);

		// If the type is already loaded, then register immediately.
		if (LazyLoader.isLoaded(this.prop.get_containingType())) {
			register(this.prop.get_containingType().get_jstype());
		}
		// Otherwise, wait until the type is loaded.
		else {
			$extend(this.prop.get_containingType().get_fullName(), register);
		}
	}

	RequiredIfExpressionsRule.prototype = {
		load: function RequiredIfExpressionsRule$load(rule, loadedType) {
			if (!loadedType.meta.baseType || LazyLoader.isLoaded(loadedType.meta.baseType)) {
				var inputs = [];

				var targetInput = new RuleInput(rule.prop);
				targetInput.set_isTarget(true);
				if (rule.prop.get_origin() === "client")
					targetInput.set_dependsOnInit(true);
				inputs.push(targetInput);

				for(var i = 0; i < rule._dependsOn.length; i++) {
					Model.property(rule._dependsOn[i], rule.prop.get_containingType(), true, function(chain) {
						rule._dependsOn[i] = chain;

						var watchPathInput = new RuleInput(rule._dependsOn[i]);
						inputs.push(watchPathInput);

						Rule.register(rule, inputs);

						rule._inited = true;
					});
				}
			}
			else {
				$extend(loadedType.meta.baseType.get_fullName(), function(baseType) {
					RequiredIfExpressionsRule.load(rule, baseType);
				});
			}
		},
		required: function RequiredIfExpressionsRule$required(obj) {
			return this._evaluationFunction.apply(obj, [ obj["get_" + this.prop.get_name()]() ]);
		},
		satisfies: function RequiredIfRule$satisfies(obj) {
			return !this.required(obj) || RequiredRule.hasValue(obj, this.prop);
		},
		execute: function RequiredIfRule$execute(obj) {
			if (this._inited === true) {
				obj.meta.conditionIf(this.err, !this.satisfies(obj));
			}
			else {
				ExoWeb.trace.logWarning("rule", "RequiredIf rule on type \"{0}\" has not been initialized.", [this.prop.get_containingType().get_fullName()]);
			}
		}
	};

	Rule.requiredIfExpressions = RequiredIfExpressionsRule;
	// #endregion

	// #region StringLengthRule
	//////////////////////////////////////////////////

	function StringLengthRule(mtype, options, ctype) {
		this.prop = mtype.property(options.property, true);
		var properties = [ this.prop ];

		if (!ctype) {
			ctype = Rule.ensureError("stringLength", this.prop);
		}

		this.min = options.min;
		this.max = options.max;

		var hasMin = (this.min !== undefined && this.min !== null);
		var hasMax = (this.max !== undefined && this.max !== null);

		if (hasMin && hasMax) {
			this.err = new Condition(ctype, $format("{0} must be between {1} and {2} characters", [this.prop.get_label(), this.min, this.max]), properties, this);
			this._test = this._testMinMax;
		}
		else if (hasMin) {
			this.err = new Condition(ctype, $format("{0} must be at least {1} characters", [this.prop.get_label(), this.min]), properties, this);
			this._test = this._testMin;
		}
		else if (hasMax) {
			this.err = new Condition(ctype, $format("{0} must be no more than {1} characters", [this.prop.get_label(), this.max]), properties, this);
			this._test = this._testMax;
		}

		Rule.register(this, properties);
	}
	StringLengthRule.prototype = {
		execute: function(obj) {
			var val = this.prop.value(obj);
			obj.meta.conditionIf(this.err, this._test(val || ""));
		},
		_testMinMax: function(val) {
			return val.length < this.min || val.length > this.max;
		},
		_testMin: function(val) {
			return val.length < this.min;
		},
		_testMax: function(val) {
			return val.length > this.max;
		},
		toString: function() {
			return $format("{0}.{1} in range, min: {2}, max: {3}",
				[this.prop.get_containingType().get_fullName(),
				this.prop.get_name(),
				this.min == undefined ? "" : this.min,
				this.max === undefined ? "" : this.max]);
		}
	};

	Rule.stringLength = StringLengthRule;

	// #endregion

	// #region CalculatedPropertyRule
	//////////////////////////////////////////////////

	function CalculatedPropertyRule(mtype, options, ctype) {
		var prop = this.prop = mtype.property(options.property, true);

		this.isAsync = options.isAsync; 
		this.calculateFn = options.fn;

		if (options.basedOn) {
			var signal = new Signal("calculated property dependencies");
			var inputs = [];

			// setup loading of each property path that the calculation is based on
			Array.forEach(options.basedOn, function (p, i) {
				var dependsOnChange;
				var dependsOnInit = true;

				// if the event was specified then parse it
				var parts = p.split(" of ");
				if (parts.length >= 2) {
					var events = parts[0].split(",");
					dependsOnInit = (events.indexOf("init") >= 0);
					dependsOnChange = (events.indexOf("change") >= 0);
				}

				var path = (parts.length >= 2) ? parts[1] : p;
				Model.property(path, mtype, true, signal.pending(function(chain) {
					var input = new RuleInput(chain);

					if (!input.property) {
						ExoWeb.trace.throwAndLog("model", "Calculated property {0}.{1} is based on an invalid property: {2}", [mtype.get_fullName(), prop._name, p]);
					}

					input.set_dependsOnInit(dependsOnInit);
					if (dependsOnChange !== undefined) {
						input.set_dependsOnChange(dependsOnChange);
					}

					inputs.push(input);
				}));
			});

			// wait until all property information is available to initialize the calculation
			signal.waitForAll(function () {
				ExoWeb.Batch.whenDone(function () {
					register.call(this, inputs);
				}, this);
			}, this);
		}
		else {
			var inferredInputs = Rule.inferInputs(mtype, options.fn);
			inferredInputs.forEach(function (input) {
				input.set_dependsOnInit(true);
			});
			register.call(this, inferredInputs);
		}

		function register(inputs) {
			// calculated property should always be initialized when first accessed
			var input = new RuleInput(this.prop);
			input.set_dependsOnGet(true);
			input.set_dependsOnChange(false);
			input.set_isTarget(true);
			inputs.push(input);

			Rule.register(this, inputs, options.isAsync, mtype, function () {
				// Static check to determine if running when registered makes sense for this calculation based on its inputs.
				if (this.canExecute(null, null, true)) {
					// Execute for existing instances if their initialization state allows it.
					mtype.known().forEach(function (obj) {
						if (this.canExecute(obj, null, true)) {
							try {
								this._isExecuting = true;
								//ExoWeb.trace.log("rule", "executing rule '{0}' when initialized", [rule]);
								this.execute(obj);
							}
							catch (err) {
								ExoWeb.trace.throwAndLog("rules", "Error running rule '{0}': {1}", [this, err]);
							}
							finally {
								this._isExecuting = false;
							}
						}
					}, this);
				}
			}, this);
		}
	}

	CalculatedPropertyRule.mixin({
		canExecute: function(sender, property, retroactive) {
			// If there is no event, check if the calculation is based on some initialization, then defer to the default
			// input check. This is done so that rules that are based on property changes alone do not fire when created,
			// but calculations that are based on property initialization are allowed to fire if possible.
			return (!!property || (!!retroactive && this.inputs.filter(function (input) { return input.get_dependsOnInit(); }).length > 0)) &&
				// If no sender exists then this is a static check that is only dependent on the rule's inputs
				// and not the initialization state of any particular object. If no event is firing (property
				// argument is undefined) then the property argument will be the property that the rule is
				// attached to, which should have no effect on the outcome.
				(!sender || Rule.canExecute(this, sender, property || this.prop));
		},
		execute: function Property$calculated$execute(obj, callback) {
			var signal = new Signal("calculated rule");
			var prop = this.prop;

			if (prop._isList) {
				// Initialize list if needed.  A calculated list property cannot depend on initialization 
				// of a server-based list property since initialization is done when the object is constructed 
				// and before data is available.  If it depends only on the change of the server-based list 
				// property then initialization will not happen until the property value is requested.
				if (!prop.isInited(obj)) {
					prop.init(obj, []);
				}

				// re-calculate the list values
				var newList;
				if (this.isAsync) {
					this.calculateFn.call(obj, signal.pending(function (result) {
						newList = result;
					}));
				}
				else {
					newList = this.calculateFn.apply(obj);
				}

				signal.waitForAll(function () {
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
					curList.clear();
					curList.addRange(newList);
					curList.endUpdate();

					if (callback) {
						callback(obj);
					}
				}, null, !this.isAsync);
			}
			else {
				var newValue;
				if (this.isAsync) {
					this.calculateFn.call(obj, signal.pending(function (result) {
						newValue = result;
					}));
				}
				else {
					newValue = this.calculateFn.apply(obj);
				}

				signal.waitForAll(function () {
					prop.value(obj, newValue, { calculated: true });

					if (callback) {
						callback(obj);
					}
				}, null, !this.isAsync);
			}
		},
		toString: function () {
			return "calculation of " + this.prop._name;
		}
	});

	ExoWeb.Model.CalculatedPropertyRule = CalculatedPropertyRule;

	// #endregion

	// #region ConditionTypeSet
	//////////////////////////////////////////////////

	function ConditionTypeSet(name) {
		if (allConditionTypeSets[name]) {
			ExoWeb.trace.throwAndLog("conditions", "A set with the name \"{0}\" has already been created.", [name]);
		}

		this._name = name;
		this._types = [];
		this._active = false;

		allConditionTypeSets[name] = this;
	}

	var allConditionTypeSets = {};

	ConditionTypeSet.all = function ConditionTypeSet$all() {
		/// <summary>
		/// Returns an array of all condition type sets that have been created.
		/// Not that the array is created each time the function is called.
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
		get_name: function ConditionTypeSet$get_name() {
			return this._name;
		},
		get_types: function ConditionTypeSet$get_types() {
			return this._types;
		},
		get_active: function ConditionTypeSet$get_active() {
			return this._active;
		},
		set_active: function ConditionTypeSet$set_active(value) {
			if (value === true && !this._active) {
				this._raiseEvent("activated");
			}
			else if (value === false && this._active === true) {
				this._raiseEvent("deactivated");
			}

			this._active = value;
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
		}
	};

	ConditionTypeSet.mixin(ExoWeb.Functor.eventing);

	ExoWeb.Model.ConditionTypeSet = ConditionTypeSet;
	ConditionTypeSet.registerClass("ExoWeb.Model.ConditionTypeSet");

	// #endregion

	// #region ConditionType
	//////////////////////////////////////////////////

	function ConditionType(code, category, message, sets) {
		// So that sub types can use it's prototype.
		if (arguments.length === 0) {
			return;
		}

		if (allConditionTypes[code]) {
			ExoWeb.trace.throwAndLog("conditions", "A condition type with the code \"{0}\" has already been created.", [code]);
		}

		this._code = code;
		this._category = category;
		this._message = message;
		this._sets = (sets === undefined || sets === null) ? [] : sets;
		this._rules = [];

		if (sets && sets.length > 0) {
			Array.forEach(sets, function(s) {
				s._types.push(this);
			}, this);
		}

		allConditionTypes[code] = this;
	}

	var allConditionTypes = {};

	ConditionType.all = function ConditionType$all() {
		/// <summary>
		/// Returns an array of all condition types that have been created.
		/// Not that the array is created each time the function is called.
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
		get_code: function ConditionType$get_code() {
			return this._code;
		},
		get_category: function ConditionType$get_category() {
			return this._category;
		},
		get_message: function ConditionType$get_message() {
			return this._message;
		},
		get_sets: function ConditionType$get_sets() {
			return this._sets;
		},
		rules: function() {
			return Array.prototype.slice.call(this._rules);
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
		}
	}

	ExoWeb.Model.ConditionType = ConditionType;
	ConditionType.registerClass("ExoWeb.Model.ConditionType");

	(function() {
		//////////////////////////////////////////////////////////////////////////////////////
		function Error(code, message, sets) {
			ConditionType.call(this, code, "Error", message, sets);
		}

		Error.prototype = new ConditionType();

		ExoWeb.Model.ConditionType.Error = Error;
		Error.registerClass("ExoWeb.Model.ConditionType.Error", ConditionType);

		//////////////////////////////////////////////////////////////////////////////////////
		function Warning(code, message, sets) {
			ConditionType.call(this, code, "Warning", message, sets);
		}

		Warning.prototype = new ConditionType();

		ExoWeb.Model.ConditionType.Warning = Warning;
		Warning.registerClass("ExoWeb.Model.ConditionType.Warning", ConditionType);

		//////////////////////////////////////////////////////////////////////////////////////
		function Permission(code, message, sets, permissionType, isAllowed) {
			ConditionType.call(this, code, "Permission", message, sets);
			this._permissionType = permissionType;
			this._isAllowed = isAllowed;
		}

		Permission.prototype = new ConditionType();

		Permission.mixin({
			get_permissionType: function Permission$get_permissionType() {
				return this._permissionType;
			},
			get_isAllowed: function Permission$get_isAllowed() {
				return this._isAllowed;
			}
		});

		ExoWeb.Model.ConditionType.Permission = Permission;
		Permission.registerClass("ExoWeb.Model.ConditionType.Permission", ConditionType);
	})();

	// #endregion

	// #region Condition
	//////////////////////////////////////////////////

	function Condition(type, message, relatedProperties, origin) {
		this._type = type;
		this._properties = relatedProperties || [];
		this._message = message;
		this._origin = origin;
		this._targets = [];

		Sys.Observer.makeObservable(this._targets);
	}

	Condition.prototype = {
		get_type: function () {
			return this._type;
		},
		get_properties: function () {
			return this._properties;
		},
		get_message: function () {
			return this._message;
		},
		set_message: function (message) {
			this._message = message;
		},
		get_origin: function () {
			return this._origin;
		},
		set_origin: function (origin) {
			this._origin = origin;
		},
		get_targets: function () {
			return this._targets;
		},
		equals: function (o) {
			return o.property.equals(this.property) && o._message.equals(this._message);
		}
	};

	ExoWeb.Model.Condition = Condition;
	Condition.registerClass("ExoWeb.Model.Condition");

	// #endregion

	// #region FormatError
	//////////////////////////////////////////////////

	function FormatError(message, invalidValue) {
		this._message = message;
		this._invalidValue = invalidValue;
	}

	var formatConditionType = new ConditionType("FormatError", "Error", "The value is not properly formatted.", []);

	FormatError.mixin({
		createCondition: function FormatError$createCondition(origin, prop) {
			return new Condition(formatConditionType,
				$format(this.get_message(), { value: prop.get_label() }),
				[prop],
				origin);
		},
		get_message: function FormateError$get_message() {
			return this._message;
		},
		get_invalidValue: function FormateError$get_invalidValue() {
			return this._invalidValue;
		},
		toString: function FormateError$toString() {
			return this._invalidValue;
		}
	});

	ExoWeb.Model.FormatError = FormatError;
	FormatError.registerClass("ExoWeb.Model.FormatError");

	// #endregion

	// #region Formats
	//////////////////////////////////////////////////

	Number.formats = {};
	String.formats = {};
	Date.formats = {};
	TimeSpan.formats = {};
	Boolean.formats = {};
	Object.formats = {};
	Array.formats = {};

	//TODO: number formatting include commas
	Number.formats.Integer = new Format({
		description: "#,###",
		convert: function(val) {
			return Math.round(val).toString();
		},
		convertBack: function(str) {
			if (!/^([-\+])?(\d+)?\,?(\d+)?\,?(\d+)?\,?(\d+)$/.test(str)) {
				throw new Error("invalid format");
			}

			return parseInt(str, 10);
		}
	});

	Number.formats.Float = new Format({
		description: "#,###.#",
		convert: function(val) {
			return val.toString();
		},
		convertBack: function(str) {
			if (!/^\s*([-\+])?(\d+)?\,?(\d+)?\,?(\d+)?\,?(\d+)?(\.(\d\d*))?\s*$/.test(str)) {
				throw new Error("invalid format");
			}
			var valString = str.replace(/,/g, "");
			var val = parseFloat(valString);
			if (isNaN(val)) {
				throw new Error("invalid format");
			}
			return val;
		}
	});

	Number.formats.Percent = new Format({
		description: "##.#%",
		convert: function(val) {
			return (val * 100).toPrecision(3).toString() + " %";
		}
	});

	Number.formats.Currency = new Format({
		description: "$#,###.##",
		convert: function(val) {
			var valString = val.toFixed(2).toString().replace(/\B(?=(?:\d{3})+(?!\d))/g, ",");
			return "$" + valString;
		},
		convertBack: function(str) {
			var valString = str.replace(/[\$,]/g, "");
			if (!/^\s*([-\+])?(\d+)?\,?(\d+)?\,?(\d+)?\,?(\d+)?(\.(\d){0,2})?\s*$/.test(valString)) {
				 throw new Error("invalid format");
			}

			var val = parseFloat(valString);

			return val;
		}
	});

	Number.formats.$system = Number.formats.Float;

	String.formats.Phone = new Format({
		description: "###-###-#### x####",
		convertBack: function(str) {
			if (!/^\s*\(?([1-9][0-9][0-9])\)?[ -]?([0-9]{3})-?([0-9]{4})( ?x[0-9]{1,8})?\s*$/.test(str)) {
				throw new Error("invalid format");
			}

			return str;
		}
	});

	String.formats.PhoneAreaCodeOptional = new Format({
		description: "###-###-#### x#### or ###-#### x####",
		convertBack: function(str) {
			if (!/^\s*\(?([1-9][0-9][0-9])\)?[ -]?([0-9]{3})-?([0-9]{4})( ?x[0-9]{1,8})?\s*$/.test(str) &&
				!/^\s*([0-9]{3})-?([0-9]{4})( ?x[0-9]{1,8})?\s*$/.test(str)) {
				throw new Error("invalid format");
			}

			return str;
		}
	});

	String.formats.Email = new Format({
		description: "name@address.com",
		convertBack: function(str) {
			// based on RFC 2822 token definitions for valid email and RFC 1035 tokens for domain names:
			if (!/^\s*([a-zA-Z0-9\!\#\$\%\&\'\*\+\-\/\=\?\^_\`\{\|\}\~]+(\.[a-zA-Z0-9\!\#\$\%\&\'\*\+\-\/\=\?\^_\`\{\|\}\~]+)*@([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*\.[a-zA-Z]{2,6}|([0-9]{1,3}(\.[0-9]{1,3}){3})))\s*$/.test(str)) {
				throw new Error("invalid format");
			}

			return str;
		}
	});

	String.formats.ZipCode = new Format({
		description: "##### or #####-####",
		convertBack: function(str){
			if(!/^\s*(\d{5})(-\d{4})?\s*$/.test(str)){
				throw new Error("invalid format");
			}

			return str;
		}
	});

	String.formats.$system = String.formats.$display = new Format({
		convertBack: function(val) {
			return val ? $.trim(val) : val;
		}
	});

	Boolean.formats.YesNo = new Format({
		convert: function(val) { return val ? "Yes" : "No"; },
		convertBack: function(str) { return str.toLowerCase() == "yes"; }
	});

	Boolean.formats.TrueFalse = new Format({
		convert: function(val) { return val ? "true" : "false"; },
		convertBack: function(str) {
			if (str.toLowerCase() == "true") {
				return true;
			}
			else if (str.toLowerCase() == "false") {
				return false;
			}
		}
	});

	Boolean.formats.$system = Boolean.formats.TrueFalse;
	Boolean.formats.$display = Boolean.formats.YesNo;

	Date.formats.DateTime = new Format({
		description: "mm/dd/yyyy hh:mm AM/PM",
		convert: function(val) {
			return val.format("MM/dd/yyyy h:mm tt");
		},
		convertBack: function(str) {
			var val = Date.parse(str);

			if (val !== null) {
				return new Date(val);
			}

			throw new Error("invalid date");
		}
	});

	Date.formats.ShortDate = new Format({
		description: "mm/dd/yyyy",
		convert: function(val) {
			return val.format("M/d/yyyy");
		},
		convertBack: function(str) {
			var val = Date.parseInvariant(str);

			if (val !== null) {
				return val;
			}

			throw new Error("invalid date");
		}
	});

	Date.formats.Time = new Format({
		description: "HH:MM AM/PM",
		convert: function(val) {
			return val.format("h:mm tt");
		},
		convertBack: function(str) {
			var parser = /^(1[0-2]|0?[1-9]):([0-5][0-9]) *(AM?|(PM?))$/i;

			var parts = str.match(parser);

			if (!parts) {
				throw new Error("invalid time");
			}

			// build new date, start with current data and overwite the time component
			var val = new Date();

			// hours
			if (parts[4]) {
				val.setHours((parseInt(parts[1], 10) % 12) + 12);  // PM
			}
			else {
				val.setHours(parseInt(parts[1], 10) % 12);  // AM
			}

			// minutes
			val.setMinutes(parseInt(parts[2], 10));

			// keep the rest of the time component clean
			val.setSeconds(0);
			val.setMilliseconds(0);

			return val;
		}
	});

	Date.formats.$system = Date.formats.DateTime;
	Date.formats.$display = Date.formats.DateTime;

	TimeSpan.formats.Meeting = new ExoWeb.Model.Format({
		convert: function(val) {
			var num;
			var label;

			if (val.totalHours < 1) {
				num = Math.round(val.totalMinutes);
				label = "minute";
			}
			else if (val.totalDays < 1) {
				num = Math.round(val.totalHours * 100) / 100;
				label = "hour";
			}
			else {
				num = Math.round(val.totalDays * 100) / 100;
				label = "day";
			}

			return num == 1 ? (num + " " + label) : (num + " " + label + "s");
		},
		convertBack: function(str) {
			var parser = /^([0-9]+(\.[0-9]+)?) *(m((inute)?s)?|h((our)?s?)|hr|d((ay)?s)?)$/i;

			var parts = str.match(parser);

			if (!parts) {
				throw new Error("invalid format");
			}

			var num = parseFloat(parts[1]);
			var ms;

			if (parts[3].startsWith("m")) {
				ms = num * 60 * 1000;
			}
			else if (parts[3].startsWith("h")) {
				ms = num * 60 * 60 * 1000;
			}
			else if (parts[3].startsWith("d")) {
				ms = num * 24 * 60 * 60 * 1000;
			}

			return new TimeSpan(ms);
		}
	});

	TimeSpan.formats.$display = TimeSpan.formats.Meeting;
	TimeSpan.formats.$system = TimeSpan.formats.Meeting;  // TODO: implement Exact format

	Array.formats.$display = new ExoWeb.Model.Format({
		convert: function (val) {
			if (!val)
				return "";

			var builder = [];
			for (var i = 0; i < val.length; ++i)
				builder.push(val[i].toString());

			return builder.join(", ");
		}
	});
	// #endregion

	// #region LazyLoader
	//////////////////////////////////////////////////

	function LazyLoader() {
	}

	LazyLoader.eval = function LazyLoader$eval(target, path, successCallback, errorCallback, scopeChain, thisPtr/*, continueFn, performedLoading*/) {
		if (path === undefined || path === null) {
			path = "";
		}

		if (ExoWeb.isType(path, String)) {
			path = new PathTokens(path);
		}
		else if (ExoWeb.isType(path, Array)) {
			path = new PathTokens(path.join("."));
		}
		else if (!ExoWeb.isType(path, PathTokens)) {
			ExoWeb.trace.throwAndLog("lazyLoad", "Unknown path \"{0}\" of type {1}.", [path, ExoWeb.parseFunctionName(path.constructor)]);
		}

		scopeChain = scopeChain || [window];

		if (target === undefined || target === null) {
			target = Array.dequeue(scopeChain);
		}

		// Initialize to defaults.
		var performedLoading = false;
		var continueFn = LazyLoader.eval;

		// If additional arguments were specified (internal), then use those.
		if (arguments.length == 8) {
			// Allow an invocation to specify continuing loading properties using a given function, by default this is LazyLoader.eval.
			// This is used by evalAll to ensure that array properties can be force loaded at any point in the path.
			continueFn = arguments[6] instanceof Function ? arguments[6] : continueFn;
			// Allow recursive calling function (eval or evalAll) to specify that loading was performed.
			performedLoading = arguments[7] instanceof Boolean ? arguments[7] : performedLoading;
		}

		while (path.steps.length > 0) {
			// If an array is encountered and this call originated from "evalAll" then delegate to "evalAll", otherwise 
			// this will most likely be an error condition unless the remainder of the path are properties of Array.
			if (continueFn == LazyLoader.evalAll && target instanceof Array) {
				continueFn(target, path, successCallback, errorCallback, scopeChain, thisPtr, continueFn, performedLoading);
				return;
			}

			var step = Array.dequeue(path.steps);

			if (!LazyLoader.isLoaded(target, step.property)) {
				performedLoading = true;
				LazyLoader.load(target, step.property, function() {
					var nextTarget = ExoWeb.getValue(target, step.property);

					// If the next target is undefined then there is a problem since getValue returns null if a property exists but returns no value.
					if (nextTarget === undefined) {
						// Backtrack using the next item in the scope chain.
						if (scopeChain.length > 0) {
							Array.insert(path.steps, 0, step);

							continueFn(Array.dequeue(scopeChain), path, successCallback, errorCallback, scopeChain, thisPtr, continueFn, performedLoading);
						}
						// Nowhere to backtrack, so return or throw an error.
						else if (errorCallback) {
							errorCallback.call(thisPtr, "Property is undefined: " + step.property);
						}
						else {
							ExoWeb.trace.throwAndLog(["lazyLoad"], "Cannot complete property evaluation because a property is undefined: {0}", [step.property]);
						}
					}
					// Continue if there is a next target and either no cast of the current property or the value is of the cast type.
					else if (nextTarget !== null && (!step.cast || ExoWeb.isType(nextTarget, step.cast))) {
						continueFn(nextTarget, path, successCallback, errorCallback, [], thisPtr, continueFn, performedLoading);
					}
					// If the next target is defined & non-null or not of the cast type, then exit with success.
					else if (successCallback) {
						successCallback.call(thisPtr, null);
					}
				});

				return;
			}
			else {
				var propValue = ExoWeb.getValue(target, step.property);

				// If the value is undefined then there is a problem since getValue returns null if a property exists but returns no value.
				if (propValue === undefined) {
					if (scopeChain.length > 0) {
						Array.insert(path.steps, 0, step);
						target = Array.dequeue(scopeChain);
					}
					else {
						if (errorCallback) {
							errorCallback.call(thisPtr, "Property is undefined: " + step.property);
						}
						else {
							ExoWeb.trace.throwAndLog(["lazyLoad"], "Cannot complete property evaluation because a property is undefined: {0}", [step.property]);
						}

						return;
					}
				}
				// The next target is null (nothing left to evaluate) or there is a cast of the current property and the value is 
				// not of the cast type (no need to continue evaluating).
				else if (propValue === null || (step.cast && !ExoWeb.isType(propValue, step.cast))) {
					if (successCallback) {
						successCallback.call(thisPtr, null);
					}
					return;
				}
				// Otherwise, continue to the next property.
				else {
					if (scopeChain.length > 0) {
						scopeChain = [];
					}

					target = propValue;
				}
			}
		}

		// Load final object
		if (target !== undefined && target !== null && !LazyLoader.isLoaded(target)) {
			performedLoading = true;
			LazyLoader.load(target, null, successCallback.prepare(thisPtr, [target, performedLoading]));
		}
		else if (successCallback) {
			successCallback.call(thisPtr, target, performedLoading);
		}
	};

	LazyLoader.evalAll = function LazyLoader$evalAll(target, path, successCallback, errorCallback, scopeChain, thisPtr/*, continueFn, performedLoading*/) {
		var performedLoading = arguments.length == 8 && arguments[7] instanceof Boolean ? arguments[7] : false;

		if (target instanceof Array) {
			if (LazyLoader.isLoaded(target)) {
				var signal = new ExoWeb.Signal("evalAll - " + path);
				var results = [];
				var errors = [];
				var successCallbacks = [];
				var errorCallbacks = [];

				var allSucceeded = true;

				Array.forEach(target, function(subTarget, i) {
					results.push(null);
					errors.push(null);
					successCallbacks.push(signal.pending(function(result, performedLoadingOne) {
						performedLoading = performedLoading || performedLoadingOne;
						results[i] = result;
					}));
					errorCallbacks.push(signal.orPending(function(err) {
						allSucceeded = false;
						errors[i] = err;
					}));
				});

				Array.forEach(target, function(subTarget, i) {
					// Make a copy of the original path tokens for arrays so that items' processing don't affect one another.
					if (path instanceof PathTokens) {
						path = path.buildExpression();
					}

					LazyLoader.eval(subTarget, path, successCallbacks[i], errorCallbacks[i], scopeChain, thisPtr, LazyLoader.evalAll, performedLoading);
				});

				signal.waitForAll(function() {
					if (allSucceeded) {
						// call the success callback if one exists
						if (successCallback) {
							successCallback.call(thisPtr, results, performedLoading);
						}
					}
					else if (errorCallback) {
						errorCallback.call(thisPtr, errors);
					}
					else {
						var numErrors = 0;
						Array.forEach(errors, function(e) {
							if (e) {
								ExoWeb.trace.logError(["lazyLoad"], e);
								numErrors += 1;
							}
							ExoWeb.trace.throwAndLog(["lazyLoad"], "{0} errors encountered while attempting to eval paths for all items in the target array.", [numErrors]);
						});
					}
				});
			}
			else {
				LazyLoader.load(target, null, function() {
					LazyLoader.evalAll(target, path, successCallback, errorCallback, scopeChain, thisPtr, LazyLoader.evalAll, performedLoading);
				});
			}
		}
		else {
			LazyLoader.evalAll([target], path, successCallback, errorCallback, scopeChain, thisPtr, LazyLoader.evalAll, performedLoading);
		}
	};

	LazyLoader.isLoaded = function LazyLoader$isLoaded(obj, propName) {
		if (obj === undefined || obj === null) {
			return;
		}

		var reg = obj._lazyLoader;

		if (!reg) {
			return true;
		}

		var loader;
		if (propName && reg.byProp) {
			loader = reg.byProp[propName];
		}

		if (!loader) {
			loader = reg.allProps;
		}

		return !loader || (!!loader.isLoaded && obj._lazyLoader.isLoaded(obj, propName));
	};

	LazyLoader.load = function LazyLoader$load(obj, propName, callback, thisPtr) {
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
				ExoWeb.trace.throwAndLog(["lazyLoad"], "Attempting to load object but no appropriate loader is registered. object: {0}, property: {1}", [obj, propName]);
			}

			loader.load(obj, propName, callback, thisPtr);
		}
	};

	LazyLoader.isRegistered = function LazyLoader$isRegistered(obj, loader, propName) {
		var reg = obj._lazyLoader;

		if (!reg) {
			return false;
		}
		if (propName) {
			return reg.byProp && reg.byProp[propName] === loader;
		}

		return reg.allProps === loader;
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

	ExoWeb.Model.LazyLoader = LazyLoader;
	LazyLoader.registerClass("ExoWeb.Model.LazyLoader");

	// #endregion

	// #region ObjectProvider
	//////////////////////////////////////////////////

	var objectProviderFn = function objectProviderFn(type, ids, paths, inScope, changes, onSuccess, onFailure) {
		throw "Object provider has not been implemented.  Call ExoWeb.Mapper.setObjectProvider(fn);";
	};

	function objectProvider(type, ids, paths, inScope, changes, onSuccess, onFailure, thisPtr) {
		var scopeQueries;

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
			scopeQueries = context.server._scopeQueries;
		}

		if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
			thisPtr = onFailure;
			onFailure = null;
		}

		var batch = ExoWeb.Batch.suspendCurrent("objectProvider");
		objectProviderFn.call(this, type, ids, paths, inScope, changes, scopeQueries,
			function objectProviderSuccess() {
				ExoWeb.Batch.resume(batch);
				if (onSuccess) onSuccess.apply(thisPtr || this, arguments);
			},
			function objectProviderFailure() {
				ExoWeb.Batch.resume(batch);
				if (onFailure) onFailure.apply(thisPtr || this, arguments);
			});
	}
	ExoWeb.Mapper.setObjectProvider = function setObjectProvider(fn) {
		objectProviderFn = fn;
	};

	// #endregion

	// #region QueryProvider
	//////////////////////////////////////////////////

	﻿var queryProviderFn = function queryProviderFn(queries, changes, onSuccess, onFailure) {
		throw "Query provider has not been implemented.  Call ExoWeb.Mapper.setQueryProvider(fn);";
	};

	function queryProvider(queries, changes, onSuccess, onFailure, thisPtr, thisPtr) {
		var scopeQueries;

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
			scopeQueries = context.server._scopeQueries;
		}

		if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
			thisPtr = onFailure;
			onFailure = null;
		}

		var batch = ExoWeb.Batch.suspendCurrent("queryProvider");
		queryProviderFn.call(this, queries, changes, scopeQueries,
			function queryProviderSuccess() {
				ExoWeb.Batch.resume(batch);
				if (onSuccess) onSuccess.apply(thisPtr || this, arguments);
			},
			function queryProviderFailure() {
				ExoWeb.Batch.resume(batch);
				if (onFailure) onFailure.apply(thisPtr || this, arguments);
			});
	}

	ExoWeb.Mapper.setQueryProvider = function setQueryProvider(fn) {
		queryProviderFn = fn;
	};

	// #endregion

	// #region TypeProvider
	//////////////////////////////////////////////////

	var typeProviderFn = function typeProviderFn(type, onSuccess, onFailure) {
		throw "Type provider has not been implemented.  Call ExoWeb.Mapper.setTypeProvider(fn);";
	};

	function typeProvider(type, onSuccess, onFailure, thisPtr) {
		if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
			thisPtr = onFailure;
			onFailure = null;
		}

		var batch = ExoWeb.Batch.suspendCurrent("typeProvider");

		var cachedType = ExoWeb.cache(type);
		if (cachedType) {
			if (ExoWeb.cacheHash && cachedType.cacheHash !== ExoWeb.cacheHash) {
				// the cached type definition is out of date, so remove it and continue
				ExoWeb.cache(type, null);
			}
			else {
				// the cached type definition is current, so use it and return early
				onSuccess.call(thisPtr || this, cachedType);
				return;
			}
		}

		typeProviderFn.call(this, type,
			function typeProviderSuccess() {
				ExoWeb.Batch.resume(batch);

				// add cache hash and cache type definition
				arguments[0].cacheHash = ExoWeb.cacheHash;
				ExoWeb.cache(type, arguments[0]);

				if (onSuccess) onSuccess.apply(thisPtr || this, arguments);
			},
			function typeProviderFailure() {
				ExoWeb.Batch.resume(batch);
				if (onFailure) onFailure.apply(thisPtr || this, arguments);
			});
	}
	ExoWeb.Mapper.setTypeProvider = function setTypeProvider(fn) {
		typeProviderFn = fn;
	};

	// #endregion

	// #region ListProvider
	//////////////////////////////////////////////////

	var listProviderFn = function listProvider(ownerType, ownerId, paths, changes, onSuccess, onFailure) {
		throw "List provider has not been implemented.  Call ExoWeb.Mapper.setListProvider(fn);";
	};

	function listProvider(ownerType, ownerId, listProp, otherProps, changes, onSuccess, onFailure, thisPtr) {
		var scopeQueries;

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
			scopeQueries = context.server._scopeQueries;
		}

		if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
			thisPtr = onFailure;
			onFailure = null;
		}

		var batch = ExoWeb.Batch.suspendCurrent("listProvider");

		var listPath = (ownerId == "static" ? ownerType : "this") + "." + listProp;
		var paths = [listPath];

		// prepend list prop to beginning of each other prop
		if (otherProps.length > 0) {
			Array.forEach(otherProps, function(p) {
				paths.push(p.startsWith("this.") ? listPath + "." + p.substring(5) : p);
			});
		}

		listProviderFn.call(this, ownerType, ownerId == "static" ? null : ownerId, paths, changes, scopeQueries,
			function listProviderSuccess() {
				ExoWeb.Batch.resume(batch);
				if (onSuccess) onSuccess.apply(thisPtr || this, arguments);
			},
			function listProviderFailure() {
				ExoWeb.Batch.resume(batch);
				if (onFailure) onFailure.apply(thisPtr || this, arguments);
			});
	}

	ExoWeb.Mapper.setListProvider = function setListProvider(fn) {
		listProviderFn = fn;
	};

	// #endregion

	// #region RoundtripProvider
	//////////////////////////////////////////////////

	var roundtripProviderFn = function roundtripProviderFn(changes, onSuccess, onFailure) {
		throw "Roundtrip provider has not been implemented.  Call ExoWeb.Mapper.setRoundtripProvider(fn);";
	};

	function roundtripProvider(type, id, paths, changes, onSuccess, onFailure, thisPtr) {
		var scopeQueries;

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
			scopeQueries = context.server._scopeQueries;
		}

		if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
			thisPtr = onFailure;
			onFailure = null;
		}

		var batch = ExoWeb.Batch.suspendCurrent("roundtripProvider");
		roundtripProviderFn.call(this, type, id, paths, changes, scopeQueries,
			function roundtripProviderSucess() {
				ExoWeb.Batch.resume(batch);
				if (onSuccess) onSuccess.apply(thisPtr || this, arguments);
			},
			function roundtripProviderFailure() {
				ExoWeb.Batch.resume(batch);
				if (onFailure) onFailure.apply(thisPtr || this, arguments);
			});
	}

	ExoWeb.Mapper.setRoundtripProvider = function setRoundtripProvider(fn) {
		roundtripProviderFn = fn;
	};

	// #endregion

	// #region SaveProvider
	//////////////////////////////////////////////////

	var saveProviderFn = function saveProviderFn(root, changes, onSuccess, onFailure) {
		throw "Save provider has not been implemented.  Call ExoWeb.Mapper.setSaveProvider(fn);";
	};

	function saveProvider(root, changes, onSuccess, onFailure, thisPtr) {
		var scopeQueries;

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
			scopeQueries = context.server._scopeQueries;
		}

		if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
			thisPtr = onFailure;
			onFailure = null;
		}

		var batch = ExoWeb.Batch.suspendCurrent("saveProvider");
		saveProviderFn.call(this, root, changes, scopeQueries,
			function saveProviderSuccess() {
				ExoWeb.Batch.resume(batch);
				if (onSuccess) onSuccess.apply(thisPtr || this, arguments);
			},
			function saveProviderFailure() {
				ExoWeb.Batch.resume(batch);
				if (onFailure) onFailure.apply(thisPtr || this, arguments);
			});
	}

	ExoWeb.Mapper.setSaveProvider = function setSaveProvider(fn) {
		saveProviderFn = fn;
	};

	// #endregion

	// #region EventProvider
	//////////////////////////////////////////////////

	var eventProviderFn = function eventProviderFn(eventType, instance, event, paths, changes, onSuccess, onFailure) {
		throw "Event provider has not been implemented.  Call ExoWeb.Mapper.setEventProvider(fn);";
	};

	function eventProvider(eventType, instance, event, paths, changes, onSuccess, onFailure, thisPtr) {
		var scopeQueries;

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
			scopeQueries = context.server._scopeQueries;
		}

		if (onFailure !== undefined && onFailure !== null && !(onFailure instanceof Function)) {
			thisPtr = onFailure;
			onFailure = null;
		}

		var batch = ExoWeb.Batch.suspendCurrent("eventProvider");
		eventProviderFn.call(this, eventType, instance, event, paths, changes, scopeQueries,
			function eventProviderSuccess() {
				ExoWeb.Batch.resume(batch);
				if (onSuccess) onSuccess.apply(thisPtr || this, arguments);
			},
			function eventProviderFailure() {
				ExoWeb.Batch.resume(batch);
				if (onFailure) onFailure.apply(thisPtr || this, arguments);
			});
	}

	ExoWeb.Mapper.setEventProvider = function setEventProvider(fn) {
		eventProviderFn = fn;
	};

	// #endregion

	// #region ResponseHandler
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
		// Load types from JSON
		//////////////////////////////////////////
			function loadTypes(callback, thisPtr) {
				if (this._options.types) {
					ExoWeb.trace.log("responseHandler", "Loading types.");
					for (var typeName in this._options.types) {
						var signal = new ExoWeb.Signal("embeddedType(" + typeName + ")");

						// load type(s)
						var typesToUse = {};
						typesToUse[typeName] = this._options.types[typeName];
						typesFromJson(this._model, typesToUse);

						var mtype = this._model.type(typeName);

						// ensure base classes are loaded too
						mtype.eachBaseType(function(mtype) {
							if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
								ExoWeb.Model.LazyLoader.load(mtype, null, signal.pending());
							}
						});

						signal.waitForAll(function() {
							TypeLazyLoader.unregister(mtype);
							raiseExtensions(mtype);
						});
					}
				}

				callback.call(thisPtr || this);
			},

		// Apply "init new" changes
		//////////////////////////////////////////
			function applyInitChanges(callback, thisPtr) {
				if (this._options.changes) {
					ExoWeb.trace.log("responseHandler", "Applying \"init new\" changes.");

					var changes = Array.prototype.slice.apply(this._options.changes);

					var initChanges = changes.filter(function (change) {
						return change.type === "InitNew";
					});

					this._serverSync._changeLog.applyChanges(initChanges, this._options.source, this._serverSync);

					callback.call(thisPtr);
				}
				else {
					callback.call(thisPtr || this);
				}
			},

		// Load instance data from JSON
		//////////////////////////////////////////
			function loadInstances(callback, thisPtr) {
				if (this._options.instances) {
					ExoWeb.trace.log("responseHandler", "Loading instances.");
					objectsFromJson(this._model, this._options.instances, callback, thisPtr);
				}
				else {
					callback.call(thisPtr || this);
				}
			},

		// Apply non-"init new" changes
		//////////////////////////////////////////
			function applyNonInitChanges(callback, thisPtr) {
				if (this._options.changes) {
					ExoWeb.trace.log("responseHandler", "Applying non-\"init new\" changes.");

					var changes = Array.prototype.slice.apply(this._options.changes);

					var initChanges = changes.filter(function (change) {
						return change.type !== "InitNew";
					});

					this._serverSync._changeLog.applyChanges(initChanges, this._options.source, this._serverSync);

					callback.call(thisPtr);
				}
				else {
					callback.call(thisPtr || this);
				}
			},

		// Load conditions from JSON
		//////////////////////////////////////////
			function loadConditions(callback, thisPtr) {
				if (this._options.conditions) {
					ExoWeb.trace.log("reponseHandler", "Loading conditions.");
					conditionsFromJson(this._model, this._options.conditions, callback, thisPtr);
				}
				else {
					callback.call(thisPtr || this);
				}
			}
		)
	});

	ExoWeb.Mapper.ResponseHandler = ResponseHandler;

	// #endregion

	// #region Translation
	//////////////////////////////////////////////////

	ExoWeb.Model.Entity.formats.$load = new ExoWeb.Model.Format({
		convert: function(obj) {
			return obj.meta.type.toIdString(obj.meta.id);
		},
		convertBack: function(val) {
			var ids = val.split("|");
			var jstype = ExoWeb.Model.Model.getJsType(ids[0]);
			var obj = jstype.meta.get(ids[1]);

			if (!obj) {
				obj = new jstype(ids[1]);
				ObjectLazyLoader.register(obj);
//					ExoWeb.trace.log(["entity", "server"], "{0}({1})  (ghost)", [jstype.meta.get_fullName(), ids[1]]);
			}

			return obj;
		}
	});

	function toExoGraph(translator, val) {
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

	function fromExoGraph(val, translator) {
		if (val !== undefined && val !== null && val.type && val.id ) {
			var type = ExoWeb.Model.Model.getJsType(val.type);

			// Entities only: translate back to the client's id.  This is necessary to handle the fact that ids are created on 
			// both the client and server.  Also, in some cases a transaction references an entity that was created on the server 
			// and then committed, so that the id actually references an object that already exists on the client but with a different id.
			//--------------------------------------------------------------------------------------------------------
			if (type.meta && type.meta instanceof ExoWeb.Model.Type && translator) {
				// don't alter the original object
				var id = translateId(translator, val.type, val.id);

				var obj = type.meta.get(id);

				if (!obj) {
					obj = new type(id);
					ObjectLazyLoader.register(obj);
					ExoWeb.trace.log(["entity", "server"], "{0}({1})  (ghost)", [type.meta.get_fullName(), id]);
				}

				return obj;
			}

			// is this needed? Can the if statement that checks type.meta be removed?
			return val;
		}

		return val;
	}

	// #endregion

	// #region ExoGraphEventListener
	//////////////////////////////////////////////////

	function ExoGraphEventListener(model, translator, filters) {
		this._model = model;
		this._translator = translator;
		this._filters = filters;

		// listen for events
		model.addListChanged(this.onListChanged.bind(this));
		model.addAfterPropertySet(this.onPropertyChanged.bind(this));
		model.addObjectRegistered(this.onObjectRegistered.bind(this));
		model.addObjectUnregistered(this.onObjectUnregistered.bind(this));
	}

	ExoGraphEventListener.mixin(ExoWeb.Functor.eventing);

	ExoGraphEventListener.mixin({
		addChangeCaptured: function ExoGraphEventListener$onEvent(handler) {
			this._addEvent("changeCaptured", handler);
		},

		// Model event handlers
		onListChanged: function ExoGraphEventListener$onListChanged(obj, property, listChanges) {
			if (this._filters && this._filters.listChanged && this._filters.listChanged(obj, property, listChanges) !== true)
				return;

			if (obj instanceof Function) {
//					ExoWeb.trace.log("server", "logging list change: {0}.{1}", [obj.meta.get_fullName(), property.get_name()]);
			}
			else {
//					ExoWeb.trace.log("server", "logging list change: {0}({1}).{2}", [obj.meta.type.get_fullName(), obj.meta.id, property.get_name()]);
			}

			for (var i = 0; i < listChanges.length; ++i) {
				var listChange = listChanges[i];

				var change = {
					type: "ListChange",
					instance: toExoGraph(this._translator, obj),
					property: property.get_name(),
					added: [],
					removed: []
				};

				var _this = this;
				if (listChange.newStartingIndex >= 0 || listChange.newItems) {
					Array.forEach(listChange.newItems, function ExoGraphEventListener$onListChanged$addedItem(obj) {
						change.added.push(toExoGraph(_this._translator, obj));
					});
				}
				if (listChange.oldStartingIndex >= 0 || listChange.oldItems) {
					Array.forEach(listChange.oldItems, function ExoGraphEventListener$onListChanged$removedItem(obj) {
						change.removed.push(toExoGraph(_this._translator, obj));
					});
				}

				this._raiseEvent("changeCaptured", [change]);
			}
		},
		onObjectRegistered: function ExoGraphEventListener$onObjectRegistered(obj) {
			if (this._filters && this._filters.objectRegistered && this._filters.objectRegistered(obj) !== true)
				return;

			if (obj.meta.isNew) {
//					ExoWeb.trace.log("server", "logging new: {0}({1})", [obj.meta.type.get_fullName(), obj.meta.id]);

				var change = {
					type: "InitNew",
					instance: toExoGraph(this._translator, obj)
				};

				this._raiseEvent("changeCaptured", [change]);
			}
		},
		onObjectUnregistered: function ExoGraphEventListener$onObjectUnregistered(obj) {
			if (this._filters && this._filters.objectUnregistered && this._filters.objectUnregistered(obj) !== true)
				return;

			ExoWeb.trace.throwAndLog("server", "Unregistering server-type objects is not currently supported: {type.fullName}({id})", obj.meta);
		},
		onPropertyChanged: function ExoGraphEventListener$onPropertyChanged(obj, property, newValue, oldValue) {
			if (this._filters && this._filters.propertyChanged && this._filters.propertyChanged(obj, property, newValue, oldValue) !== true)
				return;

			if (property.get_isValueType()) {
				if (obj instanceof Function) {
//						ExoWeb.trace.log("server", "logging value change: {0}.{1}", [obj.meta.get_fullName(), property.get_name()]);
				}
				else {
//						ExoWeb.trace.log("server", "logging value change: {0}({1}).{2}", [obj.meta.type.get_fullName(), obj.meta.id, property.get_name()]);
				}

				var valueChange = {
					type: "ValueChange",
					instance: toExoGraph(this._translator, obj),
					property: property.get_name(),
					oldValue: oldValue,
					newValue: newValue
				};

				this._raiseEvent("changeCaptured", [valueChange]);
			}
			else {
				if (obj instanceof Function) {
//						ExoWeb.trace.log("server", "logging reference change: {0}.{1}", [obj.meta.get_fullName(), property.get_name()]);
				}
				else {
//						ExoWeb.trace.log("server", "logging reference change: {0}({1}).{2}", [obj.meta.type.get_fullName(), obj.meta.id, property.get_name()]);
				}

				var refChange = {
					type: "ReferenceChange",
					instance: toExoGraph(this._translator, obj),
					property: property.get_name(),
					oldValue: toExoGraph(this._translator, oldValue),
					newValue: toExoGraph(this._translator, newValue)
				};

				this._raiseEvent("changeCaptured", [refChange]);
			}
		}
	});

	ExoWeb.Mapper.ExoGraphEventListener = ExoGraphEventListener;

	// #endregion

	// #region ChangeSet
	//////////////////////////////////////////////////

	function ChangeSet(source, initialChanges) {
		if (!source || source.constructor !== String) {
			ExoWeb.trace.throwAndLog("changeLog", "Creating a change set requires a string source argument.");
		}

		this._source = source;
		this._changes = (initialChanges && initialChanges instanceof Array) ?
			[].concat(initialChanges) :
			[];
	}

	ChangeSet.mixin(Functor.eventing);

	ChangeSet.mixin({
		add: function(change) {
			var idx = this._changes.push(change) - 1;
			this._raiseEvent("changeAdded", [change, idx, this]);
			return idx;
		},
		addChangeAdded: function(fn, filter, once) {
			this._addEvent("changeAdded", fn, filter, once);
		},
		addChangeUndone: function(fn, filter, once) {
			this._addEvent("changeUndone", fn, filter, once);
		},
		addTruncated: function(fn, filter, once) {
			this._addEvent("truncated", fn, filter, once);
		},
		changes: function() {
			return this._changes;
		},
		checkpoint: function(title, code) {
			// Generate a random code for the checkpoint if one is not given.
			if (!code)
				code = [].fill(null, 10).map(function() { return String.fromCharCode(Math.floor(Math.random() * 26) + 97); }).join("");

			// Add the checkpoint and return the code.
			this.add({ type: "Checkpoint", title: title || "untitled", code: code });
			return code;
		},
		count: function (filter, thisPtr) {
			if (!filter) {
				return this._changes.length;
			}

			return this._changes.filter(filter, thisPtr).length;
		},
		lastChange: function() {
			return this._changes.length > 0 ? this._changes[this._changes.length - 1] : null;
		},
		serialize: function(filter, thisPtr) {
			return {
				source: (this._source === "init" || this._source === "client") ? this._source : "server",
				changes: filter ? 
					this._changes.filter(filter, thisPtr) :
					Array.prototype.slice.call(this._changes)
			};
		},
		source: function() {
			return this._source;
		},
		truncate: function(checkpoint, filter, thisPtr) {
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
					if (change.type === "Checkpoint" && change.code === checkpoint)
						foundCheckpoint = true;

					// Stop truncating when the checkpoint is found.
					if (foundCheckpoint === true)
						return false;

					// Delegate to custom filter if one is given.
					return customFilter ? customFilter.apply(this, arguments) : true;
				};
			}

			// Discard all changes that match the given filter
			var numRemoved;
			if (filter) {
				var removedAt = this._changes.purge(filter, thisPtr);
				numRemoved = removedAt ? removedAt.length : 0;
			}
			else {
				numRemoved = this._changes.length;
				this._changes.clear();
			}

			this._raiseEvent("truncated", [numRemoved, this]);
			return numRemoved;
		},
		undo: function() {
			if (this._changes.length > 0) {
				var lastIdx = this._changes.length - 1;
				var change = this._changes[lastIdx];
				this._changes.splice(lastIdx, 1);
				this._raiseEvent("changeUndone", [change, lastIdx, this]);
				return change;
			}

			return null;
		}
	});

	// #endregion

	// #region ChangeLog
	//////////////////////////////////////////////////

	function ChangeLog() {
		this._activeSet = null;
		this._sets = [];
	}

	ChangeLog.mixin(Functor.eventing);

	ChangeLog.mixin({
		activeSet: function () {
			// Returns the active change set.

			return this._activeSet;
		},
		add: function (change) {
			// Adds a new change to the log.

			if (this._activeSet === null) {
				ExoWeb.trace.throwAndLog("server", "The change log is not currently active.");
			}

			var idx = this._activeSet.add(change);

			this._raiseEvent("changeAdded", [change, idx, this._activeSet, this]);

			return idx;
		},
		addChangeAdded: function (fn, filter, once) {
			this._addEvent("changeAdded", fn, filter, once);
		},
		addChangeSetStarted: function (fn, filter, once) {
			this._addEvent("changeSetStarted", fn, filter, once);
		},
		addChangeUndone: function (fn, filter, once) {
			this._addEvent("changeUndone", fn, filter, once);
		},
		addSet: function (source, changes) {
			this._sets.push(new ChangeSet(source, changes));
		},
		addTruncated: function (fn, filter, once) {
			this._addEvent("truncated", fn, filter, once);
		},
		checkpoint: function (title) {
			if (this._activeSet && this._sets.some(function (s) { return s.changes().length > 0; })) {
				return this._activeSet.checkpoint(title);
			}
		},
		count: function (filter, thisPtr) {
			var result = 0;
			forEach(this._sets, function (set) {
				result += set.count(filter, thisPtr);
			}, this);
			return result;
		},
		lastChange: function () {
			for (var i = this._sets.length - 1; i >= 0; i--) {
				var set = this._sets[i];
				var change = set.lastChange();
				if (change !== null && change !== undefined) {
					return change;
				}
			}

			return null;
		},
		serialize: function (filter, thisPtr) {
			// Serializes the log and it's sets, including
			// those changes that pass the given filter.

			return this._sets.map(function (set) {
				return set.serialize(filter, thisPtr);
			});
		},
		set: function (index) {
			if (index === null || index === undefined || Object.prototype.toString.call(index) !== "[object Number]") {
				throw Error("The set method expects a numeric index argument.");
			}

			var idx = index < 0 ? (this._sets.length + index) : index;
			return this._sets[idx];
		},
		sets: function () {
			// Returns the current list of sets.

			return this._sets;
		},
		start: function (source) {
			// Starts a new change set, which means that new changes will
			// be added to the new set from this point forward.

			if (!source || source.constructor !== String) {
				ExoWeb.trace.throwAndLog("changeLog", "ChangeLog.start requires a string source argument.");
			}

			var set = new ChangeSet(source);
			var idx = this._sets.push(set) - 1;
			this._activeSet = set;

			this._raiseEvent("changeSetStarted", [set, idx, this]);

			return set;
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

			for (var i = 0; i < this._sets.length; i++) {
				if (checkpoint) {
					foundCheckpoint = this._sets[i].changes().some(function (c) {
						return c.type === "Checkpoint" && c.code === checkpoint;
					});
				}

				numRemoved += this._sets[i].truncate(checkpoint, filter, thisPtr);

				// If all changes have been removed (or all but the given checkpoint) then discard the set
				if (this._sets[i].changes().length === 0 || (this._sets[i].changes().length === 1 && foundCheckpoint === true)) {
					this._sets.splice(i--, 1);
					if (this._sets[i] === this._activeSet) {
						this._activeSet = null;
					}
				}

				if (foundCheckpoint)
					break;
			}

			// Start a new change set
			this.start("client");

			this._raiseEvent("truncated", [numRemoved, this]);
			return numRemoved;
		},
		undo: function () {
			if (!this._activeSet) {
				ExoWeb.trace.throwAndLog("server", "The change log is not currently active.");
			}

			var currentSet = this._activeSet,
				currentSetIndex = this._sets.indexOf(currentSet);

			while (currentSet.changes().length === 0) {
				// remove the set from the log
				this._sets.splice(currentSetIndex, 1);

				if (--currentSetIndex < 0) {
					return null;
				}

				currentSet = this._sets[currentSetIndex];
				this._activeSet = currentSet;
			}

			var idx = currentSet.changes().length - 1;
			var change = currentSet.undo();

			this._raiseEvent("changeUndone", [change, idx, currentSet, this]);

			return change;
		},
		// APPLY CHANGES
		///////////////////////////////////////////////////////////////////////
		applyChanges: function (checkpoint, changes, source, serverSync, filter, beforeApply, afterApply) {
			if (!changes || !(changes instanceof Array)) {
				return;
			}

			try {
				var batch = ExoWeb.Batch.start("apply changes");

				if ((source !== undefined && source !== null && (!this.activeSet() || this.activeSet().source() !== source)) || serverSync.isCapturingChanges()) {
					if (source) {
						this.start(source);
					}
					else {
						this.start("unknown");
						ExoWeb.trace.logWarning("server", "Changes to apply but no source is specified.");
					}
				}

				var newChanges = 0;
				var currentChanges = this.count(serverSync.canSave, serverSync);
				var totalChanges = changes.length;

				// truncate change log up-front if save occurred
				var saveChanges = changes.filter(function (c, i) { return c.type === "Save"; });
				var numSaveChanges = saveChanges.length;
				if (numSaveChanges > 0) {
					this.truncate(checkpoint, serverSync.canSave, serverSync);

					// Update affected scope queries
					saveChanges.forEach(function (change) {
						if (!change.idChanges) return;
						change.idChanges.forEach(function (idChange) {
							var jstype = ExoWeb.Model.Model.getJsType(idChange.type, true);
							if (jstype && ExoWeb.Model.LazyLoader.isLoaded(jstype.meta)) {
								var serverOldId = idChange.oldId;
								var clientOldId = !(idChange.oldId in jstype.meta._pool) ?
									serverSync._translator.reverse(idChange.type, serverOldId) :
									idChange.oldId;
								serverSync._scopeQueries.forEach(function (query) {
									query.ids = query.ids.map(function (id) {
										return (id === clientOldId) ? idChange.newId : id;
									}, this);
								}, this);
							}
						}, this);
					}, this);
				}

				changes.forEach(function (change, changeIndex) {
					if (change.type === "InitNew") {
						this.applyInitChange(change, serverSync, beforeApply, afterApply);
					}
					else if (change.type === "ReferenceChange") {
						this.applyRefChange(change, serverSync, beforeApply, afterApply);
					}
					else if (change.type === "ValueChange") {
						this.applyValChange(change, serverSync, beforeApply, afterApply);
					}
					else if (change.type === "ListChange") {
						this.applyListChange(change, serverSync, beforeApply, afterApply);
					}
					else if (change.type === "Save") {
						this.applySaveChange(change, serverSync, beforeApply, afterApply);
						numSaveChanges--;
					}

					// only record a change if there is not a pending save change
					if (change.type !== "Save" && numSaveChanges <= 0 && (!filter || filter(change) === true)) {
						newChanges++;
						this.add(change);
					}
				}, this);


				// start a new set to capture future changes
				if (serverSync.isCapturingChanges()) {
					this.start("client");
				}

				ExoWeb.Batch.end(batch);

				// raise "HasPendingChanges" change event, only new changes were recorded
				if (newChanges > 0) {
					Sys.Observer.raisePropertyChanged(serverSync, "HasPendingChanges");
				}
			}
			catch (e) {
				// attempt to clean up in the event of an error
				ExoWeb.Batch.end(batch);
				ExoWeb.trace.throwAndLog(["server"], e);
			}
		},
		applySaveChange: function (change, serverSync, before, after) {
			if (!change.idChanges)
				return;

			change.idChanges.forEach(function (idChange, idChangeIndex) {
				ensureJsType(serverSync._model, idChange.type, serverSync.ignoreChanges(before, function (jstype) {
					var serverOldId = idChange.oldId;
					var clientOldId = !(idChange.oldId in jstype.meta._pool) ?
							serverSync._translator.reverse(idChange.type, serverOldId) :
							idChange.oldId;

					// If the client recognizes the old id then this is an object we have seen before
					if (clientOldId) {
						var type = serverSync._model.type(idChange.type);

						// Attempt to load the object.
						var obj = type.get(clientOldId);

						// Ensure that the object exists.
						if (!obj) {
							ExoWeb.trace.throwAndLog("server",
								"Unable to change id for object of type \"{0}\" from \"{1}\" to \"{2}\" since the object could not be found.",
								[jstype.meta.get_fullName(), idChange.oldId, idChange.newId]
							);
						}

						// Change the id and make non-new.
						type.changeObjectId(clientOldId, idChange.newId);
						Sys.Observer.setValue(obj.meta, "isNew", false);

						// Update affected scope queries
						serverSync._scopeQueries.forEach(function (query) {
							query.ids = query.ids.map(function (id) {
								return (id === clientOldId) ? idChange.newId : id;
							}, this);
						}, this);

						// Update post-save changes with new id
						function fixInstance(inst) {
							if (inst && obj === fromExoGraph(inst, serverSync._translator))
								inst.id = idChange.newId;
						}

						this._sets.forEach(function (set) {
							set._changes.forEach(function (change) {
								// Only process changes to graph instances
								if (!change.instance) return;

								fixInstance(change.instance);

								// For list changes additionally check added and removed objects.
								if (change.type === "ListChange") {
									if (change.added.length > 0)
										change.added.forEach(fixInstance);
									if (change.removed.length > 0)
										change.removed.forEach(fixInstance);
								}
								// For reference changes additionally check oldValue/newValue
								else if (change.type === "ReferenceChange") {
									fixInstance(change.oldValue);
									fixInstance(change.newValue);
								}
							}, this);
						}, this);
					}
					// Otherwise, log an error.
					else {
						ExoWeb.trace.logWarning("server",
							"Cannot apply id change on type \"{type}\" since old id \"{oldId}\" was not found.",
							idChange);
					}
				}, after), this);
			}, this);
		},
		applyInitChange: function (change, serverSync, before, after) {
			tryGetJsType(serverSync._model, change.instance.type, null, false, serverSync.ignoreChanges(before, function (jstype) {
				if (!jstype.meta.get(change.instance.id)) {
					// Create the new object
					var newObj = new jstype();

					// Check for a translation between the old id that was reported and an actual old id.  This is
					// needed since new objects that are created on the server and then committed will result in an accurate
					// id change record, but "instance.id" for this change will actually be the persisted id.
					var serverOldId = serverSync._translator.forward(change.instance.type, change.instance.id) || change.instance.id;

					// Remember the object's client-generated new id and the corresponding server-generated new id
					serverSync._translator.add(change.instance.type, newObj.meta.id, serverOldId);
				}
			}, after), this);
		},
		applyRefChange: function (change, serverSync, before, after) {
			tryGetJsType(serverSync._model, change.instance.type, change.property, false, function (srcType) {
				tryGetEntity(serverSync._model, serverSync._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, serverSync.ignoreChanges(before, function (srcObj) {
					if (change.newValue) {
						tryGetJsType(serverSync._model, change.newValue.type, null, true, serverSync.ignoreChanges(before, function (refType) {
							var refObj = fromExoGraph(change.newValue, serverSync._translator);
							Sys.Observer.setValue(srcObj, change.property, refObj);
						}, after), this);
					}
					else {
						Sys.Observer.setValue(srcObj, change.property, null);
					}
				}, after), this);
			}, this);
		},
		applyValChange: function (change, serverSync, before, after) {
			tryGetJsType(serverSync._model, change.instance.type, change.property, false, function (srcType) {
				tryGetEntity(serverSync._model, serverSync._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, serverSync.ignoreChanges(before, function (srcObj) {
					if (srcObj.meta.property(change.property).get_jstype() == Date && change.newValue && change.newValue.constructor == String && change.newValue.length > 0) {

						//now that we have the value set for the date.
						//if the underlying property datatype is actually a date and not a datetime
						//then we need to add the local timezone offset to make sure that the date is displayed acurately.
						if (srcObj.meta.property(change.property).get_format() === Date.formats.ShortDate) {
							var serverOffset = serverSync.get_ServerTimezoneOffset();
							var localOffset = -(new Date().getTimezoneOffset() / 60);
							change.newValue = change.newValue.replace(dateRegex, dateRegexReplace);
							change.newValue = new Date(change.newValue);
							change.newValue.addHours(serverOffset - localOffset);
						}
						else {
							change.newValue = change.newValue.replace(dateRegex, dateRegexReplace);
							change.newValue = new Date(change.newValue);
						}
					}

					Sys.Observer.setValue(srcObj, change.property, change.newValue);
				}, after), this);
			}, this);
		},
		applyListChange: function (change, serverSync, before, after) {
			tryGetJsType(serverSync._model, change.instance.type, change.property, false, function (srcType) {
				tryGetEntity(serverSync._model, serverSync._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, serverSync.ignoreChanges(before, function (srcObj) {
					var prop = srcObj.meta.property(change.property, true);
					var list = prop.value(srcObj);

					list.beginUpdate();

					var listSignal = new ExoWeb.Signal("applyListChange-items");

					// apply added items
					change.added.forEach(function (item) {
						tryGetJsType(serverSync._model, item.type, null, true, listSignal.pending(serverSync.ignoreChanges(before, function (itemType) {
							var itemObj = fromExoGraph(item, serverSync._translator);
							if (list.indexOf(itemObj) < 0) {
								list.add(itemObj);
							}
						}, after)), this, true);
					}, this);

					// apply removed items
					change.removed.forEach(function (item) {
						// no need to load instance only to remove it from a list
						tryGetJsType(serverSync._model, item.type, null, false, serverSync.ignoreChanges(before, function (itemType) {
							var itemObj = fromExoGraph(item, serverSync._translator);
							list.remove(itemObj);
						}, after), this, true);
					}, this);

					// don't end update until the items have been loaded
					listSignal.waitForAll(serverSync.ignoreChanges(before, function () {
						list.endUpdate();
					}, after), this, true);
				}, after), this);
			}, this);
		}
	});

	// #endregion

	// #region ServerSync
	//////////////////////////////////////////////////

	function ServerSync(model) {
		this._model = model;
		this._changeLog = new ChangeLog();
		this._pendingServerEvent = false;
		this._pendingRoundtrip = false;
		this._pendingSave = false;
		this._scopeQueries = [];
		this._objectsExcludedFromSave = [];
		this._translator = new ExoWeb.Translator();
		this._serverInfo = null;

		// don't record changes to types that didn't originate from the server
		function filterObjectEvent(obj) {
			return obj.meta.type.get_origin() === "server";
		}

		// don't record changes to types or properties that didn't originate from the server
		function filterPropertyEvent(obj, property) {
			return property.get_containingType().get_origin() === "server" && property.get_origin() === "server" && !property.get_isStatic();
		}

		this._listener = new ExoGraphEventListener(this._model, this._translator, {
			listChanged: filterPropertyEvent,
			propertyChanged: filterPropertyEvent,
			objectRegistered: filterObjectEvent,
			objectUnregistered: filterObjectEvent
		});

		var applyingChanges = 0;
		this.isApplyingChanges = function ServerSync$isApplyingChanges() {
			return applyingChanges > 0;
		};
		this.beginApplyingChanges = function ServerSync$beginApplyingChanges() {
			applyingChanges++;
		};
		this.endApplyingChanges = function ServerSync$endApplyingChanges() {
			applyingChanges--;

			if (applyingChanges < 0)
				ExoWeb.trace.throwAndLog("Error in transaction log processing: unmatched begin and end applying changes.");
		};

		var isCapturingChanges = false;
		this.isCapturingChanges = function ServerSync$isCapturingChanges() {
			return isCapturingChanges;
		};
		this.beginCapturingChanges = function ServerSync$beginCapturingChanges() {
			isCapturingChanges = true;
			startChangeSet.call(this, "client");
		};

		this.ignoreChanges = function(before, callback, after, thisPtr) {
			return function() {
				var beforeCalled = false;

				try {
					applyingChanges++;

					if (before && before instanceof Function)
						before();
				
					beforeCalled = true;

					callback.apply(thisPtr || this, arguments);
				}
				finally {
					applyingChanges--;
				
					if (beforeCalled === true && after && after instanceof Function)
						after();
				}
			};
		};

		model.addObjectRegistered(function(obj) {
			// if an existing object is registered then register for lazy loading
			if (!obj.meta.isNew && obj.meta.type.get_origin() == "server" && isCapturingChanges && !applyingChanges) {
				ObjectLazyLoader.register(obj);
				//ExoWeb.trace.log(["entity", "server"], "{0}({1})  (ghost)", [obj.meta.type.get_fullName(), obj.meta.id]);
			}
		});

		// Assign back reference
		model._server = this;

		this._listener.addChangeCaptured(this._captureChange.bind(this));

		Sys.Observer.makeObservable(this);
	}

	ServerSync.mixin(ExoWeb.Functor.eventing);

	var pendingRequests = 0;

	ExoWeb.registerActivity(function() {
		return pendingRequests > 0;
	});

	function serializeChanges(includeAllChanges, simulateInitRoot) {
		var changes = this._changeLog.serialize(includeAllChanges ? this.canSend : this.canSave, this);

		// temporary HACK (no, really): splice InitNew changes into init transaction
		if (simulateInitRoot && simulateInitRoot.meta.isNew) {
			function isRootChange(change) {
				return change.type === "InitNew" && change.instance.type === simulateInitRoot.meta.type.get_fullName() &&
					(change.instance.id === simulateInitRoot.meta.id || this._translator.reverse(change.instance.type, change.instance.id) === simulateInitRoot.meta.id);
			}

			var found = false;
			var initSet = changes.filter(function(set) { return set.source === "init"; })[0];
			if (!initSet || !initSet.changes.some(isRootChange, this)) {
				changes.forEach(function(set) {
					if (found === true) return;
					set.changes.forEach(function(change, index) {
						if (found === true) return;
						else if (isRootChange.call(this, change)) {
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

	function startChangeSet(source) {
		if (source) {
			this._changeLog.start(source);
		}
		else {
			this._changeLog.start("unknown");
			ExoWeb.trace.logWarning("server", "Changes to apply but no source is specified.");
		}
	}

	// when ServerSync is made singleton, this data will be referenced via closure
	function ServerSync$addScopeQuery(query) {
		this._scopeQueries.push(query);
	}

	function ServerSync$storeInitChanges(changes) {
		var activeSet = this._changeLog.activeSet();

		this._changeLog.addSet("init", changes);

		if (activeSet)
			startChangeSet.call(this, activeSet.source());
	}

	ServerSync.mixin({
		// Enable/disable save & related functions
		///////////////////////////////////////////////////////////////////////
		enableSave: function ServerSync$enableSave(obj) {
			if (Array.contains(this._objectsExcludedFromSave, obj)) {
				Array.remove(this._objectsExcludedFromSave, obj);
				Sys.Observer.raisePropertyChanged(this, "HasPendingChanges");
				return true;
			}
		},
		disableSave: function ServerSync$disableSave(obj) {
			if (!Array.contains(this._objectsExcludedFromSave, obj)) {
				this._objectsExcludedFromSave.push(obj);
				Sys.Observer.raisePropertyChanged(this, "HasPendingChanges");
				return true;
			}
		},
		canSend: function (change) {
			if (change.type === "Checkpoint") return false;

			return true;
		},
		canSaveObject: function ServerSync$canSaveObject(objOrMeta) {
			var obj;
			var errorFmt = "Unable to test whether object can be saved:  {0}.";

			if (arguments.length === 0) {
				ExoWeb.trace.throwAndLog("server", errorFmt, ["argument not given"]);
			}
			else if (objOrMeta === undefined || objOrMeta === null) {
				ExoWeb.trace.throwAndLog("server", errorFmt, ["argument is null or undefined"]);
			}
			else if (objOrMeta instanceof ExoWeb.Model.ObjectMeta) {
				obj = objOrMeta._obj;
			}
			else if (objOrMeta instanceof ExoWeb.Model.Entity) {
				obj = objOrMeta;
			}
			else {
				ExoWeb.trace.throwAndLog("server", errorFmt, ["argument is not of correct type"]);
			}

			return !Array.contains(this._objectsExcludedFromSave, obj);
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
						var jstype = ExoWeb.Model.Model.getJsType(item.type, true);
						if (!jstype || this.canSaveObject(fromExoGraph(item, this._translator))) {
							ignore = false;
						}
					}, this);
					Array.forEach(change.removed, function (item) {
						// if the type doesn't exist then obviously the instance doesn't either
						var jstype = ExoWeb.Model.Model.getJsType(item.type, true);
						if (!jstype || this.canSaveObject(fromExoGraph(item, this._translator))) {
							ignore = false;
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
					var oldValue = fromExoGraph(change.oldValue, this._translator);
					if (oldValue && !this.canSaveObject(oldValue)) {
						return false;
					}
				}

				var newJsType = change.newValue && ExoWeb.Model.Model.getJsType(change.newValue.type, true);
				if (newJsType) {
					var newValue = fromExoGraph(change.newValue, this._translator);
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
			var instanceObj = fromExoGraph(change.instance, this._translator);
			return this.canSaveObject(instanceObj);
		},

		_handleResult: function ServerSync$handleResult(result, source, checkpoint, callback) {
			var signal = new ExoWeb.Signal("Success");

			if (result.serverinfo)
				this.set_ServerInfo(result.serverinfo);

			if (result.instances) {
				var batch = ExoWeb.Batch.start();

				objectsFromJson(this._model, result.instances, signal.pending(function () {
					function processChanges() {
						ExoWeb.Batch.end(batch);

						if (result.changes && result.changes.length > 0) {
							this._changeLog.applyChanges(checkpoint, result.changes, source, this);
						}
						else if (source) {
							// no changes, so record empty set
							startChangeSet.call(this, source);
							startChangeSet.call(this, "client");
						}
					}

					// if there is instance data to load then wait before loading conditions (since they may reference these instances)
					if (result.conditions) {
						conditionsFromJson(this._model, result.conditions, signal.pending(processChanges), this);
					}
					else {
						processChanges.call(this);
					}
				}), this);
			}
			else if (result.changes && result.changes.length > 0) {
				this._changeLog.applyChanges(checkpoint, result.changes, source, this);
				if (result.conditions) {
					conditionsFromJson(this._model, result.conditions, signal.pending());
				}
			}
			else {
				if (source) {
					// no changes, so record empty set
					startChangeSet.call(this, source);
					startChangeSet.call(this, "client");
				}

				if (result.conditions) {
					conditionsFromJson(this._model, result.conditions, signal.pending());
				}
			}

			signal.waitForAll(function () {
				if (callback && callback instanceof Function) {
					callback.call(this);
				}
			}, this);
		},

		// General events methods
		///////////////////////////////////////////////////////////////////////
		_raiseBeginEvents: function (method, args) {
			this._raiseEvent("requestBegin", [this, args]);
			this._raiseEvent(method + "Begin", [this, args]);
		},
		_raiseEndEvents: function (method, result, args) {
			this._raiseEvent("requestEnd", [this, args]);
			this._raiseEvent("request" + result, [this, args]);
			this._raiseEvent(method + "End", [this, args]);
			this._raiseEvent(method + result, [this, args]);
		},
		addRequestBegin: function (handler) {
			this._addEvent("requestBegin", handler);
		},
		addRequestEnd: function (handler) {
			this._addEvent("requestEnd", handler);
		},
		addRequestSuccess: function (handler) {
			this._addEvent("requestSuccess", handler);
		},
		addRequestFailed: function (handler) {
			this._addEvent("requestFailed", handler);
		},

		// Raise Server Event
		///////////////////////////////////////////////////////////////////////
		raiseServerEvent: function ServerSync$raiseServerEvent(name, obj, event, includeAllChanges, success, failed, paths) {
			pendingRequests++;

			Sys.Observer.setValue(this, "PendingServerEvent", true);

			var args = { eventTarget: obj, eventName: name, eventRaised: event, includeAllChanges: includeAllChanges };
			this._raiseBeginEvents("raiseServerEvent", args);

			// if no event object is provided then use an empty object
			if (event === undefined || event === null) {
				event = {};
			}

			for (var key in event) {
				var arg = event[key];

				if (arg instanceof Array) {
					for (var i = 0; i < arg.length; ++i) {
						arg[i] = toExoGraph(this._translator, arg[i]);
					}
				}
				else {
					event[key] = toExoGraph(this._translator, arg);
				}
			}

			// Checkpoint the log to ensure that we only truncate changes that were saved.
			var checkpoint = this._changeLog.checkpoint("server event " + name + " " + Date.formats.DateTime.convert(new Date()));

			eventProvider(
				name,
				toExoGraph(this._translator, obj),
				event,
				paths,
			// If includeAllChanges is true, then use all changes including those 
			// that should not be saved, otherwise only use changes that can be saved.
				serializeChanges.call(this, includeAllChanges, obj),
				this._onRaiseServerEventSuccess.bind(this).appendArguments(args, checkpoint, success),
				this._onRaiseServerEventFailed.bind(this).appendArguments(args, failed || success)
			);
		},
		_onRaiseServerEventSuccess: function ServerSync$_onRaiseServerEventSuccess(result, args, checkpoint, callback) {
			Sys.Observer.setValue(this, "PendingServerEvent", false);

			args.responseObject = result;

			this._handleResult(result, args.name, checkpoint, function () {
				var event = result.events[0];
				if (event instanceof Array) {
					for (var i = 0; i < event.length; ++i) {
						event[i] = fromExoGraph(event[i], this._translator);
					}
				}
				else {
					event = fromExoGraph(event, this._translator);
				}

				restoreDates(event);

				result.event = event;
				args.eventResponse = event;

				this._raiseEndEvents("raiseServerEvent", "Success", args);

				if (callback && callback instanceof Function)
					callback.call(this, result);

				pendingRequests--;
			});
		},
		_onRaiseServerEventFailed: function ServerSync$_onRaiseServerEventFailed(error, args, callback) {
			Sys.Observer.setValue(this, "PendingServerEvent", false);

			args.error = error;

			this._raiseEndEvents("raiseServerEvent", "Failed", args);

			if (callback && callback instanceof Function)
				callback.call(this, error);

			pendingRequests--;
		},
		addRaiseServerEventBegin: function (handler) {
			this._addEvent("raiseServerEventBegin", handler);
		},
		addRaiseServerEventEnd: function (handler) {
			this._addEvent("raiseServerEventEnd", handler);
		},
		addRaiseServerEventSuccess: function (handler) {
			this._addEvent("raiseServerEventSuccess", handler);
		},
		addRaiseServerEventFailed: function (handler) {
			this._addEvent("raiseServerEventFailed", handler);
		},

		// Roundtrip
		///////////////////////////////////////////////////////////////////////
		roundtrip: function ServerSync$roundtrip(root, paths, success, failed) {
			pendingRequests++;

			if (root && root instanceof Function) {
				success = root;
				failed = paths;
				root = null;
				paths = null;
			}

			Sys.Observer.setValue(this, "PendingRoundtrip", true);

			var args = {};
			this._raiseBeginEvents("roundtrip", args);

			var mtype = root ? root.meta.type || root.meta : null;
			var id = root ? root.meta.id || STATIC_ID : null;

			roundtripProvider(
				mtype ? mtype.get_fullName() : null,
				id,
				paths,
				serializeChanges.call(this, false, root),
				this._onRoundtripSuccess.bind(this).appendArguments(args, success),
				this._onRoundtripFailed.bind(this).appendArguments(args, failed || success)
			);
		},
		_onRoundtripSuccess: function ServerSync$_onRoundtripSuccess(result, args, callback) {
			Sys.Observer.setValue(this, "PendingRoundtrip", false);

			args.responseObject = result;

			this._handleResult(result, "roundtrip", null, function () {
				this._raiseEndEvents("roundtrip", "Success", args);

				if (callback && callback instanceof Function)
					callback.call(this, result);

				pendingRequests--;
			});
		},
		_onRoundtripFailed: function ServerSync$_onRoundtripFailed(error, args, callback) {
			Sys.Observer.setValue(this, "PendingRoundtrip", false);

			args.error = error;

			this._raiseEndEvents("roundtrip", "Failed", args);

			if (callback && callback instanceof Function)
				callback.call(this, error);

			pendingRequests--;
		},
		startAutoRoundtrip: function ServerSync$startAutoRoundtrip(interval) {
			//ExoWeb.trace.log("server", "auto-roundtrip enabled - interval of {0} milliseconds", [interval]);

			// cancel any pending roundtrip schedule
			this.stopAutoRoundtrip();

			function doRoundtrip() {
				//ExoWeb.trace.log("server", "auto-roundtrip starting ({0})", [new Date()]);
				this.roundtrip(function () {
					//ExoWeb.trace.log("server", "auto-roundtrip complete ({0})", [new Date()]);
					this._roundtripTimeout = window.setTimeout(doRoundtrip.bind(this), interval);
				});
			}

			this._roundtripTimeout = window.setTimeout(doRoundtrip.bind(this), interval);
		},
		stopAutoRoundtrip: function ServerSync$stopAutoRoundtrip() {
			if (this._roundtripTimeout) {
				window.clearTimeout(this._roundtripTimeout);
			}
		},

		// Save
		///////////////////////////////////////////////////////////////////////
		save: function ServerSync$save(root, success, failed) {
			pendingRequests++;

			Sys.Observer.setValue(this, "PendingSave", true);

			var args = { root: root };
			this._raiseBeginEvents("save", args);

			// Checkpoint the log to ensure that we only truncate changes that were saved.
			var checkpoint = this._changeLog.checkpoint("save " + Date.formats.DateTime.convert(new Date()));

			saveProvider(
				toExoGraph(this._translator, root),
				serializeChanges.call(this, true, root),
				this._onSaveSuccess.bind(this).appendArguments(args, checkpoint, success),
				this._onSaveFailed.bind(this).appendArguments(args, failed || success)
			);
		},
		_onSaveSuccess: function ServerSync$_onSaveSuccess(result, args, checkpoint, callback) {
			Sys.Observer.setValue(this, "PendingSave", false);

			args.responseObject = result;

			this._handleResult(result, "save", checkpoint, function () {
				this._raiseEndEvents("save", "Success", args);

				if (callback && callback instanceof Function)
					callback.call(this, result);

				pendingRequests--;
			});
		},
		_onSaveFailed: function (error, args, callback) {
			Sys.Observer.setValue(this, "PendingSave", false);

			args.error = error;

			this._raiseEndEvents("save", "Failed", args);

			if (callback && callback instanceof Function)
				callback.call(this, error);

			pendingRequests--;
		},
		startAutoSave: function ServerSync$startAutoSave(root, interval) {
			// cancel any pending save schedule
			this.stopAutoSave();
			this._saveInterval = interval;
			this._saveRoot = root;
		},
		stopAutoSave: function ServerSync$stopAutoSave() {
			if (this._saveTimeout) {
				window.clearTimeout(this._saveTimeout);

				this._saveTimeout = null;
			}

			this._saveInterval = null;
			this._saveRoot = null;
		},
		_queueAutoSave: function ServerSync$_queueAutoSave() {
			if (this._saveTimeout)
				return;

			function doAutoSave() {
				//ExoWeb.trace.log("server", "auto-save starting ({0})", [new Date()]);
				this.save(this._saveRoot, function ServerSync$doAutoSave$callback() {
					//ExoWeb.trace.log("server", "auto-save complete ({0})", [new Date()]);

					// wait for the next change before next auto save
					this._saveTimeout = null;
				});
			}

			this._saveTimeout = window.setTimeout(doAutoSave.bind(this), this._saveInterval);
		},
		addSaveBegin: function (handler) {
			this._addEvent("saveBegin", handler);
		},
		addSaveEnd: function (handler) {
			this._addEvent("saveEnd", handler);
		},
		addSaveSuccess: function (handler) {
			this._addEvent("saveSuccess", handler);
		},
		addSaveFailed: function (handler) {
			this._addEvent("saveFailed", handler);
		},

		// Rollback
		///////////////////////////////////////////////////////////////////////
		rollback: function ServerSync$rollback(steps, callback) {
			var depth = 0;

			try {
				//					ExoWeb.trace.log("server", "ServerSync.rollback() >> {0}", steps);

				this.beginApplyingChanges();

				var signal = new ExoWeb.Signal("ServerSync.rollback");

				function processNextChange() {
					var change = null;

					if (steps === undefined || depth < steps) {
						change = this._changeLog.undo();
						depth++;
					}

					if (change) {
						var callback = signal.pending(processNextChange, this);

						if (change.type == "InitNew") {
							this.rollbackInitChange(change, callback);
						}
						else if (change.type == "ReferenceChange") {
							this.rollbackRefChange(change, callback);
						}
						else if (change.type == "ValueChange") {
							this.rollbackValChange(change, callback);
						}
						else if (change.type == "ListChange") {
							this.rollbackListChange(change, callback);
						}
					}
				}

				processNextChange.call(this);

				signal.waitForAll(function () {
					//						ExoWeb.trace.log("server", "done rolling back {0} changes", [steps]);
					this.endApplyingChanges();

					if (callback && callback instanceof Function) {
						callback();
					}

					Sys.Observer.raisePropertyChanged(this, "HasPendingChanges");
				}, this);
			}
			catch (e) {
				this.endApplyingChanges();
				ExoWeb.trace.throwAndLog(["server"], e);
			}
		},
		rollbackValChange: function ServerSync$rollbackValChange(change, callback) {
			//				ExoWeb.trace.log("server", "rollbackValChange", change.instance);

			var obj = fromExoGraph(change.instance, this._translator);

			Sys.Observer.setValue(obj, change.property, change.oldValue);
			callback();
		},
		rollbackRefChange: function ServerSync$rollbackRefChange(change, callback) {
			//				ExoWeb.trace.log("server", "rollbackRefChange: Type = {instance.type}, Id = {instance.id}, Property = {property}", change);

			var obj = fromExoGraph(change.instance, this._translator);
			var ref = fromExoGraph(change.oldValue, this._translator);

			Sys.Observer.setValue(obj, change.property, ref);
			callback();
		},
		rollbackInitChange: function ServerSync$rollbackInitChange(change, callback) {
			//				ExoWeb.trace.log("server", "rollbackInitChange: Type = {type}, Id = {id}", change.instance);

			delete change.instance;

			//TODO: need to remove from the translator

			callback();
		},
		rollbackListChange: function ServerSync$rollbackListChange(change, callback) {
			var obj = fromExoGraph(change.instance, this._translator);
			var prop = obj.meta.property(change.property, true);
			var list = prop.value(obj);
			var translator = this._translator;

			list.beginUpdate();

			// Rollback added items
			Array.forEach(change.added, function ServerSync$rollbackListChanges$added(item) {
				var childObj = fromExoGraph(item, translator);
				list.remove(childObj);
			});

			// Rollback removed items
			Array.forEach(change.removed, function ServerSync$rollbackListChanges$added(item) {
				var childObj = fromExoGraph(item, translator);
				list.add(childObj);
			});

			list.endUpdate();

			callback();
		},

		// Various
		///////////////////////////////////////////////////////////////////////
		_captureChange: function ServerSync$_captureChange(change) {
			if (!this.isApplyingChanges() && this.isCapturingChanges()) {
				this._changeLog.add(change);

				Sys.Observer.raisePropertyChanged(this, "HasPendingChanges");

				if (this._saveInterval)
					this._queueAutoSave();
			}
		},
		get_Changes: function ServerSync$get_Changes(includeAllChanges/*, ignoreWarning*/) {
			if (arguments.length < 2 || arguments[1] !== true) {
				ExoWeb.trace.logWarning("server", "Method get_Changes is not intended for long-term use - it will be removed in the near future.");
			}

			var list = [];
			var sets = this._changeLog.serialize(includeAllChanges ? null : this.canSave, this);
			sets.forEach(function (set) {
				list.addRange(set.changes);
			});
			return list;
		},
		get_HasPendingChanges: function ServerSync$get_HasPendingChanges() {
			return this._changeLog.sets().some(function (set) {
				return set.changes().some(function (change) {
					return this.canSave(change);
				}, this);
			}, this);
		},
		get_PendingAction: function ServerSync$get_PendingAction() {
			return this._pendingServerEvent || this._pendingRoundtrip || this._pendingSave;
		},
		get_PendingServerEvent: function ServerSync$get_PendingServerEvent() {
			return this._pendingServerEvent;
		},
		set_PendingServerEvent: function ServerSync$set_PendingServerEvent(value) {
			var oldValue = this._pendingServerEvent;
			this._pendingServerEvent = value;

			if (oldValue !== value) {
				Sys.Observer.raisePropertyChanged(this, "PendingAction");
			}
		},
		get_PendingRoundtrip: function ServerSync$get_PendingRoundtrip() {
			return this._pendingRoundtrip;
		},
		set_PendingRoundtrip: function ServerSync$set_PendingRoundtrip(value) {
			var oldValue = this._pendingRoundtrip;
			this._pendingRoundtrip = value;

			if (oldValue !== value) {
				Sys.Observer.raisePropertyChanged(this, "PendingAction");
			}
		},
		get_PendingSave: function ServerSync$get_PendingSave() {
			return this._pendingSave;
		},
		set_PendingSave: function ServerSync$set_PendingSave(value) {
			var oldValue = this._pendingSave;
			this._pendingSave = value;

			if (oldValue !== value) {
				Sys.Observer.raisePropertyChanged(this, "PendingAction");
			}
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
			this._serverInfo = this._serverInfo ? $.extend(this._serverInfo, newInfo) : newInfo;
		}
	});

	ExoWeb.Mapper.ServerSync = ServerSync;

	ServerSync.Roundtrip = function ServerSync$Roundtrip(root, success, failed) {
		if (root instanceof ExoWeb.Model.Entity) {
			root = root.meta.type.get_model();
		}

		if (root instanceof ExoWeb.Model.Model) {
			if (root._server) {
				if (!root._server.isApplyingChanges()) {
					root._server.roundtrip(success, failed);
				}
			}
			else {
				ExoWeb.trace.logWarning("server", "Unable to perform roundtrip:  root is not a model or entity.");
			}
		}
	};

	ServerSync.Save = function ServerSync$Save(root, success, failed) {
		var model;
		if (root instanceof ExoWeb.Model.Entity) {
			model = root.meta.type.get_model();
		}

		if (model && model instanceof ExoWeb.Model.Model) {
			if (model._server) {
				model._server.save(root, success, failed);
			}
			else {
				// TODO
			}
		}
	};

	ServerSync.GetServerTimeZone = function ServerSync$GetServerTimeZone(root) {
		var model;
		if (root instanceof ExoWeb.Model.Entity) {
			model = root.meta.type.get_model();
		}

		if (model && model instanceof ExoWeb.Model.Model) {
			if (model._server) {
				return model._server.get_ServerTimezoneOffset(root);
			}
			else {
				// TODO
			}
		}
	};

	// #endregion

	// #region TriggersRoundtripRule
	//////////////////////////////////////////////////

	function TriggerRoundtripRule(property) {
		var prop = this.prop = property;

		ExoWeb.Model.Rule.register(this, [property], true);
	}

	TriggerRoundtripRule.prototype = {
		execute: function(obj, callback) {
			ServerSync.Roundtrip(obj, callback, callback);
		},
		toString: function() {
			return "trigger roundtrip";
		}
	};

	ExoWeb.Mapper.TriggerRoundtripRule = ExoWeb.Model.Rule.triggerRoundtrip = TriggerRoundtripRule;

	ExoWeb.Model.Property.mixin({
		triggersRoundtrip: function () {
			if (!this._triggersRoundtrip) {
				var rule = new TriggerRoundtripRule(this);
				this._triggersRoundtrip = true;
			}
		}
	});

	// #endregion

	// #region Internals
	//////////////////////////////////////////////////

	var STATIC_ID = "static";

	function ensureJsType(model, typeName, callback, thisPtr) {
		var mtype = model.type(typeName);

		if (!mtype) {
			fetchType(model, typeName, function(jstype) {
				callback.apply(thisPtr || this, [jstype]);
			});
		}
		else if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
			ExoWeb.Model.LazyLoader.load(mtype, null, function(jstype) {
				callback.apply(thisPtr || this, [jstype]);
			});
		}
		else {
			callback.apply(thisPtr || this, [mtype.get_jstype()]);
		}
	}

	function conditionsFromJson(model, json, callback, thisPtr) {
		var signal = new Signal("conditionsFromJson");

		for (var code in json) {
			conditionFromJson(model, code, json[code], signal.pending());
		}

		signal.waitForAll(function() {
			if (callback && callback instanceof Function) {
				callback.call(thisPtr || this);
			}
		});
	}

	function conditionFromJson(model, code, json, callback, thisPtr) {
		var type = ExoWeb.Model.ConditionType.get(code);

		if (!type) {
			ExoWeb.trace.logWarning(["server", "conditions"], "A condition type with code \"{0}\" could not be found.", [code]);
			callback.call(thisPtr || this);
			return;
		}

		var signal = new Signal("conditionFromJson - " + code);

		var serverSync = model._server;

		json.forEach(function(condition) {
			var conditionObj = null;

			condition.targets.forEach(function(target) {
				tryGetJsType(serverSync._model, target.instance.type, null, false, function (jstype) {
					tryGetEntity(serverSync._model, serverSync._translator, jstype, target.instance.id, null, LazyLoadEnum.None, function (inst) {
						var propsSignal = new Signal("conditionFromJson.properties");

						var props = [];
						distinct(target.properties).forEach(function(p, i) {
							Model.property("this." + p, inst.meta.type, true, propsSignal.pending(function(chain) {
								props[i] = chain;
							}));
						});

						propsSignal.waitForAll(signal.pending(function() {
							if (!conditionObj) {
								conditionObj = new ExoWeb.Model.Condition(type, condition.message ? condition.message : type.get_message(), props);
							}
							else {
								conditionObj.get_properties().addRange(props);
							}

							inst.meta.conditionIf(conditionObj, true);
						}));
					});
				});
			});
		});

		signal.waitForAll(function() {
			if (callback && callback instanceof Function) {
				callback.call(thisPtr || this);
			}
		});
	}

	function objectsFromJson(model, json, callback, thisPtr) {
		var signal = new ExoWeb.Signal("objectsFromJson");

		try {
			for (var typeName in json) {
				var poolJson = json[typeName];
				for (var id in poolJson) {
					// locate the object's state in the json
					objectFromJson(model, typeName, id, poolJson[id], signal.pending(), thisPtr);
				}
			}
		}
		finally {
			signal.waitForAll(function() {
				callback.apply(thisPtr || this, arguments);
			});
		}
	}

	function objectFromJson(model, typeName, id, json, callback, thisPtr) {
		// get the object to load
		var obj;

		// family-qualified type name is not available so can't use getType()
		var mtype = model.type(typeName);

		// if this type has never been seen, go and fetch it and resume later
		if (!mtype) {
			fetchType(model, typeName, function() {
				objectFromJson(model, typeName, id, json, callback);
			});
			return;
		}

		// Load object's type if needed
		if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
			ExoWeb.Model.LazyLoader.load(mtype, null, function() {
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

		///initialize the object if it was ghosted
		if (id === STATIC_ID || (obj && obj.wasGhosted) || !LazyLoader.isLoaded(obj)) {
		//			ExoWeb.trace.log("objectInit", "{0}({1})   <.>", [typeName, id]);
			if (obj) {
				delete obj.wasGhosted;
			}

			var loadedProperties = [];

			// Load object's properties
			for (var t = mtype; t !== null; t = t.baseType) {
				var props = obj ? t.get_instanceProperties() : t.get_staticProperties();

				for (var propName in props) {
					if (loadedProperties.contains(propName))
						continue;
			
					loadedProperties.push(propName);

					var prop = props[propName];
		
		//					ExoWeb.trace.log("propInit", "{0}({1}).{2} = {3}", [typeName, id, propName, propData]);

					if (!prop) {
						ExoWeb.trace.throwAndLog(["objectInit"], "Cannot load object {0}({2}) because it has an unexpected property '{1}'", [typeName, propName, id]);
					}

					if(prop.get_origin() !== "server")
						continue;

					var propData;

					// instance fields have indexes, static fields use names
					if(obj) {
						propData = json[prop.get_index()]; 
					}
					else {
						propData = json[propName]; 

						// not all static fields may be present
						if(propData === undefined)
							continue;
					}

					if (propData === null) {
						prop.init(obj, null);
					}
					else {
						var propType = prop.get_jstype();

						 if (prop.get_isList()) {
							var list = prop.value(obj);

							if (propData == "?") {
								// don't overwrite list if its already a ghost
								if (!list) {
									list = ListLazyLoader.register(obj, prop);
									prop.init(obj, list, false);
								}
							}
							else {
								if (!list || !ExoWeb.Model.LazyLoader.isLoaded(list)) {

									var doInit = undefined;

									// json has list members
									if (list) {
										ListLazyLoader.unregister(list);
										doInit = false;
									}
									else {
										list = [];
										doInit = true;
									}

									for (var i = 0; i < propData.length; i++) {
										var ref = propData[i];
										list.push(getObject(model, propType, (ref && ref.id || ref), (ref && ref.type || propType)));
									}

									if (doInit) {
										prop.init(obj, list);
									}
								}
							}
						}
						else {
							var ctor = prop.get_jstype(true);

							// assume if ctor is not found its a model type not an intrinsic
							if (!ctor || ctor.meta) {
								prop.init(obj, getObject(model, propType, (propData && propData.id || propData), (propData && propData.type || propType)));
							}
							else {
								// Coerce strings into dates
								if (ctor == Date && propData && propData.constructor == String && propData.length > 0) {

									//now that we have the value set for the date.
									//if the underlying property datatype is actually a date and not a datetime
									//then we need to add the local timezone offset to make sure that the date is displayed acurately.
									if (prop.get_format() === Date.formats.ShortDate) {
										var serverOffset = model._server.get_ServerTimezoneOffset();
										var localOffset = -(new Date().getTimezoneOffset() / 60);

										propData = propData.replace(dateRegex, dateRegexReplace);
										propData = new Date(propData);
										propData.addHours(serverOffset - localOffset);
									}
									else {
										propData = propData.replace(dateRegex, dateRegexReplace);
										propData = new Date(propData);
									}
								}
								prop.init(obj, propData);
							}
						}
					}

					// static fields are potentially loaded one at a time
				}
			}

			if (obj) {
				ObjectLazyLoader.unregister(obj);
			}
		}

		if (callback && callback instanceof Function) {
			callback(thisPtr || this);
		}
	}

	function typesFromJson(model, json) {
		for (var typeName in json) {
			typeFromJson(model, typeName, json[typeName]);
		}
	}

	function typeFromJson(model, typeName, json) {
//			ExoWeb.trace.log("typeInit", "{1}   <.>", arguments);

		// get model type. it may have already been created for lazy loading	
		var mtype = getType(model, typeName, json.baseType, true);

		// define properties
		for (var propName in json.properties) {
			var propJson = json.properties[propName];

			// Type
			var propType = propJson.type;
			if (propJson.type.endsWith("[]"))
			{
				propType = propType.toString().substring(0, propType.length - 2);
				propJson.isList = true;
			}
			propType = getJsType(model, propType);

			// Format
			var format = (propJson.format && propType.formats) ? propType.formats[propJson.format] : null;

			// Add the property
			var prop = mtype.addProperty({ name: propName, type: propType, isList: propJson.isList, label: propJson.label, format: format, isStatic: propJson.isStatic, index: propJson.index });


			// setup static properties for lazy loading
			if (propJson.isStatic) {
				if (propJson.isList) {
					prop.init(null, ListLazyLoader.register(null, prop));
				}
				//TODO
				//else {
				//	PropertyLazyLoader.register(mtype.get_jstype(), prop);
				//}
			}

			if (propJson.rules) {
				for (var i = 0; i < propJson.rules.length; ++i) {
					ruleFromJson(propJson.rules[i], prop);
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
	}

	function conditionTypesFromJson(model, mtype, json) {
		for (var code in json) {
			conditionTypeFromJson(model, mtype, code, json[code]);
		}
	}

	function conditionTypeFromJson(model, mtype, code, json) {

		// Attempt to retrieve the condition type by code.
		var conditionType = ExoWeb.Model.ConditionType.get(code);

		// Create the condition type if it does not already exist.
		if (!conditionType) {
			// Get a list of condition type sets for this type.
			var sets = !json.sets ? [] : json.sets.map(function(name) {
				var set = ExoWeb.Model.ConditionTypeSet.get(name);
				if (!set) {
					set = new ExoWeb.Model.ConditionTypeSet(name);
				}
				return set;
			});

			// Create the appropriate condition type based on the category.
			if (json.category == "Error") {
				conditionType = new ExoWeb.Model.ConditionType.Error(code, json.message, sets);
			}
			else if (json.category == "Warning") {
				conditionType = new ExoWeb.Model.ConditionType.Warning(code, json.message, sets);
			}
			else if (json.category == "Permission") {
				conditionType = new ExoWeb.Model.ConditionType.Permission(code, json.message, sets, json.permissionType, json.isAllowed);
			}
			else {
				conditionType = new ExoWeb.Model.ConditionType(code, json.category, json.message, sets);
			}

			// Account for the potential for subclasses to be serialized with additional properties.
			conditionType.extend(json);
		}

		if (json.rule && json.rule.hasOwnProperty("type")) {
			var ruleType = ExoWeb.Model.Rule[json.rule.type];
			var rule = new ruleType(mtype, json.rule, conditionType);
			conditionType.rules().push(rule);
		}
	}

	function getJsType(model, typeName, forLoading) {
		// Get an array representing the type family.
		var family = typeName.split(">");

		// Try to get the js type from the window object.
		var jstype = ExoWeb.Model.Model.getJsType(family[0], true);

		// If its not defined, assume the type is a model type
		// that may eventually be fetched.
		if (jstype === undefined) {
			jstype = getType(model, null, family, forLoading).get_jstype();
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

					//if (!forLoading || family.length > 0) {
//							ExoWeb.trace.log("typeInit", "{0} (ghost)", [type]);
						TypeLazyLoader.register(mtype);
					//}
				}
			}
		}

		return mtype;
	}

	function getObject(model, propType, id, finalType, forLoading) {
		if (id === STATIC_ID) {
			ExoWeb.trace.throwAndLog(["objectInit", "lazyLoad"], "getObject() can only be called for instances (id='{0}')", [id]);
		}

		// get model type
		var mtype = getType(model, finalType, propType);

		// Try to locate object in pool
		var obj = mtype.get(id);

		// if it doesn't exist, create a ghost
		if (!obj) {
			obj = new (mtype.get_jstype())(id);
			obj.wasGhosted = true;
			if (!forLoading) {
				ObjectLazyLoader.register(obj);
//					ExoWeb.trace.log("entity", "{0}({1})  (ghost)", [mtype.get_fullName(), id]);
			}
		}

		return obj;
	}

	///////////////////////////////////////////////////////////////////////////////
	function fetchTypeImpl(model, typeName, callback, thisPtr) {
		var signal = new ExoWeb.Signal("fetchType(" + typeName + ")");

		var errorObj;

		function success(result) {
			// load type(s)
			typesFromJson(model, result.types);

			// ensure base classes are loaded too
			model.type(typeName).eachBaseType(function(mtype) {
				if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
					ExoWeb.Model.LazyLoader.load(mtype, null, signal.pending());
				}
			});
		}

		// Handle an error response.  Loading should
		// *NOT* continue as if the type is available.
		function error(error) {
			errorObj = error;
		}

		// request the type and handle the response
		typeProvider(typeName, signal.pending(success), signal.orPending(error));

		// after properties and base class are loaded, then return results
		signal.waitForAll(function() {
			if (errorObj !== undefined) {
				ExoWeb.trace.throwAndLog("typeInit",
					"Failed to load {typeName} (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
					{ typeName: typeName, error: errorObj });
			}

			var mtype = model.type(typeName);
			TypeLazyLoader.unregister(mtype);

			raiseExtensions(mtype);

			// done
			if (callback && callback instanceof Function) {
				callback.call(thisPtr || this, mtype.get_jstype());
			}
		});
	}

	var fetchType = fetchTypeImpl.dontDoubleUp({ callbackArg: 2, thisPtrArg: 3 });

	function fetchPathTypes(model, jstype, path, callback) {
		var step = Array.dequeue(path.steps);
		while (step) {
			// locate property definition in model
			var prop = jstype.meta.property(step.property, true);

			if (!prop) {
				ExoWeb.trace.throwAndLog("typeInit", "Could not find property \"{0}\" on type \"{1}\".", [step.property, jstype.meta.get_fullName()]);
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
					fetchType(model, step.cast, function() {
						fetchPathTypes(model, jstype, path, callback);
					});
					return;
				}
			}
			else {
				mtype = prop.get_jstype().meta;
			}

			// if property's type isn't load it, then fetch it
			if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
				fetchType(model, mtype.get_fullName(), function(jstype) {
					fetchPathTypes(model, jstype, path, callback);
				});

				// path walking will resume with callback
				return;
			}

			// keep walking the path
			jstype = mtype.get_jstype();

			step = Array.dequeue(path.steps);
		}

		// done walking path
		if (callback && callback instanceof Function) {
			callback();
		}
	}

	function fetchTypes(model, typeName, paths, callback) {
		var signal = new ExoWeb.Signal("fetchTypes");

		function rootTypeLoaded(jstype) {
			if (paths) {
				Array.forEach(paths, function(path) {
					if (path.steps[0].property === "this") {
						var step = Array.dequeue(path.steps);
						var mtype = jstype.meta;

						var fetchRootTypePaths = function fetchRootTypePaths() {
							fetchPathTypes(model, mtype.get_jstype(), path, signal.pending());
						};

						// handle the case where the root object is cast to a derived type
						if (step.cast) {
							mtype = model.type(step.cast);
							if (!mtype) {
								fetchType(model, step.cast, signal.pending(function() {
									mtype = model.type(step.cast);
									fetchRootTypePaths();
								}));
							}
							else {
								fetchRootTypePaths();
							}
						}
						else {
							fetchRootTypePaths();
						}
					}
					else {
						// This is a static property.  Static property paths 
						// are currently limited to a single property.
						var step = null, typeName = "";
						while (path.steps.length > 1) {
							step = Array.dequeue(path.steps);
							typeName += (typeName.length > 0 ? "." : "") + step.property;
						}

						var mtype = model.type(typeName);

						var fetchStaticPathTypes = function fetchStaticPathTypes() {
							fetchPathTypes(model, (mtype || model.type(typeName)).get_jstype(), path, signal.pending());
						};

						if (!mtype) {
							// first time type has been seen, fetch it
							fetchType(model, typeName, signal.pending(fetchStaticPathTypes));
						}
						else if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
							// lazy load type and continue walking the path
							ExoWeb.Model.LazyLoader.load(mtype, null, signal.pending(fetchStaticPathTypes));
						}
						else {
							fetchStaticPathTypes();
						}
					}
				});
			}
		}

		// load root type, then load types referenced in paths
		var rootType = model.type(typeName);
		if (!rootType) {
			fetchType(model, typeName, signal.pending(rootTypeLoaded));
		}
		else if (!ExoWeb.Model.LazyLoader.isLoaded(rootType)) {
			ExoWeb.Model.LazyLoader.load(rootType, null, signal.pending(rootTypeLoaded));
		}
		else {
			rootTypeLoaded(rootType.get_jstype());
		}

		signal.waitForAll(callback);
	}

	// {ruleName: ruleConfig}
	function ruleFromJson(rulesJson, prop) {
		for (var name in rulesJson) {
			var json = rulesJson[name];
			var ruleType = ExoWeb.Model.Rule[json.type];
			var rule = new ruleType(json, [prop]);
		}
	}

	var dateRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})\:(\d{2})\:(\d{2})(\.\d{3})?Z$/g;
	var dateRegexReplace = "$2/$3/$1 $4:$5:$6 GMT";

	// Recursively searches throught the specified object and restores dates serialized as strings
	function restoreDates(value) {
		if (value instanceof Array) {
			for (var i = 0; i < value.length; i++)
			{
				var element = value[i];
				if (element && element.constructor == String && dateRegex.test(element)) {
					dateRegex.lastIndex = 0;
					element = element.replace(dateRegex, dateRegexReplace);
					value[i] = new Date(element);
				}
			}
		}
		else if (value instanceof Object) {
			for (var field in value) {
				if (value.hasOwnProperty(field)) {
					var element = value[field];
					if (element && element.constructor == String && dateRegex.test(element)) {
						dateRegex.lastIndex = 0;
						element = element.replace(dateRegex, dateRegexReplace);
						value[field] = new Date(element);
					}
				}
			}
		}
	}

	function tryGetJsType(model, name, property, forceLoad, callback, thisPtr) {
		var jstype = ExoWeb.Model.Model.getJsType(name, true);

		if (jstype && ExoWeb.Model.LazyLoader.isLoaded(jstype.meta)) {
			callback.call(thisPtr || this, jstype);
		}
		else if (jstype && forceLoad) {
//				ExoWeb.trace.log("server", "Forcing lazy loading of type \"{0}\".", [name]);
			ExoWeb.Model.LazyLoader.load(jstype.meta, property, callback, thisPtr);
		}
		else if (!jstype && forceLoad) {
//				ExoWeb.trace.log("server", "Force creating type \"{0}\".", [name]);
			ensureJsType(model, name, callback, thisPtr);
		}
		else {
//				ExoWeb.trace.log("server", "Waiting for existance of type \"{0}\".", [name]);
			$extend(name, function() {
//					ExoWeb.trace.log("server", "Type \"{0}\" was loaded, now continuing.", [name]);
				callback.apply(this, arguments);
			}, thisPtr);
		}
	}

	var LazyLoadEnum = {
		None: 0,
		Force: 1,
		ForceAndWait: 2
	};

	function tryGetEntity(model, translator, type, id, property, lazyLoad, callback, thisPtr) {
		var obj = type.meta.get(translateId(translator, type.meta.get_fullName(), id));

		if (obj && ExoWeb.Model.LazyLoader.isLoaded(obj)) {
			callback.call(thisPtr || this, obj);
		}
		else if (lazyLoad == LazyLoadEnum.Force) {
			if (!obj) {
				ExoWeb.trace.log("server", "Forcing creation of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
				obj = fromExoGraph({ type: type.meta.get_fullName(), id: id }, translator);
			}
			callback.call(thisPtr || this, obj);
			ExoWeb.trace.log("server", "Forcing lazy loading of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
			ExoWeb.Model.LazyLoader.load(obj, property);
		}
		else if (lazyLoad == LazyLoadEnum.ForceAndWait) {
			if (!obj) {
				ExoWeb.trace.log("server", "Forcing creation of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
				obj = fromExoGraph({ type: type.meta.get_fullName(), id: id }, translator);
			}

			ExoWeb.trace.log("server", "Forcing lazy loading of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
			ExoWeb.Model.LazyLoader.load(obj, property, thisPtr ? callback.bind(thisPtr) : callback);
		}
		else {
			ExoWeb.trace.log("server", "Waiting for existance of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);

			function invokeCallback() {
				if (filter(obj) !== true)
					return;

				// only invoke the callback once
				propertyFilter = function() { return false; };
				callback.call(thisPtr || this, obj);
			}

			var objSignal = new Signal("wait for object to exist");

			if (!obj) {
				model.addObjectRegistered(objSignal.pending(null, null, true), function(newObj) {
					if (newObj.meta.type === type.meta && newObj.meta.id === id) {
						obj = newObj;
						return true;
					}
				}, true);
			}

			objSignal.waitForAll(function () {
				// if a property was specified and its not inited, then wait for it
				if (property && type.meta.property(property, true).isInited(obj) !== true) {
					type.meta.property(property, true).addChanged(callback.bind(thisPtr), obj, true);
					return;
				}

				callback.call(thisPtr || this, obj);
			}, null, true);
		}
	}

	// #endregion

	// #region TypeLazyLoader
	//////////////////////////////////////////////////

	function TypeLazyLoader() {
	}

	function typeLoad(mtype, propName, callback, thisPtr) {
//				ExoWeb.trace.log(["typeInit", "lazyLoad"], "Lazy load: {0}", [mtype.get_fullName()]);
		fetchType(mtype.get_model(), mtype.get_fullName(), callback, thisPtr);
	}

	TypeLazyLoader.mixin({
		load: typeLoad.dontDoubleUp({ callbackArg: 2, thisPtrArg: 3, groupBy: function(mtype) { return [mtype]; } })
	});

	(function() {
		var instance = new TypeLazyLoader();

		TypeLazyLoader.register = function(obj) {
			ExoWeb.Model.LazyLoader.register(obj, instance);
		};

		TypeLazyLoader.unregister = function(obj) {
			ExoWeb.Model.LazyLoader.unregister(obj, instance);
		};
	})();

	// #endregion

	// #region ObjectLazyLoader
	//////////////////////////////////////////////////

	function ObjectLazyLoader() {
		this._requests = {};
		this._typePaths = {};
	}

	var pendingObjects = 0;

	ExoWeb.registerActivity(function() {
		return pendingObjects > 0;
	});

	function objLoad(obj, propName, callback, thisPtr) {
		pendingObjects++;

		var signal = new ExoWeb.Signal("object lazy loader");

		var id = obj.meta.id || STATIC_ID;
		var mtype = obj.meta.type || obj.meta;

		// Get the paths from the original query(ies) that apply to this object (based on type).
		var paths = ObjectLazyLoader.getRelativePaths(obj);

		// Add the property to load if specified.  Assumes an instance property.
		if (propName && paths.indexOf("this." + propName) < 0) {
			paths.push("this." + propName);
		}

		// fetch object json
		ExoWeb.trace.log(["objectInit", "lazyLoad"], "Lazy load: {0}({1})", [mtype.get_fullName(), id]);

		// TODO: reference to server will be a singleton, not context
		objectProvider(mtype.get_fullName(), [id], paths, false,
			serializeChanges.call(context.server, true),
			function(result) {
				mtype.get_model()._server._handleResult(result, null, null, function() {
					ExoWeb.Model.LazyLoader.unregister(obj, this);
					pendingObjects--;
					callback.call(thisPtr || this, obj);
				});
			},
			function(e) {
				pendingObjects--;
				var message = $format("Failed to load {0}({1}): ", [mtype.get_fullName(), id]);
				if (e !== undefined && e !== null &&
					e.get_message !== undefined && e.get_message !== null &&
					e.get_message instanceof Function) {

					message += e.get_message();
				}
				else {
					message += "unknown error";
				}
				ExoWeb.trace.logError("lazyLoad", message);
			});

		// does the object's type need to be loaded too?
		if (! ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
			ExoWeb.Model.LazyLoader.load(mtype, null, signal.pending());
		}
	}

	ObjectLazyLoader.mixin({
		load: objLoad.dontDoubleUp({ callbackArg: 2, thisPtrArg: 3, groupBy: function(obj) { return [obj]; } })
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
				var jstype = ExoWeb.Model.Model.getJsType(typeName);

				if (jstype && jstype.meta) {
					var paths = instance._typePaths[typeName];
					for (var i = 0; i < paths.length; i++) {
						var path = paths[i].expression;
						var chain = ExoWeb.Model.Model.property(path, jstype.meta);
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

			return relPaths;
		};

		ObjectLazyLoader.register = function(obj) {
			if (!ExoWeb.Model.LazyLoader.isRegistered(obj, instance)) {
				ExoWeb.Model.LazyLoader.register(obj, instance);
			}
		};

		ObjectLazyLoader.unregister = function(obj) {
			ExoWeb.Model.LazyLoader.unregister(obj, instance);
		};
	})();

	// #endregion

	// #region ListLazyLoader
	//////////////////////////////////////////////////

	function ListLazyLoader() {
	}

	function listLoad(list, propName, callback, thisPtr) {
		var signal = new ExoWeb.Signal("list lazy loader");

		var model = list._ownerProperty.get_containingType().get_model();
		var ownerId = list._ownerId;
		var ownerType = list._ownerProperty.get_containingType().get_fullName();
		var prop = list._ownerProperty;
		var propIndex = list._ownerProperty.get_index();
		var propName = list._ownerProperty.get_name();
		var propType = list._ownerProperty.get_jstype().meta;

		// load the objects in the list
		ExoWeb.trace.log(["listInit", "lazyLoad"], "Lazy load: {0}({1}).{2}", [ownerType, ownerId, propName]);

		var objectJson, conditionsJson;

		// TODO: reference to server will be a singleton, not context
		listProvider(ownerType, ownerId, propName, ownerId === STATIC_ID ? [] : ObjectLazyLoader.getRelativePathsForType(propType),
			serializeChanges.call(context.server, true),
			signal.pending(function(result) {
				objectJson = result.instances;
				conditionsJson = result.conditions;
			}),
			signal.orPending(function(e) {
				var message = $format("Failed to load {0}({1}).{2}: ", [ownerType, ownerId, propName]);
				if (e !== undefined && e !== null &&
						e.get_message !== undefined && e.get_message !== null &&
						e.get_message instanceof Function) {

					message += e.get_message();
				}
				else {
					message += "unknown error";
				}
				ExoWeb.trace.logError("lazyLoad", message);
			})
		);

		// ensure that the property type is loaded as well.
		// if the list has objects that are subtypes, those will be loaded later
		// when the instances are being loaded
		if (!ExoWeb.Model.LazyLoader.isLoaded(propType)) {
			ExoWeb.Model.LazyLoader.load(propType, null, signal.pending());
		}

		signal.waitForAll(function() {
			if (!objectJson) {
				return;
			}

//					ExoWeb.trace.log("list", "{0}({1}).{2}", [ownerType, ownerId, propName]);

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
				ExoWeb.trace.throwAndLog(["list", "lazyLoad"], "Data could not be found for {0}:{1}.", [ownerType, ownerId]);
			}

			var listJson = prop.get_isStatic() ?
				objectJson[jsonType][jsonId][propName] :
				objectJson[jsonType][jsonId][propIndex];

			// populate the list with objects
			for (var i = 0; i < listJson.length; i++) {
				var ref = listJson[i];
				var item = getObject(model, propType, (ref && ref.id || ref), (ref && ref.type || propType));
				list.push(item);

				// if the list item is already loaded ensure its data is not in the response
				// so that it won't be reloaded
				if (ExoWeb.Model.LazyLoader.isLoaded(item)) {
					delete objectJson[jsonType][ref.id];
				}
			}

			// get the list owner type (static) or entity (non-static)
			var owner = ownerId === STATIC_ID ?
				propType.get_jstype() :
				getObject(model, ownerType, ownerId, null);

			// remove list from json and process the json.  there may be
			// instance data returned for the objects in the list
			if (ExoWeb.Model.LazyLoader.isLoaded(owner)) {
				delete objectJson[jsonType][jsonId];
			}

			ListLazyLoader.unregister(list, this);

			var batch = ExoWeb.Batch.start($format("{0}({1}).{2}", [ownerType, ownerId, propName]));

			var done = function() {
				// Collection change driven by user action or other behavior would result in the "change" event
				//	being raised for the list property.  Since we don't want to record this as a true observable
				//	change, raise the event manually so that rules will still run as needed.
				// This occurs before batch end so that it functions like normal object loading.
				prop._raiseEvent("changed", [owner, { property: prop, newValue: list, oldValue: undefined, wasInited: true, collectionChanged: true}]);

				ExoWeb.Batch.end(batch);
				callback.call(thisPtr || this, list);

			}

			objectsFromJson(model, objectJson, function() {
				if (conditionsJson) {
					conditionsFromJson(model, conditionsJson, done);
				}
				else {
					done();
				}
			});
		});
	}

	ListLazyLoader.mixin({
		load: listLoad.dontDoubleUp({ callbackArg: 2, thisPtrArg: 3, groupBy: function(list) { return [list]; } /*, debug: true, debugLabel: "ListLazyLoader"*/ })
	});

	(function() {
		var instance = new ListLazyLoader();

		ListLazyLoader.register = function(obj, prop) {
			var list = [];

			list._ownerId = prop.get_isStatic() ? STATIC_ID : obj.meta.id;
			list._ownerProperty = prop;

			ExoWeb.Model.LazyLoader.register(list, instance);

			return list;
		};

		ListLazyLoader.unregister = function(list) {
			ExoWeb.Model.LazyLoader.unregister(list, instance);

			delete list._ownerId;
			delete list._ownerType;
			delete list._ownerProperty;
		};
	})();

	// #endregion

	// #region Context
	//////////////////////////////////////////////////

	var allSignals = new ExoWeb.Signal("createContext allSignals");

	ExoWeb.registerActivity(function() {
		return allSignals.isActive();
	});

	function Context() {
		var model = new ExoWeb.Model.Model();

		this.model = { meta: model };
		this.server = new ServerSync(model);

		// start capturing changes prior to processing any model query
		this._addEvent("beforeModel", this.server.beginCapturingChanges.bind(this.server), null, true);
	}

	Context.mixin(ExoWeb.Functor.eventing);

	Context.mixin({
		isModelReady: function() {
			var result = false;

			eachProp(this.model, function(prop, val) {
				if (prop != "meta") {
					result = true;
					return false;
				}
			}, this);

			return result;
		},
		addModelReady: function Context$ready(callback, thisPtr) {
			this._addEvent("modelReady", thisPtr ? callback.bind(thisPtr) : callback, null, true);

			// Raise event immediately if there are currently models. Subscribers
			// will not actually be called until signals have subsided.
			if (this.isModelReady())
				this.onModelReady();
		},
		onModelReady: function () {
			// Indicate that one or more model queries are ready for consumption
			allSignals.waitForAll(function() {
				this._raiseEvent("modelReady");
			}, this);
		},
		onBeforeModel: function () {
			this._raiseEvent("beforeModel");
		}
	});

	function Context$query(options) {
		var contextQuery = new ContextQuery(this, options);

		// if there is a model option, when the query is finished executing the model ready fn will be called
		contextQuery.execute(options.model ? this.onModelReady.bind(this) : null);
	}

	// #endregion

	// #region ContextQuery
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
				ExoWeb.trace.log("context", "Starting context query batch.");
				this.batch = ExoWeb.Batch.start("context query");

				// store init changes as early as possible
				if (this.options.changes)
					ServerSync$storeInitChanges.call(this.context.server, this.options.changes);

				if (this.options.serverinfo)
					this.context.server.set_ServerInfo(this.options.serverinfo);

				callback.call(thisPtr || this);
			},

		// Perform pre-processing of model queries and their paths.
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$initModels(callback, thisPtr) {
				if (this.options.model) {
					this.context.onBeforeModel();
					ExoWeb.trace.log("context", "Running init step for model queries.");
					ExoWeb.eachProp(this.options.model, function (varName, query) {
						// Assert that the necessary properties are provided
						if (!query.hasOwnProperty("from") || (!query.hasOwnProperty("id") && !query.hasOwnProperty("ids")))
							ExoWeb.trace.throwAndLog("types", "The model query \"{0}\" requires a from and id or ids clause.", [varName]);
						if (query.hasOwnProperty("id") && query.hasOwnProperty("ids"))
							ExoWeb.trace.throwAndLog("types", "The model query \"{0}\" specifies both id or ids.", [varName]);

						// common initial setup of state for all model queries
						this.state[varName] = { signal: new ExoWeb.Signal("createContext." + varName), isArray: false };
						allSignals.pending(null, this, true);

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
							Sys.Observer.makeObservable(arr);
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
									include: query.include ? query.include.filter(function (p) { return p.startsWith("this."); }) : [],
									inScope: true,
									forLoad: false
								};
							}
						}
					}, this);
				}

				callback.call(thisPtr || this);
			},

		// Process embedded data as if it had been recieved from the server in
		// the form of a web service response. This should enable flicker-free
		// page loads by embedded data, changes, etc.
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$processEmbedded(callback, thisPtr) {
				ExoWeb.trace.log("context", "Processing embedded data in query.");

				if (this.options.instances || this.options.conditions || (this.options.types && !(this.options.types instanceof Array))) {
					var handler = new ResponseHandler(this.context.model.meta, this.context.server, {
						instances: this.options.instances,
						conditions: this.options.conditions,
						types: this.options.types,
						changes: this.options.changes,
						source: "init"
					});

					handler.execute(function () {
						// Update 'isNew' for objects that show up in InitNew changes.
						if (this.options.changes) {
							this.options.changes.forEach(function (change) {
								tryGetJsType(this.context.server._model, change.instance.type, null, false, function (jstype) {
									var obj = jstype.meta.get(change.instance.id);
									if (obj) {
										obj.meta.isNew = true;
									}
								}, this);
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

					ExoWeb.trace.log("context", "Looking for potential loading requests in query.");

					ExoWeb.eachProp(this.options.model, function (varName, query) {
						if (!query.load && query.ids.length > 0) {
							var jstype = ExoWeb.Model.Model.getJsType(query.from, true);

							// get a list of ids that should be batch-requested
							var batchIds = filter(query.ids, function (id, index) {
								// if the type doesn't exist, include the id in the batch query
								if (!jstype) return true;

								// check to see if the object already exists, i.e. because of embedding
								var obj = jstype.meta.get(translateId(this.context.server._translator, query.from, id));

								// if it doesn't exist, include the id in the batch query
								if (obj === undefined) return true;

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
										conditionsFromJson(this.context.model.meta, result.conditions, function () {
											batchQuerySignal.oneDone();
										});
									}
									else {
										batchQuerySignal.oneDone();
									}
								}, this);
							},
							function context$objects$callback(error) {
								ExoWeb.trace.logError("objectInit", "Failed to load batch query (HTTP: {_statusCode}, Timeout: {_timedOut})", error);
								batchQuerySignal.oneDone();
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
									// check to see if the object already exists, i.e. because of embedding
									var obj = type.meta.get(translateId(this.context.server._translator, query.from, id));

									// if it doesn't exist, include the id in the batch query
									if (obj === undefined) return true;

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
											ExoWeb.trace.logError("objectInit",
												"Failed to load {query.from}({query.ids}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
												{ query: query, error: error });
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
							var staticPaths = query.include ? query.include.filter(function (p) { return !p.startsWith("this."); }) : null;

							// Only call the server if paths were specified
							if (staticPaths && staticPaths.length > 0) {
								objectProvider(null, null, staticPaths, false, null,
									allSignals.pending(function context$objects$callback(result) {
										// load the json. this may happen asynchronously to increment the signal just in case
										objectsFromJson(this.context.model.meta, result.instances, allSignals.pending(function () {
											if (result.conditions) {
												conditionsFromJson(this.context.model.meta, result.conditions, allSignals.pending());
											}
										}), this);
									}, this, true),
									allSignals.orPending(function context$objects$callback(error) {
										ExoWeb.trace.logError("objectInit",
											"Failed to load {query.from}({query.ids}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
											{ query: query, error: error });
									}, this, true)
								);
							}
						}
					}, this);
				}

				callback.call(thisPtr || this);
			},

		// Only fetch the types if they are not embedded. If the types are
		// embedded then fetching the types from server will cause a signal to
		// be created that will never be processed.
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$fetchPathTypes(callback, thisPtr) {
				if (this.options.model && (!this.options.types || this.options.types instanceof Array)) {
					ExoWeb.eachProp(this.options.model, function (varName, query) {
						fetchTypes(this.context.model.meta, query.from, query.normalized, this.state[varName].signal.pending(null, this, true));
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
										ExoWeb.trace.throwAndLog("context", $format("Could not get type {0} required to process query results.", [query.from]));
									}

									// establish roots for each id
									forEach(query.ids, function (id, index) {
										// TODO: resolve translator access
										var clientId = translateId(this.context.server._translator, query.from, id);
										var obj = mtype.get(clientId);

										// if it doesn't exist, raise an error
										if (obj === undefined)
											ExoWeb.trace.throwAndLog("context", "Could not get {0} with id = {1}{2}.", [query.from, clientId, (id !== clientId ? "(" + id + ")" : "")]);

										// otherwise, include it in the model
										if (!this.state[varName].isArray && !this.context.model[varName]) {
											this.context.model[varName] = obj;
										}
										else if (this.state[varName].isArray && !this.context.model[varName][index]) {
											this.context.model[varName][index] = obj;
										}
									}, this);

									if (this.state[varName].conditionsJson) {
										conditionsFromJson(this.context.model.meta, this.state[varName].conditionsJson, function () {
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
								// root object was satisfied because it happened to be a part of the graph of another root object
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

		// Load type data from query.
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$fetchTypes(callback, thisPtr) {
				// load types if they are in array format.  This is for the full server/client model of ExoWeb
				// to load the types and isntance data async
				if (this.options.types && this.options.types instanceof Array) {
					// allow specifying types and paths apart from instance data
					for (var i = 0; i < this.options.types.length; i++) {
						var typeQuery = this.options.types[i];

						// store the paths for later use
						typeQuery.normalized = ExoWeb.Model.PathTokens.normalizePaths(typeQuery.include);
						ObjectLazyLoader.addPaths(typeQuery.from, typeQuery.normalized);

						fetchTypes(this.context.model.meta, typeQuery.from, typeQuery.normalized, allSignals.pending(null, this, true));

						var staticPaths = typeQuery.include ? typeQuery.include.filter(function (p) { return !p.startsWith("this."); }) : null;

						if (staticPaths && staticPaths.length > 0) {
							objectProvider(typeQuery.from, null, staticPaths, false, null,
								allSignals.pending(function context$objects$callback(result) {
									// load the json. this may happen asynchronously to increment the signal just in case
									objectsFromJson(this.context.model.meta, result.instances, allSignals.pending(function () {
										if (result.conditions) {
											conditionsFromJson(this.context.model.meta, result.conditions, allSignals.pending());
										}
									}), this);
								}, this, true),
								allSignals.orPending(function context$objects$callback(error) {
									ExoWeb.trace.logError("objectInit",
										"Failed to load {query.from}({query.ids}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
										{ query: typeQuery, error: error });
								}, this, true), this);
						}
					}
				}

				callback.call(thisPtr || this);
			},

		// Perform pre-processing of model queries and their paths.
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$postQueries(callback, thisPtr) {
				if (this.options.model) {
					ExoWeb.trace.log("context", "Running post query step for model queries.");
					ExoWeb.eachProp(this.options.model, function (varName, query) {
						if (this.state[varName].scopeQuery) {
							ServerSync$addScopeQuery.call(this.context.server, this.state[varName].scopeQuery);
						}
					}, this);
				}

				callback.call(thisPtr || this);
			},

		// Setup lazy loading on the context object to control lazy evaluation.
		// Loading is considered complete at the same point model.ready() fires.
		///////////////////////////////////////////////////////////////////////////////
			function ContextQuery$registerLazyLoader(callback, thisPtr) {
				ExoWeb.Model.LazyLoader.register(this.context, {
					load: function context$load(obj, propName, callback, thisPtr) {
						//ExoWeb.trace.log(["context", "lazyLoad"], "caller is waiting for createContext.ready(), propName={1}", arguments);

						// objects are already loading so just queue up the calls
						allSignals.waitForAll(function context$load$callback() {
							//ExoWeb.trace.log(["context", "lazyLoad"], "raising createContext.ready()");

							ExoWeb.Model.LazyLoader.unregister(obj, this);

							if (callback && callback instanceof Function) {
								callback.call(thisPtr || this);
							}
						}, this, true);
					}
				});

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

	// #region ExoWeb
	//////////////////////////////////////////////////

	Sys.activateDom = false;

	// Object constant to signal to mapper to create a new instance rather than load one
	window.$newId = function() { return "$newId"; };

	// Indicates whether or not the DOM has been activated
	var activated = false;

	// The (combined) set of options that are pending
	// execution. Options will stack up until something
	// is encountered that triggers loading to occur.
	var pendingOptions;

	function modelReadyHandler(contextReady, extendContext, domReady) {
		return function () {
			var readySignal = new Signal();
		
			if (extendContext)
				extendContext(window.context, readySignal.pending());

			readySignal.waitForAll(function() {
				if (contextReady)
					contextReady(window.context);

				$(function() {
					// Activate the document if this is the first context to load
					if (!activated) {
						activated = true;
						Sys.Application.activateElement(document.documentElement);
					}

					// Invoke dom ready notifications
					if (domReady)
						domReady(window.context);
				});
			});
		};
	}

	// Global method for initializing ExoWeb on a page
	window.$exoweb = function (options) {
		// Support initialization function as parameter
		if (options instanceof Function)
			options = { init: options };

		if (!pendingOptions)
			// No pending options to merge
			pendingOptions = options;
		else {
			// Merge options as necessary
			pendingOptions.init = mergeFunctions(pendingOptions.init, options.init);
			pendingOptions.extendContext = mergeFunctions(pendingOptions.extendContext, options.extendContext, { async: true, callbackIndex: 1 });
			pendingOptions.contextReady = mergeFunctions(pendingOptions.contextReady, options.contextReady);
			pendingOptions.domReady = mergeFunctions(pendingOptions.domReady, options.domReady);
			pendingOptions.types = pendingOptions.types ? (options.types ? pendingOptions.types.concat(options.types) : pendingOptions.types) : options.types;
			pendingOptions.model = pendingOptions.model ? $.extend(pendingOptions.model, options.model) : options.model;
			pendingOptions.changes = pendingOptions.changes ? (options.changes ? pendingOptions.changes.concat(options.changes) : pendingOptions.changes) : options.changes;
			pendingOptions.conditions = pendingOptions.conditions ? $.extend(pendingOptions.conditions, options.conditions) : options.conditions;
			pendingOptions.instances = pendingOptions.instances ? $.extend(pendingOptions.instances, options.instances) : options.instances;
			pendingOptions.serverinfo = pendingOptions.serverinfo ? $.extend(pendingOptions.serverinfo, options.serverinfo) : options.serverinfo;
		}

		// Exit immediately if no model or types are pending
		if (!(pendingOptions.model || pendingOptions.types || pendingOptions.instances || pendingOptions.conditions || pendingOptions.changes)) {
			if (window.context && pendingOptions.init) {

				// Context has already been created, so perform initialization and remove it so that we don't double-up
				pendingOptions.init(window.context);
				pendingOptions.init = null;
			}

			if (window.context && window.context.isModelReady() &&
				(pendingOptions.contextReady || pendingOptions.extendContext || pendingOptions.domReady)) {

				// The context is already ready, so invoke handlers and remove so that we don't double-up
				window.context.addModelReady(modelReadyHandler(pendingOptions.contextReady, pendingOptions.extendContext, pendingOptions.domReady));
				pendingOptions.contextReady = null;
				pendingOptions.extendContext = null;
				pendingOptions.domReady = null;
			}

			return;
		}

		var currentOptions = pendingOptions;
		pendingOptions = null;

		// Create a context if needed
		window.context = window.context || new Context();
	
		// Perform initialization
		if (currentOptions.init)
			currentOptions.init(window.context);

		// Start the new query
		Context$query.call(window.context, {
			model: currentOptions.model,
			types: currentOptions.types,
			changes: currentOptions.changes,
			conditions: currentOptions.conditions,
			instances: currentOptions.instances,
			serverinfo: currentOptions.serverinfo
		});

		// Perform initialization once the context is ready
		if (currentOptions.contextReady || currentOptions.extendContext || currentOptions.domReady || !activated)
			window.context.addModelReady(modelReadyHandler(currentOptions.contextReady, currentOptions.extendContext, currentOptions.domReady));
	};

	// #endregion

	// #region Extend
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

		if (jstype && ExoWeb.Model.LazyLoader.isLoaded(jstype.meta)) {
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
		if (!typeInfo) {
			ExoWeb.trace.throwAndLog("extend", "Invalid value passed into $extend, argument must be of type String or String[].");
		}

		// If typeInfo is an arry of type names, then use a signal to wait until all types are loaded.
		if (Object.prototype.toString.call(typeInfo) === "[object Array]") {
			var signal = new ExoWeb.Signal("extend");

			var types = [];
			Array.forEach(typeInfo, function(item, index) {
				if (item.constructor !== String) {
					ExoWeb.trace.throwAndLog("extend", "Invalid value passed into $extend, item in array must be of type String.");
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
		else {
			if (typeInfo.constructor !== String) {
				ExoWeb.trace.throwAndLog("extend", "Invalid value passed into $extend, argument must be of type String or String[].");
			}

			extendOne(typeInfo, callback, thisPtr);
		}
	};

	window.$extendSubtypes = function(typeName, callback, thisPtr) {
		if (!typeName || typeName.constructor !== String) {
			ExoWeb.trace.throwAndLog("extend", "Invalid value passed into $extendSubtypes, argument must be of type String.");
		}

		var jstype = ExoWeb.Model.Model.getJsType(typeName, true);

		if (jstype) {
			// Call for existing, loaded subtypes
			Array.forEach(jstype.meta.derivedTypes || [], function(mtype) {
				if (mtype && ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
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
		if (!typeName || typeName.constructor !== String) {
			ExoWeb.trace.throwAndLog("extend", "Invalid value passed into $extendProperties, argument must be of type String.");
		}

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
})();
