function Toggle(element) {

	// Default action is show
	this._action = "show";

	Toggle.initializeBase(this, [element]);

}

var Toggle_allowedActions = ["show", "hide", "enable", "disable", "render", "dispose", "addClass", "removeClass"];

// Actions
Toggle.mixin({
	// Show/Hide
	//////////////////////////////////////////////////////////
	do_show: function Toggle$do_show() {
		$(this.get_element()).show();
		this.set_state("on");

		// visibility has changed so raise event
		if (this._visible === undefined || this._visible === false) {
			Sys.Observer.raiseEvent(this, "shown");
		}

		this._visible = true;
	},
	do_hide: function Toggle$do_hide() {
		$(this.get_element()).hide();
		this.set_state("off");

		// visibility has changed so raise event
		if (this._visible === undefined || this._visible === true) {
			Sys.Observer.raiseEvent(this, "hidden");
		}

		this._visible = false;
	},
	add_on: function Toggle$add_on(handler) {
		this._addHandler("on", handler);
	},
	remove_on: function Toggle$remove_on(handler) {
		this._removeHandler("on", handler);
	},
	add_off: function Toggle$add_off(handler) {
		this._addHandler("off", handler);
	},
	remove_off: function Toggle$remove_off(handler) {
		this._removeHandler("off", handler);
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
		this.set_state("on");
	},
	do_disable: function Toggle$do_disable() {
		$("select,input,textarea,a,button,optgroup,option", this.get_element()).andSelf().attr("disabled", "disabled");
		this.set_state("off");
	},

	// Render/Destroy
	//////////////////////////////////////////////////////////
	link_render: function Toggle$link_render() {
		this._context = null;

		if ((this._action === "render" && $(this._element).is(".toggle-on")) || (this._action === "dispose" && $(this._element).is(".toggle-off"))) {
			var pctx = this.get_templateContext();

			if (!this._ctxIdx && this._element.childNodes.length > 0)
				throw new Error("A toggle control is attached to the node, which expects a template context id, but no id was specified.");

			var newContext = new Sys.UI.TemplateContext(this._ctxIdx);
			newContext.data = pctx.dataItem;
			newContext.components = [];
			newContext.nodes = [];
			newContext.dataItem = pctx.dataItem;
			newContext.index = 0;
			newContext.parentContext = pctx;
			newContext.containerElement = this.get_element();
			newContext.template = this._getTemplate();
			newContext.template._ensureCompiled();
			this._context = newContext;

			Sys.Application._linkContexts(pctx, this, pctx.dataItem, this.get_element(), newContext, this._contentTemplate);

			newContext.initializeComponents();
			newContext._onInstantiated(null, true);
		}
	},
	init_render: function Toggle$init_render() {
		if (!this._template && !$(this._element).is(".sys-template")) {
			ExoWeb.trace.throwAndLog(["ui", "toggle"], "When using toggle in render/dispose mode, the element should be marked with the \"sys-template\" class.");
		}

		this._template = new Sys.UI.Template(this._element);
		this._template._ensureCompiled();
		$(this._element).empty();
		$(this._element).removeClass("sys-template");
	},
	do_render: function Toggle$do_render() {
		var pctx = this.get_templateContext();

		var renderArgs = new Sys.Data.DataEventArgs(pctx.dataItem);
		Sys.Observer.raiseEvent(this, "rendering", renderArgs);

		this.set_state("on");
		$(this._element).empty();
		$(this.get_element()).show();

		var context = this._context = this._template.instantiateIn(this._element, pctx.dataItem, pctx.dataItem, 0, null, pctx, this._contentTemplate);
		context.initializeComponents();

		Sys.Observer.raiseEvent(this, "rendered", renderArgs);
	},
	do_dispose: function Toggle$do_dispose() {
		var renderArgs = new Sys.Data.DataEventArgs();
		Sys.Observer.raiseEvent(this, "rendering", renderArgs);

		this.set_state("off");
		$(this._element).empty();
		$(this.get_element()).hide();

		Sys.Observer.raiseEvent(this, "rendered", renderArgs);
	},
	add_rendering: function (handler) {
		this._addHandler("rendering", handler);
	},
	remove_rendering: function (handler) {
		this._removeHandler("rendering", handler);
	},
	add_rendered: function (handler) {
		this._addHandler("rendered", handler);
	},
	remove_rendered: function (handler) {
		this._removeHandler("rendered", handler);
	},

	// addClass / removeClass
	//////////////////////////////////////////////////////////
	do_addClass: function Toggle$do_addClass() {
		var $el = $(this.get_element());
		
		if(!$el.is("."+this._class)) {
			$el.addClass(this._class);
			this.set_state("on");
			Sys.Observer.raiseEvent(this, "classAdded");
		}
	},
	do_removeClass: function Toggle$do_removeClass() {
		var $el = $(this.get_element());
		
		if($el.is("."+this._class)) {
			$el.removeClass(this._class);
			this.set_state("off");
			Sys.Observer.raiseEvent(this, "classRemoved");
		}
	},
	add_classAdded: function Toggle$add_classAdded(handler) {
		this._addHandler("classAdded", handler);
	},
	remove_classAdded: function Toggle$remove_classAdded(handler) {
		this._removeHandler("classAdded", handler);
	},
	add_classRemoved: function Toggle$add_classRemoved(handler) {
		this._addHandler("classRemoved", handler);
	},
	remove_classRemoved: function Toggle$remove_classRemoved(handler) {
		this._removeHandler("classRemoved", handler);
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
	link_dispose: Toggle.prototype.link_render,
	init_dispose: Toggle.prototype.init_render,
	undo_render: Toggle.prototype.do_dispose,
	undo_dispose: Toggle.prototype.do_render,

	// addClass/removeClass
	//////////////////////////////////////////////////////////
	undo_addClass: Toggle.prototype.do_removeClass,
	undo_removeClass: Toggle.prototype.do_addClass
});

Toggle.mixin({
	_generatesContext: function Toggle$_generatesContext() {
		return this._action === "render" || this._action === "dispose";
	},
	_getTemplate: function Toggle$_getTemplate() {
		return this._template;
	},
	_setTemplate: function Toggle$_setTemplate(value) {
		this._template = value;
	},
	_setTemplateCtxId: function Toggle$_setTemplateCtxId(idx) {
		this._ctxIdx = idx;
	},

	get_templateContext: function Content$get_templateContext() {
		/// <value mayBeNull="false" type="Sys.UI.TemplateContext" locid="P:J#ExoWeb.UI.Toggle.templateContext"></value>
		if (!this._parentContext) {
			this._parentContext = Sys.UI.Template.findContext(this._element);
		}
		return this._parentContext;
	},
	set_templateContext: function Context$set_templateContext(value) {
		this._parentContext = value;
	},

	get_action: function Toggle$get_action() {
		/// <summary>
		/// The value that determines what the control should
		/// do when its state changes. Ignored if the class property is set
		/// Options:  show, hide, enable, disable, render, dispose, addClass, removeClass
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

	get_class: function Toggle$get_class() {
		/// <summary>
		/// Class to add or remove
		/// </summary>

		return this._class;
	},
	set_class: function Toggle$set_class(value) {
		this._class = value;
		if (!this._action)
			this._action = "addClass";
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
				this._collectionChangedHandler = this.execute.bind(this);
				Sys.Observer.addCollectionChanged(this._on, this._collectionChangedHandler);
			}

			this.execute();
		}
		else if (this._when && this._when instanceof Function) {
			this._on = value;
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

	set_strictMode: function Toggle$set_strictMode(value) {
		/// <summary>
		/// If true, the "on" value will be strictly compared
		/// to the "when" value.  Otherwise, if "when" is undefined
		/// the "on" value will be checked for truthiness.
		/// </summary>

		this._strictMode = value;
	},
	get_strictMode: function Toggle$get_strictMode() {
		return this._strictMode;
	},

	get_groupName: function Toggle$get_groupName() {
		return this._groupName;
	},
	set_groupName: function Toggle$set_groupName(value) {
		this._groupName = value;
	},

	get_state: function Toggle$get_state() {
		return this._state;
	},
	set_state: function Toggle$set_state(value) {
		this._state = value;
		this._stateClass(value);
		Sys.Observer.raiseEvent(this, value);
	},

	get_equals: function Toggle$get_equals() {
		if (this._when === undefined) {
			// When is not defined, so condition depends entirely on "on" property
			var onType = Object.prototype.toString.call(this._on);

			if (this.get_strictMode() === true) {
				if (this._on.constructor !== Boolean)
					ExoWeb.trace.throwAndLog("ui", "With strict mode enabled, toggle:on should be a value of type Boolean.");

				return this._on;
			}
			else if (onType === "[object Array]") {
				return this._on.length > 0;
			}
			else {
				// Default case when not in strict mode is truthiness.
				return !!this._on;
			}
		}
		else if (this._when instanceof Function) {
			var result = this._when(this._on);
			if (this.get_strictMode() === true) {
				if (result === null || result === undefined || result.constructor !== Boolean)
					ExoWeb.trace.throwAndLog("ui", "With strict mode enabled, toggle:when function should return a value of type Boolean.");
				return result;
			}
			else {
				return !!result;
			}
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
	addContentTemplate: function Toggle$addContentTemplate(tmpl) {
		if (this._action !== "render" && this._action !== "dispose" && this.get_templateContext() === Sys.Application._context) {
			throw Error.invalidOperation("invalidSysContentTemplate");
		}
		Sys.UI.IContentTemplateConsumer.prototype.addContentTemplate.apply(this, arguments);
	},
	initialize: function Toggle$initialize() {
		Toggle.callBaseMethod(this, "initialize");

		if (this.get_isLinkPending()) {
			// Perform custom init logic for the action
			var actionLink = this["link_" + this._action];
			if (actionLink) {
				actionLink.call(this);
			}
		}
		else {
			// Perform custom init logic for the action
			var actionInit = this["init_" + this._action];
			if (actionInit) {
				actionInit.call(this);
			}
	
			this.execute();
		}
	},
	_stateClass: function(state)
	{
		if(state == "on")
			$(this.get_element()).addClass("toggle-on").removeClass("toggle-off");
		else
			$(this.get_element()).removeClass("toggle-on").addClass("toggle-off");
	}
});

ExoWeb.UI.Toggle = Toggle;
Toggle.registerClass("ExoWeb.UI.Toggle", Sys.UI.Control, Sys.UI.ITemplateContextConsumer, Sys.UI.IContentTemplateConsumer);
