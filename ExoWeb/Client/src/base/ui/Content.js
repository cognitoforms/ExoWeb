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
			ExoWeb.trace.throwAndLog(["ui", "templates"], "This content region does not match any available templates. Data={0}, Element={1}.{2}", [data, this._element.tagName, this._element.className]);
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
	add_error: function(handler) {
		this._addHandler("error", handler);
	},
	remove_error: function(handler) {
		this._removeHandler("error", handler);
	},
	get_isRendered: function() {
		return this._isRendered;
	},
	render: function Content$render(force) {
		if (this._canRender(force)) {
//					ExoWeb.trace.log(['ui', "templates"], "render({0})", [force === true ? "force" : ""]);

			contentControlsRendering++;

			externalTemplatesSignal.waitForAll(function Content$externalTemplatesSignal() {
				if (this._element === undefined || this._element === null) {
					contentControlsRendering--;
					return;
				}

//						ExoWeb.trace.log(['ui', "templates"], "render() proceeding after all templates are loaded");

				var renderArgs = new Sys.Data.DataEventArgs(this._data);
				Sys.Observer.raiseEvent(this, "rendering", renderArgs);

				this._isRendered = false;

				try {
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
