var fs = require('fs');

var files = JSON.parse(fs.readFileSync('scripts.json', 'utf8'));

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
	var whitespaceLines = 0;
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
				whitespaceLines += 1;
			}
		} else if (/^\s*exports\.([^=]*\s*=)/.test(line)) {
			result += "\r\n\t" + line.replace(/^\s*exports\.([^=]*\s*=)/, modulePrefix + "$1");
			whitespaceLines = 0;
			previousLineRemoved = false;
		} else {
			result += "\r\n\t" + line;
			whitespaceLines = 0;
			previousLineRemoved = false;
		}
	});

	result += "\r\n";
	if (whitespaceLines === 0) {
		result += "\r\n";
	} else {
		while (whitespaceLines > 1) {
			result = result.substring(0, result.length - 2);
			whitespaceLines -= 1;
		}
	}

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
