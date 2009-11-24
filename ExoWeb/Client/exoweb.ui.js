Type.registerNamespace("ExoWeb.UI");


///////////////////////////////////////////////////////////////////////////////
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
ExoWeb.UI.Template = function(element) {
	ExoWeb.UI.Template.initializeBase(this, [element]);
}

ExoWeb.UI.Template.prototype = {
	// CSS Selectors
	///////////////////////////////////////////////////////////////////////////
	get_for: function() {
		return this._for;
	},
	set_for: function(value) {
		this._for = value;
	},
	matches: function(e) {
		return $(e).is(this._for);
	},

	// Arbitrary JavaScript
	///////////////////////////////////////////////////////////////////////////
	get_if: function() {
		return this._if;
	},
	set_if: function(value) {
		this._if = value;
	},
	satisfies: function(e) {
		// return true by default if no filter
		var result = true;

		if (this._if) {
			var func = null;

			try {
				// turn arbitrary javascript code into function
				func = new Function("return " + this._if + ";");
			}
			catch (e) {
				throw ("Statement \"" + this._if + "\" causes the following error: " + e);
			}

			if (func) {
				try {
					result = func.call(e);
				}
				catch (e) {
					throw ("Calling \"" + this._if + "\" causes the following error: " + e);
				}
			}
		}

		return result;
	},

	test: function(e) {
		// determines if the given element matches this template
		return this.matches(e) && this.satisfies(e);
	},
	
	initialize: function() {
		ExoWeb.UI.Template.callBaseMethod(this, "initialize");

		// add a class that can be used to search for templates 
		// and make sure that the template element is hidden
		$(this.get_element()).addClass("vc3-template").hide();
	}
}

/// <summary>
/// Finds the first field template with a selector and filter that
/// match the given element and returns the template.
/// </summary>
ExoWeb.UI.Template.find = function(element) {
	var templates = $(".vc3-template");
	for (var t = 0; t < templates.length; t++) {
		var tmpl = templates[t];
		if (ExoWeb.UI.Template.isInstanceOfType(tmpl.control) && tmpl.control.test(element))
			return tmpl;
	}

	return null;
}

ExoWeb.UI.Template.registerClass("ExoWeb.UI.Template", Sys.UI.Control);


// TODO: rename content


///////////////////////////////////////////////////////////////////////////////
/// <summary>
/// Finds its matching template and renders using the provided data as the 
/// binding context.  It can be used as a "field control", using part of the 
/// context data to select the appropriate control template.  Another common 
/// usage would be to select the appropriate template for a portion of the UI,
/// as in the example where an objects meta type determines how it is 
/// displayed in the UI.
/// </summary>
///
/// <example>
///		<div sys:attach="content" content:data="{{ somedata }}"></div>
/// </example>
ExoWeb.UI.Content = function(element) {
	ExoWeb.UI.Content.initializeBase(this, [element]);
}

ExoWeb.UI.Content.prototype = {
	get_template: function() {
		if (!this._template) {
			var element = this.get_element();
			this._template = ExoWeb.UI.Template.find(element);

			if (!this._template) {
				throw ("This content region does not match any available templates.");
			}
		}

		if (!Sys.UI.Template.isInstanceOfType(this._template))
			this._template = new Sys.UI.Template(this._template);

		return this._template;
	},
	get_data: function() {
		return this._data;
	},
	set_data: function(value) {
		this._data = value;
		this.render();
	},
	render: function() {
		if (this._data && this._initialized) {
			try {
				var tmpl = this.get_template();

				// get custom classes from template
				var classes = $(tmpl.get_element()).attr("class").replace("vc3-template", "").replace("sys-template", "").trim();

				var ctx = tmpl.instantiateIn(this.get_element(), null, this.get_data());

				//ctx.dataItem = this.get_data();

				// copy custom classes from template to content control
				$(this.get_element()).addClass(classes);

				// necessary in order to render components found within the template (like a nested dataview)
				ctx.initializeComponents();
			}
			catch (e) {
				console.error(e);
			}
		}
	},
	initialize: function() {
		ExoWeb.UI.Content.callBaseMethod(this, "initialize");

		// TODO: include meta info about field?

		this._initialized = true;

		this.render();
	}
}

ExoWeb.UI.Content.registerClass("ExoWeb.UI.Content", Sys.UI.Control);


// Since this script is not loaded by System.Web.Handlers.ScriptResourceHandler
// invoke Sys.Application.notifyScriptLoaded to notify ScriptManager 
// that this is the end of the script.
if (typeof (Sys) !== 'undefined') Sys.Application.notifyScriptLoaded();
