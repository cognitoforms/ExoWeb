module("Context");
asyncTest("Context ready is not fired until embedded data is processed", function () {
	expect(1);

	$exoweb({
		model: {
			context_ghostbusters: { from: "Movie", id: "ghostbusters" }
		},
		contextReady: function () {
			ok(context.model.context_ghostbusters != null, "Ghostbusters model property should exist when contextReady fires.");
			start();
		}
	});
});

asyncTest("All context ready callbacks should fire before all dom ready callbacks fire", function () {
	expect(10);

	// Make processing async to ensure that callbacks get bunched together.
	ExoWeb.config.signalTimeout = true;

	var started;
	var contextReadyCount = 0;
	var domReadyCount = 0;

	$exoweb({
		model: {
			context_superman: { from: "Movie", id: "waiting_for_superman" }
		},
		contextReady: function () {
			contextReadyCount++;
			ok(context.model.context_superman != null, "Waiting for superman model property should exist when contextReady fires.");
			equal(contextReadyCount, 1, "Should be the first context ready to fire.");
			equal(domReadyCount, 0, "DOM ready should not have fired yet.");
		},
		domReady: function () {
			domReadyCount++;
			equal(domReadyCount, 1, "Should be the first DOM ready to fire here.");
			equal(contextReadyCount, 2, "Both context ready callbacks should have fired.");

			// Start the tests when the second domReady fires
			if (started === undefined) {
				started = false;
			} else {
				started = true;
				start();
				ExoWeb.config.signalTimeout = false;
			}
		}
	});

	$exoweb({
		contextReady: function () {
			contextReadyCount++;
			ok(context.model.context_superman != null, "Waiting for superman model property should exist when contextReady fires.");
			equal(contextReadyCount, 2, "Should be the second context ready to fire.");
			equal(domReadyCount, 0, "DOM ready should not have fired yet.");
		},
		domReady: function () {
			domReadyCount++;
			equal(domReadyCount, 2, "Should be the second DOM ready to fire here.");
			equal(contextReadyCount, 2, "Both context ready callbacks should have fired.");

			if (started === undefined) {
				started = false;
			} else {
				started = true;
				start();
				ExoWeb.config.signalTimeout = false;
			}
		}
	});
});
