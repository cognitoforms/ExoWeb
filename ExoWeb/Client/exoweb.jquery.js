
(function() {
	var undefined;

	function execute() {

		//////////////////////////////////////////////////////////////////////////////////////
		// validation events
		var ensureInited = function($el) {
			if (!window.ExoWeb) {
				return;
			}

			if ($el.attr("__validating") === undefined) {
				// register for model validation events
				var bindings = $el.liveBindings();

				for (var i = 0; i < bindings.length; i++) {
					var binding = bindings[i];
					var srcObj = Sys_Binding_getFinalSourceObject(binding);
					var propName = Sys_Binding_getFinalPath(binding);

					var meta = srcObj.meta || srcObj;

					if (meta && meta.addPropertyValidating) {
						// wire up validating/validated events
						meta.addPropertyValidating(propName, function(sender, issues) {
							$el.trigger('validating');
						});
					}

					if (meta && meta.addPropertyValidated) {
						meta.addPropertyValidated(propName, function(sender, issues) {
							$el.trigger("validated", [issues]);
						});
					}
				}

				// don't double register for events
				$el.attr("__validating", true);
			}
		};

		jQuery.fn.validated = function(f) {
			this.each(function() {
				$(this).bind('validated', f);
				ensureInited($(this));
			});

			return this;
		};

		jQuery.fn.validating = function(f) {
			this.each(function() {
				$(this).bind("validating", f);
				ensureInited($(this));
			});

			return this;
		};

		//////////////////////////////////////////////////////////////////////////////////////
		// rendering events
		jQuery.fn.rendering = function(f, onlyRaiseOnTarget) {
			$(this).each(function() {
				var target = this;
				$(this).bind("rendering", function(evt) {
					if (!onlyRaiseOnTarget || evt.target == target) {
						f.apply(this, arguments);
					}
				});
			});
			return this;
		};

		jQuery.fn.rendered = function(f, onlyRaiseOnTarget) {
			$(this).each(function() {
				var target = this;
				$(this).bind("rendered", function(evt) {
					if (!onlyRaiseOnTarget || evt.target == target) {
						f.apply(this, arguments);
					}
				});
			});
			return this;
		};

		//////////////////////////////////////////////////////////////////////////////////////
		// selectors for rules
		jQuery.expr[":"].rule = function(obj, index, meta, stack) {
			if (!window.ExoWeb) {
				return false;
			}

			var ruleName = meta[3];
			var ruleType = ExoWeb.Model.Rule[ruleName];

			if (!ruleType) {
				ExoWeb.trace.throwAndLog(["ui", "jquery"], "Unknown rule in selector: " + ruleName);
			}

			return $(obj).rules(ruleType).length > 0;
		};

		jQuery.expr[":"].bound = function(obj, index, meta, stack) {
			if (!(window.ExoWeb && ExoWeb.Model)) {
				return false;
			}
			return $(obj).liveBindings().length > 0;
		};

		//////////////////////////////////////////////////////////////////////////////////////
		// helpers for working with ms ajax controls

		jQuery.expr[":"].dataview = function(obj, index, meta, stack) {
			return obj.control instanceof Sys.UI.DataView;
		};

		jQuery.expr[":"].control = function(obj, index, meta, stack) {
			var typeName = meta[3];
			var jstype = new Function("{return " + typeName + ";}");

			return obj.control instanceof jstype;
		};

		jQuery.fn.control = function(propName, propValue) {
			if (arguments.length === 0) {
				return this.get(0).control;
			}
			else if (arguments.length == 1) {
				return this.get(0).control["get_" + propName]();
			}
			else {
				this.each(function(element) {
					element.control["set_" + propName](propValue);
					return this;
				});
			}
		};

		jQuery.fn.commands = function(commands) {
			var control = this.control();
			control.add_command(function(sender, args) {
				var handler = commands[args.get_commandName()];
				if (handler) {
					handler(sender, args);
				}
			});
		};

		//////////////////////////////////////////////////////////////////////////////////////
		// helpers for MS AJAX and model integration
		var everRegs = [];

		function processElements(els, action) {
			for (var e = 0; e < els.length; ++e) {
				var el = els[e];

				for (var i = 0; i < everRegs.length; ++i) {
					var reg = everRegs[i];

					var handler = reg[action];

					if (!handler) {
						continue;
					}

					// test root
					if ($(el).is(reg.selector)) {
						handler.apply(el);
					}

					// test children
					$(reg.selector, el).each(handler);
				}
			}
		}


		var interceptingTemplates = false;
		var interceptingWebForms = false;

		function ensureIntercepting() {
			if (!interceptingTemplates && window.Sys && Sys.UI && Sys.UI.Template) {
				var instantiateInBase = Sys.UI.Template.prototype.instantiateIn;
				Sys.UI.Template.prototype.instantiateIn = function(containerElement, data, dataItem, dataIndex, nodeToInsertTemplateBefore, parentContext) {
					var ret = instantiateInBase.apply(this, arguments);

					processElements(ret.nodes, "added");
					return ret;
				};
				interceptingTemplates = true;
			}

			if (!interceptingWebForms && window.Sys && Sys.WebForms) {
				Sys.WebForms.PageRequestManager.getInstance().add_pageLoading(function(sender, evt) {
					processElements(evt.get_panelsUpdating(), "deleted");
				});

				Sys.WebForms.PageRequestManager.getInstance().add_pageLoaded(function(sender, evt) {
					processElements(evt.get_panelsCreated(), "added");
					processElements(evt.get_panelsUpdated(), "added");
				});
				interceptingWebForms = true;
			}
		}

		// matches elements as they are dynamically added to the DOM
		jQuery.fn.ever = function(added, deleted) {

			// If the function is called in any way other than as a method on the 
			// jQuery object, then intercept and return early.
			if (!(this instanceof jQuery)) {
				ensureIntercepting();
				return;
			}

			// apply now
			this.each(added);

			// and then watch for dom changes
			everRegs.push({
				selector: this.selector,
				context: this.context,
				added: added,
				deleted: deleted
			});

			ensureIntercepting();

			// really shouldn't chain calls b/c only elements
			// currently in the DOM would be affected.
			return null;
		};

		// Gets all Sys.Bindings for an element
		jQuery.fn.liveBindings = function() {
			return this.get(0).__msajaxbindings || [];
		};

		// Gets all model rules associated with the property an element is bound to
		jQuery.fn.rules = function(ruleType) {
			if (!(window.ExoWeb && ExoWeb.Model)) {
				return [];
			}

			var rules = [];
			var bindings = $(this).liveBindings();

			for (var i = 0; i < bindings.length; i++) {
				var binding = bindings[i];
				var srcObj = Sys_Binding_getFinalSourceObject(binding);

				var prop;

				if (srcObj instanceof ExoWeb.View.Adapter) {
					prop = srcObj.get_propertyChain().lastProperty();
				}
				else if (srcObj instanceof ExoWeb.View.OptionAdapter) {
					prop = srcObj.get_parent().get_propertyChain().lastProperty();
				}
				else if (srcObj instanceof ExoWeb.Model.ObjectBase) {
					var propName = Sys_Binding_getFinalPath(binding);
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

		// Get's the last object in the source path.  Ex: Customer.Address.Street returns the Address object.
		function Sys_Binding_getFinalSourceObject(binding) {
			var src = binding.get_source();

			for (var i = 0; i < binding._pathArray.length - 1; ++i) {
				src = src[binding._pathArray[i]];
			}

			return src;
		}

		function Sys_Binding_getFinalPath(binding) {
			return binding._pathArray[binding._pathArray.length - 1];
		}
	}

	if (window.Sys && Sys.loader) {
		Sys.loader.registerScript("ExoWebJquery", null, execute);
	}
	else {
		execute();
	}
})();
