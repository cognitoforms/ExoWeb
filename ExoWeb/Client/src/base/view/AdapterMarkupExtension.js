Sys.Application.registerMarkupExtension(
	"@",
	function AdapterMarkupExtention(component, targetProperty, templateContext, properties) {
		if (properties.required) {
			ExoWeb.trace.logWarning(["@", "markupExt"], "Adapter markup extension does not support the \"required\" property.");
		}

		var path = properties.path || properties.$default;
		delete properties.$default;

		var source;
		if (properties.source) {
			source = properties.source;
			delete properties.source;
		}
		else {
			source = templateContext.dataItem;
		}

		var adapter;
		if (!path) {
			if (!(source instanceof Adapter)) {
				throw new Error("No path was specified for the \"@\" markup extension, and the source is not an adapter.");
			}
			for (var prop in properties) {
				if (properties.hasOwnProperty(prop) && prop !== "isLinkPending") {
					throw new Error("Additional adapter properties cannot be specified when deferring to another adapter (no path specified). Found property \"" + prop + "\".");
				}
			}
			adapter = source;
		}
		else {
			adapter = new Adapter(source, path, properties.format, properties);
			templateContext.components.push(adapter);
		}

		adapter.ready(function AdapterReady() {
			Sys.Observer.setValue(component, targetProperty, adapter);
		});
	},
	false
);
