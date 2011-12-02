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
					reg.action.apply(el, [0, el]);

				// test children
				$el.find(reg.selector).each(reg.action);
			}
		}
	}
}

var interceptingTemplates = false;
var interceptingWebForms = false;
var interceptingToggle = false;
var interceptingContent = false;
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
		Sys.UI.DataView.prototype._clearContainers = function (placeholders, start, count) {
			var i, len, nodes, startNode, endNode;
			for (i = start || 0, len = count ? (start + count) : this._contexts.length; i < len; i++) {
				nodes = this._contexts[i].nodes;
				processElements(nodes, "deleted");
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
		Sys.UI.DataView.prototype._clearContainer = function (container, placeholder, startNode, endNode, suppressEvent) {
			var count = placeholder ? placeholder.__msajaxphcount : -1;
			if ((count > -1) && placeholder) placeholder.__msajaxphcount = 0;
			if (count < 0) {
				if (placeholder) {
					container.removeChild(placeholder);
				}
				if (!suppressEvent) {
					processElements(container.childNodes, "deleted");
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
					processElements([element], "deleted");
					Sys.Application.disposeElement(element, false);
					container.removeChild(element);
				}
			}
		};

		interceptingTemplates = true;
	}

	if (!interceptingWebForms && window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
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
	
	if (!interceptingToggle && window.ExoWeb && ExoWeb.UI && ExoWeb.UI.Toggle) {
		var undoRender = ExoWeb.UI.Toggle.prototype.undo_render;
		ExoWeb.UI.Toggle.prototype.undo_render = function () {
			processElements($(this._element).children().get(), "deleted");
			undoRender.apply(this, arguments);
		};

		var toggleDispose = ExoWeb.UI.Toggle.prototype.do_dispose;
		ExoWeb.UI.Toggle.prototype.do_dispose = function () {
			processElements($(this._element).children().get(), "deleted");
			toggleDispose.apply(this, arguments);
		};

		interceptingToggle = true;
	}

	if (!interceptingContent && window.ExoWeb && ExoWeb.UI && ExoWeb.UI.Content) {
		var render = ExoWeb.UI.Content.prototype.render;
		ExoWeb.UI.Content.prototype.render = function () {
			if(this._element)
				processElements($(this._element).children().get(), "deleted");
			
			render.apply(this, arguments);
		};

		interceptingContent = true;
	}
}

// matches elements as they are dynamically added to the DOM
jQuery.fn.ever = function (added, deleted) {

	// If the function is called in any way other than as a method on the 
	// jQuery object, then intercept and return early.
	if (!(this instanceof jQuery)) {
		ensureIntercepting();
		return;
	}

	// apply now
	this.each(added);

	var selector = this.selector;

	// and then watch for dom changes
	if (added) {
		var addedReg = null;
		for (var a = 0, aLen = everRegs.added.length; a < aLen; ++a) {
			var regA = everRegs.added[a];
			if (regA.selector === selector) {
				addedReg = regA;
				break;
			}
		}

		if (!addedReg) {
			addedReg = { selector: selector, action: added };
			everRegs.added.push(addedReg);
		}
		else if (addedReg.action.add) {
			addedReg.action.add(added);
		}
		else {
			var addedPrev = addedReg.action;
			addedReg.action = ExoWeb.Functor();
			addedReg.action.add(addedPrev);
			addedReg.action.add(added);
		}
	}

	if (deleted) {
		var deletedReg = null;
		for (var d = 0, dLen = everRegs.deleted.length; d < dLen; ++d) {
			var regD = everRegs.deleted[d];
			if (regD.selector === selector) {
				deletedReg = regD;
				break;
			}
		}

		if (!deletedReg) {
			deletedReg = { selector: selector, action: deleted };
			everRegs.deleted.push(deletedReg);
		}
		else if (deletedReg.action.add) {
			deletedReg.action.add(deleted);
		}
		else {
			var deletedPrev = deletedReg.action;
			deletedReg.action = ExoWeb.Functor();
			deletedReg.action.add(deletedPrev);
			deletedReg.action.add(deleted);
		}
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
