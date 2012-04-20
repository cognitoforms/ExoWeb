function OptionAdapter(parent, obj) {
	this._parent = parent;
	this._obj = obj;

	// watch for changes to properties of the source object and update the label
	this._ensureObservable();
}

OptionAdapter.prototype = {
	// Internal book-keeping and setup methods
	///////////////////////////////////////////////////////////////////////
	_loadForFormatAndRaiseChange: function OptionAdapter$_loadForFormatAndRaiseChange(val) {
		if (val === undefined || val === null) {
			Sys.Observer.raisePropertyChanged(this, "displayValue");
			Sys.Observer.raisePropertyChanged(this, "systemValue");
			return;
		}

		var signal = new ExoWeb.Signal("OptionAdapter.displayValue");
		this._parent._doForFormatPaths(val, function (path) {
			ExoWeb.Model.LazyLoader.evalAll(val, path, signal.pending());
		}, this);
		signal.waitForAll(function () {
			Sys.Observer.raisePropertyChanged(this, "displayValue");
			Sys.Observer.raisePropertyChanged(this, "systemValue");
		}, this);
	},
	_subscribeToFormatChanges: function OptionAdapter$_subscribeToFormatChanges(val) {
		this._parent._doForFormatPaths(val, function (path) {
			Sys.Observer.addPathChanged(val, path, this._loadForFormatAndRaiseChange.bind(this).prependArguments(val));
		}, this);
	},
	_ensureObservable: function OptionAdapter$_ensureObservable() {
		if (!this._observable) {
			Sys.Observer.makeObservable(this);

			// set up initial watching of format paths
			this._subscribeToFormatChanges(this._obj);

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
		var format = this._parent._format;
		return format ? format.convert(this._obj) : this._obj;
	},
	get_systemValue: function OptionAdapter$get_systemValue() {
		if (this._obj === null || this._obj === undefined) {
			return "";
		}
		else {
			return this._parent.get_isEntity() ? Entity.toIdString(this._obj) : this._obj.toString();
		}
	},
	get_selected: function OptionAdapter$get_selected() {
		var rawValue = this._parent.get_rawValue();

		if (rawValue instanceof Array) {
			return Array.contains(rawValue, this._obj);
		}
		else {
			return rawValue === this._obj;
		}
	},
	set_selected: function OptionAdapter$set_selected(value) {
		var rawValue = this._parent.get_rawValue();

		if (rawValue instanceof Array) {
			if (value && !Array.contains(rawValue, this._obj)) {
				rawValue.add(this._obj);
			}
			else if (!value && Array.contains(rawValue, this._obj)) {
				rawValue.remove(this._obj);
			}
		}
		else {
			if (value) {
				this._parent.set_rawValue(this._obj);
			}
			else {
				this._parent.set_rawValue(null);
			}
		}
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
