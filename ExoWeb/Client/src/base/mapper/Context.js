var allSignals = new ExoWeb.Signal("createContext allSignals");

ExoWeb.registerActivity(function() {
	return allSignals.isActive();
});

function Context() {
	var model = new ExoWeb.Model.Model();

	this.model = { meta: model };
	this.server = new ServerSync(model);

	// start capturing changes prior to processing any model query
	this._addEvent("beforeModel", this.server.beginCapturingChanges.setScope(this.server), null, true);
}

Context.mixin(ExoWeb.Functor.eventing);

Context.mixin({
	isModelReady: function() {
		var result = false;

		eachProp(this.model, function(prop, val) {
			if (prop != "meta") {
				result = true;
				return false;
			}
		}, this);

		return result;
	},
	addModelReady: function Context$ready(callback, thisPtr) {
		this._addEvent("modelReady", thisPtr ? callback.setScope(thisPtr) : callback, null, true);

		// Raise event immediately if there are currently models. Subscribers
		// will not actually be called until signals have subsided.
		if (this.isModelReady())
			this.onModelReady();
	},
	onModelReady: function () {
		// Indicate that one or more model queries are ready for consumption
		allSignals.waitForAll(function() {
			this._raiseEvent("modelReady");
		}, this);
	},
	onBeforeModel: function () {
		this._raiseEvent("beforeModel");
	}
});

function Context$query(options) {
	var contextQuery = new ContextQuery(this, options);

	// if there is a model option, when the query is finished executing the model ready fn will be called
	contextQuery.execute(options.model ? this.onModelReady.setScope(this) : null);
}
