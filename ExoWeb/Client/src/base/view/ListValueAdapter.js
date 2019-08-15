function ListValueAdapter(parent, index) {
	this._parent = parent;
	this._index = index;

	// watch for changes to properties of the source object and update the label
	this._ensureObservable();
}

ListValueAdapter.prototype = {
	// Internal book-keeping and setup methods
	///////////////////////////////////////////////////////////////////////
	_loadForFormatAndRaiseChange: function ListValueAdapter$_loadForFormatAndRaiseChange(val) {
		if (val === undefined || val === null) {
			Observer.raisePropertyChanged(this, "displayValue");
			Observer.raisePropertyChanged(this, "systemValue");
			return;
		}

		var signal = new ExoWeb.Signal("ListValueAdapter.displayValue");
		this._parent._doForFormatPaths(val, function (path) {
			LazyLoader.evalAll(val, path, signal.pending());
		}, this);
		signal.waitForAll(function () {
			Observer.raisePropertyChanged(this, "displayValue");
			Observer.raisePropertyChanged(this, "systemValue");
		}, this);
	},
	//_subscribeToFormatChanges: function ListValueAdapter$_subscribeToFormatChanges(val) {
	//	this._parent._doForFormatPaths(val, function (path) {
	//		Model.property(path, val.meta.type, true, function (chain) {
	//			var subscription = this._formatSubscribers[path] = { chain: chain, handler: this._loadForFormatAndRaiseChange.bind(this).prependArguments(val) };
	//			chain.addChanged(subscription.handler, val);
	//		}, this);
	//	}, this);
	//},
	_ensureObservable: function ListValueAdapter$_ensureObservable() {
		if (!this._observable) {
			Observer.makeObservable(this);

			this._formatSubscribers = {};

			// set up initial watching of format paths
			//this._subscribeToFormatChanges(this._obj);

			this._observable = true;
		}
	},

	// Properties consumed by UI
	///////////////////////////////////////////////////////////////////////////
	get_parent: function ListValueAdapter$get_parent() {
		return this._parent;
	},
	get_isEntity: function ListValueAdapter$get_isEntity() {
		return this._parent.get_isEntity();
	},
	get_options: function ListValueAdapter$get_options() {
		var _this = this;
		return this._parent.get_options().map(function (o) { return new OptionAdapter(_this, o._obj); });
	},
	get_rawValue: function ListValueAdapter$get_rawValue() {
		return this._parent.get_rawValue()[this._index];
	},
	get_displayValue: function ListValueAdapter$get_displayValue() {
		var format = this._parent._format;
		var obj = this._parent.get_rawValue()[this._index];
		return format ? format.convert(obj) : obj;
	},
	set_displayValue: function ListValueAdapter$set_displayValue(value) {
		if (this._parent.get_isEntity()) {
			throw new Error("Cannot set displayValue property of OptionAdapters for entity types.");
		}
		else {
			// Set the internal option value after optional applying a conversion
			value = this._format ? this._parent._format.convertBack(value) : value;

			var list = this._parent.get_rawValue();
			list.beginUpdate();
			list.removeAt(this._index);
			list.insert(this._index, value);
			list.endUpdate();
		}
	},
	get_systemValue: function ListValueAdapter$get_systemValue() {
		if (this._obj === null || this._obj === undefined) {
			return "";
		}
		else {
			return this._parent.get_isEntity() ? Entity.toIdString(this._obj) : this._obj.toString();
		}
	},
	get_conditions: function ListValueAdapter$get_conditions() {
		return this._parent.get_conditions();
	},
	_doForFormatPaths: function ListValueAdapter$_doForFormatPaths(val, callback, thisPtr) {
		return this._parent._doForFormatPaths(val, callback, thisPtr);
	},
	get_format: function ListValueAdapter$get_format() {
		return this._parent._format;
	}
};

ExoWeb.View.ListValueAdapter = ListValueAdapter;
