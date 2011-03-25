function ChangeLog() {
	this._activeSet = null;
	this._sets = [];
}

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

		this._activeSet.add(change);
	},
	addSet: function (source, changes) {
		this._sets.push(new ChangeSet(source, changes));
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
		this._sets.push(set);
		this._activeSet = set;
		return set;
	},
	truncate: function (filter, thisPtr) {
		// Removes all change sets where all changes match the given
		// filter.  If a set contains one or more changes that do NOT
		// match, the set is left intact with those changes.

		for (var i = 0; i < this._sets.length; i++) {
			this._sets[i].truncate(filter, thisPtr);

			// If all changes have been removed then discard the set
			if (this._sets[i].changes().length === 0) {
				this._sets.splice(i--, 1);
				if (this._sets[i] === this._activeSet) {
					this._activeSet = null;
				}
			}
		}

		// Start a new change set
		this.start("client");
	},
	undo: function () {
		if (!this._activeSet) {
			ExoWeb.trace.throwAndLog("server", "The change log is not currently active.");
		}

		var currentSet = this._activeSet,
			currentSetIndex = this._sets.indexOf(currentSet);

		while (currentSet.changes().length === 0) {
			// remove the set from the log
			this._sets.splice(currentSetIndex, 1);

			if (--currentSetIndex < 0) {
				return null;
			}

			currentSet = this._sets[currentSetIndex];
			this._activeSet = currentSet;
		}

		return currentSet.undo();
	},
	// APPLY CHANGES
	///////////////////////////////////////////////////////////////////////
	applyChanges: function (changes, source, serverSync, callback, thisPtr) {
		if (!changes || !(changes instanceof Array)) {
			return;
		}

		try {
			var batch = ExoWeb.Batch.start("apply changes");
			//					ExoWeb.trace.log("server", "begin applying {length} changes", changes);

			serverSync.beginApplyingChanges();

			if ((source !== undefined && source !== null && (!this.activeSet() || this.activeSet().source() !== source)) || serverSync.isCapturingChanges()) {
				if (source) {
					this.start(source);
				}
				else {
					this.start("unknown");
					ExoWeb.trace.logWarning("server", "Changes to apply but no source is specified.");
				}
			}

			var signal = new ExoWeb.Signal("ServerSync.apply");

			var totalChanges = changes.length;
			var newChanges = 0;
			var ignoreCount = 0;

			// NOTE: "save" changes are processed before the changes that they affect since the instances 
			// that are serialized and sent back to the client will always refer to their persisted 
			// identifiers, which will not be reflected on the client until the id changes are applied.  
			// Naively processing changes in order can result in cases where a change refers to an item 
			// that is already on the client by an id that it is not yet aware of.  The client will then 
			// fetch this data from the server, resulting in duplicate data and perhaps unexpected UI 
			// behavior.  If the data sent from the server refers to objects using point-in-time ids, 
			// then this process can be greatly simplified to simply process changes in order.

			function processNextChange() {
				var change = null;

				// don't record the change if we are still ignoring changes prior to a save
				var recordChange = (ignoreCount === 0);

				// look for remaining changes that are save changes, but only if 
				// we are finished processing changes that occurred before a save
				var saveChanges = null;

				// process the next save change
				if (saveChanges && saveChanges.length > 0) {
					// get the first save change
					change = saveChanges[0];
					// don't record changes before changes were saved
					ignoreCount = Array.indexOf(changes, change);
					// remove the save change from the underlying array if there are no preceeding changes
					if (ignoreCount === 0) {
						Array.remove(changes, change);
					}
				}
				// process the next change of any kind
				else {
					// decrement ignore count until it reaches zero
					ignoreCount = ignoreCount > 0 ? ignoreCount - 1 : 0;
					// pull off the next change to process
					change = Array.dequeue(changes);
				}

				if (change) {
					var callback = signal.pending(processNextChange, this);

					var ifApplied = (function (applied) {
						if (recordChange && applied) {
							newChanges++;
							this.add(change);
						}
						callback();
					}).bind(this);

					if (change.type == "InitNew") {
						this.applyInitChange(change, serverSync, ifApplied);
					}
					else if (change.type == "ReferenceChange") {
						this.applyRefChange(change, serverSync, ifApplied);
					}
					else if (change.type == "ValueChange") {
						this.applyValChange(change, serverSync, ifApplied);
					}
					else if (change.type == "ListChange") {
						this.applyListChange(change, serverSync, ifApplied);
					}
					else if (change.type == "Save") {
						var lookahead = (saveChanges && saveChanges.length > 0 && ignoreCount !== 0);
						this.applySaveChange(change, lookahead, serverSync, function () {
							// changes have been applied so truncate the log to this point
							this.truncate(this.canSave, this);
							Sys.Observer.raisePropertyChanged(serverSync, "HasPendingChanges");
							ifApplied.apply(this, arguments);
						});
					}
				}
			}

			processNextChange.call(this);

			signal.waitForAll(function () {
				//						ExoWeb.trace.log("server", "done applying {0} changes: {1} captured", [totalChanges, newChanges]);
				if (serverSync.isCapturingChanges()) {
					this.start("client");
				}
				serverSync.endApplyingChanges();
				ExoWeb.Batch.end(batch);
				if (callback && callback instanceof Function) {
					callback.call(thisPtr || this);
				}
				if (newChanges > 0) {
					Sys.Observer.raisePropertyChanged(serverSync, "HasPendingChanges");
				}
			}, this);
		}
		catch (e) {
			serverSync.endApplyingChanges();
			ExoWeb.trace.throwAndLog(["server"], e);
		}
	},
	applySaveChange: function (change, isLookahead, serverSync, callback) {
		//				ExoWeb.trace.log("server", "applySaveChange: {0} changes", [change.idChanges ? change.idChanges.length : "0"]);

		if (change.idChanges && change.idChanges.length > 0) {

			var index = 0;

			var processNextIdChange = function processNextIdChange() {
				if (index == change.idChanges.length) {
					callback.call(this);
				}
				else {
					var idChange = change.idChanges[index++];

					ensureJsType(serverSync._model, idChange.type, function applySaveChange$typeLoaded(jstype) {
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
							// TODO
							//// Ensure that the object is a new object.
							//else if (!obj.meta.isNew) {
							//	ExoWeb.trace.throwAndLog("server",
							//		"Changing id for object of type \"{0}\" from \"{1}\" to \"{2}\", but the object is not new.",
							//		[jstype.meta.get_fullName(), idChange.oldId, idChange.newId]
							//	);
							//}

							// Change the id and make non-new.
							type.changeObjectId(clientOldId, idChange.newId);
							Sys.Observer.setValue(obj.meta, "isNew", false);

							// Update affected scope queries
							serverSync._scopeQueries.forEach(function (query) {
								query.ids = query.ids.map(function (id) {
									return (id === clientOldId) ? idChange.newId : id;
								}, this);
							}, this);

							// Remove the id change from the list and move the index back.
							Array.remove(change.idChanges, idChange);
							index = (index === 0) ? 0 : index - 1;
						}
						// Otherwise, if this is a lookahead pass, make a note of the new object 
						// that was created on the server so that we can correct the ids later
						else if (isLookahead) {
							// The server knows the correct old id, but the client will see a new object created with a persisted id 
							// since it was created and then committed.  Translate from the persisted id to the server's old id so that 
							// we can reverse it when creating new objects from the server.  Also, a reverse record should not be added.
							var unpersistedId = idChange.oldId;
							var persistedId = idChange.newId;
							serverSync._translator.add(idChange.type, persistedId, unpersistedId, true);
						}
						// Otherwise, log an error.
						else {
							ExoWeb.trace.logWarning("server",
								"Cannot apply id change on type \"{type}\" since old id \"{oldId}\" was not found.",
								idChange);
						}

						processNextIdChange.call(this);
					}, this);
				}
			};

			// start processing id changes, use call so that "this" pointer refers to ServerSync object
			processNextIdChange.call(this);
		}
		else {
			callback.call(this);
		}
	},
	applyInitChange: function (change, serverSync, callback) {
		//				ExoWeb.trace.log("server", "applyInitChange: Type = {type}, Id = {id}", change.instance);

		var translator = serverSync._translator;

		ensureJsType(serverSync._model, change.instance.type,
			function applyInitChange$typeLoaded(jstype) {
				// Create the new object
				var newObj = new jstype();

				// Check for a translation between the old id that was reported and an actual old id.  This is
				// needed since new objects that are created on the server and then committed will result in an accurate
				// id change record, but "instance.id" for this change will actually be the persisted id.
				var serverOldId = translator.forward(change.instance.type, change.instance.id) || change.instance.id;

				// Remember the object's client-generated new id and the corresponding server-generated new id
				translator.add(change.instance.type, newObj.meta.id, serverOldId);

				callback(true);
			});
	},
	applyRefChange: function (change, serverSync, callback) {
		//				ExoWeb.trace.log("server", "applyRefChange: Type = {instance.type}, Id = {instance.id}, Property = {property}", change);

		var returnImmediately = !ExoWeb.config.aggressiveLog;

		tryGetJsType(serverSync._model, change.instance.type, change.property, ExoWeb.config.aggressiveLog, function (srcType) {
			tryGetEntity(serverSync._model, serverSync._translator, srcType, change.instance.id, change.property, ExoWeb.config.aggressiveLog ? LazyLoadEnum.ForceAndWait : LazyLoadEnum.None, function (srcObj) {

				// Call ballback here if type and instance were
				// present immediately or aggressive mode is turned on
				var doCallback = returnImmediately || ExoWeb.config.aggressiveLog;

				// Indicate that type and instance were present immediately
				returnImmediately = false;

				if (change.newValue) {
					tryGetJsType(serverSync._model, change.newValue.type, null, true, function (refType) {
						var refObj = fromExoGraph(change.newValue, serverSync._translator);
						var changed = ExoWeb.getValue(srcObj, change.property) != refObj;

						Sys.Observer.setValue(srcObj, change.property, refObj);

						if (doCallback) {
							callback(changed);
						}
					}, this);
				}
				else {
					var changed = ExoWeb.getValue(srcObj, change.property) != null;

					Sys.Observer.setValue(srcObj, change.property, null);

					if (doCallback) {
						callback(changed);
					}
				}
			}, this);
		}, this);

		// call callback here if target type or instance is not
		// present and aggressive log behavior is not turned on
		if (returnImmediately) {
			callback();
		}

		returnImmediately = false;
	},
	applyValChange: function (change, serverSync, callback) {
		//				ExoWeb.trace.log("server", "applyValChange", change.instance);

		var returnImmediately = !ExoWeb.config.aggressiveLog;

		tryGetJsType(serverSync._model, change.instance.type, change.property, ExoWeb.config.aggressiveLog, function (srcType) {
			tryGetEntity(serverSync._model, serverSync._translator, srcType, change.instance.id, change.property, ExoWeb.config.aggressiveLog ? LazyLoadEnum.ForceAndWait : LazyLoadEnum.None, function (srcObj) {

				// Call ballback here if type and instance were
				// present immediately or aggressive mode is turned on
				var doCallback = returnImmediately || ExoWeb.config.aggressiveLog;

				// Indicate that type and instance were present immediately
				returnImmediately = false;

				var changed = ExoWeb.getValue(srcObj, change.property) != change.newValue;

				if (srcObj.meta.property(change.property).get_jstype() == Date && change.newValue && change.newValue.constructor == String && change.newValue.length > 0) {
					change.newValue = change.newValue.replace(dateRegex, dateRegexReplace);
					change.newValue = new Date(change.newValue);
				}

				Sys.Observer.setValue(srcObj, change.property, change.newValue);

				if (doCallback) {
					callback(changed);
				}
			}, this);
		}, this);

		if (returnImmediately) {
			callback();
		}

		returnImmediately = false;
	},
	applyListChange: function (change, serverSync, callback) {
		//				ExoWeb.trace.log("server", "applyListChange", change.instance);

		var returnImmediately = !ExoWeb.config.aggressiveLog;

		tryGetJsType(serverSync._model, change.instance.type, change.property, ExoWeb.config.aggressiveLog, function (srcType) {
			tryGetEntity(serverSync._model, serverSync._translator, srcType, change.instance.id, change.property, ExoWeb.config.aggressiveLog ? LazyLoadEnum.ForceAndWait : LazyLoadEnum.None, function (srcObj) {

				// Call callback here if type and instance were
				// present immediately or aggressive mode is turned on
				var doCallback = returnImmediately || ExoWeb.config.aggressiveLog;

				// Indicate that type and instance were present immediately
				returnImmediately = false;

				var prop = srcObj.meta.property(change.property, true);
				var list = prop.value(srcObj);

				list.beginUpdate();

				var listSignal = new ExoWeb.Signal("applyListChange-items");

				// apply added items
				Array.forEach(change.added, function ServerSync$applyListChanges$added(item) {
					tryGetJsType(serverSync._model, item.type, null, true, listSignal.pending(function (itemType) {
						var itemObj = fromExoGraph(item, serverSync._translator);
						if (list.indexOf(itemObj) < 0) {
							list.add(itemObj);
						}
					}), this);
				}, this);

				// apply removed items
				Array.forEach(change.removed, function ServerSync$applyListChanges$removed(item) {
					// no need to load instance only to remove it from a list
					tryGetJsType(serverSync._model, item.type, null, false, function (itemType) {
						var itemObj = fromExoGraph(item, serverSync._translator);
						list.remove(itemObj);
					}, this);
				}, this);

				// don't end update until the items have been loaded
				listSignal.waitForAll(function () {
					list.endUpdate();
					if (doCallback) {
						callback(true);
					}
				}, this);

			}, this);
		}, this);

		if (returnImmediately) {
			callback();
		}

		returnImmediately = false;
	}
});
exports.ChangeLog = ChangeLog; // IGNORE
