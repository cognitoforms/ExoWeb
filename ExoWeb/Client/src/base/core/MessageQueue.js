function MessageQueue(handler, thisPtr) {

	// Require that a callback function is given.
	if (!handler || Object.prototype.toString.call(handler) !== "[object Function]")
		ExoWeb.trace.throwAndLog("messageQueue", "A callback must be provided to handle queued messages.");

	// Construct an array to store messages that are queued.
	var messages = [];
	
	// Number of milliseconds to wait before flushing the queue.
	var interval = null;

	// Timeout used for autoflush.
	var timeout = null;

	// Whether or not the interval resets when new items are enqueued.
	var rolling;

	// Starts or resets the timer when an item is enqueued.
	function startTimer() {
		if (timeout) {
			clearTimeout(timeout);
		}

		timeout = setTimeout(function() {
			timeout = null;
			queue.flush();
		}, interval);
	}

	var queue = {

		/*
		* Adds a new message to the queue.  If an interval is enabled
		* it will either be started or reset (if rolling).
		*/
		add: function(message) {
			if (rolling === true || (timeout === null && rolling === false)) {
				startTimer();
			}

			messages.push(message);
		},

		/*
		* Returns the number of messages that have been enqueued.
		*/
		count: function() {
			return messages.length;
		},

		/*
		* Invokes the callback with all messages that have been queued to date.
		*/
		flush: function() {
			if (messages.length > 0) {
				if (thisPtr)
					handler.call(thisPtr, messages.splice(0, messages.length));
				else
					handler(messages.splice(0, messages.length));
			}
		},

		/*
		* Enables flushing the queue after a given number of milliseconds.
		*/
		autoFlush: function(every/*, rolling*/) {
			if (interval !== null)
				ExoWeb.trace.throwAndLog("messageQueue", "Autoflush is already enabled after {0} milliseconds.", [interval]);

			// Set interval and rolling options.
			rolling = arguments[1] ? true : false;
			interval = every;

			// Start the timer now if we already have messages.
			if (messages.length > 0) {
				startTimer();
			}
		}
	};

	return queue;
}

exports.MessageQueue = MessageQueue;
