; (function() {
	var pendingTests = [];
	var executingTestsSignal = new ExoWeb.Signal("all pending tests signal");

	// override parse to avoid nasty recursion bug
	var oldObjectParser = QUnit.jsDump.parsers.object;
	QUnit.jsDump.parsers.object = function(obj) {
		if (obj.meta) {
			return obj.toString();
		}
		else {
			return oldObjectParser.call(this, obj);
		}
	}

	function defineTest(name, optionsOrCallback, callbackOrNone) {
		// usage is test setup
		var options = optionsOrCallback;
		var callback = callbackOrNone || options.fn;

		if (arguments.length == 2 && !callback && optionsOrCallback instanceof Function) {
			callback = optionsOrCallback;
			options = {};
		}

		// watch for when the test is registered
		var scopeSignal = new ExoWeb.Signal("registered signal: " + name);
		var scopeCallback = scopeSignal.pending();

		// create a function to be invoked when the test is ready to be executed
		var pending = {
			name: name,
			fn: function(args, whenDone) {
				// wait until the test is in scope if it isn't already
				scopeSignal.waitForAll(function() {
					// notify qunit that the test is starting back up
					start();

					try {
						var context = {};

						if (options.setUp) {
							options.setUp.call(context);
						}
						else if (options.setup) {
							options.setup.call(context);
						}

						// invoke the test callback
						callback.call(context);

						if (options.tearDown) {
							options.tearDown.call(context);
						}
						else if (options.teardown) {
							options.teardown.call(context);
						}

						if (whenDone && whenDone instanceof Function) {
							whenDone();
						}
					}
					catch (e) {
						ok(false, e);
					}
				});
			}
		};

		pendingTests.push(pending);
		pendingTests[name] = pending;

		// queue up the test
		test(options.description || name, function() {
			if (options.expect) {
				expect(options.expect);
			}

			stop(options.timeout);

			// notify that the test is in scope
			scopeCallback();
		});
	}

	window.defineTest = defineTest;

	function _executeTest(name, args, callback) {
		// register a pending test execution signal
		var onComplete = executingTestsSignal.pending();

		// look for the test in the cache

		var pending = pendingTests[name];

		if (pending) {
			// invoke the test callback
			pending.fn.call(this, args, callback);
		}
		else {
			console.warn("(UT) test not found: " + name);
		}

		// delete the test from the cache
		pendingTests.splice(pendingTests.indexOf(pending), 1);
		delete pendingTests[name];

		// notify that the pending test is complete
		onComplete.call(this);

		if (callback && callback instanceof Function) {
			callback();
		}
	}

	function executeTest(name) {
		var args = Array.prototype.slice.call(arguments, 1);

		_executeTest(name, args);

		// pass the argument through
		return args;
	}

	window.executeTest = executeTest;


	function executeAllTests() {
		function _executeNextTest() {
			if (pendingTests.length > 0) {
				_executeTest(pendingTests[0].name, [], _executeNextTest);
			}
		}
		_executeNextTest();
	}

	window.executeAllTests = executeAllTests;

	function timeoutTests(timeout) {
		window.setTimeout(function() {
			// allow tests to complete if they are mid-execution
			executingTestsSignal.waitForAll(function() {
				// look for any pending tests and force execute them
				for (var name in pendingTests) {
					// look for the test in the cache
					var pending = pendingTests[name];

					start();

					// delete the test from the cache
					delete pendingTests[name];
				}
			});
		}, timeout * 1000);
	}

	window.timeoutTests = timeoutTests;

})();