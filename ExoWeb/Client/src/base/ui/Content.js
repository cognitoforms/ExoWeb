function Content(element) {
	/// <summary locid="M:J#ExoWeb.UI.Content.#ctor">
	/// Finds its matching template and renders using the provided data as the 
	/// binding context.  It can be used as a "field control", using part of the 
	/// context data to select the appropriate control template.  Another common 
	/// usage would be to select the appropriate template for a portion of the UI,
	/// as in the example where an objects meta type determines how it is 
	/// displayed in the UI.
	/// </summary>
	/// <param name="element"></param>
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

	get_template: function Content$get_template() {
		/// <value mayBeNull="true" type="String" locid="P:J#ExoWeb.UI.Content.template"></value>
		return this._template;
	},
	set_template: function (value) {
		this._template = value;
	},

	get_data: function Content$get_data() {
		/// <value mayBeNull="false" locid="P:J#ExoWeb.UI.Content.data"></value>
		return this._data;
	},
	set_data: function Content$set_data(value) {
		var removedData = ((value === undefined || value === null) && (this._data !== undefined && this._data !== null));

		if (this._changedHandler) {
			// Remove old change handler if applicable.
			Sys.Observer.removeCollectionChanged(this._data, this._changedHandler);
			delete this._changedHandler;
		}

		this._data = value;

		if (value instanceof Array) {
			// Watch for changes to an array.
			this._changedHandler = this._collectionChanged.bind(this);
			Sys.Observer.addCollectionChanged(value, this._changedHandler);
		}

		// Force rendering to occur if we previously had a value and now do not.
		this.update(removedData);
	},

	get_disabled: function Content$get_disabled() {
		/// <value mayBeNull="false" type="Boolean" locid="P:J#ExoWeb.UI.Content.disabled"></value>
		return this._disabled === undefined ? false : !!this._disabled;
	},
	set_disabled: function Content$set_disabled(value) {
		var newValue;

		if (value.constructor === Boolean) {
			newValue = value;
		}
		else if (value.constructor === String) {
			newValue = value.toLowerCase() == "true" ? true : (value.toLowerCase() == "false" ? false : undefined);
		}
		else {
			ExoWeb.trace.throwAndLog(["ui", "content"], "Invalid value for property \"disabled\": {0}.", [value]);
		}

		var oldValue = this._disabled;
		this._disabled = newValue;

		if (oldValue === true && newValue === false) {
			this.update();
		}
	},

	get_contexts: function Content$get_contexts() {
		/// <value mayBeNull="false" type="Array" locid="P:J#ExoWeb.UI.Content.contexts"></value>
		return [this._context];
	},

	get_templateContext: function Content$get_templateContext() {
		/// <value mayBeNull="false" type="Sys.UI.TemplateContext" locid="P:J#ExoWeb.UI.Content.templateContext"></value>
		if (!this._parentContext) {
			this._parentContext = Sys.UI.Template.findContext(this._element);
		}
		return this._parentContext;
	},
	set_templateContext: function Context$set_templateContext(value) {
		this._parentContext = value;
	},

	get_isRendered: function Context$get_isRendered() {
		/// <value mayBeNull="false" type="Boolean" locid="P:J#ExoWeb.UI.Content.isRendered"></value>
		return this._isRendered;
	},

	add_rendering: function Content$add_rendering(handler) {
		/// <summary locid="E:J#ExoWeb.UI.Content.rendering" />
		this._addHandler("rendering", handler);
	},
	remove_rendering: function Content$remove_rendering(handler) {
		this._removeHandler("rendering", handler);
	},

	add_rendered: function Content$add_rendered(handler) {
		/// <summary locid="E:J#ExoWeb.UI.Content.rendered" />
		this._addHandler("rendered", handler);
	},
	remove_rendered: function Content$remove_rendered(handler) {
		this._removeHandler("rendered", handler);
	},

	add_error: function (handler) {
		/// <summary locid="E:J#ExoWeb.UI.Content.error" />
		this._addHandler("error", handler);
	},
	remove_error: function (handler) {
		this._removeHandler("error", handler);
	},

	_collectionChanged: function (sender, args) {
		this.update(true);
	},

	_initializeResults: function Content$_initializeResults() {
		if (this._context) {
			this._context.initializeComponents();
		}
	},

	_generatesContext: function Content$_generatesContext() {
		return true;
	},
	_setTemplateCtxId: function Content$_setTemplateCtxId(idx) {
		this._ctxIdx = idx;
	},

	_findTemplate: function Content$_findTemplate() {
		/// <summary locid="M:J#ExoWeb.UI.Content._findTemplate">
		/// Find the first matching template for the content control.
		/// </summary>
		var tmplNames;
		if (this._contentTemplate) {
			tmplNames = this._contentTemplate;
		}
		if (this._template) {
			if (tmplNames) {
				tmplNames += " ";
				tmplNames += this._template;
			}
			else {
				tmplNames = this._template;
			}
		}

		var tmplEl = findTemplate(this._element.tagName.toLowerCase(), this._data, tmplNames ? tmplNames.trim().split(/\s+/) : []);

		if (!tmplEl) {
			ExoWeb.trace.throwAndLog(["ui", "templates"], "This content region does not match any available templates. Tag={0}, Data={1}, Template={2}", [this._element.tagName.toLowerCase(), this._data, tmplNames || ""]);
		}

		return tmplEl;
	},

	_canRender: function Content$_canRender(force) {
		/// <summary locid="M:J#ExoWeb.UI.Content._canRender">
		/// Ensure that the control is initialized, has an element, and the "data" property has been set.
		/// 1) The set_data method may be called before the control has been initialized.
		/// 2) If a lazy markup extension is used to set the "data" property then a callback could set the 
		/// property value when the element is undefined, possibly because of template re-rendering.
		/// 3) If a lazy markup extension is used to set the "data" property then it may not have a value when initialized.
		/// Also check that the control has not been disabled.
		/// </summary>

		return ((this._data !== undefined && this._data !== null) || force === true) &&
			this.get_isInitialized() && this._element !== undefined && this._element !== null && !this.get_disabled();
	},

	_getResultingTemplateNames: function Content$_getResultingTemplateNames(tmplEl) {
		// use sys:content-template (on content control) and content:template
		var contentTemplateNames;
		if (this._contentTemplate) {
			contentTemplateNames = this._contentTemplate;
			if (this._template) {
				contentTemplateNames += " " + this._template;
			}
		}
		else if (this._template) {
			contentTemplateNames = this._template;
		}
		else {
			contentTemplateNames = "";
		}

		var contentTemplate = contentTemplateNames.trim().split(/\s+/).distinct();

		// Remove names matched by the template
		if (contentTemplate.length > 0) {
			var tmplNames = tmplEl.control.get_nameArray();
			if (tmplNames) {
				purge(contentTemplate, function(name) {
					return tmplNames.indexOf(name) >= 0;
				});
			}
		}

		// Add sys:content-template defined on the template element
		if (tmplEl.control._contentTemplate) {
			contentTemplate.addRange(tmplEl.control._contentTemplate.trim().split(/\s+/));
		}

		return contentTemplate;
	},

	_render: function Content$_render() {
		/// <summary locid="M:J#ExoWeb.UI.Content._render">
		/// Render the content template into the container element.
		/// </summary>

		// Failing to empty content before rendering can result in invalid content since rendering 
		// content is not necessarily in order because of waiting on external templates.
		var container = this._element;

		$(container).empty();

		var parentContext = this.get_templateContext();
		this._context = null;

		var data = this._data;
		if (data !== null && data !== undefined) {
			var tmplEl = this._findTemplate();
			var template = new Sys.UI.Template(tmplEl);

			// get custom classes from template
			var classes = $(tmplEl).attr("class");
			if (classes) {
				classes = $.trim(classes.replace("exoweb-template", "").replace("sys-template", ""));
				$(container).addClass(classes);
			}

			// Get the list of template names applicable to the control's children
			var contentTemplate = this._getResultingTemplateNames(tmplEl);

			this._context = template.instantiateIn(container, this._data, this._data, 0, null, parentContext, contentTemplate.join(" "));

			this._initializeResults();
		}
	},

	_renderStart: function Content$_renderStart(force) {
		/// <summary locid="M:J#ExoWeb.UI.Content._renderStart">
		/// Start the rendering process. There may be a delay if external templates
		/// have not yet finished loading.
		/// </summary>
		if (this._canRender(force)) {
			contentControlsRendering++;

			externalTemplatesSignal.waitForAll(function () {
				if (this._element === undefined || this._element === null) {
					contentControlsRendering--;
					return;
				}

				var renderArgs = new Sys.Data.DataEventArgs(this._data);
				Sys.Observer.raiseEvent(this, "rendering", renderArgs);

				this._isRendered = false;

				if (ExoWeb.config.debug === true) {
					this._render();
					this._isRendered = true;
					Sys.Observer.raiseEvent(this, "rendered", renderArgs);
					contentControlsRendering--;
				}
				else {
					try {
						this._render();
						this._isRendered = true;
						Sys.Observer.raiseEvent(this, "rendered", renderArgs);
					}
					catch (e) {
						if (this._isRendered !== true) {
							Sys.Observer.raiseEvent(this, "error", e);
							ExoWeb.trace.logError("content", "An error occurred while rendering content: {0}", e);
						}
						else {
							throw e;
						}
					}
					finally {
						contentControlsRendering--;
					}
				}
			}, this);
		}
	},

	link: function Content$link() {
		/// <summary locid="M:J#ExoWeb.UI.Content.link" />
		externalTemplatesSignal.waitForAll(function () {
			this._isRendered = true;
			this._context = null;

			var pctx = this.get_templateContext();
			var tmplEl = this._findTemplate();

			if (!this._ctxIdx && this._element.childNodes.length > 0)
				throw new Error("A content control is attached to the node, which expects a template context id, but no id was specified.");

			var newContext = new Sys.UI.TemplateContext(this._ctxIdx);
			newContext.data = this._data;
			newContext.components = [];
			newContext.nodes = [];
			newContext.dataItem = this._data;
			newContext.index = 0;
			newContext.parentContext = pctx;
			newContext.containerElement = this._element;
			newContext.template = new Sys.UI.Template(tmplEl);
			newContext.template._ensureCompiled();

			this._context = newContext;

			// Get the list of template names applicable to the control's children
			var contentTemplate = this._getResultingTemplateNames(tmplEl);

			var element = this._element;
			Sys.Application._linkContexts(pctx, this, this._data, element, newContext, contentTemplate.join(" "));

			for (var i = 0; i < element.childNodes.length; i++) {
				newContext.nodes.push(element.childNodes[i]);
			}

			newContext._onInstantiated(null, true);
			this._initializeResults();

			ExoWeb.UI.Content.callBaseMethod(this, 'link');
		}, this);
	},

	update: function Content$update(force) {
		if (this.get_isLinkPending()) {
			this.link();
		}
		else if (this._canRender(force)) {
			this._renderStart(force);
		}
	},

	dispose: function ExoWeb$UI$Content$dispose() {
		if (this._context) {
			this._context.dispose();
		}
		if (this._changedHandler) {
			Sys.Observer.removeCollectionChanged(this._data, this._changedHandler);
			this._changedHandler = null;
		}
		this._contentTemplate = this._context = this._ctxIdx =
			this._data = this._disabled = this._isRendered = this._parentContext = this._template = null;
		ExoWeb.UI.Content.callBaseMethod(this, "dispose");
	},

	initialize: function Content$initialize() {
		/// <summary locid="M:J#ExoWeb.UI.Content.initialize" />
		Content.callBaseMethod(this, "initialize");

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
		this.update();
	}

};

ExoWeb.UI.Content = Content;
Content.registerClass("ExoWeb.UI.Content", Sys.UI.Control, Sys.UI.ITemplateContextConsumer, Sys.UI.IContentTemplateConsumer);
