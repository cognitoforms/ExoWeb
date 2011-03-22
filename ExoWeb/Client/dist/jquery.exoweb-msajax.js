
// jquery plugin for msajax helper
//////////////////////////////////////////////////
(function() {

	// #region Validation
	//////////////////////////////////////////////////

	// Get's the last object in the source path.  Ex: Customer.Address.Street returns the Address object.
	function getFinalSrcObject(binding) {
		var src = binding.get_source();

		for (var i = 0; i < binding._pathArray.length - 1; ++i) {
			src = src[binding._pathArray[i]] || src["get_" + binding._pathArray[i]]();
		}

		return src;
	}

	function getFinalPathStep(binding) {
		return binding._pathArray[binding._pathArray.length - 1];
	}

	var ensureInited = function ($el) {
		if (!window.ExoWeb) {
			return;
		}

		if ($el.attr("__validating") === undefined) {
			// register for model validation events
			var bindings = $el.liveBindings();

			for (var i = 0; i < bindings.length; i++) {
				var binding = bindings[i];
				var srcObj = getFinalSrcObject(binding);
				var propName = getFinalPathStep(binding);

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
		if (!(window.ExoWeb && ExoWeb.Model)) {
			return [];
		}

		var rules = [];
		var bindings = $(this).liveBindings();

		for (var i = 0; i < bindings.length; i++) {
			var binding = bindings[i];
			var srcObj = getFinalSrcObject(binding);

			var prop;

			if (srcObj instanceof ExoWeb.View.Adapter) {
				prop = srcObj.get_propertyChain().lastProperty();
			}
			else if (srcObj instanceof ExoWeb.View.OptionAdapter) {
				prop = srcObj.get_parent().get_propertyChain().lastProperty();
			}
			else if (srcObj instanceof ExoWeb.Model.Entity) {
				var propName = getFinalPathStep(binding);
				prop = srcObj.meta.property(propName);
			}
			else {
				continue;
			}

			var rule = prop.rule(ruleType);
			if (rule) {
				rules.push(rule);
			}
		}

		return rules;
	};

	jQuery.fn.issues = function (options) {
		var issues = [];

		options = options || { refresh: false };

		var bindings = $(this).liveBindings();

		for (var i = 0; i < bindings.length; i++) {
			var binding = bindings[i];
			var srcObj = getFinalSrcObject(binding);

			var target;
			var prop;

			// Option adapter defers to parent adapter
			if (srcObj instanceof ExoWeb.View.OptionAdapter) {
				srcObj = srcObj.get_parent();
			}

			if (srcObj instanceof ExoWeb.View.Adapter) {
				var chain = srcObj.get_propertyChain();
				prop = chain.lastProperty();
				target = chain.lastTarget(srcObj.get_target());

				// Guard against null/undefined target.  This could happen if the target is 
				// undefined, or if the path is multi-hop, and the full path is not defined.
				if (target === null || target === undefined) {
					continue;
				}
			}
			else if (srcObj instanceof ExoWeb.Model.Entity) {
				var propName = getFinalPathStep(binding);
				prop = srcObj.meta.property(propName);
				target = srcObj;
			}
			else {
				continue;
			}

			if (options.refresh)
				target.meta.executeRules(prop);

			Array.addRange(issues, target.meta.conditions({ property: prop }));
		}
		return issues;
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
			var $el = $(els[e]);

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
			var clearContainersBase = Sys.UI.DataView.prototype._clearContainers;
			Sys.UI.DataView.prototype._clearContainers = function () {
				var contexts = this.get_contexts();

				for (var i = 0; i < contexts.length; i++)
					processElements(contexts[i].nodes, "deleted");

				clearContainersBase.apply(this, arguments);
			}

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

	// #endregion

})();