function Template(element) {
	/// <summary>
	/// In addition to defining template markup, also defines rules that are used
	/// to determine if it should be chosen as the template for a given element
	/// based on a CSS selector as well as a javascript filter that is evaluated 
	/// against the element in question.
	/// </summary>
	///
	/// <example>
	///		<div sys:attach="template" template:for="table.inputform tr" template:if="<some condition>"></div>
	/// </example>

	Template.initializeBase(this, [element]);
}

Template.prototype = {
	// CSS Selectors
	///////////////////////////////////////////////////////////////////////////
	get_for: function() {
		return this._for;
	},
	set_for: function(value) {
		this._for = value;
	},
	matches: function(e) {
		if (this._for === undefined) {
			return true;
		}

		return $(e).is(this._for);
	},

	get_dataType: function Template$get_dataType() {
		return this._dataType;
	},
	set_dataType: function Template$set_dataType(value) {
		if (ExoWeb.isType(value, Function)) {
			this._dataType = ExoWeb.parseFunctionName(value);
			this._dataTypeCtor = value;
		}
		else if (ExoWeb.isType(value, String)) {
			this._dataType = value;
		}
	},
	get_dataTypeCtor: function Template$set_dataType() {
		// lazy evaluate the actual constructor
		if (!this._dataTypeCtor && ExoWeb.isType(this._dataType, String)) {
			this._dataTypeCtor = ExoWeb.getCtor(this._dataType);
		}
		return this._dataTypeCtor;
	},
	isType: function Template$isType(obj) {
		// Don't return a value if a data type has not been specified.
		if (this._dataType === undefined || this._dataType === null) {
			return;
		}

		return ExoWeb.isType(obj, this.get_dataTypeCtor());
	},

	// Arbitrary JavaScript
	///////////////////////////////////////////////////////////////////////////
	get_if: function() {
		return this._if;
	},
	set_if: function(value) {
		this._if = value;
	},
	satisfies: function(element, data) {
		// return true by default if no filter
		var result = true;

		if (this._if) {
			if (!this._ifFn) {
				try {
					// turn arbitrary javascript code into function
					this._ifFn = new Function("$data", "$container", "return " + this._if + ";");
				}
				catch (compileError) {
					ExoWeb.trace.throwAndLog(["ui", "templates"], "Compiling statement \"" + this._if + "\" causes the following error: " + compileError);
				}
			}

			if (this._ifFn) {
				try {
					result = this._ifFn.apply(this, [data, element]);
				}
				catch (executeError) {
					ExoWeb.trace.logWarning(["ui", "templates"], "Executing statement \"" + this._if + "\" causes the following error: " + executeError);
					result = false;
				}
			}
		}

		return result;
	},

	test: function(element, data) {
		// determines if the given element matches this template
		return this.matches(element) && this.satisfies(element, data);
	},

	initialize: function() {
		Template.callBaseMethod(this, "initialize");

		// add a class that can be used to search for templates 
		// and make sure that the template element is hidden
		$(this.get_element()).addClass("vc3-template").hide();

		if (this.get_element().control.constructor !== String) {
			allTemplates.push(this.get_element());
		}
	}
};

var allTemplates = [];

Template.find = function Template$find(element, data) {
	/// <summary>
	/// Finds the first field template with a selector and filter that
	/// match the given element and returns the template.
	/// </summary>

	ExoWeb.trace.log(["templates"],
		"attempt to find match for element = {0}{1}, data = {2}",
		[element.tagName, element.className ? "." + element.className : "", data]);

	if (data === undefined || data === null) {
		ExoWeb.trace.logWarning("templates", "Attempting to find template for {0} data.", [data === undefined ? "undefined" : "null"]);
	}

	for (var t = allTemplates.length - 1; t >= 0; t--) {
		var tmpl = allTemplates[t];

		if (tmpl.control instanceof Template) {
			var isType = tmpl.control.isType(data);
			if ((isType === undefined || isType === true) && tmpl.control.test(element, data)) {
//						ExoWeb.trace.log(["templates"], "TEMPLATE MATCHES!: for = {_for}, type = {_dataType}, if = {_if}", tmpl.control);
				return tmpl;
			}
			else {
//						ExoWeb.trace.log(["templates"], "template does not match: for = {_for}, type = {_dataType}, if = {_if}", tmpl.control);
			}
		}
	}

	return null;
};

// bookkeeping for Template.load()...
// consider wrapper object to clean up after templates are loaded?
var templateCount = 0;
var externalTemplatesSignal = new ExoWeb.Signal("external templates");
var lastTemplateRequestSignal;

Template.load = function Template$load(path, options) {
	/// <summary>
	/// Loads external templates into the page.
	/// </summary>

	var id = "exoweb-templates-" + (templateCount++);

	var lastReq = lastTemplateRequestSignal;

	// set the last request signal to the new signal and increment
	var signal = lastTemplateRequestSignal = new ExoWeb.Signal(id);
	var callback = externalTemplatesSignal.pending(signal.pending(function (elem) {
		//				ExoWeb.trace.log("ui", "Activating elements for templates \"{0}\"", [id]);

		// Store the number of templates before activating this element.
		var originalTemplateCount = allTemplates.length;

		// Activate template controls within the response.
		Sys.Application.activateElement(elem);

		// No new templates were created.
		if (originalTemplateCount === allTemplates.length) {
			ExoWeb.trace.logWarning("ui", "Templates for request \"{0}\" from path \"{1}\" yields no templates.", [id, path]);
		}
	}));

	$(function ($) {
		var tmpl = $("<div id='" + id + "'/>")
				.hide()
				.appendTo("body");

		//if the template is stored locally look for the path as a div on the page rather than the cache
		if (options && options.isLocal === true) {
			var localTemplate = $('#' + path);
			callback(localTemplate.get(0));
		}
		else {
			var html = ExoWeb.cache(path);

			if (html) {
				tmpl.append(html);
				callback(tmpl.get(0));
			}
			else {
				tmpl.load(path, function () {
					var elem = this;

					// Cache the template
					ExoWeb.cache(path, elem.innerHTML);

					// if there is a pending request then wait for it to complete
					if (lastReq) {
						lastReq.waitForAll(function () { callback(elem); });
					}
					else {
						callback(elem);
					}
				});
			}
		}
	});
};

ExoWeb.UI.Template = Template;
Template.registerClass("ExoWeb.UI.Template", Sys.UI.Control);
