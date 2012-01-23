function ChangeLog() {
	this._activeSet = null;
	this._sets = [];
}

ChangeLog.mixin(Functor.eventing);

ChangeLog.mixin({
	activeSet: function () {
		// Returns the active change set.

		return this._activeSet;
	},
	add: function (change) {
		// Adds a new change to the log.

		if (this._activeSet === null) {
			ExoWeb.trace.throwAndLog("server", "The change log is not currently active.");
		}

		var idx = this._activeSet.add(change);

		this._raiseEvent("changeAdded", [change, idx, this._activeSet, this]);

		return idx;
	},
	addChangeAdded: function (fn, filter, once) {
		this._addEvent("changeAdded", fn, filter, once);
	},
	addChangeSetStarted: function (fn, filter, once) {
		this._addEvent("changeSetStarted", fn, filter, once);
	},
	addChangeUndone: function (fn, filter, once) {
		this._addEvent("changeUndone", fn, filter, once);
	},
	addSet: function (source, changes) {
		this._sets.push(new ChangeSet(source, changes));
	},
	addTruncated: function (fn, filter, once) {
		this._addEvent("truncated", fn, filter, once);
	},
	checkpoint: function (title, code) {
		if (this._activeSet && this._sets.some(function (s) { return s.changes().length > 0; })) {
			return this._activeSet.checkpoint(title, code);
		}
	},
	count: function (filter, thisPtr) {
		var result = 0;
		forEach(this._sets, function (set) {
			result += set.count(filter, thisPtr);
		}, this);
		return result;
	},
	lastChange: function () {
		for (var i = this._sets.length - 1; i >= 0; i--) {
			var set = this._sets[i];
			var change = set.lastChange();
			if (change !== null && change !== undefined) {
				return change;
			}
		}

		return null;
	},
	serialize: function (filter, thisPtr) {
		// Serializes the log and it's sets, including
		// those changes that pass the given filter.

		return this._sets.map(function (set) {
			return set.serialize(filter, thisPtr);
		});
	},
	set: function (index) {
		if (index === null || index === undefined || Object.prototype.toString.call(index) !== "[object Number]") {
			throw Error("The set method expects a numeric index argument.");
		}

		var idx = index < 0 ? (this._sets.length + index) : index;
		return this._sets[idx];
	},
	sets: function () {
		// Returns the current list of sets.

		return this._sets;
	},
	start: function (source) {
		// Starts a new change set, which means that new changes will
		// be added to the new set from this point forward.

		if (!source || source.constructor !== String) {
			ExoWeb.trace.throwAndLog("changeLog", "ChangeLog.start requires a string source argument.");
		}

		var set = new ChangeSet(source);
		var idx = this._sets.push(set) - 1;
		this._activeSet = set;

		this._raiseEvent("changeSetStarted", [set, idx, this]);

		return set;
	},
	truncate: function (checkpoint, filter, thisPtr) {
		// Removes all change sets where all changes match the given
		// filter.  If a set contains one or more changes that do NOT
		// match, the set is left intact with those changes.

		// Allow calling as function(filter, thisPtr)
		if (checkpoint && Object.prototype.toString.call(checkpoint) === "[object Function]") {
			thisPtr = filter;
			filter = checkpoint;
			checkpoint = null;
		}

		var numRemoved = 0;
		var foundCheckpoint = false;

		for (var i = 0; i < this._sets.length; i++) {
			if (checkpoint) {
				foundCheckpoint = this._sets[i].changes().some(function (c) {
					return c.type === "Checkpoint" && c.code === checkpoint;
				});
			}

			numRemoved += this._sets[i].truncate(checkpoint, filter, thisPtr);

			// If all changes have been removed (or all but the given checkpoint) then discard the set
			if (this._sets[i].changes().length === 0) {
				this._sets.splice(i--, 1);
				if (this._sets[i] === this._activeSet) {
					this._activeSet = null;
				}
			}

			if (foundCheckpoint)
				break;
		}

		// Start a new change set
		this.start("client");

		this._raiseEvent("truncated", [numRemoved, this]);
		return numRemoved;
	},
	undo: function () {
		if (!this._activeSet) {
			ExoWeb.trace.throwAndLog("server", "The change log is not currently active.");
		}

		var currentSet = this._activeSet,
			currentSetIndex = this._sets.indexOf(currentSet);

		while (!currentSet.changes().some(function(c) { return c.type !== "Checkpoint"; })) {
			// remove the set from the log
			this._sets.splice(currentSetIndex, 1);

			if (--currentSetIndex < 0) {
				return null;
			}

			currentSet = this._sets[currentSetIndex];
			this._activeSet = currentSet;
		}

		var idx = currentSet.changes().length - 1;
		var change = currentSet.undo();

		this._raiseEvent("changeUndone", [change, idx, currentSet, this]);

		return change;
	},
	// APPLY CHANGES
	///////////////////////////////////////////////////////////////////////
	applyChanges: function (checkpoint, changes, source, serverSync, filter, beforeApply, afterApply) {
		if (!changes || !(changes instanceof Array)) {
			return;
		}

		try {
			var batch = ExoWeb.Batch.start("apply changes");

			if ((source !== undefined && source !== null && (!this.activeSet() || this.activeSet().source() !== source)) || serverSync.isCapturingChanges()) {
				if (source) {
					this.start(source);
				}
				else {
					this.start("unknown");
					ExoWeb.trace.logWarning("server", "Changes to apply but no source is specified.");
				}
			}

			var newChanges = 0;
			var currentChanges = this.count(serverSync.canSave, serverSync);
			var totalChanges = changes.length;

			// truncate change log up-front if save occurred
			var saveChanges = changes.filter(function (c, i) { return c.type === "Save"; });
			var numSaveChanges = saveChanges.length;
			if (numSaveChanges > 0) {
				// Collect all of the id changes in the response. Multiple saves could occur.
				var idChanges = saveChanges.mapToArray(function(change) { return change.added || []; });

				// Create a list of new instances that were saved. Use a typed identifier form since the id stored
				// in changes in the change log will be a server id rather than client id (if there is a distinction)
				// and using the typed identifier approach allows for a straightforward search of the array.
				var newInstancesSaved = idChanges.map(function(idChange) { return idChange.type + "|" + idChange.oldId; });

				// Truncate changes that we believe were actually saved based on the response
				this.truncate(checkpoint, function(change) {
					var couldHaveBeenSaved, isNewObjectNotYetSaved;

					// Determine if the change could have been saved in the first place
					couldHaveBeenSaved = serverSync.canSave(change);

					// Determine if the change targets a new object that has not been saved
					isNewObjectNotYetSaved = change.instance && change.instance.isNew && !newInstancesSaved.contains(change.instance.type + "|" + change.instance.id);

					// Return a value indicating whether or not the change should be removed
					return couldHaveBeenSaved && !isNewObjectNotYetSaved;
				});

				// Update affected scope queries
				idChanges.forEach(function (idChange) {
					var jstype = ExoWeb.Model.Model.getJsType(idChange.type, true);
					if (jstype && ExoWeb.Model.LazyLoader.isLoaded(jstype.meta)) {
						var serverOldId = idChange.oldId;
						var clientOldId = !(idChange.oldId in jstype.meta._pool) ?
							serverSync._translator.reverse(idChange.type, serverOldId) :
							idChange.oldId;
						serverSync._scopeQueries.forEach(function (query) {
							query.ids = query.ids.map(function (id) {
								return (id === clientOldId) ? idChange.newId : id;
							}, this);
						}, this);
					}
				}, this);
			}

			changes.forEach(function (change, changeIndex) {
				if (change.type === "InitNew") {
					this.applyInitChange(change, serverSync, beforeApply, afterApply);
				}
				else if (change.type === "ReferenceChange") {
					this.applyRefChange(change, serverSync, beforeApply, afterApply);
				}
				else if (change.type === "ValueChange") {
					this.applyValChange(change, serverSync, beforeApply, afterApply);
				}
				else if (change.type === "ListChange") {
					this.applyListChange(change, serverSync, beforeApply, afterApply);
				}
				else if (change.type === "Save") {
					this.applySaveChange(change, serverSync, beforeApply, afterApply);
					numSaveChanges--;
				}

				// only record a change if there is not a pending save change
				if (change.type !== "Save" && numSaveChanges <= 0 && (!filter || filter(change) === true)) {
					newChanges++;
					this.add(change);
				}
			}, this);


			// start a new set to capture future changes
			if (serverSync.isCapturingChanges()) {
				this.start("client");
			}

			ExoWeb.Batch.end(batch);

			// raise "HasPendingChanges" change event, only new changes were recorded
			if (newChanges > 0) {
				Sys.Observer.raisePropertyChanged(serverSync, "HasPendingChanges");
			}
		}
		catch (e) {
			// attempt to clean up in the event of an error
			ExoWeb.Batch.end(batch);
			ExoWeb.trace.throwAndLog(["server"], e);
		}
	},
	applySaveChange: function (change, serverSync, before, after) {
		if (!change.added)
			return;

		change.added.forEach(function (idChange, idChangeIndex) {
			ensureJsType(serverSync._model, idChange.type, serverSync.ignoreChanges(before, function (jstype) {
				var serverOldId = idChange.oldId;
				var clientOldId = !(idChange.oldId in jstype.meta._pool) ?
						serverSync._translator.reverse(idChange.type, serverOldId) :
						idChange.oldId;

				// If the client recognizes the old id then this is an object we have seen before
				if (clientOldId) {
					var type = serverSync._model.type(idChange.type);

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
					Sys.Observer.setValue(obj.meta, "isNew", false);

					// Update affected scope queries
					serverSync._scopeQueries.forEach(function (query) {
						query.ids = query.ids.map(function (id) {
							return (id === clientOldId) ? idChange.newId : id;
						}, this);
					}, this);

					// Update post-save changes with new id
					function fixInstance(inst) {
						if (inst && obj === fromExoGraph(inst, serverSync._translator))
							inst.id = idChange.newId;
					}

					this._sets.forEach(function (set) {
						set._changes.forEach(function (change) {
							// Only process changes to graph instances
							if (!change.instance) return;

							fixInstance(change.instance);

							// For list changes additionally check added and removed objects.
							if (change.type === "ListChange") {
								if (change.added.length > 0)
									change.added.forEach(fixInstance);
								if (change.removed.length > 0)
									change.removed.forEach(fixInstance);
							}
							// For reference changes additionally check oldValue/newValue
							else if (change.type === "ReferenceChange") {
								fixInstance(change.oldValue);
								fixInstance(change.newValue);
							}
						}, this);
					}, this);
				}
				// Otherwise, log an error.
				else {
					ExoWeb.trace.logWarning("server",
						"Cannot apply id change on type \"{type}\" since old id \"{oldId}\" was not found.",
						idChange);
				}
			}, after), this);
		}, this);
	},
	applyInitChange: function (change, serverSync, before, after) {
		tryGetJsType(serverSync._model, change.instance.type, null, false, serverSync.ignoreChanges(before, function (jstype) {
			if (!jstype.meta.get(change.instance.id)) {
				// Create the new object
				var newObj = new jstype();

				// Check for a translation between the old id that was reported and an actual old id.  This is
				// needed since new objects that are created on the server and then committed will result in an accurate
				// id change record, but "instance.id" for this change will actually be the persisted id.
				var serverOldId = serverSync._translator.forward(change.instance.type, change.instance.id) || change.instance.id;

				// Remember the object's client-generated new id and the corresponding server-generated new id
				serverSync._translator.add(change.instance.type, newObj.meta.id, serverOldId);
			}
		}, after), this);
	},
	applyRefChange: function (change, serverSync, before, after) {
		tryGetJsType(serverSync._model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(serverSync._model, serverSync._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, serverSync.ignoreChanges(before, function (srcObj) {
				if (change.newValue) {
					tryGetJsType(serverSync._model, change.newValue.type, null, true, serverSync.ignoreChanges(before, function (refType) {
						var refObj = fromExoGraph(change.newValue, serverSync._translator, true);
						Sys.Observer.setValue(srcObj, change.property, refObj);
					}, after), this);
				}
				else {
					Sys.Observer.setValue(srcObj, change.property, null);
				}
			}, after), this);
		}, this);
	},
	applyValChange: function (change, serverSync, before, after) {
		tryGetJsType(serverSync._model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(serverSync._model, serverSync._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, serverSync.ignoreChanges(before, function (srcObj) {

				// Cache the new value, becuase we access it many times and also it may be modified below
				// to account for timezone differences, but we don't want to modify the actual change object.
				var newValue = change.newValue;
				
				// Cache the property since it is not a simple property access.
				var property = srcObj.meta.property(change.property);

				if (property.get_jstype() === Date && newValue && newValue.constructor == String && newValue.length > 0) {

					// Convert from string (e.g.: "2011-07-28T06:00:00.000Z") to date.
					newValue = Date.formats.$json.convertBack(newValue);

					//now that we have the value set for the date.
					//if the underlying property datatype is actually a date and not a datetime
					//then we need to add the local timezone offset to make sure that the date is displayed acurately.
					if (property.get_format() === Date.formats.ShortDate) {
						var serverOffset = serverSync.get_ServerTimezoneOffset();
						var localOffset = -(new Date().getTimezoneOffset() / 60);
						newValue.addHours(serverOffset - localOffset);
					}
				}

				Sys.Observer.setValue(srcObj, change.property, newValue);

			}, after), this);
		}, this);
	},
	applyListChange: function (change, serverSync, before, after) {
		tryGetJsType(serverSync._model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(serverSync._model, serverSync._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, serverSync.ignoreChanges(before, function (srcObj) {
				var prop = srcObj.meta.property(change.property, true);
				var list = prop.value(srcObj);

				list.beginUpdate();

				var listSignal = new ExoWeb.Signal("applyListChange-items");

				// apply added items
				change.added.forEach(function (item) {
					tryGetJsType(serverSync._model, item.type, null, true, listSignal.pending(serverSync.ignoreChanges(before, function (itemType) {
						var itemObj = fromExoGraph(item, serverSync._translator, true);
						if (!list.contains(itemObj)) {
							list.add(itemObj);
						}
					}, after)), this, true);
				}, this);

				// apply removed items
				change.removed.forEach(function (item) {
					// no need to load instance only to remove it from a list
					tryGetJsType(serverSync._model, item.type, null, false, serverSync.ignoreChanges(before, function (itemType) {
						var itemObj = fromExoGraph(item, serverSync._translator, true);
						list.remove(itemObj);
					}, after), this, true);
				}, this);

				// don't end update until the items have been loaded
				listSignal.waitForAll(serverSync.ignoreChanges(before, function () {
					list.endUpdate();
				}, after), this, true);
			}, after), this);
		}, this);
	}
});
exports.ChangeLog = ChangeLog; // IGNORE
