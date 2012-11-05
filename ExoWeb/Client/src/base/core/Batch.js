var batchIndex = 0;
var allBatches = [];
var currentBatch = null;

function Batch(label) {
	this._index = batchIndex++;
	this._labels = [label];
	this._rootLabel = label;
	this._subscribers = [];

	allBatches.push(this);
}

registerActivity("Batch", function() {
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
		this._labels.push(label);

		return this;
	},
	_end: function Batch$_end() {
		// Cannot end a batch that has already been ended.
		if (this.isEnded()) {
			return this;
		}

		// Remove the last label from the list.
		var label = this._labels.pop();

		if (this.isEnded()) {
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

		currentBatch = this;

		return this;
	},
	isEnded: function Batch$isEnded() {
		return this._labels.length === 0;
	},
	whenDone: function Batch$whenDone(fn, thisPtr) {
		this._subscribers.push({ fn: fn, thisPtr: thisPtr });

		return this;
	}
});

exports.Batch = Batch;
