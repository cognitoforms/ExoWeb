function OptionAdapter(parent, obj) {
	this._parent = parent;
	this._obj = obj;

	// watch for changes to properties of the source object and update the label
	this._ensureObservable();
}

OptionAdapter.prototype = {
	// Internal book-keeping and setup methods
	///////////////////////////////////////////////////////////////////////
	_loadForFormatAndRaiseChange: function OptionAdapter$_loadForFormatAndRaiseChange(val, fmtName) {
		if (val === undefined || val === null) {
			Sys.Observer.raisePropertyChanged(this, fmtName + "Value");
			return;
		}

		var signal = new ExoWeb.Signal("OptionAdapter." + fmtName + "Value");
		this._parent._doForFormatPaths(val, fmtName, function(path) {
			ExoWeb.Model.LazyLoader.evalAll(val, path, signal.pending());
		}, this);
		signal.waitForAll(function() {
			Sys.Observer.raisePropertyChanged(this, fmtName + "Value");
		}, this);
	},
	_subscribeToFormatChanges: function OptionAdapter$_subscribeToFormatChanges(val, fmtName) {
		this._parent._doForFormatPaths(val, fmtName, function(path) {
			Sys.Observer.addPathChanged(val, path, this._loadForFormatAndRaiseChange.bind(this).prependArguments(val, fmtName));
		}, this);
	},
	_ensureObservable: function OptionAdapter$_ensureObservable() {
		if (!this._observable) {
			Sys.Observer.makeObservable(this);

			// set up initial watching of format paths
			this._subscribeToFormatChanges(this._obj, "system");
			this._subscribeToFormatChanges(this._obj, "display");

			this._observable = true;
		}
	},

	// Properties consumed by UI
	///////////////////////////////////////////////////////////////////////////
	get_parent: function OptionAdapter$get_parent() {
		return this._parent;
	},
	get_rawValue: function OptionAdapter$get_rawValue() {
		return this._obj;
	},
	get_displayValue: function OptionAdapter$get_displayValue() {
		var format = this._parent.get_displayFormat();
		return format ? format.convert(this._obj) : this._obj;
	},
	get_systemValue: function OptionAdapter$get_systemValue() {
		var format = this._parent.get_systemFormat();
		return format ? format.convert(this._obj) : this._obj;
	},
	get_selected: function OptionAdapter$get_selected() {
		return this._parent.get_selected(this._obj);
	},
	set_selected: function OptionAdapter$set_selected(value) {
		this._parent.set_selected(this._obj, value);
	},

	// Pass validation events through to the target
	///////////////////////////////////////////////////////////////////////////
	addPropertyValidating: function OptionAdapter$addPropertyValidating(propName, handler) {
		var prop = this._parent.get_propertyChain();
		prop.lastTarget(this._parent._target).meta.addPropertyValidating(prop.get_name(), handler);
	},
	addPropertyValidated: function OptionAdapter$addPropertyValidated(propName, handler) {
		var prop = this._parent.get_propertyChain();
		prop.lastTarget(this._parent._target).meta.addPropertyValidated(prop.get_name(), handler);
	}
};

ExoWeb.View.OptionAdapter = OptionAdapter;
OptionAdapter.registerClass("ExoWeb.View.OptionAdapter");
