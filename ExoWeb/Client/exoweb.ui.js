Type.registerNamespace("ExoWeb.UI");

(function() {

	var undefined;

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
	Template = function(element) {
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
					func = new Function("$data", "$container", "return " + this._if + ";");
				}
				catch (e) {
					throw ("Statement \"" + this._if + "\" causes the following error: " + e);
				}

				if (func) {
					try {
						result = func.apply(this, [e.control.get_data(), e]);
					}
					catch (e) {
						result = false;
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
			Template.callBaseMethod(this, "initialize");

			// add a class that can be used to search for templates 
			// and make sure that the template element is hidden
			$(this.get_element()).addClass("vc3-template").hide();
		}
	}

	/// <summary>
	/// Finds the first field template with a selector and filter that
	/// match the given element and returns the template.
	/// </summary>
	Template.find = function(element) {
		var templates = $(".vc3-template");
		for (var t = 0; t < templates.length; t++) {
			var tmpl = templates[t];
			if (Template.isInstanceOfType(tmpl.control) && tmpl.control.test(element))
				return tmpl;
		}

		return null;
	}

	ExoWeb.UI.Template = Template;
	Template.registerClass("ExoWeb.UI.Template", Sys.UI.Control);


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
	Content = function(element) {
		Content.initializeBase(this, [element]);
	}

	Content.prototype = {
		get_template: function() {
			if (!this._template) {
				var element = this.get_element();
				this._template = Template.find(element);

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
		get_context: function() {
			return this._context;
		},
		set_context: function(value) {
			this._context = value;
		},
		render: function() {
			if (this._data && this._initialized) {
				try {
					var tmpl = this.get_template();

					// get custom classes from template
					var classes = $(tmpl.get_element()).attr("class").replace("vc3-template", "").replace("sys-template", "").trim();

					this._context = tmpl.instantiateIn(this.get_element(), null, this.get_data());

					// copy custom classes from template to content control
					$(this.get_element()).addClass(classes);

					// necessary in order to render components found within the template (like a nested dataview)
					this._context.initializeComponents();
				}
				catch (e) {
					console.error(e);
				}
			}
		},
		initialize: function() {
			Content.callBaseMethod(this, "initialize");

			// TODO: include meta info about field?
			this._element._exowebcontent = {};

			this._initialized = true;

			this.render();
		}
	}

	ExoWeb.UI.Content = Content;
	Content.registerClass("ExoWeb.UI.Content", Sys.UI.Control);

	function getTemplateSubContainer(childElement) {
		var element = childElement;

		// find the first parent that has an attached ASP.NET Ajax dataview or ExoWeb content control
		while (element.parentNode && !element.parentNode._msajaxtemplate && !element.parentNode._exowebcontent)
			element = element.parentNode;

		// containing template was not found
		if (element.parentNode && (element.parentNode._msajaxtemplate || element.parentNode._exowebcontent))
			return element;

		return null;
	}

	function getParentContextData(elementOrControl, index, level) {

		if (elementOrControl.control instanceof Sys.UI.DataView)
			elementOrControl = elementOrControl.control;
		else if (elementOrControl instanceof Sys.UI.Template)
			elementOrControl = elementOrControl.get_element();

		if (!level)
			level = 1;

		var container;
		var subcontainer;
		for (var i = 0; i < level; i++) {
			// if we are starting out with a dataview then look at the parent context rather than walking 
			// up the dom (since the element will probably not be present in the dom)
			if (!container && elementOrControl instanceof Sys.UI.DataView && elementOrControl._parentContext) {
				context = elementOrControl._parentContext;
				container = context.containerElement;
			}
			else {
				subcontainer = getTemplateSubContainer(container || elementOrControl);

				if (!subcontainer)
					throw Error.invalidOperation("Not within a container template.");

				container = subcontainer.parentNode;
			}
		}

		var data = null;

		if (container.control instanceof ExoWeb.UI.Content) {
			// content control doesn't currenlty support lists, so return the data object
			return container.control.get_data();
		}
		else if (container.control instanceof Sys.UI.DataView) {
			var containerContexts = container.control.get_contexts();
			var containerData = container.control.get_data();
			
			// ensure an array for conformity
			if (!(containerData instanceof Array))
				containerData = [containerData];
			
			if (containerContexts) {
				// if there is only one context in the array then the index must be zero
				if (containerContexts.length == 1)
					index = 0;
					
				if (index != undefined && index.constructor == Number) {
					if (index >= containerContexts.length)
						ExoWeb.trace.log("ui", "invalid index");
					else {
						var indexedContext = containerContexts[index];
						var indexedData = containerData[index];
						data = (indexedContext) ? indexedContext.dataItem : indexedData;
					}
				}
				else {
					// try to find the right context based on the element's position in the dom
					for (var i = 0, l = containerContexts.length; i < l; i++) {
						var childContext = containerContexts[i];
						if (childContext && childContext.containerElement === container && Sys._indexOf(childContext.nodes, subcontainer) > -1)
							data = childContext.dataItem;
					}
				}
			}
		}

		return data;
	}

	window.$parentContextData = getParentContextData;

	// Since this script is not loaded by System.Web.Handlers.ScriptResourceHandler
	// invoke Sys.Application.notifyScriptLoaded to notify ScriptManager 
	// that this is the end of the script.
	if (typeof (Sys) !== 'undefined') Sys.Application.notifyScriptLoaded();

})();