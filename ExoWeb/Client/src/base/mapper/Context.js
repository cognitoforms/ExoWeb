// Signal to keep track of any ongoing context initialization
var allSignals = new ExoWeb.Signal("Context : allSignals");

ExoWeb.registerActivity("Context: allSignals", function() {
	return allSignals.isActive();
});

function Context() {
	window.context = this;

	this.model = { meta: new ExoWeb.Model.Model() };
	this.server = new ServerSync(this.model.meta);
}

Context.mixin(ExoWeb.Functor.eventing);

var numberOfPendingQueries;

Context.mixin({
	addReady: function Context$addReady(callback, thisPtr) {
		var queriesAreComplete = numberOfPendingQueries === 0;

		this._addEvent("ready", thisPtr ? callback.bind(thisPtr) : callback, null, true);

		// Simulate the event being raised immediately if a query or queries have already completed
		if (queriesAreComplete) {
			// Subscribers will not actually be called until signals have subsided
			allSignals.waitForAll(function() {
				this._raiseEvent("ready");
			}, this);
		}
	},
	beginContextReady: ExoWeb.Functor(),
	endContextReady: ExoWeb.Functor()
});

function ensureContext() {
	if (!window.context) {
		window.context = new Context();
	}

	if (!(window.context instanceof Context)) {
		throw new Error("The window object has a context property that is not a valid context.");
	}
}

Context.ready = function Context$ready(context) {
	numberOfPendingQueries--;

	var queriesAreComplete = numberOfPendingQueries === 0;

	if (queriesAreComplete) {
		// Indicate that one or more model queries are ready for consumption
		allSignals.waitForAll(function() {
			context._raiseEvent("ready");
		});
	}
};

Context.query = function Context$query(context, options) {
	var queriesHaveBegunOrCompleted = numberOfPendingQueries !== undefined;
	if (!queriesHaveBegunOrCompleted) {
		numberOfPendingQueries = 0;
	}
	numberOfPendingQueries++;

	// Execute the query and fire the ready event when complete
	(new ContextQuery(context, options)).execute(function() {
		Context.ready(context);
	});
}
