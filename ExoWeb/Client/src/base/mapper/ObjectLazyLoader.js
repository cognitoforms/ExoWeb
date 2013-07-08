// <reference path="../core/Config.js" />

function ObjectLazyLoader() {
	this._requests = {};
	this._typePaths = {};
}

var pendingObjects = 0;

registerActivity("ObjectLazyLoader", function() {
	return pendingObjects > 0;
});

function objLoad(obj, propName, callback, thisPtr) {
	if (!ExoWeb.config.allowObjectLazyLoading) {
		throw new Error($format("Object lazy loading has been disabled: {0}|{1}", obj.meta.type.get_fullName(), obj.meta.id));
	}

	pendingObjects++;

	var signal = new ExoWeb.Signal("object lazy loader");

	var id = obj.meta.id || STATIC_ID;
	var mtype = obj.meta.type || obj.meta;

	// Get the paths from the original query(ies) that apply to this object (based on type).
	var paths = ObjectLazyLoader.getRelativePaths(obj);

	// Add the property to load if specified.  Assumes an instance property.
	if (propName && paths.indexOf(propName) < 0) {
		paths.push(propName);
	}

	// fetch object json
	logWarning($format("Lazy load object: {0}|{1}", mtype.get_fullName(), id));

	// TODO: reference to server will be a singleton, not context
	objectProvider(mtype.get_fullName(), [id], paths, false,
		serializeChanges.call(context.server, true),
		function(result) {
			mtype.model.server._handleResult(result, $format("Lazy load: {0}|{1}", mtype.get_fullName(), id), null, function() {
				LazyLoader.unregister(obj, this);
				pendingObjects--;

				// Raise init events if registered.
				for (var t = mtype; t; t = t.baseType) {
					var handler = t._getEventHandler("initExisting");
					if (handler)
						handler(obj, {});
				}

				callback.call(thisPtr || this, obj);
			});
		},
		function(e) {
			pendingObjects--;
			var message = $format("Failed to load {0}|{1}: ", [mtype.get_fullName(), id]);
			if (e !== undefined && e !== null &&
				e.get_message !== undefined && e.get_message !== null &&
				e.get_message instanceof Function) {

				message += e.get_message();
			}
			else {
				message += "unknown error";
			}
			throw new Error(message);
		});

	// does the object's type need to be loaded too?
	if (LazyLoader.isRegistered(mtype)) {
		LazyLoader.load(mtype, null, signal.pending());
	}
}

ObjectLazyLoader.mixin({
	load: objLoad.dontDoubleUp({ callbackArg: 2, thisPtrArg: 3, groupBy: 0 })
});

(function() {
	var instance = new ObjectLazyLoader();

	exports.instance = instance; // IGNORE

	ObjectLazyLoader.addPaths = function ObjectLazyLoader$addPaths(rootType, paths) {
		var typePaths = instance._typePaths[rootType];
		if (!typePaths) {
			typePaths = instance._typePaths[rootType] = [];
		}
		for (var i = 0; i < paths.length; i++) {
			var path = paths[i];
			if (typePaths.indexOf(path) < 0) {
				typePaths.push(path);
			}
		}
	};

	ObjectLazyLoader.getRelativePaths = function getRelativePaths(obj) {
		return ObjectLazyLoader.getRelativePathsForType(obj.meta.type);
	};

	ObjectLazyLoader.getRelativePathsForType = function getRelativePathsForType(type) {
		var relPaths = [];

		for (var typeName in instance._typePaths) {
			var jstype = Model.getJsType(typeName);

			if (jstype && jstype.meta) {
				var paths = instance._typePaths[typeName];
				for (var i = 0; i < paths.length; i++) {
					var path = paths[i].expression;
					var chain = Model.property(path, jstype.meta);
					// No need to include static paths since if they were 
					// cached then they were loaded previously.
					if (!chain.get_isStatic()) {
						var rootedPath = chain.rootedPath(type);
						if (rootedPath) {
							relPaths.push(rootedPath);
						}
					}
				}
			}
		}

		return relPaths.distinct();
	};

	ObjectLazyLoader.isRegistered = function (obj) {
		return LazyLoader.isRegistered(obj, instance);
	};

	ObjectLazyLoader.register = function(obj) {
		if (!ObjectLazyLoader.isRegistered(obj)) {
			if (obj.meta.type.get_origin() !== "server") {
				throw new Error($format("Cannot lazy load instance of non-server-origin type: {0}|{1}", obj.meta.type.get_fullName(), obj.meta.id));
			}
			LazyLoader.register(obj, instance);
		}
	};

	ObjectLazyLoader.unregister = function(obj) {
		LazyLoader.unregister(obj, instance);
	};
})();

exports.ObjectLazyLoader = ObjectLazyLoader; // IGNORE
