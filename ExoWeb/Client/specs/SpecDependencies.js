// Common helpers
///////////////////////////////////////
var helper;
exports.setHelper = function(helperArg) {
	helper = helperArg;
};

var log = function() {
	if (helper.isDebugging()) {
		console.log.apply(console, arguments);
	}
};

// Dependency graph and module cache
///////////////////////////////////////
var dependencyGraph = {};

function ensureNode(name) {
	var node = dependencyGraph[name];
	if (!node) {
		//log("Created node for \"" + name + "\"");
		node = dependencyGraph[name] = {
			name: name,
			dependencies: [],
			namespaces: [],
			module: null
		};
	}
	return node;
}

String.prototype.dependsOn = function(/* dependencies */) {
	// Ensure a node in the dependency graph
	var node = ensureNode(this);

	// Ensure each dependency argument
	var dependencies = [];
	Array.prototype.push.apply(dependencies, arguments);
	//log("Adding dependencies " + dependencies.join(", ") + " to module \"" + this + "\".");
	dependencies.forEach(function(depName) {
		var depNode = ensureNode(depName);
		if (node.dependencies.indexOf(depNode) < 0) {
			node.dependencies.push(depNode);
		}
	});
};

String.prototype.inNamespace = function(ns) {
	// Ensure a node in the dependency graph
	var node = ensureNode(this);

	// Mark the module to be attached to the given namespace
	if (node.namespaces.indexOf(ns) < 0) {
		node.namespaces.push(ns);
	}
};

// Dependency definitions
///////////////////////////////////////

var extensions = ["dotnet", "jquery-msajax", "msajax"];

exports.init = function () {

	// Core dependencies
	ensureNode("core.TypeChecking");
	ensureNode("core.Utilities");
	"core.Warnings".dependsOn("core.Errors");
	"core.Cache".dependsOn("core.Warnings");
	"core.Signal".dependsOn("core.Functor", "core.Function", "core.Config");
	"core.Functor".dependsOn("core.Activity");
	"core.Function".dependsOn("core.Array", "core.Functor", "core.Errors");
	"core.Random".dependsOn("core.TypeChecking");
	"core.Utilities".dependsOn("core.Warnings");
	"core.Transform".dependsOn("core.Errors", "core.Function", "core.Utilities", "core.TypeChecking");
	"core.Batch".dependsOn("core.Activity", "core.Function", "core.Array");
	"core.EventScope".dependsOn("core.Function", "core.Functor");
	"model.Model".dependsOn("core.Functor", "core.Function", "model.PathTokens");
	"model.Type".dependsOn("core.Function", "model.Model", "core.Array", "model.Entity", "model.ObjectMeta");
	"model.Property".dependsOn("core.Utilities", "model.LazyLoader", "model.Type", "core.Observer", "core.TimeSpan");
	"model.PropertyChain".dependsOn("core.Functor", "core.Function", "core.Object", "model.Property", "core.Observer");
	"model.PathTokens".dependsOn("core.Function", "model.Property", "model.PropertyChain", "core.Observer");
	"mapper.Internals".dependsOn("core.Warnings");
	"mapper.ServerSync".dependsOn("core.Utilities", "core.Functor", "core.Function");
	"mapper.ObjectLazyLoader".dependsOn("core.Utilities", "core.Activity", "core.Function", "model.LazyLoader", "core.Array");
	"mapper.ChangeSet".dependsOn("core.Function", "core.Functor", "core.Random");
	"mapper.ChangeLog".dependsOn("core.Function", "core.Functor", "mapper.ChangeSet");

	// Extension dependencies
	"msajax.ObserverProvider".dependsOn("core.Observer");

};

// Module loading
///////////////////////////////////////

function getModulePath(basePath, name) {
	var pair = name.split(".");
	var root = extensions.indexOf(pair[0]) < 0 ? "base" : "extensions";
	return basePath + root + "/" + pair.join("/");
}

var currentlyRequiring = [];
function requireWithDependencies(moduleNode, basePath, rootModuleName, depth) {
	var prefix = "";
	for (var i = 0; i < depth; i++) {
		prefix += "\t";
	}

	if (moduleNode.module) {
		log(prefix + "Module \"" + moduleNode.name + "\" was already loaded.");
		return moduleNode.module;
	}

	prefix += "\t";

	if (currentlyRequiring.indexOf(moduleNode) < 0) {
		log(prefix + "Loading module \"" + moduleNode.name + "\".");

		currentlyRequiring.push(moduleNode);

		moduleNode.dependencies.forEach(function(dep) {
			log(prefix + "Found dependency \"" + dep.name + "\" for \"" + moduleNode.name + "\"");
			requireWithDependencies(dep, basePath, rootModuleName, depth + 1);
		});
	}

	var modulePath = getModulePath(basePath, moduleNode.name);
	log(prefix + "Requiring \"" + moduleNode.name + "\" from \"" + modulePath + "\"");
	moduleNode.module = require(modulePath);
	for (var prop in moduleNode.module) {
		if (moduleNode.module.hasOwnProperty(prop)) {
			global[prop] = moduleNode.module[prop];
		}
	}
	currentlyRequiring.splice(currentlyRequiring.indexOf(moduleNode), 1);
	moduleNode.namespaces.forEach(function(ns) {
		var namespace = helper.ensureNamespace(ns);
		var steps = moduleNode.name.split(".");
		var finalName = steps[steps.length - 1];
		namespace[finalName] = moduleNode.module;
	});
	return moduleNode.module;
}

exports.require = function(moduleName) {
	log("");
	var module = requireWithDependencies(ensureNode(moduleName), "../src/", moduleName, 0);
	log("");
	return module;
};
