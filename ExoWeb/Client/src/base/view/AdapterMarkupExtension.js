Sys.Application.registerMarkupExtension("@",
	function AdapterMarkupExtention(component, targetProperty, templateContext, properties) {
//				ExoWeb.trace.log(["@", "markupExt"], "@ " + (properties.$default || "(no path)") + " (evaluating)");

		if (properties.required) {
			ExoWeb.trace.logWarning(["@", "markupExt"], "Adapter markup extension does not support the \"required\" property.");
		}

		var path = properties.path || properties.$default;
		delete properties.$default;

		var adapter = new Adapter(properties.source || templateContext.dataItem, path, properties.systemFormat, properties.displayFormat, properties);

		adapter.ready(function AdapterReady() {
//					ExoWeb.trace.log(["@", "markupExt"], "@ " + (adapter._propertyPath || "(no path)") + "  <.>");
			Sys.Observer.setValue(component, targetProperty, adapter);
			if (component.add_disposing) {
				component.add_disposing(function() {
					adapter.dispose();
				});
			}
		});

		templateContext.components.push(adapter);
	}, false);
