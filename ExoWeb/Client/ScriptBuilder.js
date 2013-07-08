var files = {};

exports.buildNamespacesObjects = function () {
	return Array.prototype.map.call(arguments, function (ns) { return "window.ExoWeb." + ns + " = {};"; }).join("\r\n");
};

exports.processScriptSource = function (src, filePath) {
	var namespaceComponent = filePath.replace(/.*\/([A-Za-z\-]*)\/[A-Z][A-Za-z\-]*\.js/g, "$1");

	var namespace = (namespaceComponent === "core"
						? "ExoWeb"
						: namespaceComponent === "ui"
							? "ExoWeb.UI"
							: namespaceComponent === "dotnet"
								? "ExoWeb.DotNet"
								: namespaceComponent === "msajax" || namespaceComponent === "jquery-msajax"
									? null
									: "ExoWeb." + namespaceComponent[0].toUpperCase() + namespaceComponent.substring(1));

	var moduleName = filePath.replace(/.*\/([A-Z][A-Za-z]*)\.js/g, "$1");
	var modulePrefix = namespace ? namespace + "." : "";

	var result = "";

	// Add "region" header and "underline".
	result += "\t// #region " + modulePrefix + moduleName + "\r\n";
	result += "\t//////////////////////////////////////////////////" + "\r\n";

	var previousLineRemoved = false;
	src.split("\r\n").forEach(function (line) {
		if (/(^|\n)[ \t]*('use strict'|"use strict");?\s*$/.test(line)) {
			// Skip "use strict" statements.
			previousLineRemoved = true;
		} else if (/^\s*exports\.(.*\s*=\s*.*;)\s*\/\/\s*IGNORE$/.test(line)) {
			// Skip "// IGNORE" export statements.
			previousLineRemoved = true;
		} else if (/^\s*\/\/\/\s*\<reference\s/.test(line)) {
			// Skip reference file comments.
			previousLineRemoved = true;
		} else if (/^(var [A-Za-z_$][A-Za-z_$0-9]* = )?require\(/.test(line)) {
			// Skip require statements.
			previousLineRemoved = true;
		} else if (/^\s*$/.test(line)) {
			if (previousLineRemoved) {
				// Skip whitespace following a removed line.
				previousLineRemoved = true;
			} else {
				// Do not manipulate whitespace-only lines.
				result += "\r\n" + line;
				previousLineRemoved = false;
			}
		} else if (/^\s*exports\.([^=]*\s*=)/.test(line)) {
			result += "\r\n\t" + line.replace(/^\s*exports\.([^=]*\s*=)/, modulePrefix + "$1");
			previousLineRemoved = false;
		} else {
			result += "\r\n\t" + line;
			previousLineRemoved = false;
		}
	});

	// Emulate current logic.
	result += "\r\n";
	if (previousLineRemoved) {
		result += "\r\n";
	}

	// Use this logic instead when migration is complete.
	// if (!previousLineRemoved) {
	// result += "\r\n";
	// }

	// Add "end region" footer
	result += "\t// #endregion\r\n";

	return result;
};

function isExtension(ns) {
	return ns === "dotnet" || ns === "msajax" || ns === "jquery-msajax";
}

exports.getNamespaceFiles = function () {
	var result = [];
	Array.prototype.forEach.call(arguments, function (ns) {
		var nsDir = ns.toLowerCase().replace("_", "-");
		Array.prototype.push.apply(result, files[ns].map(function (f) {
			return isExtension(nsDir)
				? "src/extensions/" + nsDir + "/" + f + ".js"
				: "src/base/" + nsDir + "/" + f + ".js";
		}));
	});
	return result;
};

// Namespace file definitions
///////////////////////////////
files.core = [
	"Config",
	"Unload",
	"Errors",
	"Warnings",
	"TypeChecking",
	"Random",
	"Function",
	"Array",
	"String",
	"Cache",
	"Activity",
	"Batch",
	"Signal",
	"Functor",
	"FunctionChain",
	"EventScope",
	"EvalWrapper",
	"Transform",
	"Translator",
	"Utilities",
	"TimeSpan",
	"Date",
	"Object",
	"Observer",
	"PropertyObserver"
];

files.model = [
	"Resource",
	"Format",
	"Model",
	"Entity",
	"Type",
	"Property",
	"PathTokens",
	"PropertyChain",
	"ObjectMeta",
	"RuleInvocationType",
	"Rule",
	"RuleInput",
	"ConditionRule",
	"ValidatedPropertyRule",
	"CalculatedPropertyRule",
	"RequiredRule",
	"RangeRule",
	"AllowedValuesRule",
	"CompareRule",
	"RequiredIfRule",
	"StringLengthRule",
	"StringFormatRule",
	"ListLengthRule",
	"ConditionTypeSet",
	"ConditionType",
	"ConditionTarget",
	"Condition",
	"FormatError",
	"FormatProvider",
	"LazyLoader",
	"Utilities"
];

files.mapper = [
	"ObjectProvider",
	"QueryProvider",
	"TypeProvider",
	"ListProvider",
	"RoundtripProvider",
	"SaveProvider",
	"EventProvider",
	"ResponseHandler",
	"Translation",
	"ExoModelEventListener",
	"ChangeSet",
	"ChangeLog",
	"ServerSync",
	"Internals",
	"TypeLazyLoader",
	"ObjectLazyLoader",
	"ListLazyLoader",
	"Context",
	"ContextQuery",
	"ExoWeb",
	"Extend"
];

files.ui = [
	"Toggle",
	"ToggleGroup",
	"Template",
	"Content",
	"DataView",
	"Html",
	"Behavior",
	"Utilities"
];

files.view = [
	"AdapterMarkupExtension",
	"MetaMarkupExtension",
	"ConditionMarkupExtension",
	"Binding",
	"LazyMarkupExtension",
	"Adapter",
	"OptionAdapter",
	"OptionGroupAdapter",
	"MsAjax"
];

files.jquery_MsAjax = [
	"Validation",
	"Selectors",
	"Helpers",
	"Ever"
];

files.dotNet = [
	"WebService"
];

files.msajax = [
	"FormatProvider",
	"ObserverProvider"
];
