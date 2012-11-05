// Cache lists of ever handlers by type
var everHandlers = { added: [], deleted: [], bound: [], unbound: [] };

var processElements = function processElements(container, els, action, source) {
	// Determine if the input is an array
	var isArr = Object.prototype.toString.call(els) === "[object Array]",

		// The number of elements to process
		numEls = isArr ? els.length : 1,

		// Cache of handlers for the action in question
		actionHandlers,

		// The number of unfiltered handlers
		numActionHandlers,

		// Handlers that are applicable to this call
		handlers,

		// The number of cached handlers
		numHandlers,

		// Determines whether to search children for matches
		doSearch,

		// Element iteration index variable
		i = 0,

		// Element iteration item variable
		el,

		// Optimization: cache the jQuery object for the element
		$el,

		// Handler iteration index variable
		j,

		// Handler iteration item variable
		handler;

	if (numEls === 0) {
		return;
	}

	actionHandlers = everHandlers[action];

	// Filter based on source and context
	i = -1;
	numActionHandlers = actionHandlers.length;
	handlers = [];
	while (++i < numActionHandlers) {
		handler = actionHandlers[i];

		// If a handler source is specified then filter by the source
		if (handler.source && handler.source !== source) {
			continue;
		}

		// If a handler context is specified then see if it contains the given container, or equals if children were passed in
		if (handler.context && !((isArr && handler.context === container) || jQuery.contains(handler.context, container))) {
			continue;
		}

		handlers.push(handler);
	}

	numHandlers = handlers.length;

	if (numHandlers === 0) {
		return;
	}

	// Only perform descendent search for added/deleted actions, since this
	// doesn't make sense for bound/unbound, which are specific to an element.
	doSearch = action === "added" || action === "deleted";

	i = -1;
	while (++i < numEls) {
		el = isArr ? els[i] : els;

		// Only process elements
		if (el.nodeType === 1) {
			j = 0;
			$el = jQuery(el);

			while (j < numHandlers) {
				handler = handlers[j++];

				// Test root
				if ($el.is(handler.selector)) {
					handler.action.apply(el, [0, el]);
				}

				if (doSearch && el.children.length > 0) {
					// Test children
					$el.find(handler.selector).each(handler.action);
				}
			}
		}
	}
};

var interceptingBound = false;
var interceptingTemplates = false;
var interceptingWebForms = false;
var interceptingToggle = false;
var interceptingContent = false;
var partialPageLoadOccurred = false;

function ensureIntercepting() {
	if (!interceptingBound && window.Sys && Sys.Binding && Sys.UI && Sys.UI.TemplateContext) {
		var addBinding = Sys.Binding.prototype._addBinding;
		if (!addBinding) {
			throw new Error("Could not find Binding._addBinding method to override.");
		}
		Sys.Binding.prototype._addBinding = function addBinding$wrap(element) {
			addBinding.apply(this, arguments);
			var ctx = this._templateContext;
			if (ctx._completed && ctx._completed.length > 0) {
				ctx.add_instantiated(function addBinding$contextInstantiated() {
					processElements(element, element, "bound");
				});
			}
			else {
				processElements(element, element, "bound");
			}
		};
		var disposeBindings = Sys.Binding._disposeBindings;
		if (!disposeBindings) {
			throw new Error("Could not find Binding._disposeBindings method to override.");
		}
		Sys.Binding._disposeBindings = function disposeBindings$wrap() {
			disposeBindings.apply(this, arguments);
			processElements(this, this, "unbound");
		};
		interceptingBound = true;
	}

	if (!interceptingTemplates && window.Sys && Sys.UI && Sys.UI.Template) {
		var instantiateInBase = Sys.UI.Template.prototype.instantiateIn;
		if (!instantiateInBase) {
			throw new Error("Could not find Template.instantiateIn method to override.");
		}
		Sys.UI.Template.prototype.instantiateIn = function instantiateIn$wrap() {
			var context = instantiateInBase.apply(this, arguments);
			if (context.nodes.length > 0) {
				processElements(context.containerElement, context.nodes, "added", "template");
			}
			return context;
		};
		// intercept Sys.UI.DataView._clearContainers called conditionally during dispose() and refresh().
		// dispose is too late because the nodes will have been cleared out.
		Sys.UI.DataView.prototype._clearContainers = function _clearContainers$override(placeholders, start, count) {
			var i, len, nodes, startNode, endNode, context;
			for (i = start || 0, len = count ? (start + count) : this._contexts.length; i < len; i++) {
				context = this._contexts[i];
				nodes = context.nodes;
				if (nodes.length > 0) {
					processElements(context.containerElement, nodes, "deleted", "template");
				}
				if (count) {
					if (!startNode) {
						startNode = nodes[0];
					}
					if (nodes.length > 0) {
						endNode = nodes[nodes.length - 1];
					}
				}
			}
			for (i = 0, len = placeholders.length; i < len; i++) {
				var ph = placeholders[i],
					container = ph ? ph.parentNode : this.get_element();
				if (!count || (startNode && endNode)) {
					this._clearContainer(container, ph, startNode, endNode, true);
				}
			}
			for (i = start || 0, len = count ? (start + count) : this._contexts.length; i < len; i++) {
				var ctx = this._contexts[i];
				ctx.nodes = null;
				ctx.dispose();
			}
		};
		Sys.UI.DataView.prototype._clearContainer = function _clearContainer$override(container, placeholder, startNode, endNode, suppressEvent) {
			var count = placeholder ? placeholder.__msajaxphcount : -1;
			if ((count > -1) && placeholder) placeholder.__msajaxphcount = 0;
			if (count < 0) {
				if (placeholder) {
					container.removeChild(placeholder);
				}
				if (!suppressEvent) {
					if (container.childNodes.length > 0) {
						processElements(container, container.childNodes, "deleted", "template");
					}
				}
				if (!startNode) {
					Sys.Application.disposeElement(container, true);
				}
				var cleared = false;
				if (!startNode) {
					try {
						container.innerHTML = "";
						cleared = true;
					}
					catch (err) { }
				}
				if (!cleared) {
					var child = startNode || container.firstChild, nextChild;
					while (child) {
						nextChild = child === endNode ? null : child.nextSibling;
						Sys.Application.disposeElement(child, false);
						container.removeChild(child);
						child = nextChild;
					}
				}
				if (placeholder) {
					container.appendChild(placeholder);
				}
			}
			else if (count > 0) {
				var i, l, start, children = container.childNodes;
				for (i = 0, l = children.length; i < l; i++) {
					if (children[i] === placeholder) {
						break;
					}
				}
				start = i - count;
				for (i = 0; i < count; i++) {
					var element = children[start];
					processElements(element, element, "deleted", "template");
					Sys.Application.disposeElement(element, false);
					container.removeChild(element);
				}
			}
		};
		interceptingTemplates = true;
	}

	if (!interceptingWebForms && window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
		Sys.WebForms.PageRequestManager.getInstance().add_pageLoading(function PageRequestManager$ever_deleted(sender, evt) {
			partialPageLoadOccurred = true;
			var updating = evt.get_panelsUpdating();
			if (updating.length > 0) {
				processElements(null, updating, "deleted", "updatePanel");
			}
		});
		Sys.WebForms.PageRequestManager.getInstance().add_pageLoaded(function PageRequestManager$ever_added(sender, evt) {
			// Only process elements for update panels that were added if we have actually done a partial update.
			// This is needed so that the "ever" handler is not called twice when a panel is added to the page on first page load.
			if (partialPageLoadOccurred) {
				var created = evt.get_panelsCreated();
				if (created.length > 0) {
					processElements(null, created, "added", "updatePanel");
				}
			}

			var updated = evt.get_panelsUpdated();
			if (updated.length > 0) {
				processElements(null, updated, "added", "updatePanel");
			}
		});
		interceptingWebForms = true;
	}

	if (!interceptingToggle && window.ExoWeb && ExoWeb.UI && ExoWeb.UI.Toggle) {
		var undoRender = ExoWeb.UI.Toggle.prototype.undo_render;
		if (!undoRender) {
			throw new Error("Could not find Toggle.undo_render method to override.");
		}
		ExoWeb.UI.Toggle.prototype.undo_render = function Toggle$undo_render$wrap() {
			var children = this._element.children;
			if (children.length > 0) {
				processElements(this._element, children, "deleted", "template");
			}
			undoRender.apply(this, arguments);
		};
		var toggleDispose = ExoWeb.UI.Toggle.prototype.do_dispose;
		if (!toggleDispose) {
			throw new Error("Could not find Toggle.do_dispose method to override.");
		}
		ExoWeb.UI.Toggle.prototype.do_dispose = function Toggle$do_dispose$wrap() {
			var children = this._element.children;
			if (children.length > 0) {
				processElements(this._element, children, "deleted", "template");
			}
			toggleDispose.apply(this, arguments);
		};
		interceptingToggle = true;
	}

	if (!interceptingContent && window.ExoWeb && ExoWeb.UI && ExoWeb.UI.Content) {
		var _render = ExoWeb.UI.Content.prototype._render;
		if (!_render) {
			throw new Error("Could not find Content._render method to override.");
		}
		ExoWeb.UI.Content.prototype._render = function Content$_render$wrap() {
			if (this._element) {
				var children = this._element.children;
				if (children.length > 0) {
					processElements(this._element, children, "deleted", "template");
				}
			}
			_render.apply(this, arguments);
		};
		interceptingContent = true;
	}
}

var rootContext = jQuery("body").context;

var addEverHandler = function addEverHandler(context, selector, type, source, action) {
	var handlers, i, len, handler, existingHandler, existingFn;
	i = 0;
	handlers = everHandlers[type];
	len = handlers.length;
	while (i < len) {
		existingHandler = handlers[i++];
		if (existingHandler.context === context && existingHandler.source === source && existingHandler.selector === selector) {
			handler = existingHandler;
			break;
		}
	}
	if (!handler) {
		handler = { selector: selector, action: action };
		if (context) {
			handler.context = context;
		}
		handlers.push(handler);
	}
	else if (handler.action.add) {
		handler.action.add(action);
	}
	else {
		existingFn = handler.action;
		if (window.ExoWeb) {
			handler.action = ExoWeb.Functor();
			handler.action.add(existingFn);
			handler.action.add(action);
		}
		else {
			handler.action = function() {
				existingFn.apply(this, arguments);
				action.apply(this, arguments);
			};
		}
	}
};

// Matches elements as they are dynamically added to the DOM
jQuery.fn.ever = function jQuery$ever(opts) {

	// The non-selector context that was passed into this jQuery object
	var queryContext,

		// The selector that was specified on the query
		querySelector = this.selector,

		// The jQuery objects that the action may be immediately performed for
		boundImmediate,
		addedImmediate,

		// The options the will be used to add handlers
		options;

	// Optimization: only make a record of the context if it's not the root context
	if (this.context !== rootContext) {
		queryContext = this.context;
	}

	// Handle legacy form
	if (typeof (opts) === "function") {
		addedImmediate = this;
		options = {
			context: queryContext,
			selector: querySelector,
			added: opts,
			deleted: arguments[1]
		};
	}
	// Use options argument directly
	else {
		options = opts;
		// Detect non-supported options
		if (window.ExoWeb) {
			for (var opt in options) {
				if (options.hasOwnProperty(opt) && !/^(selector|source|added|deleted|bound|unbound)$/.test(opt)) {
					logWarning("Unexpected option \"" + opt + "\"");
				}
			}
		}
		// Set the context if it was specified
		if (queryContext) {
			options.context = queryContext;
		}
		// Filter the immediate object if it will be used to invoke immediately (added/bound)
		if (options.added) {
			addedImmediate = this;
			if (options.selector) {
				addedImmediate = addedImmediate.find(options.selector);
			}
		}
		if (options.bound) {
			boundImmediate = this;
			if (options.selector) {
				boundImmediate = boundImmediate.find(options.selector);
			}
			boundImmediate = boundImmediate.filter(":bound");
		}
		// Merge the query selector with the options selector
		if (querySelector) {
			if (options.selector) {
				options.selector = querySelector.replace(/,/g, " " + options.selector + ",") + " " + options.selector;
			}
			else {
				options.selector = querySelector;
			}
		}
		else if (!options.selector) {
			throw new Error("Ever requires a selector");
		}
		if (window.ExoWeb && options.source) {
			if (!(options.added || options.deleted)) {
				logWarning("The source option only applies to added and deleted handlers");
			}
			if (options.source !== "template" && options.source !== "updatePanel") {
				logWarning("Unexpected source \"" + options.source + "\"");
			}
		}
	}

	// Add ever handlers
	if (options.added) {
		if (addedImmediate.length > 0) {
			addedImmediate.each(options.added);
		}
		addEverHandler(options.context, options.selector, "added", options.source, options.added);
	}
	if (options.deleted) {
		addEverHandler(options.context, options.selector, "deleted", options.source, options.deleted);
	}
	if (options.bound) {
		if (boundImmediate.length > 0) {
			boundImmediate.each(options.bound);
		}
		addEverHandler(options.context, options.selector, "bound", options.source, options.bound);
	}
	if (options.unbound) {
		addEverHandler(options.context, options.selector, "unbound", options.source, options.unbound);
	}

	// Ensure that code is being overriden to call ever handlers where appropriate
	ensureIntercepting();

	// Really shouldn't chain calls b/c only elements currently in the DOM would be affected
	return null;
};
