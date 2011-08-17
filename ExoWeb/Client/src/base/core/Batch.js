var batchIndex = 0;
var allBatches = [];
var currentBatch = null;

function Batch(label) {
	this._index = batchIndex++;
	this._labels = [label];
	this._rootLabel = label;
	this._subscribers = [];

	ExoWeb.trace.log("batch", "[{0}] {1} - created.", [this._index, this._rootLabel]);

	allBatches.push(this);
}

ExoWeb.registerActivity(function() {
	return Batch.all().length > 0;
});

Batch.all = function Batch_$all(includeEnded) {
	return allBatches.filter(function(e) {
		return includeEnded || !e.isEnded();
	});
};

Batch.current = function Batch_$current() {
	return currentBatch;
};

Batch.suspendCurrent = function Batch_$suspendCurrent(message) {
	if (currentBatch !== null) {
		var batch = currentBatch;
		ExoWeb.trace.log("batch", "[{0}] {1} - suspending {2}.", [currentBatch._index, currentBatch._rootLabel, message || ""]);
		currentBatch = null;
		return batch;
	}
};

Batch.start = function Batch_$start(label) {
	if (currentBatch) {
		currentBatch._begin(label);
	}
	else {
		currentBatch = new Batch(label);
	}

	return currentBatch;
};

Batch.resume = function Batch_$resume(batch) {
	if (batch) {
		(batch._transferredTo || batch)._resume();
	}
};

Batch.end = function Batch_$end(batch) {
	(batch._transferredTo || batch)._end();
};

Batch.whenDone = function Batch_$whenDone(fn, thisPtr) {
	if (currentBatch) {
		currentBatch.whenDone(fn, thisPtr);
	}
	else {
		fn.call(thisPtr || this);
	}
};

Batch.current = function Batch_$current() {
	return currentBatch;
};

Batch.mixin({
	_begin: function Batch$_begin(label) {
		ExoWeb.trace.log("batch", "[{0}] {1} - beginning label {2}.", [this._index, this._rootLabel, label]);

		this._labels.push(label);

		return this;
	},
	_end: function Batch$_end() {
		// Cannot end a batch that has already been ended.
		if (this.isEnded()) {
			ExoWeb.trace.logWarning("batch", "[{0}] {1} - already ended.", [this._index, this._rootLabel]);
			return this;
		}

		// Remove the last label from the list.
		var label = this._labels.pop();

		ExoWeb.trace.log("batch", "[{0}] {1} - ending label {2}.", [this._index, this._rootLabel, label]);

		if (this.isEnded()) {
			ExoWeb.trace.log("batch", "[{0}] {1} - complete.", [this._index, this._rootLabel]);

			// If we are ending the current batch, then null out the current batch 
			// variable so that new batches can be created with a new root label.
			if (currentBatch === this) {
				currentBatch = null;
			}

			// Invoke the subscribers.
			var subscriber = this._subscribers.dequeue();
			while (subscriber) {
				subscriber.fn.apply(subscriber.thisPtr || this, arguments);
				subscriber = this._subscribers.dequeue();
			}
		}

		return this;
	},
	_transferTo: function Batch$_transferTo(otherBatch) {
		// Transfers this batch's labels and subscribers to the
		// given batch.  From this point forward this batch defers
		// its behavior to the given batch.

		ExoWeb.trace.log("batch", "transferring from [{2}] {3} to [{0}] {1}.", [this._index, this._rootLabel, otherBatch._index, otherBatch._rootLabel]);

		// Transfer labels from one batch to another.
		otherBatch._labels.addRange(this._labels);
		this._labels.clear();
		otherBatch._subscribers.addRange(this._subscribers);
		this._subscribers.clear();
		this._transferredTo = otherBatch;
	},
	_resume: function Batch$_resume() {
		// Ignore resume on a batch that has already been ended.
		if (this.isEnded()) {
			return;
		}

		if (currentBatch !== null) {
			// If there is a current batch then simple transfer the labels to it.
			this._transferTo(currentBatch);
			return currentBatch;
		}

		ExoWeb.trace.log("batch", "[{0}] {1} - resuming.", [this._index, this._rootLabel]);
		currentBatch = this;

		return this;
	},
	isEnded: function Batch$isEnded() {
		return this._labels.length === 0;
	},
	whenDone: function Batch$whenDone(fn, thisPtr) {
		ExoWeb.trace.log("batch", "[{0}] {1} - subscribing to batch done.", [this._index, this._rootLabel]);

		this._subscribers.push({ fn: fn, thisPtr: thisPtr });

		return this;
	}
});

exports.Batch = Batch;
