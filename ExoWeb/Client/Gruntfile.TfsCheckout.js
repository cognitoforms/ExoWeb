var exec = require('child_process').exec,
	fs = require("fs");

// Signal that this is a grunt task that should be automatically 
exports.grunt = function (grunt) {

	function run(command, callback) {
		var complete = false;
		console.log("> " + command);
		exec(command, function (error, stdout, stderr) {
			if (complete) {
				throw new Error("Unexpected message from completed process.");
			}

			var success = true,
				output = "";

			if (stdout) {
				console.log("stdout: " + stdout);
				output += stdout;
			}
			if (stderr) {
				console.log("stderr: " + stderr);
				output += stderr;
			}
			if (error !== null) {
				console.log("error: " + error);
				success = false;
			}

			complete = true;
			if (callback) {
				//console.log(output.trim());
				callback(success, output.trim());
			}
		});
	}

	function getStatus(item, recursive, callback) {
		run("tf status \"" + item + "\"" + (recursive ? " /recursive" : "") + " /nodetect", function (statusSuccess, statusOutput) {
			if (!statusSuccess) {
				throw new Error("Error: " + statusOutput);
			}
			if (statusOutput === "There are no pending changes.") {
				callback(null);
			} else {
				// TODO: expose real status information
				callback();
			}
		});
	}

	function checkout(item, recursive, callback) {
		getStatus(item, recursive, function (status) {
			if (status === null) {
				run("tf checkout \"" + item + "\"", function (checkoutSuccess, checkoutOutput) {
					if (!checkoutSuccess) {
						throw new Error("Error: " + checkoutOutput);
					}
					console.log("Checked out item \"" + item + "\".");
					callback();
				});
			} else {
				console.log("Item \"" + item + "\" is already checked out.");
				callback();
			}
		});
	}

	function checkoutMulti(items, recursive, callback) {
		var pending = 0,
			signal = function () {
				pending += 1;
				//console.log("pending " + pending);
				return function () {
					pending -= 1;
					//console.log("pending " + pending);
					if (pending === 0) {
						callback();
					}
				};
			};

		items.forEach(function (item) {
			checkout(item, recursive, signal());
		});
	}

	grunt.config.set("watch.auto-checkout-and-build", {
		files: ["src/**/*.js", "Gruntfile*.js"],
		tasks: ["checkout-if-needed", "build"]
	});

	grunt.registerTask("checkout", "", function () {
		console.log("Checking out dist files if they are not already checked out...");
		checkoutMulti(["dist/exoweb-msajax.js", "dist/exoweb-msajax-nojquery.js", "dist/jquery.exoweb-msajax.js"], false, this.async());
	});

	grunt.registerTask("checkout-if-needed", "", function () {
		console.log("Checking out dist files if there are source file changes and they are not already checked out...");
		var done = this.async();
		getStatus("src", true, function (status) {
			if (status !== null) {
				checkoutMulti(["dist/exoweb-msajax.js", "dist/exoweb-msajax-nojquery.js", "dist/jquery.exoweb-msajax.js"], false, done);
			} else {
				done();
			}
		});
	});

	grunt.registerTask("build-if-needed", "", function () {
		console.log("Building the dist files if there are source file changes...");
		var done = this.async();
		getStatus("src", true, function (status) {
			if (status !== null) {
				grunt.task.run("build");
			}
			done();
		});
	});

	// Load plugin for file watching.
	grunt.loadNpmTasks("grunt-contrib-watch");

	// Default task for VC3 work.
	grunt.registerTask("work", [
		// Start by checking out the dist files if there are any
		// pending changes in the source files.
		"checkout-if-needed",

		// Build the dist files if there are any changes to the dist files.
		"build-if-needed",

		// Automatically check out and build the dist files whenever a
		// change is made to either the source files or grunt file(s).
		"watch:auto-checkout-and-build"
	]);
};
