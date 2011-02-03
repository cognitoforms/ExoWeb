function ResponseHandler(model, serverSync, options) {
	if (options === undefined || options === null) {
		throw new Error("Options cannot be null or undefined.");
	}

	this._model = model;
	this._serverSync = serverSync;
	this._options = options;
}

ResponseHandler.mixin({
	execute: ExoWeb.FunctionChain.prepare(
		// Load types from JSON
		//////////////////////////////////////////
		function loadTypes(callback, thisPtr) {
			if (this._options.types) {
				ExoWeb.trace.log("responseHandler", "Loading types.");
				typesFromJson(this._model, this._options.types);
			}

			callback.call(thisPtr || this);
		},

		// Apply "init new" changes
		//////////////////////////////////////////
		function applyInitChanges(callback, thisPtr) {
			if (this._options.changes) {
				ExoWeb.trace.log("responseHandler", "Applying \"init new\" changes.");

				var signal = new ExoWeb.Signal("applyInitChanges");

				var changes = Array.prototype.slice.apply(this._options.changes);

				var initChanges = changes.where(function(change) {
					return change.type === "InitNew";
				});

				this._serverSync.applyChanges(initChanges, this._options.source, signal.pending());

				signal.waitForAll(callback, thisPtr, true);
			}
			else {
				callback.call(thisPtr || this);
			}
		},

		// Load instance data from JSON
		//////////////////////////////////////////
		function loadInstances(callback, thisPtr) {
			if (this._options.instances) {
				ExoWeb.trace.log("responseHandler", "Loading instances.");
				objectsFromJson(this._model, this._options.instances, callback, thisPtr);
			}
			else {
				callback.call(thisPtr || this);
			}
		},

		// Apply non-"init new" changes
		//////////////////////////////////////////
		function applyNonInitChanges(callback, thisPtr) {
			if (this._options.changes) {
				ExoWeb.trace.log("responseHandler", "Applying non-\"init new\" changes.");

				var signal = new ExoWeb.Signal("applyNonInitChanges");

				var changes = Array.prototype.slice.apply(this._options.changes);

				var initChanges = changes.where(function(change) {
					return change.type !== "InitNew";
				});

				this._serverSync.applyChanges(initChanges, this._options.source, signal.pending());

				signal.waitForAll(callback, thisPtr, true);
			}
			else {
				callback.call(thisPtr || this);
			}
		},

		// Load conditions from JSON
		//////////////////////////////////////////
		function loadConditions(callback, thisPtr) {
			if (this._options.conditions) {
				ExoWeb.trace.log("reponseHandler", "Loading conditions.");
				conditionsFromJson(this._model, this._options.conditions, callback, thisPtr);
			}
			else {
				callback.call(thisPtr || this);
			}
		}
	)
});

exports.ResponseHandler = ResponseHandler;
