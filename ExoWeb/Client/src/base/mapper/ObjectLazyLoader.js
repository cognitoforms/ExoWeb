function ObjectLazyLoader() {
	this._requests = {};
	this._typePaths = {};
}

var pendingObjects = 0;

ExoWeb.registerActivity(function() {
	return pendingObjects > 0;
});

function objLoad(obj, propName, callback, thisPtr) {
	pendingObjects++;

	var signal = new ExoWeb.Signal("object lazy loader");

	var id = obj.meta.id || STATIC_ID;
	var mtype = obj.meta.type || obj.meta;

	// Get the paths from the original query(ies) that apply to this object (based on type).
	var paths = ObjectLazyLoader.getRelativePaths(obj);

	// Add the property to load if specified.  Assumes an instance property.
	if (propName && paths.indexOf("this." + propName) < 0) {
		paths.push("this." + propName);
	}

	// fetch object json
	ExoWeb.trace.log(["objectInit", "lazyLoad"], "Lazy load: {0}({1})", [mtype.get_fullName(), id]);

	// TODO: reference to server will be a singleton, not context
	objectProvider(mtype.get_fullName(), [id], paths, false,
		serializeChanges.call(context.server, true),
		function(result) {
			mtype.get_model()._server._handleResult(result, null, function() {
				ExoWeb.Model.LazyLoader.unregister(obj, this);
				pendingObjects--;
				callback.call(thisPtr || this, obj);
			});
		},
		function(e) {
			pendingObjects--;
			var message = $format("Failed to load {0}({1}): ", [mtype.get_fullName(), id]);
			if (e !== undefined && e !== null &&
				e.get_message !== undefined && e.get_message !== null &&
				e.get_message instanceof Function) {

				message += e.get_message();
			}
			else {
				message += "unknown error";
			}
			ExoWeb.trace.logError("lazyLoad", message);
		});

	// does the object's type need to be loaded too?
	if (! ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
		ExoWeb.Model.LazyLoader.load(mtype, null, signal.pending());
	}
}

ObjectLazyLoader.mixin({
	load: objLoad.dontDoubleUp({ callbackArg: 2, thisPtrArg: 3, groupBy: function(obj) { return [obj]; } })
});

(function() {
	var instance = new ObjectLazyLoader();

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
			var jstype = ExoWeb.Model.Model.getJsType(typeName);

			if (jstype && jstype.meta) {
				var paths = instance._typePaths[typeName];
				for (var i = 0; i < paths.length; i++) {
					var path = paths[i].expression;
					var chain = ExoWeb.Model.Model.property(path, jstype.meta);
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

		return relPaths;
	};

	ObjectLazyLoader.register = function(obj) {
		if (!ExoWeb.Model.LazyLoader.isRegistered(obj, instance)) {
			ExoWeb.Model.LazyLoader.register(obj, instance);
		}
	};

	ObjectLazyLoader.unregister = function(obj) {
		ExoWeb.Model.LazyLoader.unregister(obj, instance);
	};
})();
