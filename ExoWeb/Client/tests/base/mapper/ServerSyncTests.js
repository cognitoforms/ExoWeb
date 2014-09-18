module("ServerSync");

var appliedChanges = [];

var listener = new ExoWeb.Mapper.ExoModelEventListener(context.model.meta, context.server._translator);

function fixInstanceId(instance) {
	instance.id = context.server._translator.forward(instance.type, instance.id) || instance.id;
}

listener.addChangeDetected(function (change) {
	if (context.server.isApplyingChanges()) {
		if (change.instance) {
			fixInstanceId(change.instance);
		}
		appliedChanges.push(change);
	}
});

function appliedJson(alphaSort) {
	var objs = appliedChanges.map(function (c) { return JSON.stringify(c); });
	if (alphaSort) {
		objs = objs.sort();
	}
	return "[\r\n" + objs.join(",\r\n") + (appliedChanges.length === 0 ? "" : ",\r\n") + "]";
}

var movieId = ExoWeb.randomText(8, true).toLowerCase();
var personId = ExoWeb.randomText(8, true).toLowerCase();
var directorId = ExoWeb.randomText(8, true).toLowerCase();

asyncTest("Call applyChanges with empty array", function () {
	expect(3);
	appliedChanges.length = 0;

	var changes = [];

	var activeSet = context.server._changeLog.activeSet;
	var numChanges = context.server.changes().length;

	context.server.applyChanges(null, changes, "server", null, null, null, null, null, null, function () {
		notEqual(context.server._changeLog.activeSet, activeSet, "There should be a new active set after calling applyChanges.");
		equal(context.server.changes().length, numChanges, "There should be no additional changes after calling applyChanges.");
		equal(appliedJson(), "[\r\n]", "There should be no applied changes.");
		start();
	});
});

asyncTest("Call applyChanges with value change that applies to context", function () {
	expect(6);
	appliedChanges.length = 0;

	var change = { type: "ValueChange", instance: { id: "robin_hood", type: "Movie" }, property: "Year", oldValue: 2010, newValue: 2009 };

	var activeSet = context.server._changeLog.activeSet;
	var numChanges = context.server.changes().length;

	equal(context.model.movie.get_Year(), 2010, "Initial value of movie year should be 2010.");

	context.server.applyChanges(null, [change], "server", null, null, null, null, null, null, function () {
		notEqual(context.server._changeLog.activeSet, activeSet, "There should be a new active set after calling applyChanges.");
		notEqual(context.server._changeLog.activeSet.changes.length, 1, "There should be a single new change in the active set after calling applyChanges.");
		equal(context.server.changes().length, numChanges + 1, "There should be one additional change after calling applyChanges.");
		equal(context.model.movie.get_Year(), 2009, "New value of movie year should be 2009.");
		equal(appliedJson(), "[\r\n" + JSON.stringify(change) + ",\r\n]", "The change should have been applied.");
		start();
	});
});

asyncTest("Call applyChanges with value change that does not apply to context", function () {
	expect(5);
	appliedChanges.length = 0;

	var change = { type: "ValueChange", instance: { id: "timeline", type: "Movie" }, property: "Year", oldValue: 2003, newValue: 1357 };

	var activeSet = context.server._changeLog.activeSet;
	var numChanges = context.server.changes().length;

	context.server.applyChanges(null, [change], "server", null, null, null, null, null, null, function () {
		notEqual(context.server._changeLog.activeSet, activeSet, "There should be a new active set after calling applyChanges.");
		notEqual(context.server._changeLog.activeSet.changes.length, 1, "There should be a single new change in the active set after calling applyChanges.");
		equal(context.server.changes().length, numChanges + 1, "There should be one additional change after calling applyChanges.");
		equal(appliedJson(), "[\r\n]", "The change should NOT have been applied.");
		ok(!Movie.meta.get("timeline"), "Movie should not exist.");
		start();
	});
});

asyncTest("Call applyChanges with initialization of object that does not apply to context", function () {
	expect(3);
	appliedChanges.length = 0;

	var numMovies = Movie.meta.known().length;
	var change = { type: "InitNew", instance: { id: ExoWeb.randomText(8, true).toLowerCase(), type: "Movie" } };

	context.server.applyChanges(null, [change], "server", null, null, null, null, null, null, function () {
		equal(appliedChanges.distinct().length, 0, "No changes should have been applied.");
		equal(Movie.meta.known().length, numMovies, "No new movies should have been created.");
		equal(appliedJson(), "[\r\n]", "The changes should NOT have been applied.");
		start();
	});
});

asyncTest("Call applyChanges with introduction of object(s) into context", function () {
	expect(2);
	appliedChanges.length = 0;

	var changes = [
		{ type: "InitNew", instance: { id: movieId, type: "Movie", isNew: true } },
		{ type: "ValueChange", instance: { id: movieId, type: "Movie", isNew: true }, property: "Name", oldValue: null, newValue: "Sphere" },
		{ type: "ValueChange", instance: { id: movieId, type: "Movie", isNew: true }, property: "Year", oldValue: 0, newValue: 1998 },
		{ type: "ValueChange", instance: { id: movieId, type: "Movie", isNew: true }, property: "Rated", oldValue: null, newValue: "PG-13" },
		{ type: "ValueChange", instance: { id: movieId, type: "Movie", isNew: true }, property: "Released", oldValue: null, newValue: new Date(1998, 2, 13) },
		{ type: "ListChange", instance: { id: movieId, type: "Movie", isNew: true }, property: "Genres", added: [{ id: "drama", type: "Genre" }], removed: [] },
		{ type: "ListChange", instance: { id: movieId, type: "Movie", isNew: true }, property: "Genres", added: [{ id: "mystery", type: "Genre" }], removed: [] },
		{ type: "ListChange", instance: { id: movieId, type: "Movie", isNew: true }, property: "Genres", added: [{ id: "sci_fi", type: "Genre" }], removed: [] },
		{ type: "InitNew", instance: { id: personId, type: "Person", isNew: true } },
		{ type: "ValueChange", instance: { id: personId, type: "Person", isNew: true }, property: "FirstName", oldValue: null, newValue: "Barry" },
		{ type: "ValueChange", instance: { id: personId, type: "Person", isNew: true }, property: "LastName", oldValue: null, newValue: "Levinson" },
		{ type: "InitNew", instance: { id: directorId, type: "Director", isNew: true } },
		{ type: "ReferenceChange", instance: { id: directorId, type: "Director", isNew: true }, property: "Person", newValue: { id: personId, type: "Person", isNew: true } },
		{ type: "ReferenceChange", instance: { id: personId, type: "Person", isNew: true }, property: "Director", newValue: { id: directorId, type: "Director", isNew: true } },
		{ type: "ReferenceChange", instance: { id: movieId, type: "Movie", isNew: true }, property: "Director", newValue: { id: directorId, type: "Director", isNew: true } },
		{ type: "ListChange", instance: { id: directorId, type: "Director", isNew: true }, property: "Movies", added: [{ id: movieId, type: "Movie", isNew: true }], removed: [] },
		{ type: "ReferenceChange", instance: { id: "robin_hood", type: "Movie" }, property: "Director", oldValue: { id: context.model.movie.get_Director().meta.id, type: "Director" }, newValue: { id: directorId, type: "Director", isNew: true } }
	];

	context.server.applyChanges(null, changes, "server", null, null, null, null, null, null, function () {
		equal(appliedChanges.distinct().length, changes.length, "All pending changes should have been applied.");
		equal(appliedJson(true), "[\r\n" + changes.map(function (c) { return JSON.stringify(c); }).sort().join(",\r\n") + ",\r\n]", "The change should NOT have been applied.");
		start();
	});
});
