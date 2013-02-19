/// <reference path="Function.js" />
/// <reference path="Functor.js" />

var currentEventScope = null;

function EventScope() {
	// If there is a current event scope
	// then it will be the parent of the new event scope
	var parent = currentEventScope;

	// Define the parent property
	Object.defineProperty(this, "parent", { value: parent });

	// Define the isActive property
	this.isActive = true;

	// Set this to be the current event scope
	currentEventScope = this;
}

EventScope.mixin(Functor.eventing);

EventScope.mixin({
	exit: function() {
		if (!this.isActive) {
			throw new Error("The event scope has already exited.");
		}

		try {
			var handler = this._getEventHandler("exit");
			if (handler && !handler.isEmpty()) {
				if (this.parent === null || !this.parent.isActive) {
					// Invoke all subscribers
					handler();
				}
				else {
					// Move subscribers to the parent scope
					this.parent._addEvent("exit", handler);
				}

				// Clear the event to ensure that it isn't
				// inadvertantly raised again through this scope
				this._clearEvent("exit");
			}
		}
		finally {
			// The event scope is no longer active
			this.isActive = false;

			// Roll back to the closest active scope
			while (currentEventScope && !currentEventScope.isActive) {
				currentEventScope = currentEventScope.parent;
			}
		}
	}
});

function EventScope$invoke(callback, thisPtr) {
	if (thisPtr) {
		callback.call(thisPtr);
	}
	else {
		callback();
	}
}

function EventScope$onExit(callback, thisPtr) {
	if (currentEventScope === null) {
		// Immediately invoke the callback
		EventScope$invoke(callback, thisPtr);
	}
	else if (!currentEventScope.isActive) {
		throw new Error("The current event scope cannot be inactive.");
	}
	else {
		// Subscribe to the exit event
		currentEventScope._addEvent("exit", EventScope$invoke.bind(null, callback, thisPtr));
	}
}

function EventScope$perform(callback, thisPtr) {
	// Create an event scope
	var scope = new EventScope();
	try {
		// Invoke the callback
		EventScope$invoke(callback, thisPtr);
	}
	finally {
		// Exit the event scope
		scope.exit();
	}
}

exports.EventScopeCtor = EventScope; // IGNORE

exports.reset = function () { currentEventScope = null; }; // IGNORE

// Export public functions
var eventScopeApi = {
	onExit: EventScope$onExit,
	perform: EventScope$perform
};

exports.EventScope = eventScopeApi;
