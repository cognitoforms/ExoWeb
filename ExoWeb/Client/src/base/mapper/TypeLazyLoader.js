function TypeLazyLoader() {
}

function typeLoad(mtype, propName, inScope, callback, thisPtr) {
	if (!ExoWeb.config.allowTypeLazyLoading) {
		throw new Error("Type lazy loading has been disabled: " + mtype.get_fullName());
	}

	fetchTypes(mtype.model, [mtype.get_fullName()], function(jstype) {
		if (callback && callback instanceof Function) {
			callback(jstype);
		}
	}, thisPtr);
}

TypeLazyLoader.mixin({
	load: typeLoad.dontDoubleUp({ callbackArg: 3, thisPtrArg: 4, groupBy: 0 })
});

(function() {
	var instance = new TypeLazyLoader();

	TypeLazyLoader.register = function(obj) {
		LazyLoader.register(obj, instance);
	};

	TypeLazyLoader.unregister = function(obj) {
		LazyLoader.unregister(obj, instance);
	};
})();
