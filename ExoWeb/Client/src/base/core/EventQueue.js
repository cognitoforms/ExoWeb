function EventQueue(raise, areEqual) {
	this._queueing = 0;
	this._queue = [];
	this._raise = raise;
	this._areEqual = areEqual;
}

EventQueue.prototype = {
	startQueueing: function EventQueue$startQueueing() {
		++this._queueing;
	},
	stopQueueing: function EventQueue$stopQueueing() {
		if (--this._queueing === 0) {
			this.raiseQueue();
		}
	},
	push: function EventQueue$push(item) {
		// NOTE:  If a queued event triggers other events when raised, 
		// the new events will be raised before the events that follow 
		// after the triggering event.  This means that events will be 
		// raised in the correct sequence, but they may occur out of order.
		if (this._queueing) {
			if (this._areEqual) {
				for (var i = 0; i < this._queue.length; ++i) {
					if (this._areEqual(item, this._queue[i])) {
						return;
					}
				}
			}

			this._queue.push(item);
		}
		else {
			this._raise(item);
		}
	},
	raiseQueue: function EventQueue$raiseQueue() {
		var nextQueue = [];
		try {
			for (var i = 0; i < this._queue.length; ++i) {
				if (this._raise(this._queue[i]) === false) {
					nextQueue.push(this._queue[i]);
				}
			}
		}
		finally {
			if (this._queue.length > 0) {
				this._queue = nextQueue;
			}
		}
	}
};

exports.EventQueue = EventQueue;
