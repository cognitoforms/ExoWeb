
// jquery plugin for msajax helper
//////////////////////////////////////////////////
(function() {

	// #region Validation
	//////////////////////////////////////////////////

	var ensureInited = function ($el) {
		if (!window.ExoWeb) {
			return;
		}

		if ($el.attr("__validating") === undefined) {
			// register for model validation events
			var bindings = $el.liveBindings();

			for (var i = 0; i < bindings.length; i++) {
				var binding = bindings[i];
				var srcObj = ExoWeb.View.getFinalSrcObject(binding);
				var propName = ExoWeb.View.getFinalPathStep(binding);

				var meta = srcObj.meta || srcObj;

				if (meta && meta.addPropertyValidating) {
					// wire up validating/validated events
					meta.addPropertyValidating(propName, function (sender, issues) {
						$el.trigger('validating');
					});
				}

				if (meta && meta.addPropertyValidated) {
					meta.addPropertyValidated(propName, function (sender, issues) {
						$el.trigger("validated", [issues]);
					});
				}
			}

			// don't double register for events
			$el.attr("__validating", true);
		}
	};

	jQuery.fn.validated = function (f) {
		this.each(function () {
			$(this).bind('validated', f);
			ensureInited($(this));
		});

		return this;
	};

	jQuery.fn.validating = function (f) {
		this.each(function () {
			$(this).bind("validating", f);
			ensureInited($(this));
		});

		return this;
	};

	// Gets all model rules associated with the property an element is bound to
	jQuery.fn.rules = function (ruleType) {
		if (!window.Sys || !window.ExoWeb || !ExoWeb.Model) return [];

		return $(this).liveBindings()
			.map(function(binding) {
				return ExoWeb.View.getBindingInfo(binding);
			}).filter(function(info) {
				return !!info.property;
			}).map(function(info) {
				return info.property.rule(ruleType);
			});
	};

	jQuery.fn.issues = function (options) {
		if (!window.Sys || !window.ExoWeb || !ExoWeb.Model) return [];

		options = options || { refresh: false };

		return $(this).liveBindings().mapToArray(function(binding) {
			var info = ExoWeb.View.getBindingInfo(binding);
		
			// Guard against null/undefined target.  This could happen if the target is 
			// undefined, or if the path is multi-hop, and the full path is not defined.
			if (!info.target || !info.property) return [];

			if (options.refresh)
				info.target.meta.executeRules(info.property);
			else if (options.ensure)
				info.target.meta.ensureValidation(info.property);

			return info.target.meta.conditions({ property: info.property });
		});
	};

	// #endregion

	// #region Selectors
	//////////////////////////////////////////////////

	var exoWebAndModel = false;

	jQuery.expr[":"].rule = function (obj, index, meta, stack) {
		if (exoWebAndModel === false) {
			if (!(window.ExoWeb && ExoWeb.Model))
				return false;
			exoWebAndModel = true;
		}

		var ruleName = meta[3];
		var ruleType = ExoWeb.Model.Rule[ruleName];

		if (!ruleType) {
			ExoWeb.trace.throwAndLog(["ui", "jquery"], "Unknown rule in selector: " + ruleName);
		}

		return $(obj).rules(ruleType).length > 0;
	};

	jQuery.expr[":"].bound = function (obj, index, meta, stack) {
		if (exoWebAndModel === false) {
			if (!(window.ExoWeb && ExoWeb.Model))
				return false;
			exoWebAndModel = true;
		}

		return $(obj).liveBindings().length > 0;
	};

	//////////////////////////////////////////////////////////////////////////////////////
	// helpers for working with controls
	var dataviewPrereqs = false;
	jQuery.expr[":"].dataview = function (obj, index, meta, stack) {
		if (dataviewPrereqs === false) {
			if (!(window.Sys !== undefined && Sys.UI !== undefined && obj.control !== undefined && Sys.UI.DataView !== undefined))
				return false;
			dataviewPrereqs = true;
		}

		return obj.control instanceof Sys.UI.DataView;
	};

	var contentPrereqs = false;
	jQuery.expr[":"].content = function (obj, index, meta, stack) {
		if (contentPrereqs === false) {
			if (!(window.ExoWeb !== undefined && ExoWeb.UI !== undefined && obj.control !== undefined && ExoWeb.UI.Content !== undefined && obj.control))
				return false;

			contentPrereqs = true;
		}

		return obj.control instanceof ExoWeb.UI.Content;
	};

	var togglePrereqs = false;
	jQuery.expr[":"].toggle = function (obj, index, meta, stack) {
		if (togglePrereqs === false) {
			if (!(window.ExoWeb !== undefined && ExoWeb.UI !== undefined && obj.control !== undefined && ExoWeb.UI.Toggle !== undefined && obj.control))
				return false;

			togglePrereqs = true;
		}

		return obj.control instanceof ExoWeb.UI.Toggle;
	};

	jQuery.expr[":"].control = function (obj, index, meta, stack) {
		var typeName = meta[3];
		var jstype = new Function("{return " + typeName + ";}");

		return obj.control instanceof jstype();
	};

	// #endregion

	// #region MsAjax
	//////////////////////////////////////////////////

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
						processElements(container.childNodes, "deleted");
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

	// #endregion

})();