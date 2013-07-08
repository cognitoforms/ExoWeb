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
			Observer.raisePropertyChanged(this, "displayValue");
			Observer.raisePropertyChanged(this, "systemValue");
			return;
		}

		var signal = new ExoWeb.Signal("OptionAdapter.displayValue");
		this._parent._doForFormatPaths(val, function (path) {
			LazyLoader.evalAll(val, path, signal.pending());
		}, this);
		signal.waitForAll(function () {
			Observer.raisePropertyChanged(this, "displayValue");
			Observer.raisePropertyChanged(this, "systemValue");
		}, this);
	},
	_subscribeToFormatChanges: function OptionAdapter$_subscribeToFormatChanges(val) {
		this._parent._doForFormatPaths(val, function (path) {
			Model.property(path, val.meta.type, true, function (chain) {
				var subscription = this._formatSubscribers[path] = { chain: chain, handler: this._loadForFormatAndRaiseChange.bind(this).prependArguments(val) };
				chain.addChanged(subscription.handler, val);
			}, this);
		}, this);
	},
	_ensureObservable: function OptionAdapter$_ensureObservable() {
		if (!this._observable) {
			Observer.makeObservable(this);

			this._formatSubscribers = {};

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
	get_conditions: function OptionAdapter$get_conditions() {
		return this._parent.get_conditions();
	}
};

ExoWeb.View.OptionAdapter = OptionAdapter;
