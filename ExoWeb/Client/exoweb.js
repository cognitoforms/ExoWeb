Function.prototype.mixin = function mixin(methods, object) {
	if (!object) {
		object = this.prototype;
	}

	for (var m in methods) {
		object[m] = methods[m];
	}
};

Type.registerNamespace("ExoWeb");

if (!("config" in ExoWeb)) {
	ExoWeb.config = {};
}

(function() {

	function execute() {

		var undefined;

		//////////////////////////////////////////////////////////////////////////////////////
		function Batch(label) {
			this._index = batchIndex++;
			this._labels = [label];
			this._rootLabel = label;
			this._subscribers = [];

			ExoWeb.trace.log("batch", "[{0}] {1} - created.", [this._index, this._rootLabel]);

			allBatches.push(this);
		}

		var batchIndex = 0;
		var allBatches = [];
		var currentBatch = null;

		Batch.all = function Batch_$all(includeEnded) {
			return $transform(allBatches).where(function(e) {
				return includeEnded || !e.isEnded();
			});
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

		Batch.whenDone = function Batch_$whenDone(fn) {
			if (currentBatch) {
				currentBatch.whenDone(fn);
			}
			else {
				fn();
			}
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
					var subscriber = Array.dequeue(this._subscribers);
					while (subscriber) {
						subscriber.apply(this, arguments);
						subscriber = Array.dequeue(this._subscribers);
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
				Array.addRange(otherBatch._labels, this._labels);
				Array.clear(this._labels);
				Array.addRange(otherBatch._subscribers, this._subscribers);
				Array.clear(this._subscribers);
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
			whenDone: function Batch$whenDone(fn) {
				ExoWeb.trace.log("batch", "[{0}] {1} - subscribing to batch done.", [this._index, this._rootLabel]);

				this._subscribers.push(fn);

				return this;
			}
		});

		ExoWeb.Batch = Batch;


		//////////////////////////////////////////////////////////////////////////////////////
		var errorHandler = function noOpErrorHandler(message, e) { };
		function setErrorHandler(fn) {
			errorHandler = fn;
		}
		ExoWeb.setErrorHandler = setErrorHandler;

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
			log: function log(category, message, args) {
				if (typeof (console) === "undefined") {
					return;
				}

				if (ExoWeb.trace._isEnabled(category)) {
					console.log(ExoWeb.trace._formatMessage(category, message, args));
				}
			},
			logWarning: function logWarning(category, message, args) {
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

		var loggingError = false;
		ExoWeb.trace.DEFAULT_ERROR_HANDLER = function DEFAULT_ERROR_HANDLER(message, e) {
			if (loggingError === false) {
				try {
					loggingError = true;
					var stackTrace = ExoWeb.trace.getCallStack();
					var type = e ? parseFunctionName(e.constructor) : "Error";
					ExoWeb.WebService.LogError(type, message, stackTrace.join("\n"), window.location.href, document.referrer);
				}
				finally {
					loggingError = false;
				}
			}
		};

		var log = ExoWeb.trace.log;
		var logError = ExoWeb.trace.logError;
		var throwAndLog = ExoWeb.trace.throwAndLog;


		//////////////////////////////////////////////////////////////////////////////////////
		function Signal(debugLabel) {
			this._waitForAll = [];
			this._pending = 0;
			var _this = this;
			this._oneDoneFn = function Signal$_oneDoneFn() { ExoWeb.Signal.prototype.oneDone.apply(_this, arguments); };

			this._debugLabel = debugLabel;
		}

		Signal.mixin({
			pending: function Signal$pending(callback, thisPtr, executeImmediately) {
				if (this._pending === 0) {
					Signal.allPending.push(this);
				}

				this._pending++;
//				log("signal", "(++{_pending}) {_debugLabel}", this);
				return this._genCallback(callback, thisPtr, executeImmediately);
			},
			orPending: function Signal$orPending(callback, thisPtr, executeImmediately) {
				return this._genCallback(callback, thisPtr, executeImmediately);
			},
			_doCallback: function Signal$_doCallback(name, thisPtr, callback, args, executeImmediately) {
				try {
					if (executeImmediately) {
						callback.apply(thisPtr, args || []);
					}
					else {
						var batch = Batch.suspendCurrent("_doCallback");
						window.setTimeout(function Signal$_doCallback$timeout() {
							ExoWeb.Batch.resume(batch);
							callback.apply(thisPtr, args || []);
						}, 1);
					}
				}
				catch (e) {
					logError("signal", "({0}) {1} callback threw an exception: {2}", [this._debugLabel, name, e]);
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
//				log("signal", "(--{0}) {1}", [this._pending - 1, this._debugLabel]);

				--this._pending;

				if (this._pending === 0) {
					Array.remove(Signal.allPending, this);
				}

				while (this._pending === 0 && this._waitForAll.length > 0) {
					var item = Array.dequeue(this._waitForAll);
					this._doCallback("waitForAll", item.thisPtr, item.callback, [], item.executeImmediately);
				}
			}
		});

		Signal.allPending = [];

		ExoWeb.Signal = Signal;


		//////////////////////////////////////////////////////////////////////////////////////
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
				var callInProgress;

				for (var c = 0; !callInProgress && c < calls.length; ++c) {
					var call = calls[c];

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
					var call = { callback: Functor(), groupBy: groupBy };
					calls.push(call);

					// make sure the original callback is invoked and that cleanup occurs
					call.callback.add(function() {
						Array.remove(calls, call);
						if (origCallback) {
							origCallback.apply(origThisPtr || this, arguments);
						}
					});

					// pass the new callback to the inner function
					arguments[options.callbackArg] = call.callback;
					proceed.apply(this, arguments);
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

		Function.prototype.setScope = function setScope(obj) {
			var func = this;
			return function setScope$fn() {
				return func.apply(obj, arguments);
			};
		};

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
				Array.addRange(args, additional);
				Array.addRange(args, Array.prototype.slice.call(arguments));
				return func.apply(this, args);
			};
		};

		Function.prototype.appendArguments = function appendArguments(/* arg1, arg2, ... */) {
			var func = this;
			var additional = Array.prototype.slice.call(arguments);
			return function appendArguments$fn() {
				var args = Array.prototype.slice.call(arguments);
				Array.addRange(args, additional);
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

		//////////////////////////////////////////////////////////////////////////////////////
		function Functor() {
			var funcs = [];

			var f = function Functor$fn() {
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

		Functor.add = function Functor$add(f) {
			this._funcs.push(f);
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
			},
			_getEventHandler: function Functor$_getEventHandler(name) {
				return this["_" + name];
			}
		};

		ExoWeb.Functor = Functor;


		//////////////////////////////////////////////////////////////////////////////////////
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

		///////////////////////////////////////////////////////////////////////////////
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
				var value = target[property];
				if (value === undefined && /\./.test(property) && !(property in target)) {
					ExoWeb.trace.logWarning("", "Possible incorrect usage of \"getValue()\", the path \"{0}\" does not exist on the target and appears to represent a multi-hop path.", [property]);
				}
				return value;
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

		///////////////////////////////////////////////////////////////////////////////
		// Globals
		function $format(str, values) {
			if (!values) {
				return str;
			}

			return str.replace(/{([a-z0-9_.]+)}/ig, function $format$token(match, expr) {
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
		};


		/////////////////////////////////////////////////////////////////////////////////////////
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
	Array.prototype.map = function Array$map(fun /*, thisp*/) {
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
	Array.prototype.indexOf = function Array$indexOf(elt /*, from*/) {
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
	Array.prototype.some = function Array$some(fun /*, thisp*/) {
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
