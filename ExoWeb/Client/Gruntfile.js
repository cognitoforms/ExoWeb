/*global module, require */

var fs = require("fs"),
	path = require("path"),
	scriptBuilder = require("./tools/javascript/ScriptBuilder.js");

module.exports = function (grunt) {
	"use strict";

	function traverseFiles(recurse, target, filter, callback) {
		if (filter && filter.constructor === String) {
			filter = new RegExp("^" + filter.replace(/\*/g, ".*") + "$");
		}

		fs.readdirSync(target).forEach(function (file) {
			var path = target + "/" + file;
			if (fs.statSync(path).isDirectory()) {
				if (recurse) {
					traverseFiles(true, path, filter, callback);
				}
			} else if (filter.test(file)) {
				callback(path);
			}
		});
	}

	// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		jshint: {
			src: {
				options: {
					jshintrc: "tools/.jshintrc"
				},
				files: {
					src: "src/**/*.js"
				}
			}
		},
		concat: {
			msajax_nojquery: {
				src: scriptBuilder.getNamespaceFiles("core", "model", "mapper", "ui", "view", "dotNet", "msajax"),
				dest: "dist/exoweb-msajax-nojquery.js",
				options: {
					banner: "window.ExoWeb = {};\r\n" + scriptBuilder.buildNamespacesObjects("Model", "Mapper", "UI", "View", "DotNet") + "\r\n\r\n(function(jQuery) {\r\n\r\n",
					footer: "})(window.ExoJQuery || jQuery);\r\n",
					process: scriptBuilder.processScriptSource
				}
			},
			msajax: {
				src: scriptBuilder.getNamespaceFiles("core", "model", "mapper", "ui", "view", "jquery_MsAjax", "dotNet", "msajax"),
				dest: "dist/exoweb-msajax.js",
				options: {
					banner: "window.ExoWeb = {};\r\n" + scriptBuilder.buildNamespacesObjects("Model", "Mapper", "UI", "View", "DotNet") + "\r\n\r\n(function(jQuery) {\r\n\r\n",
					footer: "})(window.ExoJQuery || jQuery);\r\n",
					process: scriptBuilder.processScriptSource
				}
			},
			jquery_msajax_plugin: {
				src: scriptBuilder.getNamespaceFiles("jquery_MsAjax"),
				dest: "dist/jquery.exoweb-msajax.js",
				options: {
					banner: "// jquery plugin for msajax helper\r\n//////////////////////////////////////////////////\r\n(function(jQuery) {\r\n\r\n",
					footer: "\r\n})(window.ExoJQuery || jQuery);\r\n",
					process: scriptBuilder.processScriptSource
				}
			}
		},
		express: {
			myserver: {
				options: {
					port: 9093,
					server: path.resolve(__dirname, 'runserver.js')
				}
			}
		},
		watch: {
			autobuild: {
				files: ["src/**/*.js", "Gruntfile.js", "tools/javascript/ScriptBuilder.js"],
				tasks: ["build"]
			}
		}
	});

	//console.log();

	traverseFiles(false, ".", "Gruntfile.*.js", function (file) {
		//console.log("Attempting to load grunt tasks in \"" + file + "\"...");

		var m = require(file);
		if (m.grunt && m.grunt instanceof Function) {
			//console.log("Loading grunt tasks...");
			m.grunt(grunt);
		}

		//console.log();
	});

	//var exec = require('child_process').exec,
	//	fs = require("fs");
	//grunt.registerTask("verify", "Verify output of build.", function (name) {
	//	var pathLeft = "dist/" + name + ".js",
	//		contentLeft = fs.readFileSync(pathLeft, "utf8"),
	//		pathRight = "dist/" + name + ".grunt.js",
	//		contentRight = fs.readFileSync(pathRight, "utf8");
	//	if (contentLeft === contentRight) {
	//		console.log("Ok, files match.");
	//	} else {
	//		exec("\"C:\\Program Files (x86)\\WinMerge\\winmergeU.exe\" " + pathLeft + " dist/" + name + ".grunt.js", function (error, stdout, stderr) {
	//			if (error !== null) {
	//				throw new Error("exec error: " + error);
	//			}
	//		});
	//		throw new Error("File " + pathLeft + " is not correct!");
	//	}
	//});

	// Load plugin for jshint.
	grunt.loadNpmTasks("grunt-contrib-jshint");

	// Load plugin for file watching.
	grunt.loadNpmTasks("grunt-contrib-watch");

	// Load plugin for building combined files.
	grunt.loadNpmTasks("grunt-contrib-concat");

	// Load plugin for express in order to static serve the unit test page for testing.
	grunt.loadNpmTasks("grunt-express");

	// JavaScript lint task.
	grunt.registerTask("lint", ["jshint:src"]);

	// Serve tests.html
	grunt.registerTask("runserver", ["express:myserver", "express-keepalive"]);

	// JavaScript concat/build task.
	grunt.registerTask("build", ["concat:msajax", "concat:msajax_nojquery", "concat:jquery_msajax_plugin"]);

	// Default task(s).
	//grunt.registerTask("default", ["test", "lint", "build"]);
	//grunt.registerTask("default", ["build", "verify:exoweb-msajax", "verify:exoweb-msajax-nojquery", "verify:jquery.exoweb-msajax"]);
	grunt.registerTask("default", ["build"]);

};
