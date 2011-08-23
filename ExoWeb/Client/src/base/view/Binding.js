function Binding(templateContext, source, sourcePath, target, targetPath, options, scopeChain) {
	Binding.initializeBase(this);

	this._templateContext = templateContext;
	this._source = source;
	this._sourcePath = sourcePath;
	this._target = target;
	this._targetPath = targetPath;
	this._options = options || {};

	this._isTargetElement = Sys.UI.DomElement.isDomElement(target);

	this._collectionChangedHandler = this._collectionChanged.bind(this);
	this._sourcePathChangedHandler = this._sourcePathChanged.bind(this);
	this._watchedItemPathChangedHandler = this._watchedItemPathChanged.bind(this);
	this._evalSuccessHandler = this._evalSuccess.bind(this);
	this._evalFailureHandler = this._evalFailure.bind(this);

	if (this._sourcePath) {
		// Start the initial fetch of the source value.
		ExoWeb.Model.LazyLoader.eval(this._source, this._sourcePath, this._evalSuccessHandler, this._evalFailureHandler, scopeChain);
	}
	else {
		this._evalSuccess(this._source);
	}
}

function ensureArray(value) {
	return isArray(value) ? value : (isNullOrUndefined(value) ? [] : [value]);
}

Binding.mixin({

	// Functions concerned with setting the value of the target after
	// the source value has been retrieved and manipulated based on options.
	//////////////////////////////////////////////////////////////////////////

	_setTarget: function(value) {
		if (this._isTargetElement && (this._targetPath === "innerText" || this._targetPath === "innerHTML")) {
			if (value && !isString(value))
				value = value.toString();

			// taken from Sys$Binding$_sourceChanged
			Sys.Application._clearContent(this._target);
			if (this._targetPath === "innerHTML")
				this._target.innerHTML = value;
			else
				this._target.appendChild(document.createTextNode(value));
			Sys.Observer.raisePropertyChanged(this._target, this._targetPath);
		}
		else if (this._isTargetElement && value === null) {
			// IE would set the value to "null"
			Sys.Observer.setValue(this._target, this._targetPath, "");
		}
		else {
			Sys.Observer.setValue(this._target, this._targetPath, value);
		}
	},

	_queue: function(value) {
		if (this._pendingValue) {
			this._pendingValue = value;
			return;
		}

		this._pendingValue = value;

		Batch.whenDone(function() {
			var targetValue = this._pendingValue;
			delete this._pendingValue;

			if (this._isDisposed === true) {
				return;
			}

			this._setTarget(targetValue);
		}, this);
	},

	// Functions that filter or transform the value of the source before
	// setting the target.  These methods are NOT asynchronous.
	//////////////////////////////////////////////////////////////////////////

	_ifNull: function(value) {
		// use a default value if the source value is null or undefined
		if (isNullOrUndefined(value) && this._options.ifNull) {
			return this._options.ifNull;
		}

		return value;
	},

	_format: function(value) {
		// attempt to format the source value used the named format
		if (value && this._options.format && value.constructor.formats && value.constructor.formats[this._options.format]) {
			return value.constructor.formats[this._options.format].convert(value);
		}

		return value;
	},

	_transform: function(value) {
		if (!this._options.transform)
			return value;

		if (!this._transformFn) {
			this._transformFn = new Function("list", "$element", "$index", "$dataItem", "return $transform(list)." + this._options.transform + ";");
		}

		// transform the original list using the given options
		return this._transformFn(value, this._isTargetElement ? this._target : this._target.get_element(), this._templateContext.index, this._templateContext.dataItem);
	},

	// Functions that deal with responding to changes, asynchronous loading,
	// and general bookkeeping.
	//////////////////////////////////////////////////////////////////////////

	_require: function(source, callback) {
		ExoWeb.Model.LazyLoader.evalAll(source, this._options.required, function() {
			callback.call(this);
		}, null, null, this);
	},

	_update: function(value, newItems, oldItems) {
		// if necessary, remove an existing collection change handler
		if (this._value && this._value instanceof Array) {
			Sys.Observer.removeCollectionChanged(this._value, this._collectionChangedHandler);
			delete this._value;
		}

		// if the value is an array and we will transform the value or require paths, then watch for collection change events
		if (value instanceof Array && (this._options.required || this._options.transform)) {
			this._value = value;
			Sys.Observer.makeObservable(value);
			Sys.Observer.addCollectionChanged(value, this._collectionChangedHandler);
		}

		// If additional paths are required then load them before invoking the callback.
		if (this._options.required) {

			// Unwatch require path for items that are no longer relevant.
			forEach(oldItems, function(item) {
				Sys.Observer.removePathChanged(item, this._options.required, this._watchedItemPathChangedHandler);
			}, this);

			// Load required paths, then manipulate the source value and update the target.
			this._require(value, function() {

				// Watch require path for new items.
				forEach(newItems, function(item) {
					Sys.Observer.addPathChanged(item, this._options.required, this._watchedItemPathChangedHandler, true);
				}, this);

				this._queue(this._ifNull(this._format(this._transform(value))));
			});
		}
		else {
			this._queue(this._ifNull(this._format(this._transform(value))));
		}
	},

	_collectionChanged: function(items, evt) {
		// In the case of an array-valued source, respond to a collection change that is raised for the source value.
		// Optimization: short circuit mapping of changes based on whether there are required paths.
		this._update(items,
			this._options.required ? evt.get_changes().mapToArray(function(change) { return change.newItems || []; }) : [],
			this._options.required ? evt.get_changes().mapToArray(function(change) { return change.oldItems || []; }) : []);
	},

	_watchedItemPathChanged: function(sender, args) {
		this._update(this._sourcePathResult, [], []);
	},

	_sourcePathChanged: function() {
		// Save the previous result and evaluate and store the new one.
		var prevSourcePathResult = this._sourcePathResult;
		this._sourcePathResult = evalPath(this._source, this._sourcePath);

		// Respond to a change that occurs at any point along the source path.
		this._update(this._sourcePathResult, ensureArray(this._sourcePathResult), ensureArray(prevSourcePathResult));
	},

	_evalSuccess: function(result, message) {
		if (this._sourcePath) {
			Sys.Observer.addPathChanged(this._source, this._sourcePath, this._sourcePathChangedHandler, true);
		}

		this._sourcePathResult = result;

		if (result !== undefined || result !== null) {
			this._update(result, ensureArray(result), []);
		}
	},

	_evalFailure: function(err) {
		ExoWeb.trace.throwAndLog(["~", "markupExt"], "Couldn't evaluate path '{0}', {1}", [this._sourcePath, err]);
	},

	dispose: function() {
		this._isDisposed = true;
		Binding.callBaseMethod(this, "dispose");
	}

});

exports.Binding = Binding;
Binding.registerClass("ExoWeb.View.Binding", Sys.Component, Sys.UI.ITemplateContextConsumer);
