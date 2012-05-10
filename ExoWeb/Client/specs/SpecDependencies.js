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
		log("Created node for \"" + name + "\"");
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
	log("Adding dependencies " + dependencies.join(", ") + " to module \"" + this + "\".");
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
exports.init = function() {
	ensureNode("core.TypeChecking");
	ensureNode("core.Utilities");
	"core.Functor".dependsOn("core.Activity");
	"model.Model".dependsOn("core.Functor", "core.Function", "core.EventQueue");
	"mapper.ServerSync".dependsOn("core.Trace", "core.Utilities", "core.Functor", "core.Function");
};

// Module loading
///////////////////////////////////////

function getModulePath(basePath, name) {
	return basePath + "base/" + name.split(".").join("/");
}

var currentlyRequiring = [];
function requireWithDependencies(moduleNode, basePath, rootModuleName) {
	if (currentlyRequiring.indexOf(moduleNode) >= 0) {
		throw new Error("Circular reference detected when loading " + rootModuleName + ": " + currentlyRequiring.join(", "));
	}

	if (moduleNode.module) {
		log("Module \"" + moduleNode.name + "\" was already loaded.");
		return moduleNode.module;
	}

	log("Loading module \"" + moduleNode.name + "\".");

	currentlyRequiring.push(moduleNode);

	moduleNode.dependencies.forEach(function(dep) {
		log("Loading dependency \"" + dep.name + "\" for \"" + moduleNode.name + "\"");
		requireWithDependencies(dep, basePath, rootModuleName);
	});

	var modulePath = getModulePath(basePath, moduleNode.name);
	log("Loading \"" + moduleNode.name + "\" from \"" + modulePath + "\"");
	moduleNode.module = require(modulePath);
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
	return requireWithDependencies(ensureNode(moduleName), "../src/", moduleName);
};
