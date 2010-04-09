Type.registerNamespace("ExoWeb.UI");

(function() {

	function execute() {

		var undefined;

		var log = ExoWeb.trace.log;
		var throwAndLog = ExoWeb.trace.throwAndLog;

		///////////////////////////////////////////////////////////////////////////////
		function Toggle(element) {
			Toggle.initializeBase(this, [element]);
		}

		Toggle.prototype = {
			set_action: function Toggle$set_action(value) {
				this._action = value;
				this.execute();
			},
			get_action: function Toggle$get_action() {
				return this._action;
			},
			set_on: function Toggle$set_on(value) {
				this._on = value;
				this.execute();
			},
			get_on: function Toggle$get_on() {
				return this._on;
			},
			set_when: function Toggle$set_when(value) {
				this._when = value;
				this.execute();
			},
			get_when: function Toggle$get_when() {
				return this._when;
			},
			get_visible: function Toggle$get_visible() {
				return this._visible;
			},
			add_shown: function Toggle$add_shown(handler) {
				this._addHandler("shown", handler);
			},
			remove_shown: function Toggle$remove_shown(handler) {
				this._removeHandler("shown", handler);
			},
			add_hidden: function Toggle$add_hidden(handler) {
				this._addHandler("hidden", handler);
			},
			remove_hidden: function Toggle$remove_hidden(handler) {
				this._removeHandler("hidden", handler);
			},
			execute: function Toggle$execute() {
				// Ensure that the control is initialized, has an element, and the "on" property has been set.
				// Scenario 1:  The set_on or set_when methods may be called before the control has been initialized.
				// Scenario 2:  If a lazy markup extension is used to set the "on" or "when" properties then a callback could set the 
				//				property value when the element is undefined, possibly because of template re-rendering.
				// Scenario 3:  If a lazy markup extension is used to set the "on" property then it may not have a value when initialized.
				if (!this.get_isInitialized() || this._element === undefined || this._element === null || !this.hasOwnProperty("_on")) {
					return;
				}

				var equals;

				if (this._when instanceof Function) {
					equals = !!this._when(this._on);
				}
				else if (typeof (this._on) === "boolean" && this._when === undefined) {
					equals = this._on;
				}
				else {
					equals = this._on === this._when;
				}

				// hide or show the element depending on the conditions
				if ((equals && this._action != "hide") || (!equals && this._action == "hide")) {
					// show the element
					$(this.get_element()).show();

					// visibility has changed so raise event
					if (this._visible === undefined || this._visible === false) {
						Sys.Observer.raiseEvent(this, "shown");
					}

					// update status
					this._visible = true;
				}
				else {
					// hide the element
					$(this.get_element()).hide();

					// visibility has changed so raise event
					if (this._visible === undefined || this._visible === true) {
						Sys.Observer.raiseEvent(this, "hidden");
					}

					// update status
					this._visible = false;
				}

			},
			initialize: function Toggle$initialize() {
				Toggle.callBaseMethod(this, "initialize");
				this.execute();
			}
		};

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
		function Template(element) {
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
							throwAndLog(["ui", "templates"], "Statement \"" + this._if + "\" causes the following error: " + compileError);
						}
					}

					if (this._ifFn) {
						try {
							result = this._ifFn.apply(this, [data, element]);
						}
						catch (executeError) {
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

		/// <summary>
		/// Finds the first field template with a selector and filter that
		/// match the given element and returns the template.
		/// </summary>
		Template.find = function(element, data) {
			log(["templates"],
				"attempt to find match for element = {0}{1}, data = {2}",
				[element.tagName, element.className ? "." + element.className : "", data]);

			for (var t = allTemplates.length - 1; t >= 0; t--) {
				var tmpl = allTemplates[t];

				if (tmpl.control instanceof Template) {
					if (tmpl.control.test(element, data)) {
						log(["templates"], "TEMPLATE MATCHES!: for = {_for}, if = {_if}", tmpl.control);
						return tmpl;
					}
					else {
						log(["templates"], "template does not match: for = {_for}, if = {_if}", tmpl.control);
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

		/// <summary>
		/// Loads external templates into the page
		/// </summary>
		Template.load = function(path) {
			var id = "exoweb-templates-" + (templateCount++);

			var lastReq = lastTemplateRequestSignal;

			// set the last request signal to the new signal and increment
			lastTemplateRequestSignal = new ExoWeb.Signal(id);
			var signal = lastTemplateRequestSignal;
			var callback = signal.pending(function(elem) {
				log("ui", "Activating elements for templates \"{0}\"", [id]);
				Sys.Application.activateElement(elem);  // activate controls
			});

			$("<div id='" + id + "'/>")
				.hide()
				.appendTo("body")
				.load(path, externalTemplatesSignal.pending(function() {
					var elem = this;

					// if there is a pending request then wait for it to complete
					if (lastReq) {
						log("ui", "Templates \"{0}\" complete and waiting.", [id]);
						lastReq.waitForAll(function() { callback(elem); });
					}
					else {
						callback(elem);
					}
				}));
		};

		ExoWeb.UI.Template = Template;
		Template.registerClass("ExoWeb.UI.Template", Sys.UI.Control);

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
		function Content(element) {
			Content.initializeBase(this, [element]);
		}

		Content.prototype = {
			getTemplate: function Content$getTemplate(data) {
				var tmpl = Template.find(this._element, data);

				if (!tmpl) {
					throwAndLog(["ui", "templates"], "This content region does not match any available templates. Data={0}, Element={1}.{2}", [data, this._element.tagName, this._element.className]);
				}

				if (!Sys.UI.Template.isInstanceOfType(tmpl)) {
					tmpl = new Sys.UI.Template(tmpl);
				}

				return tmpl;
			},
			get_data: function Content$get_data() {
				return this._data;
			},
			set_data: function Content$set_data(value) {
				this._data = value;
				this.render();
			},
			get_disabled: function Content$get_disabled() {
				return this._disabled === undefined ? false : this._disabled;
			},
			set_disabled: function Content$set_disabled(value) {
				var newValue;

				if (value.constructor === Boolean) {
					newValue = value;
				}
				else if (value.constructor === String) {
					newValue = Boolean.formats.TrueFalse.convertBack(value);
				}
				else {
					ExoWeb.trace.throwAndLog(["ui", "content"], "Invalid value for property \"disabled\": {0}.", [value]);
				}

				var oldValue = this._disabled;
				this._disabled = newValue;

				if (oldValue === true && newValue === false) {
					this.render();
				}
			},
			get_contexts: function Content$get_contexts() {
				return this._contexts;
			},
			get_templateContext: function Content$get_templateContext() {
				if (!this._parentContext) {
					this._parentContext = Sys.UI.Template.findContext(this._element);
				}
				return this._parentContext;
			},
			_canRender: function Content$_canRender() {
				// Ensure that the control is initialized, has an element, and the "data" property has been set.
				// Scenario 1:  The set_data method may be called before the control has been initialized.
				// Scenario 2:  If a lazy markup extension is used to set the "data" property then a callback could set the 
				//				property value when the element is undefined, possibly because of template re-rendering.
				// Scenario 3:  If a lazy markup extension is used to set the "data" property then it may not have a value when initialized.
				// Also check that the control has not been disabled.
				return !!(this._data && this._initialized && this._element !== undefined && this._element !== null && !this.get_disabled());
			},
			add_rendering: function Content$add_rendering(handler) {
				this._addHandler("rendering", handler);
			},
			remove_rendering: function Content$remove_rendering(handler) {
				this._removeHandler("rendering", handler);
			},
			add_rendered: function Content$add_rendered(handler) {
				this._addHandler("rendered", handler);
			},
			remove_rendered: function Content$remove_rendered(handler) {
				this._removeHandler("rendered", handler);
			},
			render: function Content$render() {
				if (this._canRender()) {
					log(['ui', "templates"], "render()");

					var _this = this;
					externalTemplatesSignal.waitForAll(function Content$externalTemplatesSignal() {
						if (_this._element !== undefined && _this._element !== null) {
							log(['ui', "templates"], "render() proceeding after all templates are loaded");

							// Failing to empty content before rendering can result in invalid content since rendering 
							// content is not necessarily in order because of waiting on external templates.
							$(_this._element).empty();

							var renderArgs = new Sys.Data.DataEventArgs(_this._data);
							Sys.Observer.raiseEvent(_this, "rendering", renderArgs);

							// ripped off from dataview
							var pctx = _this.get_templateContext();
							var container = _this.get_element();
							var data = _this._data;
							var list = data;
							var len;
							if ((data === null) || (typeof (data) === "undefined")) {
								len = 0;
							}
							else if (!(data instanceof Array)) {
								list = [data];
								len = 1;
							}
							else {
								len = data.length;
							}
							_this._contexts = new Array(len);
							for (var i = 0; i < len; i++) {
								var item = list[i];
								var itemTemplate = _this.getTemplate(item);

								// get custom classes from template
								var classes = $(itemTemplate.get_element()).attr("class");
								if (classes) {
									classes = $.trim(classes.replace("vc3-template", "").replace("sys-template", ""));
								}

								_this._contexts[i] = itemTemplate.instantiateIn(container, data, item, i, null, pctx);

								// copy custom classes from template to content control
								if (classes) {
									$(container).addClass(classes);
								}
							}

							// necessary in order to render components found within the template (like a nested dataview)
							for (var j = 0, l = _this._contexts.length; j < l; j++) {
								var ctx = _this._contexts[j];
								if (ctx) {
									ctx.initializeComponents();
								}
							}

							Sys.Observer.raiseEvent(_this, "rendered", renderArgs);
						}
					});
				}
			},
			initialize: function Content$initialize() {
				Content.callBaseMethod(this, "initialize");

				// marker attribute used by helper methods to identify as a content control
				this._element._exowebcontent = {};

				this.render();
			}
		};

		ExoWeb.UI.Content = Content;
		Content.registerClass("ExoWeb.UI.Content", Sys.UI.Control);

		///////////////////////////////////////////////////////////////////////////////
		/// <summary>
		/// 
		/// </summary>
		///
		/// <example>
		///		<div sys:attach="html" html:url="http://www.google.com"></div>
		/// </example>
		function Html(element) {
			Html.initializeBase(this, [element]);
		}

		Html.prototype = {
			get_source: function Html$get_source() {
				return this._source;
			},
			set_source: function Html$set_source(value) {
				this._source = value;
			},
			get_loadingClass: function Html$get_loadingClass() {
				return this._loadingClass;
			},
			set_loadingClass: function Html$set_loadingClass(value) {
				this._loadingClass = value;
			},
			get_url: function Html$get_url() {
				return this._url;
			},
			set_url: function Html$set_url(value) {
				this._url = value;
			},
			get_path: function Html$get_path() {
				return $format(this.get_url(), this.get_source());
			},
			initialize: function Html$initialize() {
				Html.callBaseMethod(this, "initialize");

				var path = this.get_path();
				var element = this.get_element();
				var loadingClass = this.get_loadingClass();

				$(element).addClass(loadingClass);

				$(element).load(path, function(responseText, status, response) {
					$(element).removeClass(loadingClass);

					if (status != "success" && status != "notmodified") {
						ExoWeb.trace.throwAndLog("ui", "Failed to load html: status = {status}", { status: status, response: response });
					}
				});
			}
		};

		ExoWeb.UI.Html = Html;
		Html.registerClass("ExoWeb.UI.Html", Sys.UI.Control);

		function getTemplateSubContainer(childElement) {
			var element = childElement;

			// find the first parent that has an attached ASP.NET Ajax dataview or ExoWeb content control
			while (element.parentNode && !element.parentNode._msajaxtemplate && !element.parentNode._exowebcontent) {
				element = element.parentNode;
			}

			// containing template was not found
			if (element.parentNode && (element.parentNode._msajaxtemplate || element.parentNode._exowebcontent)) {
				return element;
			}

			return null;
		}

		function getDataForContainer(container, subcontainer, index) {
			if (!container) {
				return;
			}

			var data = null;

			if (container.control instanceof Sys.UI.DataView || container.control instanceof ExoWeb.UI.Content) {
				var containerContexts = container.control.get_contexts();
				var containerData = container.control.get_data();

				// ensure an array for conformity
				if (!(containerData instanceof Array)) {
					containerData = [containerData];
				}

				if (containerContexts) {
					// if there is only one context in the array then the index must be zero
					if (containerContexts.length == 1) {
						index = 0;
					}

					if (index !== undefined && index !== null && index.constructor === Number) {
						if (index >= containerContexts.length) {
							log("ui", "invalid index");
						}
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
							if (childContext && childContext.containerElement === container && Sys._indexOf(childContext.nodes, subcontainer) > -1) {
								data = childContext.dataItem;
							}
						}
					}
				}
			}

			return data;
		}

		function getParentContextData(options/*{ target, index, level, dataType, ifFn }*/) {
			/// <summary>
			/// 	Finds the template context data based on the given options.
			/// </summary>
			/// <param name="options" type="Object">
			/// 	The object which contains the options to use.
			/// 	target:  The target from which to start searching.  This can be an HTML
			/// 					element, a control, or a template context.
			/// 		index (optional):  The index of the desired context.  If the desired context
			/// 					is one level up and is part of a list, this argument can be used
			/// 					to specify which template context to return.
			/// 		level (optional):  The number of levels to travel.  By default this is "1",
			/// 					which means that the immediate parent context data will be returned.
			/// 		dataType (optional):  If specified, this type is used as the type of data to search
			/// 					for.  When context data of this type is encountered it is returned.
			/// 					Note that arrays are not supported.  If the data is an array and the
			/// 					type of items must be checked, use the "ifFn" argument.
			/// 		ifFn (optional):  A function that determines whether the correct data has been
			/// 					found.  The context data is returned as soon as the result of calling 
			/// 					this function with the current data and container is true.
			/// </param>
			/// <returns type="Object" />

			var target = options.target, effectiveLevel = options.level || 1, container, subcontainer, i = 0, searching = true, data;

			if (target.control && (target.control instanceof Sys.UI.DataView || target.control instanceof ExoWeb.UI.Content)) {
				target = target.control;
			}
			else if (target instanceof Sys.UI.Template) {
				target = target.get_element();
			}
			else if (target instanceof Sys.UI.TemplateContext) {
				target = target.containerElement;
			}

			while (searching === true) {
				// if we are starting out with a dataview then look at the parent context rather than walking 
				// up the dom (since the element will probably not be present in the dom)
				if (!container && (target instanceof Sys.UI.DataView || target instanceof ExoWeb.UI.Content)) {
					container = target.get_templateContext().containerElement;
				}
				else {
					subcontainer = getTemplateSubContainer(container || target);

					if (!subcontainer) {
						throw Error.invalidOperation("Not within a container template.");
					}

					container = subcontainer.parentNode;
				}

				// Increment the counter to check against the level parameter.
				i++;

				// Get the context data for the current level.
				data = getDataForContainer(container, subcontainer, options.index);

				if (options.dataType) {
					// Verify that the current data is not the data type that we are looking for.
					searching = !(data instanceof options.dataType || data.constructor === options.dataType);
				}
				else if (options.ifFn) {
					// Verify that the stop function conditions are not met.
					searching = !(options.ifFn.call(this, data, container));
				}
				else {
					// Finally, check the level.  If no level was specified then we will only go up one level.
					searching = i < effectiveLevel;
				}
			}

			return data;
		}

		ExoWeb.UI.getParentContextData = getParentContextData;

		window.$parentContextData = function $parentContextData(target, index, level, dataType, ifFn) {
			/// <summary>
			/// 	Finds the template context data based on the given options.
			/// </summary>
			/// <param name="target" type="Object">
			/// 	The target from which to start searching.  This can be an HTML element, a 
			/// 	control, or a template context.
			/// </param>
			/// <param name="index" type="Number" integer="true" optional="true">
			/// 	The index of the desired context.  If the desired context is one level
			/// 	up and is part of a list, this argument can be used to specify which
			/// 	template context to return.
			/// </param>
			/// <param name="level" type="Number" integer="true" optional="true">
			/// 	The number of levels to travel.  By default this is "1", which means that
			/// 	the immediate parent context data will be returned.
			/// </param>
			/// <param name="dataType" type="Function" optional="true">
			/// 	If specified, this type is used as the type of data to search for.  When context
			/// 	data of this type is encountered it is returned.  Note that arrays are not supported.
			/// 	If the data is an array and the type of items must be checked, use the "ifFn" argument.
			/// </param>
			/// <param name="ifFn" type="Function" optional="true">
			/// 	A function that determines whether the correct data has been found.  The context data
			/// 	is returned as soon as the result of calling this function with the current data and 
			/// 	container is true.
			/// </param>
			/// <returns type="Object" />
			
			return getParentContextData({
				"target": target,
				"index": index,
				"level": level,
				"dataType": dataType,
				"ifFn": ifFn
			});
		};

		function getIsLast(control, index) {
			/// <summary>
			/// 	Returns whether the data for the given control at the given index is 
			/// 	the last object in the list.
			/// </summary>
			/// <param name="control" type="Sys.UI.Control">The control.</param>
			/// <param name="index" type="Number" integer="true">The index.</param>
			/// <returns type="Boolean" />
			var len = control.get_element().control.get_contexts().length;
			return index == len - 1;
		}

		window.$isLast = getIsLast;

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
		};

		// call jQuery.ever to make sure it intercepts template rendering since
		// we know the ASP.NET AJAX templates script is loaded at this point
		if (jQuery.fn.ever) {
			jQuery.fn.ever.call();
		}
	}

	if (window.Sys && Sys.loader) {
		Sys.loader.registerScript("ExoWebUi", null, execute);
	}
	else {
		execute();
	}

})();
