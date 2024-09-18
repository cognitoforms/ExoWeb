function VueComponent(element) {
	VueComponent.initializeBase(this, [element]);
	this._vm = null;
	this._eventHandlers = [];
}

function toKebabCase(str) {
	return str.replace(/[A-Z]/g, function (x) {
		return "-" + x.toLowerCase();
	});
}

VueComponent.prototype = {

	get_templateContext: function VueComponent$get_templateContext() {
		/// <value mayBeNull="false" type="Sys.UI.TemplateContext" locid="P:J#ExoWeb.UI.VueComponent.templateContext"></value>
		if (!this._parentContext) {
			this._parentContext = Sys.UI.Template.findContext(this._element);
		}
		return this._parentContext;
	},
	set_templateContext: function VueComponent$set_templateContext(value) {
		this._parentContext = value;
	},

	get_component: function() {
		return this._componentName;
	},
	set_component: function(value) {
		this._componentName = value;
	},

	get_parent: function() {
		if (!this._parent) {
			var parentVm = null;
			for (var tc = this.get_templateContext(); tc; tc = tc.parentContext) {
				if (tc.vm) {
					parentVm = tc.vm;
					break;
				}
			}
			this._parent = parentVm;
		}
		return this._parent;
	},
	set_parent: function(value) {
		this._parent = value;
	},

	get_model: function() {
		return this._model;
	},
	set_model: function(value) {
		this._model = value;
	},

	get_props: function() {
		return this._props || {};
	},
	set_props: function(value) {
		this._props = value;
		if (this._vm)
			this._bindProps();
	},

	get_setup: function() {
		return this._setup;
	},
	set_setup: function(value) {
		this._setup = value;
	},

	_bindProps: function () {
		// setup ad hoc prop bindings
		// Example: vuecomponent:xyz="{binding SomeProperty}"
		// Establishes a one way binding of SomeProperty -> component's xyz prop
		for (var prop in this._vm.$options.props) {
			if (Object.getPrototypeOf(this).hasOwnProperty("get_" + prop))
				console.warn("Prop '" + prop + "' will not be bound to " + this.get_component() + " component because it is a reserved property of the VueComponent control.");
			else
				this._bindProp(prop, this._getValue(prop));
		}
	},

	_setProp: function (propName, value) {
		this._vm[propName] = value;
	},

	_preventVueObservability: function(value) {
		if (value && typeof value === 'object') {
			if (value.length && Array.isArray(value)) {
				var _this = this;
				var hasExoWebEntities = false;
				value.forEach(function (o) {
					if (_this._preventVueObservability(o))
						hasExoWebEntities = true;
				});
				return hasExoWebEntities;
			}
			else if (value instanceof ExoWeb.Model.Entity) {
				preventVueObservability(value);
				return true;
			}
			else if (value instanceof ExoWeb.View.Adapter) {
				var hasExoWebEntities = this._preventVueObservability(value.get_rawValue());
				return hasExoWebEntities || value.get_isEntity() || value.get_isEntityList();
			}
		}
	},

	_getValue: function(vueProp) {
		var value = this[toKebabCase(vueProp)];
		if (this._preventVueObservability(value)) {
			if (ExoWeb.config.debug)
				console.warn("Don't pass ExoWeb objects to Vue components, component = " + this.get_component() + ", prop=" + vueProp + ".", value);
		}
		return value;
	},

	_bindProp: function(propName, value) {
		if (value instanceof ExoWeb.View.Adapter) {
			this._setProp(propName, value.get_rawValue());
			value.add_propertyChanged(function () {
				var rawValue = value.get_rawValue();
				this._preventVueObservability(rawValue);
				this._setProp(propName, rawValue);
			}.bind(this));
		}
		else {
			if (value !== undefined)
				this._setProp(propName, value);

			ExoWeb.Observer.addPropertyChanged(this, toKebabCase(propName), function () {
				this._setProp(propName, this._getValue(propName));
			}.bind(this));
		}
	},

	_bindModel: function() {
		// setup v-model binding
		// vuecomponent:model="{@ Property}" establishes a two way binding between Property and the component's
		// model prop. Property will be updated with the value emitted on the component's model event.
		// https://vuejs.org/v2/guide/components-custom-events.html#Customizing-Component-v-model
		var model = this.get_model();
		if (model instanceof ExoWeb.View.Adapter) {
			var modelOptions = this._vm.$options.model || { prop: "value", event: "input" };
			this._bindProp(modelOptions.prop, model);
			this._vm.$on(modelOptions.event, function (val) {
				model.set_rawValue(val);
			});
		}
	},

	_bindEventHandler: function(propName) {
		var that = this;
		this._vm.$on(propName.substring(1), function() {
			that._getValue(propName).apply(null, arguments);
		});

	},

	_bindEventHandlers: function() {
		for (var prop in this) {
			if (prop.indexOf("@") === 0 && typeof this[prop] === "function") {
				this._bindEventHandler(prop);
			}
		}
	},

	initialize: function() {
		VueComponent.callBaseMethod(this, "initialize");

		var element = this.get_element();
		var mountPoint = document.createElement(element.tagName);
		element.appendChild(mountPoint);

		if (!window.VueComponents)
			console.error("VueComponents global was not found. Please make sure the component library is loaded correctly before trying to use this control.");
		else if (!VueComponents[this.get_component()])
			console.error("No component named '" + this.get_component() + "' was found in the component library.");
		else {
			VueComponents[this.get_component()].load().then(function (Component) {
				var propsData = {};
				// ensure props are provided to component constructor
				for (var prop in Component.options.props) {
					var value = this._getValue(prop);
					if (value instanceof ExoWeb.View.Adapter)
						value = value.get_rawValue();
					propsData[prop] = value;
				}

				if (Component.options.functional) {
					this._vm = new Vue({
						parent: this.get_parent(),
						template: '<c-component-wrapper ref="component" v-bind="$props" />',
						components: { 'c-component-wrapper': Component },
						props: Object.keys(propsData),
						propsData: propsData
					});
				}
				else {
					this._vm = new Component({
						parent: this.get_parent(),
						propsData: propsData
					});
				}

				this._bindModel();
				this._bindProps();
				this._bindEventHandlers();

				if (typeof this._setup === "function")
					this._setup(this._vm, this._model);
				this._vm.$mount(mountPoint);
			}.bind(this));
		}
	},

	dispose: function () {
		if (this._vm) {
			try {
				this._vm.$destroy();
			}
			catch (e) {
				// Ignore error destroying component
			}
		}
	}
};

/**
 * Prevent Vue from making an object observable.
 * Adapted from VueModel -  https://github.com/cognitoforms/VueModel/blob/master/src/vue-model-observability.ts
 */
function preventVueObservability(obj) {
	if (obj && !obj.hasOwnProperty("__ob__")) {
		// Mark the object as "raw" so that Vue won't try to make it observable
		Vue.markRaw(obj);
		return true;
	}
}

ExoWeb.UI.VueComponent = VueComponent;
VueComponent.registerClass("ExoWeb.UI.VueComponent", Sys.UI.Control, Sys.UI.ITemplateContextConsumer);
