module("DataView");
asyncTest("Body #1 does partial update", function () {
	expect(4);

	$exoweb({
		domReady: function () {
			context.model.movie.get_Genres().insert(0, new Genre({ Name: "Romance" }));
			equal($("table.genres").find("tbody:nth-child(2) tr:first-child td:first-child").text(), "4", "checking rendering index");
			equal($("table.genres").find("tbody:nth-child(2) tr:first-child td:last-child").text(), "Romance", "checking rendering index");
			equal($("table.genres").find("tbody:nth-child(2) tr:last-child td:first-child").text(), "3", "checking rendering index");
			equal($("table.genres").find("tbody:nth-child(2) tr:last-child td:last-child").text(), "Drama", "checking rendering index");
			start();
		}
	});
});

asyncTest("Body #2 does not do partial update", function () {
	expect(4);

	$exoweb({
		domReady: function () {
			equal($("table.genres").find("tbody:nth-child(6) tr:first-child td:first-child").text(), "1", "checking rendering index");
			equal($("table.genres").find("tbody:nth-child(6) tr:first-child td:last-child").text(), "Romance", "checking rendering index");
			equal($("table.genres").find("tbody:nth-child(6) tr:last-child td:first-child").text(), "4", "checking rendering index");
			equal($("table.genres").find("tbody:nth-child(6) tr:last-child td:last-child").text(), "Drama", "checking rendering index");
			start();
		}
	});
});

window.RENDER_INDEX_DATAVIEW = 1;
window.RENDER_INDEX_CONTENT = 1;
