Function.prototype.mixin = function(methods, object) {
	if (!object) {
		object = this.prototype;
	}

	for (var m in methods) {
		object[m] = methods[m];
	}
};

Type.registerNamespace("ExoWeb");

(function() {

	function execute() {

		var undefined;

		var errorHandler = function noOpErrorHandler(message, e) { };
		function setErrorHandler(fn) {
			errorHandler = fn;
		};
		ExoWeb.setErrorHandler = setErrorHandler;

		ExoWeb.trace = {
			// The following flags can be turned on to see debugging info.
			// Rather than editing the code below, set them in your application's page
			flags: {
				//		all: true,
				//		signal: true,
				//		typeInit: true,
				//		objectInit: true,
				//		propInit: true
				//		listInit: true,
				//		lazyLoad: true,
				//		markupExt: true,
				//		"~": true,
				//		"@": true,
				//		context: true,
				//		tests: true,
				//		mocks: true,
				//		server: true,
				//		ui: true,
				//		templates: true,
				//		rule: true,
				//		model: true
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
			log: function log(category, message, args) {
				if (typeof (console) === "undefined") {
					return;
				}

				if (ExoWeb.trace._isEnabled(category)) {
					console.log(ExoWeb.trace._formatMessage(category, message, args));
				}
			},
			logError: function logError(category, message, args) {
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

			throwAndLog: function throwAndLog(category, message, args) {
				ExoWeb.trace.logError(category, message, args);

				throw $format(message, args);
			},
			getCallStack: function getCallStack() {
				// Use local function simply because Array makes it recursive.
				function format(arg) {
					if (arg === undefined) {
						return "undefined";
					}
					else if (arg === null) {
						return "null";
					}
					else if (arg instanceof Array) {
						var str = "";
						Array.forEach(arg, function(arg) {
							str += (str == "" ? "" : ", ") + format(arg);
						});
						return "[" + str + "]";
					}
					else if (arg instanceof Function) {
						return parseFunctionName(arg) + "()";
					}
					else if (arg.constructor === String) {
						return "\"" + arg + "\"";
					}
					else {
						var fmt = arg.constructor && arg.constructor.formats && arg.constructor.formats.$system;
						return fmt ? fmt.convert(arg) : arg;
					}
				}

				var result = [];
				for (var f = arguments.callee; f; f = f.arguments.callee.caller) {
					for (var i = 0, args = ""; i < f.arguments.length; i++) {
						args += (args == "" ? "" : ", ") + format(f.arguments[i]);
					}

					result.push(parseFunctionName(f) + "(" + args + ")");
				}

				return result;
			}
		};

		var funcRegex = /function\s*([\w-]*)/i;
		function parseFunctionName(f) {
			var result = funcRegex.exec(f);
			return result ? (result[1] || "{anonymous}") : "{anonymous}";
		}

		ExoWeb.trace.DEFAULT_ERROR_HANDLER = function DEFAULT_ERROR_HANDLER(message, e) {
			var stackTrace = ExoWeb.trace.getCallStack();
			var type = e ? parseFunctionName(e.constructor) : "Error";
			ExoWeb.WebService.LogError(type, message, stackTrace.join("\n"), window.location.href);
		};

		var log = ExoWeb.trace.log;
		var logError = ExoWeb.trace.logError;
		var throwAndLog = ExoWeb.trace.throwAndLog;

		function Signal(debugLabel) {
			this._waitForAll = [];
			this._pending = 0;
			var _this = this;
			this._oneDoneFn = function() { ExoWeb.Signal.prototype.oneDone.apply(_this, arguments); };

			this._debugLabel = debugLabel;
		}

		Signal.mixin({
			pending: function Signal$pending(callback) {
				if (this._pending === 0) {
					Signal.allPending.push(this);
				}

				this._pending++;
				log("signal", "(++{_pending}) {_debugLabel}", this);
				return this._genCallback(callback);
			},
			orPending: function Signal$orPending(callback) {
				return this._genCallback(callback);
			},
			_doCallback: function Signal$_doCallback(name, thisPtr, callback, args) {
				try {
					window.setTimeout(function() {
						callback.apply(thisPtr, args || []);
					}, 1);
				}
				catch (e) {
					logError("signal", "({0}) {1} callback threw an exception: {2}", [this._debugLabel, name, e]);
				}
			},
			_genCallback: function Signal$_genCallback(callback) {
				if (callback) {
					var signal = this;
					return function() {
						signal._doCallback("pending", this, function() { callback.apply(this, arguments); signal.oneDone(); }, arguments);
					};
				}
				else {
					return this._oneDoneFn;
				}
			},
			waitForAll: function Signal$waitForAll(callback) {
				if (!callback) {
					return;
				}

				if (this._pending === 0) {
					this._doCallback("waitForAll", this, callback, []);
				}
				else {
					this._waitForAll.push(callback);
				}
			},
			oneDone: function Signal$oneDone() {
				log("signal", "(--{0}) {1}", [this._pending - 1, this._debugLabel]);

				--this._pending;

				if (this._pending === 0) {
					Array.remove(Signal.allPending, this);
				}

				while (this._pending === 0 && this._waitForAll.length > 0) {
					this._doCallback("waitForAll", this, Array.dequeue(this._waitForAll), []);
				}
			}
		});

		Signal.allPending = [];

		ExoWeb.Signal = Signal;


		//////////////////////////////////////////////////////////////////////////////////////
		Function.prototype.dontDoubleUp = function(options) {
			var proceed = this;
			var calls = [];

			return function dontDoubleUp() {
				// is the function already being called with the same arguments?

				var origCallback;

				if (options.callbackArg < arguments.length) {
					origCallback = arguments[options.callbackArg];
				}

				// determine what values to use to group callers
				var groupBy;

				if (options.groupBy) {
					groupBy = options.groupBy.apply(this, arguments);
				}
				else {
					groupBy = [this];
					for (var i = 0; i < arguments.length; ++i) {
						if (i != options.callbackArg) {
							groupBy.push(arguments[i]);
						}
					}
				}

				// is this call already in progress?
				var callInProgress;

				for (var c = 0; !callInProgress && c < calls.length; ++c) {
					var call = calls[c];

					// TODO: handle optional params better
					if (groupBy.length != call.groupBy.length) {
						continue;
					}

					callInProgress = call;
					for (var i = 0; i < groupBy.length; ++i) {
						if (groupBy[i] !== call.groupBy[i]) {
							callInProgress = null;
							break;
						}
					}
				}

				if (!callInProgress) {
					// track the next call that is about to be made
					var call = { callback: Functor(), groupBy: groupBy };
					calls.push(call);

					// make sure the original callback is invoked and that cleanup occurs
					call.callback.add(function() {
						Array.remove(calls, call);
						if (origCallback) {
							origCallback.apply(this, arguments);
						}
					});

					// pass the new callback to the inner function
					arguments[options.callbackArg] = call.callback;
					proceed.apply(this, arguments);
				}
				else if (origCallback) {
					// wait for the original call to complete
					callInProgress.callback.add(origCallback);
				}
			};
		};

		Function.prototype.cached = function(options) {
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

		Function.prototype.setScope = function setScope(obj) {
			var func = this;
			return function setScope$function() {
				return func.apply(obj, arguments);
			};
		};

		Function.prototype.prependArguments = function prependArguments(/* arg1, arg2, ... */) {
			var func = this;
			var additional = Array.prototype.slice.call(arguments);
			return function prependArguments$function() {
				Array.addRange(additional, Array.prototype.slice.call(arguments));
				return func.apply(this, additional);
			};
		};

		Function.prototype.appendArguments = function appendArguments(/* arg1, arg2, ... */) {
			var func = this;
			var additional = Array.prototype.slice.call(arguments);
			return function appendArguments$function() {
				var args = Array.prototype.slice.call(arguments);
				Array.addRange(args, additional);
				return func.apply(this, args);
			};
		};

		Function.prototype.spliceArguments = function spliceArguments(/* start, howmany, item1, item2, ... */) {
			var func = this;
			var spliceArgs = arguments;
			return function spliceArguments$function() {
				var args = Array.prototype.slice.call(arguments);
				args.splice.apply(args, spliceArgs);
				return func.apply(this, args);
			};
		};

		Function.prototype.sliceArguments = function sliceArguments(/* start, end */) {
			var func = this;
			var sliceArgs = arguments;
			return function spliceArguments$function() {
				var args = Array.prototype.slice.call(arguments);
				args = args.slice.apply(args, sliceArgs);
				return func.apply(this, args);
			};
		};

		//////////////////////////////////////////////////////////////////////////////////////
		function Functor() {
			var funcs = [];

			var f = function() {
				for (var i = 0; i < funcs.length; ++i) {
					funcs[i].apply(this, arguments);
				}
			};

			f._funcs = funcs;
			f.add = Functor.add;
			f.remove = Functor.remove;
			f.isEmpty = Functor.isEmpty;

			return f;
		}

		Functor.add = function Functor$add() {
			for (var i = 0; i < arguments.length; ++i) {
				var f = arguments[i];

				if (f === null) {
					continue;
				}

				this._funcs.push(f);
			}
		};

		Functor.remove = function Functor$remove(old) {
			for (var i = this._funcs.length - 1; i >= 0; --i) {
				if (this._funcs[i] === old) {
					this._funcs.splice(i, 1);
					break;
				}
			}
		};

		Functor.isEmpty = function Functor$isEmpty() {
			return this._funcs.length === 0;
		};

		Functor.eventing = {
			_addEvent: function Functor$_addEvent(name, func) {
				if (!this["_" + name]) {
					this["_" + name] = new Functor();
				}

				this["_" + name].add(func);
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
					handler.apply(this, argsArray || []);
				}
			}
		};

		ExoWeb.Functor = Functor;

		///////////////////////////////////////////////////////////////////////////////
		// Helper class for interpreting expressions
		function EvalWrapper(value) {
			this.value = value;
		}
		EvalWrapper.mixin({
			get: function(member) {
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

		///////////////////////////////////////////////////////////////////////////////
		function Transform(root) {
			this.array = root;
		}

		var compileFilterFunction = (function compileFilterFunction(filter) {
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
		}).cached({ key: function(filter) { return filter; } });

		var compileGroupsFunction = (function compileGroupsFunction(groups) {
			return new Function("$item", "$index", "return ExoWeb.evalPath($item, '" + groups + "');");
		}).cached({ key: function(groups) { return groups; } });

		var compileOrderingFunction = (function compileOrderingFunction(ordering) {
			var orderings = [];
			var parser = / *([a-z0-9_.]+)( +null)?( +(asc|desc))?( +null)? *(,|$)/gi;

			ordering.replace(parser, function(match, path, nullsFirst, ws, dir, nullsLast) {
				orderings.push({
					path: path,
					ab: dir === "desc" ? 1 : -1,
					nulls: (nullsLast !== undefined && nullsLast !== null && nullsLast.length > 0) ? 1 : -1
				});
			});

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
					if (a < b) {
						return order.ab;
					}
					if (a > b) {
						return -order.ab;
					}
				}

				return 0;
			};
		}).cached({ key: function(ordering) { return ordering; } });


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
					output.sort(function() { return ordering.apply(this, arguments); });
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
				Sys.Observer.addCollectionChanged(chain[0].input(), function() {
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
					output.addRange(newResult);
					output.endUpdate();
				});

				return this._next(this.live, arguments, output);
			}
		});

		ExoWeb.Transform = Transform;
		window.$transform = function $transform(array) { return new Transform(array); };

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

		///////////////////////////////////////////////////////////////////////////
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

		function getLastTarget(target, propertyPath) {
			var path = propertyPath;
			var finalTarget = target;

			if (path.constructor == String) {
				path = path.split(".");
			}
			else if (!(path instanceof Array)) {
				throwAndLog(["$lastTarget", "core"], "invalid parameter propertyPath");
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
				return target[property];
			}
		}

		ExoWeb.getValue = getValue;

		///////////////////////////////////////////////////////////////////////////////
		// Globals
		function $format(str, values) {
			if (!values) {
				return str;
			}

			return str.replace(/{([a-z0-9_.]+)}/ig, function(match, expr) {
				return evalPath(values, expr, "", match).toString();
			});
		}
		window.$format = $format;

		//////////////////////////////////////////////////////////////////////////////////////
		// Date extensions			
		Date.mixin({
			subtract: function Date$subtract(d) {
				return new TimeSpan(this - d);
			},
			add: function Date$add(timeSpan) {
				return new Date(this.getTime() + timeSpan.totalMilliseconds);
			}
		});

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

		//////////////////////////////////////////////////////////////////////////////////////
		// MS Ajax extensions

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
		}

		function PropertyObserver(name) {
			this._source = null;
			this._name = name;
			this._events = [];
			this._handler = null;
			this._callback = null;
			this._prev = null;
			this._next = null;
		}

		PropertyObserver.prototype = {
			addEvent: function PropertyObserver$addEvent(handler) {
				this._events.push(handler);
			},
			removeEvent: function PropertyObserver$removeObserver(handler) {
				if (Array.contains(this._events, handler)) {
					Array.remove(this._events, handler);
				}
			},
			raiseEvents: function PropertyObserver$raiseEvents(result) {
				var result = ExoWeb.getValue(this._source, this._name);
				for (var i = 0; i < this._events.length; i++) {
					var evt = this._events[i];
					if (evt(result)) {
						Array.removeAt(this._events, i--);
					}
				}
			},
			wait: function PropertyObserver$wait(handler) {
				if (this._prev) {
					var _this = this;

					if (this._callback) {
						this._prev.removeEvent(this._callback);
					}

					this._callback = function(source) {
						if (source !== undefined && source !== null) {
							_this.start(source, handler);
							_this._callback = null;
							return true;
						}
					};

					this._prev.addEvent(this._callback);
				}
			},
			start: function PropertyObserver$start(source, handler) {
				if (this._source) {
					ExoWeb.trace.throwAndLog(["observer"], "Cannot start an observer that is already started.");
				}

				var _this = this;

				this._source = source;
				this._handler = function propHandler(sender, args) {
					var observer = _this;

					// Notify following properties to stop watching the old source and wait for a new one.
					if (_this._next) {
						_this._next.stopAndWait(handler);
					}

					// Call the actual handler.
					handler.apply(this, arguments);

					// Process events and remove those that are satisfied.
					_this.raiseEvents();
				};

				// Process events and remove those that are satisfied.
				_this.raiseEvents();

				// Use Sys Observer to watch for changes.
				Sys.Observer.addSpecificPropertyChanged(this._source, this._name, this._handler);
			},
			stop: function PropertyObserver$stop() {
				if (this._source) {
					// Remove the event.
					Sys.Observer.removeSpecificPropertyChanged(this._source, this._name, this._handler);

					// Null-out the source.
					this._source = null;
				}
			},
			stopAndWait: function PropertyObserver$stopAndWait(handler) {
				this.stop();
				this.wait(handler);

				// Stop following handlers as well.
				if (this._next) {
					this._next.stopAndWait(handler);
				}
			}
		}

		Sys.Observer.addPathChanged = function Sys$Observer$addPathChanged(target, path, handler) {
			if (target === undefined || target === null) {
				return;
			}

			if (!target.__pathChangeHandlers) {
				target.__pathChangeHandlers = {};
			}

			// Create a PropertyObserver for each step in the path.
			var source = target;
			var lastProp = null;

			var list = path;
			if (path instanceof Array) {
				path = path.join(".");
			}
			else {
				list = path.split(".");
			}

			var properties = list.map(function(item, index, list) {
				var prop = new PropertyObserver(item);

				// Set up forward and reverse references.
				if (lastProp !== null) {
					prop._prev = lastProp;
					lastProp._next = prop;
				}

				if (source === undefined || source === null) {
					// The source is undefined, wait on changes to the prior step to check for a value.
					prop.wait(handler);
				}
				else {
					// Start watching for changes at this step.
					prop.start(source, handler);

					// Move the source to the next step in the path.
					source = ExoWeb.getValue(source, prop._name);
				}

				lastProp = prop;

				return prop;
			});

			var pathChangeHandlers = target.__pathChangeHandlers[path];
			if (!pathChangeHandlers) {
				target.__pathChangeHandlers[path] = pathChangeHandlers = [];
			}
			pathChangeHandlers.push({ properties: properties, handler: handler });
		};

		Sys.Observer.removePathChanged = function Sys$Observer$removePathChanged(target, path, handler) {
			if (path instanceof Array) {
				path = path.join(".");
			}

			var pathChangeHandlers = target.__pathChangeHandlers ? target.__pathChangeHandlers[path] : null;

			if (pathChangeHandlers) {
				// Search the list for handlers that match the given handler and stop and remove them
				for (var i = 0; i < pathChangeHandlers.length; i++) {
					var pathChangeHandler = pathChangeHandlers[i];
					if (pathChangeHandler.handler === handler) {
						Array.forEach(pathChangeHandler.properties, function(prop) {
							prop.stop();
						});
						Array.removeAt(pathChangeHandlers, i--);
					}
				}

				// If the array is empty then remove the callbacks as an optimization
				if (pathChangeHandlers.length === 0) {
					delete target.__pathChangeHandlers[path];

					var hasHandlers = false;
					for (var handler in target.__pathChangeHandlers) {
						hasHandlers = true;
					}

					if (!hasHandlers) {
						delete target.__pathChangeHandlers;
					}
				}
			}
		};

		// Supress raising of property changed when a generated setter is already raising the event
		Sys.Observer._setValue = function Sys$Observer$_setValue(target, propertyName, value) {
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
	}

	if (window.Sys && Sys.loader) {
		Sys.loader.registerScript("ExoWeb", null, execute);
	}
	else {
		execute();
	}

})();

///////////////////////////////////////////////////////////////////////////////
// Simulate homogenous browsers
if (!Array.prototype.map) {
	Array.prototype.map = function(fun /*, thisp*/) {
		var len = this.length >>> 0;
		if (typeof fun != "function") {
			throw new TypeError();
		}

		var res = new Array(len);
		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in this) {
				res[i] = fun.call(thisp, this[i], i, this);
			}
		}

		return res;
	};
}

if (!Array.prototype.forEach) {
	Array.prototype.forEach = function Array$forEach(fun /*, thisp*/) {
		var len = this.length >>> 0;
		if (typeof fun != "function") {
			throw new TypeError();
		}

		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in this) {
				fun.call(thisp, this[i], i, this);
			}
		}
	};
}

if (!Array.prototype.every) {
	Array.prototype.every = function Array$every(fun /*, thisp*/) {
		var len = this.length >>> 0;
		if (typeof fun != "function") {
			throw new TypeError();
		}

		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in this && !fun.call(thisp, this[i], i, this)) {
				return false;
			}
		}

		return true;
	};
}

if (!Array.prototype.indexOf) {
	Array.prototype.indexOf = function(elt /*, from*/) {
		var len = this.length >>> 0;

		var from = Number(arguments[1]) || 0;

		from = (from < 0) ? Math.ceil(from) : Math.floor(from);

		if (from < 0) {
			from += len;
		}

		for (; from < len; from++) {
			if (from in this && this[from] === elt) {
				return from;
			}
		}
		return -1;
	};
}

if (!Array.prototype.some) {
	Array.prototype.some = function(fun /*, thisp*/) {
		var i = 0,
		len = this.length >>> 0;

		if (typeof fun != "function") {
			throw new TypeError();
		}

		var thisp = arguments[1];
		for (; i < len; i++) {
			if (i in this && fun.call(thisp, this[i], i, this)) {
				return true;
			}
		}

		return false;
	};
}

// original function grabbed from http://oranlooney.com/functional-javascript/
Object.copy = function Object$Copy(obj) {
	if (typeof obj !== 'object') {
		return obj;  // non-object have value sematics, so obj is already a copy.
	} else {
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
						c[property] = obj[property];
					}
					return c;
				}
			}
		}
	}
};
