function ListLazyLoader() {
}

function listLoad(list, propName, inScope, callback, thisPtr) {
	var signal = new ExoWeb.Signal("list lazy loader");

	var model = list._ownerProperty.get_containingType().model;
	var ownerId = list._ownerId;
	var containingType = list._ownerProperty.get_containingType();

	// Determine the instance or type that owns the list.
	var owner = ownerId === STATIC_ID ?

		// For static lists the owner is a type.
		containingType.get_jstype() :

		// For non-static lists, retrieve the owner by type and id.
		containingType.get(
			// Fetch the owner using the id specified in the lazy loader metadata.
			ownerId,

			// When loading a list the type of the owner comes from the containing
			// type of the property, so it may not be the exact type of the instance.
			false
		);

	var ownerType = ownerId === STATIC_ID ? owner.meta.get_fullName() : owner.meta.type.get_fullName();
	var prop = list._ownerProperty;
	var propIndex = list._ownerProperty.get_index();
	var propName = list._ownerProperty.get_name();
	var propType = list._ownerProperty.get_jstype().meta;

	if (!ExoWeb.config.allowListLazyLoading) {
		throw new Error($format("List lazy loading has been disabled: {0}|{1}.{2}", ownerType, ownerId, propName));
	}

	// load the objects in the list
	logWarning($format("Lazy load list: {0}|{1}.{2}", ownerType, ownerId, propName));

	var objectJson, conditionsJson;

	// TODO: reference to server will be a singleton, not context
	listProvider(ownerType, ownerId, propName, ownerId === STATIC_ID ? [] : ObjectLazyLoader.getRelativePathsForType(propType),
		serializeChanges.call(context.server, true),
		signal.pending(function(result) {
			objectJson = result.instances;
			conditionsJson = result.conditions;
		}),
		signal.orPending(function(e) {
			var errorMessage;
			if (e !== undefined && e !== null &&
					e.get_message !== undefined && e.get_message !== null &&
					e.get_message instanceof Function) {

				errorMessage = e.get_message();
			}
			else if (e.message) {
				errorMessage = e.message;
			}
			else {
				errorMessage = "unknown error";
			}

			throw new Error($format("Failed to load {0}|{1}.{2}: {3}", ownerType, ownerId, propName, errorMessage));
		})
	);

	// ensure that the property type is loaded as well.
	// if the list has objects that are subtypes, those will be loaded later
	// when the instances are being loaded
	if (LazyLoader.isRegistered(propType)) {
		LazyLoader.load(propType, null, false, signal.pending());
	}

	signal.waitForAll(function() {
		if (!objectJson) {
			return;
		}

		// The actual type name and id as found in the resulting json.
		var jsonId = ownerId;
		var jsonType = ownerType;

		// Find the given type and id in the object json.  The type key may be a dervied type.
		function searchJson(mtype, id) {
			// The given type is a key that is present in the result json.
			if (objectJson[mtype.get_fullName()]) {

				// The id is also a key.
				if (objectJson[mtype.get_fullName()][id]) {
					jsonType = mtype.get_fullName();
					jsonId = id;
					return true;
				}

				// Ids returned from the server are not always in the same case as ids on the client, so check one-by-one.
				for (var varId in objectJson[mtype.get_fullName()]) {
					if (varId.toLowerCase() == id.toLowerCase()) {
						jsonType = mtype.get_fullName();
						jsonId = varId;
						return true;
					}
				}
			}

			// Check derived types recursively.
			for (var i = 0; i < mtype.derivedTypes.length; i++) {
				if (searchJson(mtype.derivedTypes[i], id)) {
					return true;
				}
			}
		}

		if (!searchJson(ExoWeb.Model.Model.getJsType(ownerType).meta, ownerId)) {
			throw new Error($format("Data could not be found for {0}:{1}.", ownerType, ownerId));
		}

		var listJson = prop.get_isStatic() ?
			objectJson[jsonType][jsonId][propName] :
			objectJson[jsonType][jsonId][propIndex];

		if (!(listJson instanceof Array)) {
			throw new Error($format("Attempting to load list {0} of instance {1}:{2}, but the response JSON is not an array: {3}.", propName, ownerType, ownerId, listJson));
		}

		var populateList = false;
		//var newItems = [];

		if (LazyLoader.isRegistered(list)) {
			// If the lazy loader is no longer registered,
			// then don't populate the list.
			populateList = true;
			ListLazyLoader.unregister(list, this);
		}

		// populate the list with objects
		for (var i = 0; i < listJson.length; i++) {
			var ref = listJson[i];
			var item = getObject(model, propType, (ref && ref.id || ref), (ref && ref.type || propType));

			//newItems.push(item);

			if (populateList) {
				if (list.contains(item)) {
					logWarning($format("Lazy loading list {0}|{1}.{2} already contains object {3}.", ownerType, ownerId, propName, Entity.toIdString(item)));
				}
				list.push(item);
			}

			// if the list item is already loaded ensure its data is not in the response
			// so that it won't be reloaded
			if (LazyLoader.isLoaded(item)) {
				delete objectJson[jsonType][ref.id];
			}
		}

		// remove list from json and process the json.  there may be
		// instance data returned for the objects in the list
		if (LazyLoader.isLoaded(owner)) {
			delete objectJson[jsonType][jsonId];
		}

		ListLazyLoader.unregister(list, this);

		var batch = ExoWeb.Batch.start($format("{0}|{1}.{2}", [ownerType, ownerId, propName]));

		var done = function() {
			// Collection change driven by user action or other behavior would result in the "change" event
			//	being raised for the list property.  Since we don't want to record this as a true observable
			//	change, raise the event manually so that rules will still run as needed.
			// This occurs before batch end so that it functions like normal object loading.
			//if (ownerId !== STATIC_ID) {
			prop._raiseEvent("changed", [owner, { property: prop, newValue: list, oldValue: undefined, collectionChanged: true }]);
			//}

			// Example of explicitly raising the collection change event if needed.
			// NOTE: This is probably not necessary because it is difficult to get a reference to a
			// non-loaded list and so nothing would be watching for changes prior to loading completion.
			// The _initializing flag would be necessary to signal to the property's collection change
			// handler that it should not raise the various events in response to the collection change.
			//list._initializing = true;
			//Sys.Observer.raiseCollectionChanged(list, [new Sys.CollectionChange(Sys.NotifyCollectionChangedAction.add, newItems, 0)]);
			//delete list._initializing;

			ExoWeb.Batch.end(batch);
			callback.call(thisPtr || this, list);
		};

		objectsFromJson(model, objectJson, function() {
			if (conditionsJson) {
				conditionsFromJson(model, conditionsJson, list.slice(0), done);
			}
			else {
				done();
			}
		});
	});
}

ListLazyLoader.mixin({
	load: listLoad.dontDoubleUp({ callbackArg: 3, thisPtrArg: 4, groupBy: 0 })
});

(function() {
	var instance = new ListLazyLoader();

	var modifiableLists = [];

	function lazyListModified(sender, args) {
		// Check that modifications have not been allowed.
		if (modifiableLists.indexOf(sender) < 0) {
			// Check that at least one change involves adding or removing a non-new instance.
			if (args.get_changes().mapToArray(function(c) { return c.newItems || []; }).concat(args.get_changes().mapToArray(function(c) { return c.oldItems || []; })).some(function(i) { return !i.meta.isNew; })) {
				throw new Error($format("{0} list {1}.{2} was modified but it has not been loaded.",
					this._isStatic ? "Static" : "Non-static",
					this._isStatic ? this._containingType.get_fullName() : "this<" + this._containingType.get_fullName() + ">",
					this._name
				));
			}
		}
	}

	ListLazyLoader.register = function(obj, prop) {
		var list = [];

		// Throw an error if a non-loaded list is modified
		var collectionChangeHandler = lazyListModified.bind(prop);
		list._collectionChangeHandler = collectionChangeHandler;
		Observer.addCollectionChanged(list, collectionChangeHandler);

		list._ownerId = prop.get_isStatic() ? STATIC_ID : obj.meta.id;
		list._ownerProperty = prop;

		LazyLoader.register(list, instance);

		return list;
	};

	ListLazyLoader.unregister = function(list) {
		Observer.removeCollectionChanged(list, list._collectionChangeHandler);
		LazyLoader.unregister(list, instance);

		delete list._ownerId;
		delete list._ownerProperty;
		delete list._collectionChangeHandler;
	};

	ListLazyLoader.allowModification = function(list, callback, thisPtr) {
		modifiableLists.push(list);
		callback.call(thisPtr || this);
		modifiableLists.remove(list);
	};
})();
