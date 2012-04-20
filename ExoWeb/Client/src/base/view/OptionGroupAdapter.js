function OptionGroupAdapter(parent, obj, items) {
	this._parent = parent;
	this._obj = obj;
	this._options = $transform(items).select(parent._createOption.bind(parent)).live();

	// watch for changes to properties of the source object and update the label
	this._ensureObservable();
}

OptionGroupAdapter.prototype = {
	// Properties consumed by UI
	///////////////////////////////////////////////////////////////////////////
	get_parent: function OptionGroupAdapter$get_parent() {
		return this._parent;
	},
	get_rawValue: function OptionGroupAdapter$get_rawValue() {
		return this._obj;
	},
	get_displayValue: function OptionGroupAdapter$get_displayValue() {
		var result = this._obj;
		if (result !== null && result !== undefined && result.formats && result.formats.$display) {
			result = result.formats.$display.convert(result);
		}
		return result;
	},
	get_systemValue: function OptionGroupAdapter$get_systemValue() {
		var result = this._obj;
		if (result !== null && result !== undefined && result.formats && result.formats.$system) {
			result = result.formats.$system.convert(result);
		}
		return result;
	},
	get_options: function OptionGroupAdapter$get_options() {
		return this._options;
	},

	// Pass validation events through to the target
	///////////////////////////////////////////////////////////////////////////
	addPropertyValidating: function OptionGroupAdapter$addPropertyValidating(propName, handler) {
		var prop = this._parent.get_propertyChain();
		prop.lastTarget(this._parent._target).meta.addPropertyValidating(prop.get_name(), handler);
	},
	addPropertyValidated: function OptionGroupAdapter$addPropertyValidated(propName, handler) {
		var prop = this._parent.get_propertyChain();
		prop.lastTarget(this._parent._target).meta.addPropertyValidated(prop.get_name(), handler);
	}
};

ExoWeb.View.OptionGroupAdapter = OptionGroupAdapter;
OptionGroupAdapter.registerClass("ExoWeb.View.OptionGroupAdapter");
