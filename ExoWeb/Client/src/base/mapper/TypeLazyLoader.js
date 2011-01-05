function TypeLazyLoader() {
}

function typeLoad(mtype, propName, callback, thisPtr) {
//				ExoWeb.trace.log(["typeInit", "lazyLoad"], "Lazy load: {0}", [mtype.get_fullName()]);
	fetchType(mtype.get_model(), mtype.get_fullName(), callback, thisPtr);
}

TypeLazyLoader.mixin({
	load: typeLoad.dontDoubleUp({ callbackArg: 2, thisPtrArg: 3, groupBy: function(mtype) { return [mtype]; } })
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
