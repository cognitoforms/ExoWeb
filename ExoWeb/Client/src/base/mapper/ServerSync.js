/// <reference path="../core/Array.js" />
/// <reference path="../core/Function.js" />
/// <reference path="../core/Signal.js" />
/// <reference path="Internals.js" />

function ServerSync(model) {
	if (!model || typeof(model) !== "object" || !(model instanceof ExoWeb.Model.Model)) {
		throw ExoWeb.trace.logError("server", "A model must be specified when constructing a ServerSync object.");
	}

	this._changeLog = new ChangeLog();
	this._pendingServerEvent = false;
	this._pendingRoundtrip = false;
	this._pendingSave = false;
	this._scopeQueries = [];
	this._objectsExcludedFromSave = [];
	this._objectsDeleted = [];
	this._translator = new ExoWeb.Translator();
	this._serverInfo = null;

	// define properties
	Object.defineProperty(this, "model", { value: model });

	function isDeleted(obj, isChange) {
		if (Array.contains(this._objectsDeleted, obj)) {
			if (isChange) {
				ExoWeb.trace.logWarning("server", "Object {0}({1}) was changed but has been deleted.", obj.meta.type.get_fullName(), obj.meta.id);
			}
			return true;
		}
		return false;
	}

	// don't record changes to types that didn't originate from the server
	function filterObjectEvent(obj) {
		return !isDeleted.apply(this, [obj, false]) && obj.meta.type.get_origin() === "server";
	}

	// don't record changes to types or properties that didn't originate from the server
	function filterPropertyEvent(obj, property) {
		return !isDeleted.apply(this, [obj, true]) && property.get_containingType().get_origin() === "server" && property.get_origin() === "server" && !property.get_isStatic();
	}

	this._listener = new ExoModelEventListener(this.model, this._translator, {
		listChanged: filterPropertyEvent.bind(this),
		propertyChanged: filterPropertyEvent.bind(this),
		objectRegistered: filterObjectEvent.bind(this),
		objectUnregistered: filterObjectEvent.bind(this)
	});

	var applyingChanges = 0;
	this.isApplyingChanges = function ServerSync$isApplyingChanges() {
		return applyingChanges > 0;
	};
	this.beginApplyingChanges = function ServerSync$beginApplyingChanges() {
		applyingChanges++;
	};
	this.endApplyingChanges = function ServerSync$endApplyingChanges() {
		applyingChanges--;

		if (applyingChanges < 0)
			ExoWeb.trace.throwAndLog("Error in transaction log processing: unmatched begin and end applying changes.");
	};

	var isCapturingChanges;
	this.isCapturingChanges = function ServerSync$isCapturingChanges() {
		return isCapturingChanges === true;
	};
	this.beginCapturingChanges = function ServerSync$beginCapturingChanges() {
		if (!isCapturingChanges) {
			isCapturingChanges = true;
			this._changeLog.start("client");
		}
	};

	this.ignoreChanges = function(before, callback, after, thisPtr) {
		return function() {
			var beforeCalled = false;

			try {
				applyingChanges++;

				if (before && before instanceof Function)
					before();
				
				beforeCalled = true;

				callback.apply(thisPtr || this, arguments);
			}
			finally {
				applyingChanges--;
				
				if (beforeCalled === true && after && after instanceof Function)
					after();
			}
		};
	};

	model.addObjectRegistered(function(obj) {
		// if an existing object is registered then register for lazy loading
		if (!obj.meta.isNew && obj.meta.type.get_origin() == "server" && isCapturingChanges === true && !applyingChanges) {
			ObjectLazyLoader.register(obj);
			//ExoWeb.trace.log(["entity", "server"], "{0}({1})  (ghost)", [obj.meta.type.get_fullName(), obj.meta.id]);
		}
	});

	// Assign back reference
	Object.defineProperty(model, "server", { value: this });

	this._listener.addChangeDetected(this._captureChange.bind(this));

	Observer.makeObservable(this);
}

function isPropertyChangePersisted(change) {
	if (change.property) {
		var jstype = ExoWeb.Model.Model.getJsType(change.instance.type, true);
		if (jstype) {
			var prop = jstype.meta.property(change.property);
			// Can't save non-persisted properties
			if (!prop.get_isPersisted()) {
				return false;
			}
		}
	}
	return true;
}

ServerSync.mixin(Functor.eventing);

var pendingRequests = 0;

registerActivity("ServerSync: request", function() {
	return pendingRequests > 0;
});

function serializeChanges(includeAllChanges, simulateInitRoot) {
	var changes = this._changeLog.serialize(includeAllChanges ? this.canSend : this.canSave, this);

	// temporary HACK (no, really): splice InitNew changes into init transaction
	if (simulateInitRoot && simulateInitRoot.meta.isNew) {
		function isRootInitChange(change) {
			return change.type === "InitNew" && change.instance.type === simulateInitRoot.meta.type.get_fullName() &&
				(change.instance.id === simulateInitRoot.meta.id || this._translator.reverse(change.instance.type, change.instance.id) === simulateInitRoot.meta.id);
		}

		var found = false;
		var initSet = changes.filter(function(set) { return set.source === "init"; })[0];
		if (!initSet || !initSet.changes.some(isRootInitChange, this)) {
			changes.forEach(function(set) {
				if (found === true) return;
				set.changes.forEach(function(change, index) {
					if (found === true) return;
					else if (isRootInitChange.call(this, change)) {
						set.changes.splice(index, 1);
						if (!initSet) {
							initSet = { changes: [change], source: "init" };
							changes.splice(0, 0, initSet);
						}
						else {
							initSet.changes.push(change);
						}
						found = true;
					}
				}, this);
			}, this);
		}
	}

	return changes;
}

// when ServerSync is made singleton, this data will be referenced via closure
function ServerSync$addScopeQuery(query) {
	this._scopeQueries.push(query);
}

function ServerSync$storeInitChanges(changes) {
	var activeSet = this._changeLog.activeSet();

	this._changeLog.addSet("init", changes);

	if (activeSet) {
		this._changeLog.start(activeSet.source());
	}
}

function ServerSync$retroactivelyFixChangeWhereIdChanged(changeInstance, obj) {
	// Update change to reflect the object's new id if it is referencing a legacy id
	if (changeInstance.id === obj.meta.legacyId) {
		changeInstance.id = obj.meta.id;
		changeInstance.isNew = false;
	}
}

ServerSync.mixin({
	// Enable/disable save & related functions
	///////////////////////////////////////////////////////////////////////
	enableSave: function ServerSync$enableSave(obj) {
		if (!(obj instanceof ExoWeb.Model.Entity)) {
			ExoWeb.trace.throwAndLog("server", "Can only enableSave on entity objects.");
		}

		if (Array.contains(this._objectsExcludedFromSave, obj)) {
			var oldPendingChanges;
			if (this._saveRoot) {
				// If autosave is enabled then determine if we need to queue a timeout
				oldPendingChanges = this.changes(false, this._saveRoot, true);
			}
			Array.remove(this._objectsExcludedFromSave, obj);
			Observer.raisePropertyChanged(this, "HasPendingChanges");

			// Determine if ther are now pending changes
			if (oldPendingChanges && oldPendingChanges.length === 0 && this._saveInterval && !this._saveTimeout) {
				if (this.changes(false, this._saveRoot, true).length > 0) {
					this._queueAutoSave();
				}
			}
			return true;
		}
	},
	disableSave: function ServerSync$disableSave(obj) {
		if (!(obj instanceof ExoWeb.Model.Entity)) {
			ExoWeb.trace.throwAndLog("server", "Can only disableSave on entity objects.");
		}

		if (!Array.contains(this._objectsExcludedFromSave, obj)) {
			var oldPendingChanges;
			if (this._saveRoot) {
				// If autosave is enabled then determine if we need to queue a timeout
				oldPendingChanges = this.changes(false, this._saveRoot, true);
			}
			this._objectsExcludedFromSave.push(obj);
			Observer.raisePropertyChanged(this, "HasPendingChanges");

			// Determine if ther are no longer pending changes
			if (oldPendingChanges && oldPendingChanges.length > 0 && this._saveInterval && this._saveTimeout) {
				if (this.changes(false, this._saveRoot, true).length === 0) {
					window.clearTimeout(this._saveTimeout);
					this._saveTimeout = null;
				}
			}
			return true;
		}
	},
	notifyDeleted: function ServerSync$notifyDeleted(obj) {
		if (!(obj instanceof ExoWeb.Model.Entity)) {
			throw ExoWeb.trace.logError("server", "Notified of deleted object that is not an entity.");
		}

		if (!Array.contains(this._objectsDeleted, obj)) {
			this._objectsDeleted.push(obj);
			return true;
		}
	},
	canSend: function (change) {
		if (change.type === "Checkpoint") return false;

		return true;
	},
	canSaveObject: function ServerSync$canSaveObject(objOrMeta) {
		var obj;
		var errorFmt = "Unable to test whether object can be saved:  {0}.";

		if (arguments.length === 0) {
			ExoWeb.trace.throwAndLog("server", errorFmt, ["argument not given"]);
		}
		else if (objOrMeta === undefined || objOrMeta === null) {
			ExoWeb.trace.throwAndLog("server", errorFmt, ["argument is null or undefined"]);
		}
		else if (objOrMeta instanceof ExoWeb.Model.ObjectMeta) {
			obj = objOrMeta._obj;
		}
		else if (objOrMeta instanceof ExoWeb.Model.Entity) {
			obj = objOrMeta;
		}
		else {
			ExoWeb.trace.throwAndLog("server", errorFmt, ["argument is not of correct type"]);
		}

		return !Array.contains(this._objectsExcludedFromSave, obj) && !Array.contains(this._objectsDeleted, obj);
	},
	canSave: function ServerSync$canSave(change) {

		// Can't save changes that can't be sent to the server at all.
		if (!this.canSend(change)) return false;

		// For list changes additionally check added and removed objects.
		if (change.type === "ListChange") {
			if (change.added.length > 0 || change.removed.length > 0) {
				var ignore = true;

				// Search added and removed for an object that can be saved.
				Array.forEach(change.added, function (item) {
					// if the type doesn't exist then obviously the instance doesn't either
					var jstype = ExoWeb.Model.Model.getJsType(item.type, true);
					if (!jstype) {
						ignore = false;
					}
					else {
						var obj = fromExoModel(item, this._translator, false, this._objectsDeleted);
						// Only objects that exist can be disabled
						if (!obj || this.canSaveObject(obj)) {
							ignore = false;
						}
					}
				}, this);
				Array.forEach(change.removed, function (item) {
					// if the type doesn't exist then obviously the instance doesn't either
					var jstype = ExoWeb.Model.Model.getJsType(item.type, true);
					if (!jstype) {
						ignore = false;
					}
					else {
						var obj = fromExoModel(item, this._translator, false, this._objectsDeleted);
						if (!obj || this.canSaveObject(obj)) {
							ignore = false;
						}
					}
				}, this);

				// If no "savable" object was found in added or 
				// removed then this change cannot be saved.
				if (ignore) {
					return false;
				}
			}
		}
		// For reference changes additionally check oldValue/newValue
		else if (change.type === "ReferenceChange") {
			var oldJsType = change.oldValue && ExoWeb.Model.Model.getJsType(change.oldValue.type, true);
			if (oldJsType) {
				var oldValue = fromExoModel(change.oldValue, this._translator, false, this._objectsDeleted);
				if (oldValue && !this.canSaveObject(oldValue)) {
					return false;
				}
			}

			var newJsType = change.newValue && ExoWeb.Model.Model.getJsType(change.newValue.type, true);
			if (newJsType) {
				var newValue = fromExoModel(change.newValue, this._translator, false, this._objectsDeleted);
				if (newValue && !this.canSaveObject(newValue)) {
					return false;
				}
			}
		}

		// if the type doesn't exist then obviously the instance doesn't either
		var jstype = ExoWeb.Model.Model.getJsType(change.instance.type, true);
		if (!jstype) {
			return true;
		}

		// Ensure that the instance that the change pertains to can be saved.
		var instanceObj = fromExoModel(change.instance, this._translator, false, this._objectsDeleted);
		return !instanceObj || this.canSaveObject(instanceObj);
	},

	_handleResult: function ServerSync$_handleResult(result, source, checkpoint, callbackOrOptions) {
		var callback, beforeApply, afterApply;

		if (callbackOrOptions instanceof Function) {
			callback = callbackOrOptions;
		}
		else {
			callback = callbackOrOptions.callback;
			beforeApply = callbackOrOptions.beforeApply;
			afterApply = callbackOrOptions.afterApply;
		}

		var handler = new ResponseHandler(this.model, this, {
			instances: result.instances,
			conditions: result.conditions,
			types: result.types && result.types instanceof Array ? null : result.types,
			changes: result.changes,
			source: source,
			checkpoint: checkpoint,
			serverInfo: result.serverInfo,
			beforeApply: beforeApply,
			afterApply: afterApply
		});

		handler.execute(callback, this);
	},

	// General events methods
	///////////////////////////////////////////////////////////////////////
	_raiseBeginEvents: function (method, args) {
		this._raiseEvent(method + "Begin", [this, args]);
		this._raiseEvent("requestBegin", [this, args]);
	},
	_raiseEndEvents: function (method, result, args) {
		this._raiseEvent(method + result, [this, args]);
		this._raiseEvent("request" + result, [this, args]);
		this._raiseEvent(method + "End", [this, args]);
		this._raiseEvent("requestEnd", [this, args]);
	},
	addRequestBegin: function (handler) {
		this._addEvent("requestBegin", handler);
	},
	removeRequestBegin: function (handler) {
		this._removeEvent("requestBegin", handler);
	},
	addRequestEnd: function (handler) {
		this._addEvent("requestEnd", handler);
	},
	removeRequestEnd: function (handler) {
		this._removeEvent("requestEnd", handler);
	},
	addRequestSuccess: function (handler) {
		this._addEvent("requestSuccess", handler);
	},
	removeRequestSuccess: function (handler) {
		this._removeEvent("requestSuccess", handler);
	},
	addRequestFailed: function (handler) {
		this._addEvent("requestFailed", handler);
	},
	removeRequestFailed: function (handler) {
		this._removeEvent("requestFailed", handler);
	},

	// Raise Server Event
	///////////////////////////////////////////////////////////////////////
	raiseServerEvent: function ServerSync$raiseServerEvent(name, instance, event, includeAllChanges, success, failed, paths) {
		pendingRequests++;

		// Checkpoint the log to ensure that we only truncate changes that were saved.
		var checkpoint = this._changeLog.checkpoint("server event " + name + " " + (new Date()).format("d"));

		Observer.setValue(this, "PendingServerEvent", true);

		var args = { type: "raiseServerEvent", eventTarget: instance, eventName: name, eventRaised: event, checkpoint: checkpoint, includeAllChanges: includeAllChanges };
		this._raiseBeginEvents("raiseServerEvent", args);

		// if no event object is provided then use an empty object
		if (event === undefined || event === null) {
			event = {};
		}

		for (var key in event) {
			var arg = event[key];

			if (arg instanceof Array) {
				event[key] = arg.map(function (a) { return toExoModel(a, this._translator); }, this);
			}
			else {
				event[key] = toExoModel(arg, this._translator);
			}
		}

		eventProvider(
			name,
			toExoModel(instance, this._translator),
			event,
			paths,
		// If includeAllChanges is true, then use all changes including those 
		// that should not be saved, otherwise only use changes that can be saved.
			serializeChanges.call(this, includeAllChanges, instance),
			this._onRaiseServerEventSuccess.bind(this).appendArguments(args, checkpoint, success),
			this._onRaiseServerEventFailed.bind(this).appendArguments(args, failed || success)
		);
	},
	_onRaiseServerEventSuccess: function ServerSync$_onRaiseServerEventSuccess(result, args, checkpoint, callback) {
		Observer.setValue(this, "PendingServerEvent", false);

		args.responseObject = result;

		this._handleResult(result, args.eventName, checkpoint, function () {
			var event = result.events[0];
			if (event instanceof Array) {
				for (var i = 0; i < event.length; ++i) {
					event[i] = fromExoModel(event[i], this._translator, true);
				}
			}
			else {
				event = fromExoModel(event, this._translator, true);
			}

			restoreDates(event);

			result.event = event;
			args.eventResponse = event;

			this._raiseEndEvents("raiseServerEvent", "Success", args);

			if (callback && callback instanceof Function)
				callback.call(this, result);

			pendingRequests--;
		});
	},
	_onRaiseServerEventFailed: function ServerSync$_onRaiseServerEventFailed(error, args, callback) {
		Observer.setValue(this, "PendingServerEvent", false);

		args.error = error;

		this._raiseEndEvents("raiseServerEvent", "Failed", args);

		if (callback && callback instanceof Function)
			callback.call(this, error);

		pendingRequests--;
	},
	addRaiseServerEventBegin: function (handler) {
		this._addEvent("raiseServerEventBegin", handler);
	},
	removeRaiseServerEventBegin: function (handler) {
		this._removeEvent("raiseServerEventBegin", handler);
	},
	addRaiseServerEventEnd: function (handler) {
		this._addEvent("raiseServerEventEnd", handler);
	},
	removeRaiseServerEventEnd: function (handler) {
		this._removeEvent("raiseServerEventEnd", handler);
	},
	addRaiseServerEventSuccess: function (handler) {
		this._addEvent("raiseServerEventSuccess", handler);
	},
	removeRaiseServerEventSuccess: function (handler) {
		this._removeEvent("raiseServerEventSuccess", handler);
	},
	addRaiseServerEventFailed: function (handler) {
		this._addEvent("raiseServerEventFailed", handler);
	},
	removeRaiseServerEventFailed: function (handler) {
		this._removeEvent("raiseServerEventFailed", handler);
	},

	// Roundtrip
	///////////////////////////////////////////////////////////////////////
	roundtrip: function ServerSync$roundtrip(root, paths, success, failed) {
		pendingRequests++;

		if (root && root instanceof Function) {
			success = root;
			failed = paths;
			root = null;
			paths = null;
		}

		var checkpoint = this._changeLog.checkpoint("roundtrip " + (new Date()).format("d"));

		Observer.setValue(this, "PendingRoundtrip", true);

		var args = { type: "roundtrip", checkpoint: checkpoint };
		this._raiseBeginEvents("roundtrip", args);

		var mtype = root ? root.meta.type || root.meta : null;
		var id = root ? root.meta.id || STATIC_ID : null;

		roundtripProvider(
			mtype ? mtype.get_fullName() : null,
			id,
			paths,
			serializeChanges.call(this, !!root, root),
			this._onRoundtripSuccess.bind(this).appendArguments(args, checkpoint, success),
			this._onRoundtripFailed.bind(this).appendArguments(args, failed || success)
		);
	},
	_onRoundtripSuccess: function ServerSync$_onRoundtripSuccess(result, args, checkpoint, callback) {
		Observer.setValue(this, "PendingRoundtrip", false);

		args.responseObject = result;

		this._handleResult(result, "roundtrip", checkpoint, function () {
			this._raiseEndEvents("roundtrip", "Success", args);

			if (callback && callback instanceof Function)
				callback.call(this, result);

			pendingRequests--;
		});
	},
	_onRoundtripFailed: function ServerSync$_onRoundtripFailed(error, args, callback) {
		Observer.setValue(this, "PendingRoundtrip", false);

		args.error = error;

		this._raiseEndEvents("roundtrip", "Failed", args);

		if (callback && callback instanceof Function)
			callback.call(this, error);

		pendingRequests--;
	},
	startAutoRoundtrip: function ServerSync$startAutoRoundtrip(interval) {
		//ExoWeb.trace.log("server", "auto-roundtrip enabled - interval of {0} milliseconds", [interval]);

		// cancel any pending roundtrip schedule
		this.stopAutoRoundtrip();

		function doRoundtrip() {
			//ExoWeb.trace.log("server", "auto-roundtrip starting ({0})", [new Date()]);
			this.roundtrip(function () {
				//ExoWeb.trace.log("server", "auto-roundtrip complete ({0})", [new Date()]);
				this._roundtripTimeout = window.setTimeout(doRoundtrip.bind(this), interval);
			});
		}

		this._roundtripTimeout = window.setTimeout(doRoundtrip.bind(this), interval);
	},
	stopAutoRoundtrip: function ServerSync$stopAutoRoundtrip() {
		if (this._roundtripTimeout) {
			window.clearTimeout(this._roundtripTimeout);
		}
	},
	addRoundtripBegin: function (handler) {
		this._addEvent("roundtripBegin", handler);
	},
	removeRoundtripBegin: function (handler) {
		this._removeEvent("roundtripBegin", handler);
	},
	addRoundtripEnd: function (handler) {
		this._addEvent("roundtripEnd", handler);
	},
	removeRoundtripEnd: function (handler) {
		this._removeEvent("roundtripEnd", handler);
	},
	addRoundtripSuccess: function (handler) {
		this._addEvent("roundtripSuccess", handler);
	},
	removeRoundtripSuccess: function (handler) {
		this._removeEvent("roundtripSuccess", handler);
	},
	addRoundtripFailed: function (handler) {
		this._addEvent("roundtripFailed", handler);
	},
	removeRoundtripFailed: function (handler) {
		this._removeEvent("roundtripFailed", handler);
	},

	// Save
	///////////////////////////////////////////////////////////////////////
	save: function ServerSync$save(root, success, failed) {
		pendingRequests++;

		// Checkpoint the log to ensure that we only truncate changes that were saved.
		var checkpoint = this._changeLog.checkpoint("save " + (new Date()).format("d"));

		Observer.setValue(this, "PendingSave", true);

		var args = { type: "save", root: root, checkpoint: checkpoint };
		this._raiseBeginEvents("save", args);

		saveProvider(
			toExoModel(root, this._translator),
			serializeChanges.call(this, false, root),
			this._onSaveSuccess.bind(this).appendArguments(args, checkpoint, success),
			this._onSaveFailed.bind(this).appendArguments(args, failed || success)
		);
	},
	_onSaveSuccess: function ServerSync$_onSaveSuccess(result, args, checkpoint, callback) {
		Observer.setValue(this, "PendingSave", false);

		args.responseObject = result;

		this._handleResult(result, "save", checkpoint, function () {
			this._raiseEndEvents("save", "Success", args);

			if (callback && callback instanceof Function)
				callback.call(this, result);

			pendingRequests--;
		});
	},
	_onSaveFailed: function (error, args, callback) {
		Observer.setValue(this, "PendingSave", false);

		args.error = error;

		this._raiseEndEvents("save", "Failed", args);

		if (callback && callback instanceof Function)
			callback.call(this, error);

		pendingRequests--;
	},
	startAutoSave: function ServerSync$startAutoSave(root, interval) {
		// cancel any pending save schedule
		this.stopAutoSave();
		this._saveInterval = interval;
		this._saveRoot = root;
	},
	stopAutoSave: function ServerSync$stopAutoSave() {
		if (this._saveTimeout) {
			window.clearTimeout(this._saveTimeout);
			this._saveTimeout = null;
		}

		this._saveInterval = null;
		this._saveRoot = null;
	},
	_queueAutoSave: function ServerSync$_queueAutoSave() {
		if (this._saveTimeout)
			return;

		function doAutoSave() {
			//ExoWeb.trace.log("server", "auto-save starting ({0})", [new Date()]);
			this.save(this._saveRoot, function ServerSync$doAutoSave$callback() {
				//ExoWeb.trace.log("server", "auto-save complete ({0})", [new Date()]);

				// wait for the next change before next auto save
				this._saveTimeout = null;
			});
		}

		this._saveTimeout = window.setTimeout(doAutoSave.bind(this), this._saveInterval);
	},
	addSaveBegin: function (handler) {
		this._addEvent("saveBegin", handler);
	},
	removeSaveBegin: function (handler) {
		this._removeEvent("saveBegin", handler);
	},
	addSaveEnd: function (handler) {
		this._addEvent("saveEnd", handler);
	},
	removeSaveEnd: function (handler) {
		this._removeEvent("saveEnd", handler);
	},
	addSaveSuccess: function (handler) {
		this._addEvent("saveSuccess", handler);
	},
	removeSaveSuccess: function (handler) {
		this._removeEvent("saveSuccess", handler);
	},
	addSaveFailed: function (handler) {
		this._addEvent("saveFailed", handler);
	},
	removeSaveFailed: function (handler) {
		this._removeEvent("saveFailed", handler);
	},

	// Apply Changes
	///////////////////////////////////////////////////////////////////////
	applyChanges: function (checkpoint, changes, source, filter, beforeApply, afterApply, callback, thisPtr) {
		if (!changes || !(changes instanceof Array)) {
			if (callback) {
				callback.call(thisPtr || this);
			}
			return;
		}

		var newChanges = 0;

		var signal = new Signal("applyChanges");
		var waitForAllRegistered = false;

		try {
			var batch = ExoWeb.Batch.start("apply changes");

			this.beginApplyingChanges();

			if ((source !== undefined && source !== null && (!this._changeLog.activeSet() || this._changeLog.activeSet().source() !== source)) || this.isCapturingChanges()) {
				this._changeLog.start(source || "unknown");
			}

			var currentChanges = this._changeLog.count(this.canSave, this);
			var totalChanges = changes.length;

			// Determine that the target of a change is a new instance
			var instanceIsNew = function (change) {
				if (ExoWeb.Model.Model.getJsType(change.instance.type, true)) {
					var obj = fromExoModel(change.instance, this._translator);
					return obj && obj.meta.isNew;
				}
				return false;
			};

			// truncate change log up-front if save occurred
			var shouldDiscardChange;
			var saveChanges = changes.filter(function (c, i) { return c.type === "Save"; });
			var numSaveChanges = saveChanges.length;
			if (numSaveChanges > 0) {
				// Collect all of the id changes in the response. Multiple saves could occur.
				var idChanges = saveChanges.mapToArray(function (change) { return change.added || []; });

				// Create a list of new instances that were saved. Use a typed identifier form since the id stored
				// in changes in the change log will be a server id rather than client id (if there is a distinction)
				// and using the typed identifier approach allows for a straightforward search of the array.
				var newInstancesSaved = idChanges.map(function (idChange) { return idChange.type + "|" + idChange.oldId; });

				// Truncate changes that we believe were actually saved based on the response
				shouldDiscardChange = function (change) {
					var couldHaveBeenSaved, isNewObjectNotYetSaved;

					// Determine if the change could have been saved in the first place
					couldHaveBeenSaved = this.canSave(change);

					// Determine if the change targets a new object that has not been saved
					isNewObjectNotYetSaved = change.instance && (change.instance.isNew || instanceIsNew.call(this, change)) && !newInstancesSaved.contains(change.instance.type + "|" + change.instance.id);

					// Return a value indicating whether or not the change should be removed
					return couldHaveBeenSaved && !isNewObjectNotYetSaved;
				};

				// Truncate changes that we believe were actually saved based on the response
				this._changeLog.truncate(checkpoint, shouldDiscardChange.bind(this));

				// Update affected scope queries
				idChanges.forEach(function (idChange) {
					var jstype = ExoWeb.Model.Model.getJsType(idChange.type, true);
					if (jstype && ExoWeb.Model.LazyLoader.isLoaded(jstype.meta)) {
						var serverOldId = idChange.oldId;
						var clientOldId = !(idChange.oldId in jstype.meta._pool) ?
							this._translator.reverse(idChange.type, serverOldId) :
							idChange.oldId;
						this._scopeQueries.forEach(function (query) {
							query.ids = query.ids.map(function (id) {
								return (id === clientOldId) ? idChange.newId : id;
							}, this);
						}, this);
					}
				}, this);
			}

			var numPendingSaveChanges = numSaveChanges;

			changes.forEach(function (change, changeIndex) {
				if (change.type === "InitNew") {
					this.applyInitChange(change, beforeApply, afterApply, signal.pending());
				}
				else if (change.type === "ReferenceChange") {
					this.applyRefChange(change, beforeApply, afterApply, signal.pending());
				}
				else if (change.type === "ValueChange") {
					this.applyValChange(change, beforeApply, afterApply, signal.pending());
				}
				else if (change.type === "ListChange") {
					this.applyListChange(change, beforeApply, afterApply, signal.pending());
				}
				else if (change.type === "Save") {
					this.applySaveChange(change, beforeApply, afterApply, signal.pending());
					numPendingSaveChanges--;
				}

				if (change.type !== "Save") {
					var noObjectsWereSaved = numSaveChanges === 0;
					var hasPendingSaveChanges = numPendingSaveChanges > 0;

					// Only record a change if there is not a pending save change, also take into account new instances that are not saved
					if (noObjectsWereSaved || !hasPendingSaveChanges || !shouldDiscardChange.call(this, change)) {
						// Apply additional filter
						if (!filter || filter(change) === true) {
							newChanges++;
							this._changeLog.add(change);
						}
					}
				}
			}, this);

			// start a new set to capture future changes
			if (this.isCapturingChanges()) {
				this._changeLog.start("client");
			}

			waitForAllRegistered = true;
			signal.waitForAll(function () {
				this.endApplyingChanges();
				ExoWeb.Batch.end(batch);
				if (callback) {
					callback.call(thisPtr || this);
				}
			}, this, true);
		}
		finally {
			if (!waitForAllRegistered) {
				this.endApplyingChanges();
				ExoWeb.Batch.end(batch);
			}
		}

		// raise "HasPendingChanges" change event, only new changes were recorded
		if (newChanges > 0) {
			Observer.raisePropertyChanged(this, "HasPendingChanges");
		}
	},
	applySaveChange: function (change, before, after, callback, thisPtr) {
		if (!(change.added || change.deleted)) {
			if (callback) {
				callback.call(thisPtr || this);
			}
			return;
		}

		change.deleted.forEach(function (instance) {
			tryGetJsType(this.model, instance.type, null, false, function (type) {
				tryGetEntity(this.model, this._translator, type, instance.id, null, LazyLoadEnum.None, this.ignoreChanges(before, function (obj) {
					// Notify server object that the instance is deleted
					this.notifyDeleted(obj);
					// Simply a marker flag for debugging purposes
					obj.meta.isDeleted = true;
					// Unregister the object so that it can't be retrieved via get, known, or have rules execute against it
					type.meta.unregister(obj);
					// Remove affected scope queries
					this._scopeQueries.purge(function (query) {
						// Remove the deleted object's id from the scope query
						query.ids.purge(function (id) {
							return (id === obj.meta.id);
						}, this);
						// Remove the scope query if it is empty
						return query.ids.length === 0;
					}, this);
				}, after), this);
			}, this);
		}, this);

		change.added.forEach(function (idChange, idChangeIndex) {
			ensureJsType(this.model, idChange.type, this.ignoreChanges(before, function (jstype) {
				var serverOldId = idChange.oldId;
				var clientOldId = !(idChange.oldId in jstype.meta._pool) ?
						this._translator.reverse(idChange.type, serverOldId) :
						idChange.oldId;

				// If the client recognizes the old id then this is an object we have seen before
				if (clientOldId) {
					var type = this.model.type(idChange.type);

					// Attempt to load the object.
					var obj = type.get(clientOldId);

					// Ensure that the object exists.
					if (!obj) {
						ExoWeb.trace.throwAndLog("server",
							"Unable to change id for object of type \"{0}\" from \"{1}\" to \"{2}\" since the object could not be found.",
							[jstype.meta.get_fullName(), idChange.oldId, idChange.newId]
						);
					}

					// Change the id and make non-new.
					type.changeObjectId(clientOldId, idChange.newId);
					Observer.setValue(obj.meta, "isNew", false);

					// Update affected scope queries
					this._scopeQueries.forEach(function (query) {
						query.ids = query.ids.map(function (id) {
							return (id === clientOldId) ? idChange.newId : id;
						}, this);
					}, this);

					// Update post-save changes with new id
					function fixChangeInstanceDueToIdChange(inst) {
						if (inst) {
							var jstype = Model.getJsType(inst.type, true);
							if (jstype && obj === fromExoModel(inst, this._translator)) {
								inst.id = idChange.newId;
								inst.isNew = false;
							}
						}
					}

					this._changeLog._sets.forEach(function (set) {
						set._changes.forEach(function (change) {
							// Only process changes to model instances
							if (!change.instance) return;

							fixChangeInstanceDueToIdChange.call(this, change.instance);

							// For list changes additionally check added and removed objects.
							if (change.type === "ListChange") {
								if (change.added.length > 0)
									change.added.forEach(fixChangeInstanceDueToIdChange, this);
								if (change.removed.length > 0)
									change.removed.forEach(fixChangeInstanceDueToIdChange, this);
							}
							// For reference changes additionally check oldValue/newValue
							else if (change.type === "ReferenceChange") {
								fixChangeInstanceDueToIdChange.call(this, change.oldValue);
								fixChangeInstanceDueToIdChange.call(this, change.newValue);
							}
						}, this);
					}, this);
				}
				// Otherwise, log an error.
				else {
					ExoWeb.trace.logWarning("server",
						"Cannot apply id change on type \"{0}\" since old id \"{1}\" was not found.",
						idChange.type,
						idChange.oldId);
				}
			}, after), this);
		}, this);

		// Callback immediately since nothing will be force loaded
		if (callback) {
			callback.call(thisPtr || this);
		}
	},
	applyInitChange: function (change, before, after, callback, thisPtr) {
		tryGetJsType(this.model, change.instance.type, null, false, this.ignoreChanges(before, function (jstype) {
			if (!jstype.meta.get(change.instance.id)) {
				// Create the new object
				var newObj = new jstype();

				// Check for a translation between the old id that was reported and an actual old id.  This is
				// needed since new objects that are created on the server and then committed will result in an accurate
				// id change record, but "instance.id" for this change will actually be the persisted id.
				var serverOldId = this._translator.forward(change.instance.type, change.instance.id) || change.instance.id;

				// Remember the object's client-generated new id and the corresponding server-generated new id
				this._translator.add(change.instance.type, newObj.meta.id, serverOldId);
			}
		}, after), this);

		// Callback immediately since nothing will be force loaded
		if (callback) {
			callback.call(thisPtr || this);
		}
	},
	applyRefChange: function (change, before, after, callback, thisPtr) {
		var exited = false;
		var callImmediately = true;

		tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(this.model, this._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, this.ignoreChanges(before, function (srcObj) {
				// Update change to reflect the object's new id
				ServerSync$retroactivelyFixChangeWhereIdChanged(change.instance, srcObj);

				// Cache the property since it is not a simple property access.
				var property = srcObj.meta.property(change.property);

				// Apply change
				if (change.newValue) {
					// Don't call immediately since we may need to lazy load the type
					if (!exited) {
						callImmediately = false;
					}

					tryGetJsType(this.model, change.newValue.type, null, true, this.ignoreChanges(before, function (refType) {
						var refObj = fromExoModel(change.newValue, this._translator, true);

						// Update change to reflect the object's new id
						ServerSync$retroactivelyFixChangeWhereIdChanged(change.newValue, refObj);

						// Update change to reflect the object's new id
						if (change.newValue.id === refObj.meta.legacyId) {
							change.newValue.id = refObj.meta.id;
						}

						// Manually ensure a property value, if it doesn't have one then it will be marked as pendingInit
						Property$_ensureInited.call(property, srcObj);

						// Mark the property as no longer pending init since its value is being established
						srcObj.meta.pendingInit(property, false);

						// Set the property value
						Observer.setValue(srcObj, change.property, refObj);

						// Callback once the type has been loaded
						if (!callImmediately && callback) {
							callback.call(thisPtr || this);
						}
					}, after), this);
				}
				else {
					// Manually ensure a property value, if it doesn't have one then it will be marked as pendingInit
					Property$_ensureInited.call(property, srcObj);

					// Mark the property as no longer pending init since its value is being established
					srcObj.meta.pendingInit(property, false);

					// Set the property value
					Observer.setValue(srcObj, change.property, null);
				}

				// Update oldValue's id in change object
				if (change.oldValue) {
					tryGetJsType(this.model, change.oldValue.type, null, true, this.ignoreChanges(before, function (refType) {
						// Update change to reflect the object's new id
						var refObj = fromExoModel(change.oldValue, this._translator, true);
						ServerSync$retroactivelyFixChangeWhereIdChanged(change.oldValue, refObj);
					}, after), this);
				}
			}, after), this);
		}, this);

		// Callback immediately since nothing will be force loaded...yet
		if (callImmediately && callback) {
			callback.call(thisPtr || this);
		}

		exited = true;
	},
	applyValChange: function (change, before, after, callback, thisPtr) {
		tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(this.model, this._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, this.ignoreChanges(before, function (srcObj) {
				// Update change to reflect the object's new id
				ServerSync$retroactivelyFixChangeWhereIdChanged(change.instance, srcObj);

				// Cache the new value, becuase we access it many times and also it may be modified below
				// to account for timezone differences, but we don't want to modify the actual change object.
				var newValue = change.newValue;

				// Cache the property since it is not a simple property access.
				var property = srcObj.meta.property(change.property);

				if (property.get_jstype() === Date && newValue && newValue.constructor == String && newValue.length > 0) {

					// Convert from string (e.g.: "2011-07-28T06:00:00.000Z") to date.
					dateRegex.lastIndex = 0;
					newValue = new Date(newValue.replace(dateRegex, dateRegexReplace));

					//now that we have the value set for the date.
					//if the underlying property datatype is actually a date and not a datetime
					//then we need to add the local timezone offset to make sure that the date is displayed acurately.
					if (property.get_format() && !hasTimeFormat.test(property.get_format().toString())) {
						var serverOffset = this.get_ServerTimezoneOffset();
						var localOffset = -(new Date().getTimezoneOffset() / 60);
						newValue = newValue.addHours(serverOffset - localOffset);
					}
				}
				else if (newValue && newValue instanceof TimeSpan) {
					newValue = newValue.toObject();
				}

				// Manually ensure a property value, if it doesn't have one then it will be marked as pendingInit
				Property$_ensureInited.call(property, srcObj);

				// Mark the property as no longer pending init since its value is being established
				srcObj.meta.pendingInit(property, false);

				// Set the property value
				Observer.setValue(srcObj, change.property, newValue);
			}, after), this);
		}, this);

		// Callback immediately since nothing will be force loaded
		if (callback) {
			callback.call(thisPtr || this);
		}
	},
	applyListChange: function (change, before, after, callback, thisPtr) {
		var exited = false;
		var callImmediately = true;

		tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(this.model, this._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, this.ignoreChanges(before, function (srcObj) {
				// Update change to reflect the object's new id
				ServerSync$retroactivelyFixChangeWhereIdChanged(change.instance, srcObj);

				var prop = srcObj.meta.property(change.property);
				var list = prop.value(srcObj);

				list.beginUpdate();

				var listSignal = new ExoWeb.Signal("applyListChange-items");

				// apply added items
				if (change.added.length > 0) {
					// Don't call immediately since we may need to lazy load the type
					if (!exited) {
						callImmediately = false;
					}

					// Add each item to the list after ensuring that the type is loaded
					change.added.forEach(function (item) {
						tryGetJsType(this.model, item.type, null, true, listSignal.pending(this.ignoreChanges(before, function (itemType) {
							var itemObj = fromExoModel(item, this._translator, true);

							// Update change to reflect the object's new id
							ServerSync$retroactivelyFixChangeWhereIdChanged(item, itemObj);

							if (!list.contains(itemObj)) {
								ListLazyLoader.allowModification(list, function () {
									list.add(itemObj);
								});
							}
						}, after)), this, true);
					}, this);
				}

				// apply removed items
				change.removed.forEach(function (item) {
					// no need to load instance only to remove it from a list when it can't possibly exist
					tryGetJsType(this.model, item.type, null, false, this.ignoreChanges(before, function (itemType) {
						var itemObj = fromExoModel(item, this._translator, true);

						// Update change to reflect the object's new id
						ServerSync$retroactivelyFixChangeWhereIdChanged(item, itemObj);

						ListLazyLoader.allowModification(list, function () {
							list.remove(itemObj);
						});
					}, after), this, true);
				}, this);

				// don't end update until the items have been loaded
				listSignal.waitForAll(this.ignoreChanges(before, function () {
					if (exited) {
						this.beginApplyingChanges();
					}
					ListLazyLoader.allowModification(list, function () {
						list.endUpdate();
					});
					if (exited) {
						this.endApplyingChanges();
					}
					// Callback once all instances have been added
					if (!callImmediately && callback) {
						callback.call(thisPtr || this);
					}
				}, after), this, true);
			}, after), this);
		}, this);

		// Callback immediately since nothing will be force loaded...yet
		if (callImmediately && callback) {
			callback.call(thisPtr || this);
		}

		exited = true;
	},

	// Checkpoint
	///////////////////////////////////////////////////////////////////////
	checkpoint: function ServerSync$checkpoint() {
		return this._changeLog.checkpoint();
	},

	// Rollback
	///////////////////////////////////////////////////////////////////////
	rollback: function ServerSync$rollback(checkpoint, callback, thisPtr) {
		var signal = new Signal("rollback");
		var waitForAllRegistered = false;
		
		try {
			var batch = ExoWeb.Batch.start("rollback changes");

			this.beginApplyingChanges();

			var change = this._changeLog.undo();
			while (change && !(change.type === "Checkpoint" && change.code === checkpoint)) {
				if (change.type == "InitNew") {
					this.rollbackInitChange(change, signal.pending());
				}
				else if (change.type == "ReferenceChange") {
					this.rollbackRefChange(change, signal.pending());
				}
				else if (change.type == "ValueChange") {
					this.rollbackValChange(change, signal.pending());
				}
				else if (change.type == "ListChange") {
					this.rollbackListChange(change, signal.pending());
				}

				change = this._changeLog.undo();
			}

			waitForAllRegistered = true;
			signal.waitForAll(function () {
				this.endApplyingChanges();
				ExoWeb.Batch.end(batch);
				if (callback) {
					callback.call(thisPtr || this);
				}
				Observer.raisePropertyChanged(this, "HasPendingChanges");
			}, this, true);
		}
		finally {
			// the signal was not registered, therefore we need to handle endApplyingChanges call here
			if (!waitForAllRegistered) {
				this.endApplyingChanges();
				ExoWeb.Batch.end(batch);
			}
		}
	},
	rollbackValChange: function ServerSync$rollbackValChange(change, callback) {
		tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(this.model, this._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, function (srcObj) {

				Observer.setValue(srcObj, change.property, change.oldValue);
				callback();

			}, this);
		}, this);
	},
	rollbackRefChange: function ServerSync$rollbackRefChange(change, callback) {
		tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(this.model, this._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, function (srcObj) {
				if (change.oldValue) {
					tryGetJsType(this.model, change.oldValue.type, null, true, function (refType) {
						tryGetEntity(this.model, this._translator, refType, change.oldValue.id, change.property, LazyLoadEnum.None, function (refObj) {
							Observer.setValue(srcObj, change.property, refObj);
							callback();
						}, this);
					}, this);
				}
				else {
					Observer.setValue(srcObj, change.property, null);
					callback();
				}
			}, this);
		}, this);
	},
	rollbackInitChange: function ServerSync$rollbackInitChange(change, callback) {
		//TODO: need to remove from the translator
		callback();
	},
	rollbackListChange: function ServerSync$rollbackListChange(change, callback) {
		tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(this.model, this._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, function (srcObj) {
				var prop = srcObj.meta.property(change.property);
				var list = prop.value(srcObj);
				var translator = this._translator;

				list.beginUpdate();

				// Rollback added items
				Array.forEach(change.added, function rollbackListChanges$added(item) {
					tryGetJsType(this.model, item.type, null, false, function (itemType) {
						var childObj = fromExoModel(item, translator);
						if (childObj) {
							list.remove(childObj);
						}
					}, this);
				});

				// Rollback removed items
				Array.forEach(change.removed, function rollbackListChanges$added(item) {
					tryGetJsType(this.model, item.type, null, true, function (itemType) {
						var childObj = fromExoModel(item, translator, true);

						list.add(childObj);
					}, this);
				});

				list.endUpdate();

				callback();
			}, this);
		}, this);
	},

	// Various
	///////////////////////////////////////////////////////////////////////
	_captureChange: function ServerSync$_captureChange(change) {
		if (!this.isApplyingChanges() && this.isCapturingChanges()) {
			if (change.property) {
				var instance = fromExoModel(change.instance, this._translator);
				var property = instance.meta.property(change.property);

				if (property.get_jstype() === Date && change.newValue && property.get_format() && !hasTimeFormat.test(property.get_format().toString())) {
					var serverOffset = this.get_ServerTimezoneOffset();
					var localOffset = -(new Date().getTimezoneOffset() / 60);
					var difference = localOffset - serverOffset;
					change.newValue = change.newValue.addHours(difference);
				}
				else if (change.newValue && change.newValue instanceof TimeSpan) {
					change.newValue = change.newValue.toObject();
				}
			}

			this._changeLog.add(change);

			Observer.raisePropertyChanged(this, "HasPendingChanges");

			if (this._saveInterval && this.canSave(change) && isPropertyChangePersisted(change)) {
				this._queueAutoSave();
			}
		}
	},
	changes: function ServerSync$changes(includeAllChanges, simulateInitRoot, excludeNonPersisted) {
		var list = [];
		var sets = serializeChanges.call(this, includeAllChanges, simulateInitRoot);
		sets.forEach(function (set) {
			if (excludeNonPersisted) {
				list.addRange(set.changes.filter(isPropertyChangePersisted));
			}
			else {
				list.addRange(set.changes);
			}
		});
		return list;
	},
	get_Changes: function ServerSync$get_Changes(includeAllChanges/*, ignoreWarning*/) {
		if (arguments.length < 2 || arguments[1] !== true) {
			ExoWeb.trace.logWarning("server", "Method get_Changes is not intended for long-term use - it will be removed in the near future.");
		}
		return this.changes(includeAllChanges, null);
	},
	get_HasPendingChanges: function ServerSync$get_HasPendingChanges() {
		return this._changeLog.sets().some(function (set) {
			return set.changes().some(function (change) {
				return this.canSave(change);
			}, this);
		}, this);
	},
	get_PendingAction: function ServerSync$get_PendingAction() {
		return this._pendingServerEvent || this._pendingRoundtrip || this._pendingSave;
	},
	get_PendingServerEvent: function ServerSync$get_PendingServerEvent() {
		return this._pendingServerEvent;
	},
	set_PendingServerEvent: function ServerSync$set_PendingServerEvent(value) {
		var oldValue = this._pendingServerEvent;
		this._pendingServerEvent = value;

		if (oldValue !== value) {
			Observer.raisePropertyChanged(this, "PendingAction");
		}
	},
	get_PendingRoundtrip: function ServerSync$get_PendingRoundtrip() {
		return this._pendingRoundtrip;
	},
	set_PendingRoundtrip: function ServerSync$set_PendingRoundtrip(value) {
		var oldValue = this._pendingRoundtrip;
		this._pendingRoundtrip = value;

		if (oldValue !== value) {
			Observer.raisePropertyChanged(this, "PendingAction");
		}
	},
	get_PendingSave: function ServerSync$get_PendingSave() {
		return this._pendingSave;
	},
	set_PendingSave: function ServerSync$set_PendingSave(value) {
		var oldValue = this._pendingSave;
		this._pendingSave = value;

		if (oldValue !== value) {
			Observer.raisePropertyChanged(this, "PendingAction");
		}
	},
	get_ServerTimezoneOffset: function ServerSync$get_ServerTimezoneOffset() {
		//if we have not set the server timezone offset yet, retrieve it from the server
		var timezoneOffset = 0;

		if (this._serverInfo !== null) {
			timezoneOffset = this._serverInfo.TimeZoneOffset;
		}

		return timezoneOffset;
	},
	set_ServerInfo: function ServerSync$set_ServerTimezoneOffset(newInfo) {
		//join the new server info with the information that you are adding.
		this._serverInfo = this._serverInfo ? $.extend(this._serverInfo, newInfo) : newInfo;
	}
});

ExoWeb.Mapper.ServerSync = ServerSync;

ServerSync.Save = function ServerSync$Save(root, success, failed) {
	root.meta.type.model.server.save(root, success, failed);
};

ServerSync.GetServerTimeZone = function ServerSync$GetServerTimeZone(root) {
	return root.meta.type.model.server.get_ServerTimezoneOffset(root);
};
