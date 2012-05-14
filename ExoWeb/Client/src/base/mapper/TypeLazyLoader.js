function TypeLazyLoader() {
}

function typeLoad(mtype, propName, callback, thisPtr) {
	if (!ExoWeb.config.allowTypeLazyLoading) {
		throw new ExoWeb.trace.logError(["typeInit", "lazyLoad"], "Type lazy loading has been disabled: {0}", mtype.get_fullName());
	}

//				ExoWeb.trace.log(["typeInit", "lazyLoad"], "Lazy load: {0}", [mtype.get_fullName()]);
	fetchTypes(mtype.get_model(), [mtype.get_fullName()], function(jstypes) {
		if (callback && callback instanceof Function) {
			callback(jstypes[0]);
		}
	}, thisPtr);
}

TypeLazyLoader.mixin({
	load: typeLoad.dontDoubleUp({ callbackArg: 2, thisPtrArg: 3, groupBy: 0 })
});

(function() {
	var instance = new TypeLazyLoader();

	TypeLazyLoader.register = function(obj) {
		ExoWeb.Model.LazyLoader.register(obj, instance);
	};

	TypeLazyLoader.unregister = function(obj) {
		ExoWeb.Model.LazyLoader.unregister(obj, instance);
	};
})();
