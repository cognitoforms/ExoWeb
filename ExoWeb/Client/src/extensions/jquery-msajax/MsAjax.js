jQuery.fn.control = function (propName, propValue) {
	if (arguments.length === 0) {
		return this.get(0).control;
	}
	else if (arguments.length == 1) {
		return this.get(0).control["get_" + propName]();
	}
	else {
		this.each(function (index, element) {
			this.control["set_" + propName](propValue);
		});
	}
};

jQuery.fn.commands = function (commands) {
	var control = this.control();
	control.add_command(function (sender, args) {
		var handler = commands[args.get_commandName()];
		if (handler) {
			handler(sender, args);
		}
	});
};

var everRegs = { added: [], deleted: [] };

function processElements(els, action) {
	var regs = everRegs[action];

	for (var e = 0; e < els.length; ++e) {
		var el = els[e];

		// Ingore text nodes
		if (el.nodeType && el.nodeType !== 3) {
			var $el = $(el);

			for (var i = 0; i < regs.length; ++i) {
				var reg = regs[i];

				// test root
				if ($el.is(reg.selector))
					reg.action.apply(reg.thisPtr || els[e], [0, els[e]]);

				// test children
				$(reg.selector, els[e]).each(reg.thisPtr ? reg.action.bind(reg.thisPtr) : reg.action);
			}
		}
	}
}

var interceptingTemplates = false;
var interceptingWebForms = false;
var partialPageLoadOccurred = false;

function ensureIntercepting() {
	if (!interceptingTemplates && window.Sys && Sys.UI && Sys.UI.Template) {
		var instantiateInBase = Sys.UI.Template.prototype.instantiateIn;
		Sys.UI.Template.prototype.instantiateIn = function (containerElement, data, dataItem, dataIndex, nodeToInsertTemplateBefore, parentContext) {
			var context = instantiateInBase.apply(this, arguments);

			processElements(context.nodes, "added");
			return context;
		};

		// intercept Sys.UI.DataView._clearContainers called conditionally during dispose() and refresh().
		// dispose is too late because the nodes will have been cleared out.
		Sys.UI.DataView.prototype._clearContainers = function (placeholders) {
			var i, l;
			for (i = 0, l = this._contexts.length; i < l; i++) {
				processElements(this._contexts[i].nodes, "deleted");
			}
			for (i = 0, l = placeholders.length; i < l; i++) {
				var ph = placeholders[i],
				container = ph ? ph.parentNode : this.get_element();
				this._clearContainer(container, ph, true);
			}
			for (i = 0, l = this._contexts.length; i < l; i++) {
				var ctx = this._contexts[i];
				ctx.nodes = null;
				ctx.dispose();
			}
		};
		Sys.UI.DataView.prototype._clearContainer = function (container, placeholder, suppressEvent) {
			var count = placeholder ? placeholder.__msajaxphcount : -1;
			if ((count > -1) && placeholder) placeholder.__msajaxphcount = 0;
			if (count < 0) {
				if (placeholder) {
					container.removeChild(placeholder);
				}
				if (!suppressEvent) {
					processElements([container], "deleted");
				}
				Sys.Application.disposeElement(container, true);
				try {
					container.innerHTML = "";
				}
				catch (err) {
					var child;
					while ((child = container.firstChild)) {
						container.removeChild(child);
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
					processElements([element], "deleted");
					Sys.Application.disposeElement(element, false);
					container.removeChild(element);
				}
			}
		};

		interceptingTemplates = true;
	}

	if (!interceptingWebForms && window.Sys && Sys.WebForms) {
		Sys.WebForms.PageRequestManager.getInstance().add_pageLoading(function (sender, evt) {
			partialPageLoadOccurred = true;
			processElements(evt.get_panelsUpdating(), "deleted");
		});

		Sys.WebForms.PageRequestManager.getInstance().add_pageLoaded(function (sender, evt) {
			// Only process elements for update panels that were added if we have actually done a partial update.
			// This is needed so that the "ever" handler is not called twice when a panel is added to the page on first page load.
			if (partialPageLoadOccurred) {
				processElements(evt.get_panelsCreated(), "added");
			}

			processElements(evt.get_panelsUpdated(), "added");
		});
		interceptingWebForms = true;
	}
}

// matches elements as they are dynamically added to the DOM
jQuery.fn.ever = function (added, deleted, thisPtr) {
	// If the function is called in any way other than as a method on the 
	// jQuery object, then intercept and return early.
	if (!(this instanceof jQuery)) {
		ensureIntercepting();
		return;
	}

	// apply now
	this.each(thisPtr ? added.bind(thisPtr) : added);

	// and then watch for dom changes
	if (added) {
		everRegs.added.push({
			selector: this.selector,
			action: added,
			thisPtr: thisPtr
		});
	}

	if (deleted) {
		everRegs.deleted.push({
			selector: this.selector,
			action: deleted,
			thisPtr: thisPtr
		});
	}

	ensureIntercepting();

	// really shouldn't chain calls b/c only elements
	// currently in the DOM would be affected.
	return null;
};

// Gets all Sys.Bindings for an element
jQuery.fn.liveBindings = function () {
	var bindings = [];
	this.each(function () {
		if (this.__msajaxbindings)
			Array.addRange(bindings, this.__msajaxbindings);
	});

	return bindings;
};
