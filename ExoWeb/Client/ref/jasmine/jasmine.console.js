function Reporter() {
	this.suites = [];
	this.suppressDateAndTime = false;
	this.verbosity = "quiet";

	var self = this;
	var verbosityExpr = /\-\-v(erbosity)?\:(.*)/;
	process.argv.forEach(function (arg) {
		if (arg === "--no-date-time" || arg === "-no-date-time") {
			self.suppressDateAndTime = true;
		} else {
			var verbosityMatch = verbosityExpr.exec(arg);
			if (verbosityMatch) {
				self.verbosity = verbosityMatch[2] || "quiet";
			}
		}
	});
};

Reporter.prototype.isFirstEncounter = function(suite) {
	for (var i = 0; i < this.suites.length; i++) {
		if (this.suites[i] === suite) {
			return false;
		}
	}

	return true;
};

Reporter.prototype.reportRunnerStarting = function(runner) {
	this.startedAt = new Date();
};

Reporter.prototype.reportRunnerResults = function(runner) {
	var results = runner.results();
	var specs = runner.specs();
	var message = "\r\n" + specs.length + " spec" + (specs.length === 1 ? "" : "s" ) + ", " + results.failedCount + " failure" + ((results.failedCount === 1) ? "" : "s");

	if (this.suppressDateAndTime !== true) {
		message += " in " + ((new Date().getTime() - this.startedAt.getTime()) / 1000) + "s";
	}

	console.info(message + "\r\n");

	if (this.suppressDateAndTime !== true) {
		console.info("Finished at " + new Date().toString() + "\r\n");
	}

	if (results.failedCount > 0) {
		process.exit(1);
	}
};

Reporter.prototype.reportSuiteResults = function(suite) {
	var results = suite.results();
	var status = results.totalCount > 0 ?
		(results.passed() ? 'passed' : 'failed') : "skipped or empty";

	if (this.verbosity === "full" || status !== "passed") {
		if (status === "skipped or empty" && this.isFirstEncounter(suite)) {
			console.log("\r\n" + suite.description);
			console.log("=============================================");
		} else if (!suite.parentSuite) {
			console.log("---------------------------------------------");
		}

		if (!suite.parentSuite) {
			console.log("suite " + status);
			console.log("=============================================\r\n");
		}
	}
};

Reporter.prototype.printSuiteStart = function (suite) {
	console.log("\r\nSuite: \"" + (suite.parentSuite ? suite.parentSuite.description : suite.description) + "\"");
	console.log("=============================================");
};

Reporter.prototype.printSpecStart = function (spec) {
	if (this.verbosity === "full") {
		if (this.isFirstEncounter(spec.suite) && (!spec.suite.parentSuite || this.isFirstEncounter(spec.suite.parentSuite))) {
			this.printSuiteStart(spec.suite);
		} else {
			console.log("---------------------------------------------");
		}
	}

	var suiteDescription = spec.suite.description;
	var parentSuite = spec.suite.parentSuite;
	while (parentSuite) {
		suiteDescription = parentSuite.description + " " + suiteDescription;
		parentSuite = parentSuite.parentSuite;
	}

	if (this.verbosity === "full") {
		console.log("Running \"" + suiteDescription + " " + spec.description + "\"...");
	}
};

Reporter.prototype.reportSpecStarting = function(spec) {
	this.printSpecStart(spec);

	if (spec.suite.parentSuite) {
		this.suites.push(spec.suite.parentSuite);
	}
	this.suites.push(spec.suite);
};

Reporter.prototype.reportSpecResults = function(spec) {
	var results = spec.results();
	var resultItems = results.getItems();
	for (var i = 0; i < resultItems.length; i++) {
		var result = resultItems[i];

		if (result.type == 'log') {
			console.log("log:  " + result.toString());
		}
		else if (result.type == 'expect' && result.passed && !result.passed()) {
			if (result.passed()) {
				console.log("passed: " + result.message);
			}
			else {
				console.error("FAILED:  " + result.message);

				if (result.trace.stack) {
					console.log(result.trace.stack);
				}
			}
		}
	}
};

exports.Reporter = Reporter;

