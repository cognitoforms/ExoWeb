Type.registerNamespace("ExoWeb.UI");

(function() {

	function execute() {

		var undefined;

		var log = ExoWeb.trace.log;
		var throwAndLog = ExoWeb.trace.throwAndLog;

		// #region Toggle
		///////////////////////////////////////////////////////////////////////////////

		function Toggle(element) {
			Toggle.initializeBase(this, [element]);
		}

		var Toggle_allowedActions = ["show", "hide", "enable", "disable", "render", "dispose"];

		// Actions
		Toggle.mixin({
			// Show/Hide
			//////////////////////////////////////////////////////////
			do_show: function Toggle$do_show() {
				$(this.get_element()).show();

				// visibility has changed so raise event
				if (this._visible === undefined || this._visible === false) {
					Sys.Observer.raiseEvent(this, "shown");
				}

				this._visible = true;
			},
			do_hide: function Toggle$do_hide() {
				$(this.get_element()).hide();

				// visibility has changed so raise event
				if (this._visible === undefined || this._visible === true) {
					Sys.Observer.raiseEvent(this, "hidden");
				}

				this._visible = false;
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
			get_visible: function Toggle$get_visible() {
				return this._visible;
			},

			// Enable/Disable
			//////////////////////////////////////////////////////////
			do_enable: function Toggle$do_enable() {
				$("select,input,textarea,a,button,optgroup,option", this.get_element()).andSelf().removeAttr("disabled");
			},
			do_disable: function Toggle$do_disable() {
				$("select,input,textarea,a,button,optgroup,option", this.get_element()).andSelf().attr("disabled", "disabled");
			},

			// Render/Destroy
			//////////////////////////////////////////////////////////
			init_render: function Toggle$init_render() {
				if (!$(this._element).is(".sys-template")) {
					throwAndLog(["ui", "toggle"], "When using toggle in render/dispose mode, the element should be marked with the \"sys-template\" class.");
				}

				this._template = new Sys.UI.Template(this._element);
				$(this._element).empty();
				$(this._element).removeClass("sys-template");
			},
			do_render: function Toggle$do_render() {
				var pctx = Sys.UI.Template.findContext(this._element);

				var renderArgs = new Sys.Data.DataEventArgs(pctx.dataItem);
				Sys.Observer.raiseEvent(this, "rendering", renderArgs);

				$(this._element).empty();

				if (pctx.dataItem) {
					this._context = this._template.instantiateIn(this._element, pctx.dataItem, pctx.dataItem, 0, null, pctx);
					this._context.initializeComponents();
				}

				Sys.Observer.raiseEvent(this, "rendered", renderArgs);
			},
			do_dispose: function Toggle$do_dispose() {
				var renderArgs = new Sys.Data.DataEventArgs();
				Sys.Observer.raiseEvent(this, "rendering", renderArgs);

				$(this._element).empty();

				Sys.Observer.raiseEvent(this, "rendered", renderArgs);
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
			}
		});

		// Inverse Actions
		Toggle.mixin({
			// Hide/Show
			//////////////////////////////////////////////////////////
			init_hide: Toggle.prototype.init_show,
			undo_hide: Toggle.prototype.do_show,
			undo_show: Toggle.prototype.do_hide,

			// Enable/Disable
			//////////////////////////////////////////////////////////
			init_disable: Toggle.prototype.init_enable,
			undo_disable: Toggle.prototype.do_enable,
			undo_enable: Toggle.prototype.do_disable,

			// Render/Dispose
			//////////////////////////////////////////////////////////
			init_dispose: Toggle.prototype.init_render,
			undo_render: Toggle.prototype.do_dispose,
			undo_dispose: Toggle.prototype.do_render
		});

		Toggle.mixin({
			get_action: function Toggle$get_action() {
				/// <summary>
				/// The value that determines what the control should
				/// do when its state changes.
				/// Options:  show/hide, enable/disable, render/dispose
				/// </summary>

				return this._action;
			},
			set_action: function Toggle$set_action(value) {
				if (!Array.contains(Toggle_allowedActions, value)) {
					ExoWeb.trace.throwAndLog("ui", "Invalid toggle action \"{0}\".  Possible values are \"{1}\".", [value, Toggle_allowedActions.join(", ")]);
				}

				this._action = value;
				this.execute();
			},

			get_on: function Toggle$get_on() {
				/// <summary>
				/// The value that the control will watch to determine
				/// when its state should change.
				/// </summary>

				return this._on;
			},
			set_on: function Toggle$set_on(value) {
				var changed = value !== this._on;

				if (changed) {
					if (this._on && this._on instanceof Array) {
						Sys.Observer.removeCollectionChanged(this._on, this._collectionChangedHandler);
					}

					this._on = value;

					if (this._on && this._on instanceof Array) {
						this._collectionChangedHandler = this.execute.setScope(this);
						Sys.Observer.addCollectionChanged(this._on, this._collectionChangedHandler);
					}

					this.execute();
				}
			},

			get_when: function Toggle$get_when() {
				/// <summary>
				/// The value to compare "on" to, this will most likely 
				/// be a static value, like true or false.
				/// </summary>

				return this._when;
			},
			set_when: function Toggle$set_when(value) {
				this._when = value;
				this.execute();
			},

			get_equals: function Toggle$get_equals() {
				if (this._when instanceof Function) {
					return !!this._when(this._on);
				}
				else if (typeof (this._on) === "boolean" && this._when === undefined) {
					return this._on;
				}
				else {
					return this._on === this._when;
				}
			},

			canExecute: function Toggle$canExecute() {
				// Ensure that the control is initialized, has an element, and the "on" property has been set.
				// Scenario 1:  The set_on or set_when methods may be called before the control has been initialized.
				// Scenario 2:  If a lazy markup extension is used to set the "on" or "when" properties then a callback could set the 
				//				property value when the element is undefined, possibly because of template re-rendering.
				// Scenario 3:  If a lazy markup extension is used to set the "on" property then it may not have a value when initialized.
				return this.get_isInitialized() && this._element !== undefined && this._element !== null && this.hasOwnProperty("_on");
			},
			execute: function Toggle$execute() {
				if (this.canExecute()) {
					this[(this.get_equals() === true ? "do_" : "undo_") + this._action].call(this);
				}
			},
			initialize: function Toggle$initialize() {
				Toggle.callBaseMethod(this, "initialize");

				this._element._exowebtoggle = this;

				// Perform custom init logic for the action
				var actionInit = this["init_" + this._action];
				if (actionInit) {
					actionInit.call(this);
				}

				this.execute();
			}
		});

		ExoWeb.UI.Toggle = Toggle;
		Toggle.registerClass("ExoWeb.UI.Toggle", Sys.UI.Control);

		// #endregion

		// #region Template
		///////////////////////////////////////////////////////////////////////////////

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
							throwAndLog(["ui", "templates"], "Compiling statement \"" + this._if + "\" causes the following error: " + compileError);
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

			log(["templates"],
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
//						log(["templates"], "TEMPLATE MATCHES!: for = {_for}, type = {_dataType}, if = {_if}", tmpl.control);
						return tmpl;
					}
					else {
//						log(["templates"], "template does not match: for = {_for}, type = {_dataType}, if = {_if}", tmpl.control);
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

		Template.load = function Template$load(path) {
			/// <summary>
			/// Loads external templates into the page.
			/// </summary>

			var id = "exoweb-templates-" + (templateCount++);

			var lastReq = lastTemplateRequestSignal;

			// set the last request signal to the new signal and increment
			lastTemplateRequestSignal = new ExoWeb.Signal(id);
			var signal = lastTemplateRequestSignal;
			var callback = signal.pending(function(elem) {
//				log("ui", "Activating elements for templates \"{0}\"", [id]);

				// Store the number of templates before activating this element.
				var originalTemplateCount = allTemplates.length;

				// Activate template controls within the response.
				Sys.Application.activateElement(elem);

				// No new templates were created.
				if (originalTemplateCount === allTemplates.length) {
					ExoWeb.trace.logWarning("ui", "Templates for request \"{0}\" from path \"{1}\" yields no templates.", [id, path]);
				}
			});

			$("<div id='" + id + "'/>")
				.hide()
				.appendTo("body")
				.load(path, externalTemplatesSignal.pending(function() {
					var elem = this;

					// if there is a pending request then wait for it to complete
					if (lastReq) {
//						log("ui", "Templates \"{0}\" complete and waiting.", [id]);
						lastReq.waitForAll(function() { callback(elem); });
					}
					else {
						callback(elem);
					}
				}));
		};

		ExoWeb.UI.Template = Template;
		Template.registerClass("ExoWeb.UI.Template", Sys.UI.Control);

		// #endregion

		// #region Content
		///////////////////////////////////////////////////////////////////////////////

		function Content(element) {
			/// <summary>
			/// Finds its matching template and renders using the provided data as the 
			/// binding context.  It can be used as a "field control", using part of the 
			/// context data to select the appropriate control template.  Another common 
			/// usage would be to select the appropriate template for a portion of the UI,
			/// as in the example where an objects meta type determines how it is 
			/// displayed in the UI.
			/// </summary>
			/// <example>
			///		<div sys:attach="content" content:data="{{ somedata }}"></div>
			/// </example>

			Content.initializeBase(this, [element]);
		}

		var contentControlsRendering = 0;

		ExoWeb.registerActivity(function() {
			if (contentControlsRendering < 0) {
				ExoWeb.trace.logWarning("ui", "Number of content controls rendering should never dip below zero.");
			}

			return contentControlsRendering > 0;
		});

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
				// Force rendering to occur if we previously had a value and now do not.
				var force = ((value === undefined || value === null) && (this._data !== undefined && this._data !== null));

				this._data = value;
				this.render(force);
			},
			get_disabled: function Content$get_disabled() {
				return this._disabled === undefined ? false : !!this._disabled;
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
			_canRender: function Content$_canRender(force) {
				// Ensure that the control is initialized, has an element, and the "data" property has been set.
				// Scenario 1:  The set_data method may be called before the control has been initialized.
				// Scenario 2:  If a lazy markup extension is used to set the "data" property then a callback could set the 
				//				property value when the element is undefined, possibly because of template re-rendering.
				// Scenario 3:  If a lazy markup extension is used to set the "data" property then it may not have a value when initialized.
				// Also check that the control has not been disabled.

				return ((this._data !== undefined && this._data !== null) || force === true) &&
					!!this._initialized && this._element !== undefined && this._element !== null && !this.get_disabled();
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
			render: function Content$render(force) {
				if (this._canRender(force)) {
//					log(['ui', "templates"], "render({0})", [force === true ? "force" : ""]);

					contentControlsRendering++;

					externalTemplatesSignal.waitForAll(function Content$externalTemplatesSignal() {
						if (this._element === undefined || this._element === null) {
							contentControlsRendering--;
							return;
						}

//						log(['ui', "templates"], "render() proceeding after all templates are loaded");

						var renderArgs = new Sys.Data.DataEventArgs(this._data);
						Sys.Observer.raiseEvent(this, "rendering", renderArgs);

						// Failing to empty content before rendering can result in invalid content since rendering 
						// content is not necessarily in order because of waiting on external templates.
						$(this._element).empty();

						// ripped off from dataview
						var pctx = this.get_templateContext();
						var container = this.get_element();
						var data = this._data;
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
						this._contexts = new Array(len);
						for (var i = 0; i < len; i++) {
							var item = list[i];
							var itemTemplate = this.getTemplate(item);

							// get custom classes from template
							var classes = $(itemTemplate.get_element()).attr("class");
							if (classes) {
								classes = $.trim(classes.replace("vc3-template", "").replace("sys-template", ""));
							}

							this._contexts[i] = itemTemplate.instantiateIn(container, data, item, i, null, pctx);

							// copy custom classes from template to content control
							if (classes) {
								$(container).addClass(classes);
							}
						}

						// necessary in order to render components found within the template (like a nested dataview)
						for (var j = 0, l = this._contexts.length; j < l; j++) {
							var ctx = this._contexts[j];
							if (ctx) {
								ctx.initializeComponents();
							}
						}

						Sys.Observer.raiseEvent(this, "rendered", renderArgs);
						contentControlsRendering--;
					}, this);
				}
			},
			initialize: function Content$initialize() {
				Content.callBaseMethod(this, "initialize");

				// marker attribute used by helper methods to identify as a content control
				this._element._exowebcontent = this;

				if ($(this._element).is(".sys-template")) {
					if ($(this._element).children().length > 0) {
						ExoWeb.trace.logWarning(["ui", "content"],
							"Content control is marked with the \"sys-template\" class, which means that its children will be ignored and discarded.");
					}
					else {
						ExoWeb.trace.logWarning(["ui", "content"],
							"No need to mark a content control with the \"sys-template\" class.");
					}
				}

				this.render();
			}
		};

		ExoWeb.UI.Content = Content;
		Content.registerClass("ExoWeb.UI.Content", Sys.UI.Control);


		// #endregion

		// #region DataView
		///////////////////////////////////////////////////////////////////////////////

		var dataViewsRendering = 0;

		ExoWeb.registerActivity(function() {
			if (dataViewsRendering < 0) {
				ExoWeb.trace.logWarning("ui", "Number of dataview controls rendering should never dip below zero.");
			}

			return dataViewsRendering > 0;
		});

		var dataViewRefresh = Sys.UI.DataView.prototype.refresh;
		Sys.UI.DataView.prototype.refresh = function refresh() {
			dataViewsRendering++;

			dataViewRefresh.apply(this, arguments);

			dataViewsRendering--;
		};

		// #endregion

		// #region Html
		///////////////////////////////////////////////////////////////////////////////

		function Html(element) {
			/// <summary>
			/// </summary>
			/// <example>
			///		<div sys:attach="html" html:url="http://www.google.com"></div>
			/// </example>

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

		// #endregion

		// #region Behavior
		///////////////////////////////////////////////////////////////////////////////

		function Behavior(element) {
			/// <summary>
			/// </summary>
			/// <example>
			///		<div sys:attach="behavior" behavior:script="Sys.scripts.Foo" behavior:class="My.Class" behavior:prop-foo="bar"></div>
			/// </example>

			Behavior.initializeBase(this, [element]);
		}

		Behavior.prototype = {
			get_script: function Behavior$get_script() {
				return this._script;
			},
			set_script: function Behavior$set_script(value) {
				this._script = value;
			},
			get_scriptObject: function Behavior$get_script() {
				if (!this._scriptObject) {
					var path = this._script.startsWith("window") ?
						this._script.substring(7) :
						this._script;

					this._scriptObject = ExoWeb.evalPath(window, path);
				}

				return this._scriptObject;
			},
			get_class: function Behavior$get_class() {
				return this._class;
			},
			set_class: function Behavior$set_class(value) {
				this._class = value;
			},
			get_classObject: function Behavior$get_classObject() {
				if (!this._classObject) {
					this._classObject = ExoWeb.getCtor(this._class);
				}

				return this._classObject;
			},
			get_properties: function Behavior$get_properties() {
				if (!this._properties) {
					this._properties = {};
					for (var prop in this) {
						if (prop.startsWith("prop_") && !prop.startsWith("prop_add_")) {
							var name = Sys.Application._mapToPrototype(prop.substring(5), this.get_classObject());

							if (!name) {
								ExoWeb.trace.throwAndLog("ui",
									"Property '{0}' could not be found on type '{1}'.",
									[prop.substring(5), this._class]);
							}

							this._properties[name] = this[prop];
						}
					}
				}

				return this._properties;
			},
			get_events: function Behavior$get_events() {
				if (!this._events) {
					this._events = {};
					for (var prop in this) {
						if (prop.startsWith("prop_add_")) {
							var name = Sys.Application._mapToPrototype(prop.substring(9), this.get_classObject());

							if (!name) {
								ExoWeb.trace.throwAndLog("ui",
									"Event '{0}' could not be found on type '{1}'.",
									[prop.substring(9), this._class]);
							}

							this._events[name] = this[prop];
						}
					}
				}

				return this._events;
			},
			initialize: function Behavior$initialize() {
				Behavior.callBaseMethod(this, "initialize");

				var _this = this;

				Sys.require([this.get_scriptObject()], function() {
					// if the element is not within the document body it 
					// probably means that it is being removed - TODO: verify
					if (!$.contains(document.body, _this._element)) {
						return;
					}

					_this._behavior = $create(_this.get_classObject(), _this.get_properties(), _this.get_events(), null, _this.get_element());
				});
			}
		};

		ExoWeb.UI.Behavior = Behavior;
		Behavior.registerClass("ExoWeb.UI.Behavior", Sys.UI.Control);

		// #endregion

		// #region Helper Functions
		///////////////////////////////////////////////////////////////////////////////

		function getTemplateSubContainer(childElement) {
			var element = childElement;

			function isDataViewOrContent(el) {
				return element.parentNode._exowebcontent ||
					(element.parentNode._msajaxtemplate && !element.parentNode._exowebtoggle);
			}

			// find the first parent that has an attached ASP.NET Ajax dataview or ExoWeb content control (ignore toggle)
			while (element.parentNode && !isDataViewOrContent(element.parentNode)) {
				element = element.parentNode;
			}

			// containing template was not found
			if (element.parentNode && isDataViewOrContent(element.parentNode)) {
				return element;
			}
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
//							log("ui", "invalid index");
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
					var obj = container || target;
					subcontainer = getTemplateSubContainer(obj);

					if (!subcontainer) {
						// Back up and attempt to go through the control.
						if (obj.control && (obj.control instanceof Sys.UI.DataView || container.control instanceof ExoWeb.UI.Content)) {
							container = null;
							target = obj.control;
							continue;
						}

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
					searching = !data || !(data instanceof options.dataType || data.constructor === options.dataType);
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

		// #endregion

		// #region MS AJAX Overrides
		//////////////////////////////////////////////////////////////////////////////////////

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

		// #endregion

	}

	if (window.Sys && Sys.loader) {
		Sys.loader.registerScript("ExoWebUi", null, execute);
	}
	else {
		execute();
	}

})();
