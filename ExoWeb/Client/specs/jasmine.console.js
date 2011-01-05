function Reporter() {
	this.suites = [];
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
	var showPassed, showSkipped;

	console.log("Running tests...\r\n");

	this.startedAt = new Date();
};

Reporter.prototype.reportRunnerResults = function(runner) {
	var results = runner.results();
	var specs = runner.specs();
	var message = "\r\n" + specs.length + " spec" + (specs.length === 1 ? "" : "s" ) + ", " + results.failedCount + " failure" + ((results.failedCount === 1) ? "" : "s");
	message += " in " + ((new Date().getTime() - this.startedAt.getTime()) / 1000) + "s";

	console.log(message);
	console.log("Finished at " + new Date().toString() + "\r\n");

	if (results.failedCount > 0) {
		process.exit(1);
	}
};

Reporter.prototype.reportSuiteResults = function(suite) {
	var results = suite.results();
	var status = results.totalCount > 0 ?
		(results.passed() ? 'passed' : 'failed') : "skipped or empty";

	if (status === "skipped or empty" && this.isFirstEncounter(suite)) {
		console.log("\r\n" + suite.getFullName());
		console.log("=============================================");
	}
	else {
		console.log("---------------------------------------------");
	}

	console.log("suite " + status);
	console.log("=============================================\r\n");
};

Reporter.prototype.reportSpecStarting = function(spec) {
	if (this.isFirstEncounter(spec.suite)) {
		console.log("\r\n" + spec.suite.getFullName());
		console.log("=============================================");
	}
	else {
		console.log("---------------------------------------------");
	}

	this.suites.push(spec.suite);
	console.log("Running \"" + spec.suite.description + " " + spec.description + "\"...");
};

Reporter.prototype.reportSpecResults = function(spec) {
	var results = spec.results();
	var status = results.passed() ? 'passed' : 'failed';
	if (results.skipped) {
		status = 'skipped';
	}

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
				console.log("FAILED:  " + result.message);

				if (result.trace.stack) {
					console.log(result.trace.stack);
				}
			}
		}
	}
};

exports.Reporter = Reporter;

