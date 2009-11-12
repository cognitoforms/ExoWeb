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
	get_for: function() {
		return this._for;
	},
	set_for: function(value) {
		this._for = value;
	},
	get_if: function() {
		return this._if;
	},
	set_if: function(value) {
		this._if = value;
	},
	matches: function(e) {
		return $(e).is(this.get_for());
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
		if (ExoWeb.UI.Template.isInstanceOfType(tmpl.control) && tmpl.control.matches(element))
			return tmpl;
	}

	return null;
}

ExoWeb.UI.Template.registerClass("ExoWeb.UI.Template", Sys.UI.Control);


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
	},
	render: function() {
		try {
			var ctx = this.get_template().instantiateIn(this.get_element(), null, this.get_data());
			
			// necessary in order to render components found within the template (like a nested dataview)
			ctx.initializeComponents();
		}
		catch (e) {
			alert(e);
		}
	},
	initialize: function() {
		ExoWeb.UI.Content.callBaseMethod(this, "initialize");

		// TODO: include meta info about field?
		
		this.render();
	}
}

ExoWeb.UI.Content.registerClass("ExoWeb.UI.Content", Sys.UI.Control);


///////////////////////////////////////////////////////////////////////////////
/// <summary>
/// 
/// </summary>
ExoWeb.UI.Field = function(element) {
	ExoWeb.UI.Field.initializeBase(this, [element]);
}

ExoWeb.UI.Field.prototype = {
	get_source: function() {
		return this._source;
	},
	set_source: function(value) {
		if (this._source !== value) {
			this._data = null;
			// TODO: can't tell whether label was inferred
			this._source = value;
		}
	},
	get_label: function() {
		if (!this._label) {
			this._label = this.get_source();

			// TODO: more robust solution to human-friendly format
			this._label = this._label.replace(/([^^])([A-Z])/g, "$1 $2");
		}

		return this._label;
	},
	set_label: function(value) {
		this._label = value;
	},
	get_isReadOnly: function() {
		return this._isReadOnly || false;
	},
	set_isReadOnly: function(value) {
		if (!value) throw ("Value is not defined.");

		if (this._isReadOnly != value) {
			// TODO: better bool conversion
			if (typeof (value) == "boolean")
				this._isReadOnly = value;
			else if (typeof (value) == "string")
				this._isReadOnly = (value.toLowerCase() == "true");
			else
				throw ($format("The value \"{val}\" could not be converted to a boolean.", { val: value }));
		}
	},
	get_data: function() {
		if (!this._data) {
			var ctx = this.findContext();
			var target = ctx.dataItem;
			var prop = target.meta.property(this.get_source());
			
			this._data = new ExoWeb.Model.Adapter(target, prop);
		}
		return this._data;
	},
	findContext: function(element) {
		/// Finds the containing template control for the given element and 
		/// then finds the element's corresponding context (for repeated content).

		var element = this.get_element();
		var container = null;
		var subcontainer = null;

		// find the first parent that is an ASP.NET Ajax template
		while (element.parentNode && !element.parentNode._msajaxtemplate)
			element = element.parentNode;

		// containing template was not found
		if (!element.parentNode || !element.parentNode._msajaxtemplate)
			throw Error.invalidOperation("The field's parent template could not be found.");

		container = element.parentNode;
		subcontainer = element;

		// find the correct context (in the case of repeated content)
		var contexts = container.control.get_contexts();
		if (contexts) {
			for (var i = 0, l = contexts.length; i < l; i++) {
				var ctx = contexts[i];
				if ((ctx.containerElement === container) && (Sys._indexOf(ctx.nodes, subcontainer) > -1)) {
					return ctx;
				}
			}
		}

		return null;
	}
}

ExoWeb.UI.Field.registerClass("ExoWeb.UI.Field", ExoWeb.UI.Content);


///////////////////////////////////////////////////////////////////////////////
//Type.registerNamespace("ExoWeb.Data");

//ExoWeb.Data.DataContext = function ExoWeb$Data$DataContext(rawData) {
//	ExoWeb.Data.DataContext.initializeBase(this);
//	this._rawData = rawData;
//	this.initialize();
//}

//ExoWeb.Data.DataContext.prototype = {
//	// TODO: temporary hack to allow using data context without service
//	fetchData: function(operation, parameters, mergeOption, httpVerb, succeededCallback, failedCallback, timeout, userContext) {
//		succeededCallback(this.get_graph());
//	},
//	get_root: function() {
//		return this._root;
//	},
//	set_root: function(value) {
//		this._root = value;
//	},
//	initialize: function() {
//		$load(this._rawData.__metadata, this._rawData.__data);
//	}
//}

//ExoWeb.Data.DataContext.registerClass("ExoWeb.Data.DataContext", Sys.Data.DataContext);


// Since this script is not loaded by System.Web.Handlers.ScriptResourceHandler
// invoke Sys.Application.notifyScriptLoaded to notify ScriptManager 
// that this is the end of the script.
if (typeof (Sys) !== 'undefined') Sys.Application.notifyScriptLoaded();
