function PropertyObserver(prop) {
	this._source = null;
	this._prop = prop;
	this._handler = null;
}

PropertyObserver.mixin(Functor.eventing);

PropertyObserver.mixin({
	value: function PropertyObserver$value() {
		return ExoWeb.getValue(this._source, this._prop);
	},
	release: function PropertyObserver$release(value) {
		// Notify subscribers that the old value should be released
		if (value instanceof Array) {
			Array.forEach(value, function(item) {
				this._raiseEvent("valueReleased", [item]);
			}, this);
		}
		else {
			this._raiseEvent("valueReleased", [value]);
		}
	},
	capture: function PropertyObserver$capture(value) {
		// Notify subscribers that a new value was captured
		if (value instanceof Array) {
			Array.forEach(value, function(item) {
				this._raiseEvent("valueCaptured", [item]);
			}, this);

			var _this = this;

			// Have to store the array since if the value changes we won't necessarily be able to retrieve the original array
			if (this._collectionTarget !== undefined && this._collectionTarget !== null) {
				Observer.removeCollectionChanged(this._collectionTarget, this._collectionHandler);
			}

			this._collectionTarget = value;

			this._collectionHandler = function collectionHandler(sender, args) {
				var changes = args.get_changes();

				// Call the actual handler
				_this._handler.apply(this, arguments);

				// remove old observers and add new observers
				Array.forEach(changes.removed || [], function(removed) {
					_this._raiseEvent("valueReleased", [removed]);
				});
				Array.forEach(changes.added || [], function(added) {
					_this._raiseEvent("valueCaptured", [added]);
				});
			};

			Observer.addCollectionChanged(this._collectionTarget, this._collectionHandler);
		}
		else {
			this._raiseEvent("valueCaptured", [value]);
		}
	},
	start: function PropertyObserver$start(source, handler) {
		if (this._source) {
			throw new Error("Cannot start an observer that is already started.");
		}

		var _this = this;

		this._source = source;
		this._handler = handler;

		var value = this.value();

		this._propHandler = function propHandler(sender, args) {
			// Call the actual handler.
			_this._handler.apply(this, arguments);

			// Release the old value
			if (value !== undefined && value !== null) {
				_this.release(value);
			}

			value = _this.value();

			// Release the old value
			if (value !== undefined && value !== null) {
				_this.capture(value);
			}
		};

		Observer.addPropertyChanged(this._source, this._prop, this._propHandler);

		// If we currently have a value, then notify subscribers
		if (value !== undefined && value !== null) {
			this.capture(value);
		}
	},
	stop: function PropertyObserver$stop() {
		if (this._source) {
			// Remove the registered event(s)
			Observer.removePropertyChanged(this._source, this._prop, this._propHandler);

			// Have to store the array since if the value changes we won't necessarily be able to retrieve the original array
			if (this._collectionTarget !== undefined && this._collectionTarget !== null) {
				Observer.removeCollectionChanged(this._collectionTarget, this._collectionHandler);
				this.release(this._collectionTarget);
			}
			else {
				var value = this.value();
				if (value !== undefined && value !== null) {
					this.release(value);
				}
			}

			// Null out the source to indicate that it is no longer watching that object
			this._source = null;
		}
	}
});

ExoWeb.PropertyObserver = PropertyObserver;
