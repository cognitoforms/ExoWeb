Type.registerNamespace("ExoWeb.UI");

(function() {

	function execute() {

		var undefined;

		var log = ExoWeb.trace.log;
		var throwAndLog = ExoWeb.trace.throwAndLog;

		///////////////////////////////////////////////////////////////////////////////
		Toggle = function(element) {
			Toggle.initializeBase(this, [element]);
		}

		Toggle.prototype = {
			set_action: function Toggle$set_action(value) {
				this._action = value;
			},
			get_action: function Toggle$get_action() {
				return this._action;
			},
			set_on: function Toggle$set_on(value) {
				this._on = value;
			},
			get_on: function Toggle$get_on() {
				return this._on;
			},
			set_when: function Toggle$set_when(value) {
				this._when = value;
			},
			get_when: function Toggle$get_when() {
				return this._when;
			},
			set_source: function Toggle$set_source(value) {
				this._source = value;
			},
			get_source: function Toggle$get_source() {
				return this._source;
			},
			get_value: function Toggle$get_value() {
				var getter = this._source["get_" + this._on];
				if (getter)
					return getter.call(this._source);
				else
					return this._source[this._on];
			},
			execute: function Toggle$execute() {
				var val = this.get_value();
				if (val == this._when) {
					if (this._action == "hide")
						$(this.get_element()).hide();
					else
						$(this.get_element()).show();
				}
				else {
					if (this._action == "hide")
						$(this.get_element()).show();
					else
						$(this.get_element()).hide();
				}
			},
			initialize: function Toggle$initialize() {
				Toggle.callBaseMethod(this, "initialize");

				if (!this._source)
					this._source = getParentContextData(this._element);

				this.execute();

				var _this = this;
				Sys.Observer.addSpecificPropertyChanged(this._source, this._on, function() {
					_this.execute();
				});
			}
		}

		ExoWeb.UI.Toggle = Toggle;
		Toggle.registerClass("ExoWeb.UI.Toggle", Sys.UI.Control);



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
				if (this._for === undefined)
					return true;

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
					if (!this._ifFn) {
						try {
							// turn arbitrary javascript code into function
							this._ifFn = new Function("$data", "$container", "return " + this._if + ";");
						}
						catch (e) {
							throwAndLog(["ui", "templates"], "Statement \"" + this._if + "\" causes the following error: " + e);
						}
					}

					if (this._ifFn) {
						try {
							result = this._ifFn.apply(this, [e.control.get_data(), e]);
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
				allTemplates.push(this.get_element());
			}
		}

		var allTemplates = [];

		/// <summary>
		/// Finds the first field template with a selector and filter that
		/// match the given element and returns the template.
		/// </summary>
		Template.find = function(element) {
			for (var t = allTemplates.length - 1; t >= 0; t--) {
				var tmpl = allTemplates[t];
				if (tmpl.control.test(element))
					return tmpl;
			}

			return null;
		}

		// bookkeeping for Template.load()...
		var templateCount = 0;
		var externalTemplatesSignal = new ExoWeb.Signal("external templates");

		/// <summary>
		/// Loads external templates into the page
		/// </summary>
		Template.load = function(path) {
			var id = "exoweb-templates-" + (templateCount++);

			$("<div id='" + id + "'/>")
				.hide()
				.appendTo("body")
				.load(path, externalTemplatesSignal.pending(function() {
					// activate controls
					Sys.Application.activateElement(this);
				}));
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

					if (!this._template)
						throwAndLog(["ui", "templates"], "This content region does not match any available templates. Data={0}, Element={1}.{2}", [this._data, element.tagName, element.className]);
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
					log(['ui', "templates"], "render()");

					var _this = this;
					externalTemplatesSignal.waitForAll(function() {
						log(['ui', "templates"], "render() proceeding after all templates are loaded");
						var tmpl = _this.get_template();

						// get custom classes from template
						var classes = $.trim($(tmpl.get_element()).attr("class").replace("vc3-template", "").replace("sys-template", ""));

						_this._context = tmpl.instantiateIn(_this.get_element(), null, _this.get_data());

						// copy custom classes from template to content control
						$(_this.get_element()).addClass(classes);

						// necessary in order to render components found within the template (like a nested dataview)
						_this._context.initializeComponents();
					});
				}
				else {
					$(this._element).empty();
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

		function getDataForContainer(container, subcontainer) {
			if (!container)
				return;

			var data = null;

			if (container.control instanceof ExoWeb.UI.Content) {
				// content control doesn't currenlty support lists, so return the data object
				data = container.control.get_data();
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
							log("ui", "invalid index");
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

		function getParentContextData(elementOrControl, index, level, dataType) {

			if (elementOrControl.control instanceof Sys.UI.DataView)
				elementOrControl = elementOrControl.control;
			else if (elementOrControl instanceof Sys.UI.Template)
				elementOrControl = elementOrControl.get_element();

			var effectiveLevel = level || 1;

			var container;
			var subcontainer;
			for (var i = 0; i < effectiveLevel || (dataType && !(getDataForContainer(container, subcontainer) instanceof dataType)); i++) {
				// if we are starting out with a dataview then look at the parent context rather than walking 
				// up the dom (since the element will probably not be present in the dom)
				if (!container && elementOrControl instanceof Sys.UI.DataView && elementOrControl._parentContext) {
					container = elementOrControl._parentContext.containerElement;
				}
				else {
					subcontainer = getTemplateSubContainer(container || elementOrControl);

					if (!subcontainer)
						throw Error.invalidOperation("Not within a container template.");

					container = subcontainer.parentNode;
				}
			}
			
			return getDataForContainer(container, subcontainer);
		}

		window.$parentContextData = getParentContextData;

		function getIsLast(control, index) {
			var len = control.get_element().control.get_contexts().length;
			return index == len - 1;
		}

		window.$isLast = getIsLast;

	}

	if (window.Sys && Sys.loader) {
		Sys.loader.registerScript("ExoWebUi", null, execute);
	}
	else {
		execute();
	}

	//////////////////////////////////////////////////////////////////////////////////////
	// MS AJAX overrides

	/// replaced implementation to use _tcindex instead of _index
	/// http://msmvps.com/blogs/luisabreu/archive/2009/10/19/the-dataview-control-going-imperative-take-iii.aspx
	Sys.UI.TemplateContext.prototype.getInstanceId = function(prefix) {
		var s;
		if (this._global) {
			s = "";
		}
		else {
			s = this._tcindex;
			var ctx = this.parentContext;
			while (ctx && !ctx._global) {
				s = ctx._tcindex + "_" + s;
				ctx = ctx.parentContext;
			}
		}
		return prefix + s;
	}

})();