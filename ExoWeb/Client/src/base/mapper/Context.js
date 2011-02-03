var allSignals = new ExoWeb.Signal("createContext allSignals");

ExoWeb.registerActivity(function() {
	return allSignals.isActive();
});

function Context() {
	var model = new ExoWeb.Model.Model();

	this.model = { meta: model };
	this.server = new ServerSync(model);
}

Context.mixin({
	ready: function Context$ready(callback, thisPtr) {
		allSignals.waitForAll(callback, thisPtr);
	}
});

function Context$query(options) {
	var contextQuery = new ContextQuery(this, options);
	contextQuery.execute();
}
