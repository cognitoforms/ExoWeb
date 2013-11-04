var mh = { FirstName: "Matt", LastName: "Hooper", Grade: "01" };
var bm = { FirstName: "Bryan", LastName: "Matthews", Grade: "01" };
var pg = { FirstName: "Pete", LastName: "Gindhart", Grade: "02" };
var sg = { FirstName: "Sam", LastName: "Gindhart", Grade: "02" };
var ag = { FirstName: "Albert", LastName: "Gindhart", Grade: "02" };
var jd = { FirstName: "John", LastName: "Doe", Grade: null };

(function () {
	function liveResultHasSameItems(source, inputTransform, liveTransform, groupNesting) {
		return function () {
			ok(arraysAreEqual(inputTransform, liveTransform, resultEquality(groupNesting)), "Live array should have the same items as the source transform");
		};
	}

	function liveResultIsCopy(source, inputTransform, liveTransform, groupNesting) {
		return function () {
			ok(inputTransform !== liveTransform, "live returns a copy of the current transform's output");
			return {
				butHasTheSameItems: liveResultHasSameItems(source, inputTransform, liveTransform, groupNesting)
			};
		};
	}

	function arraysAreEqual(a, b, itemEquality) {
		if (a.length !== b.length) {
			return false;
		}
		for (var i = 0; i < a.length; i++) {
			if (itemEquality) {
				if (!itemEquality(a[i], b[i])) {
					return false;
				}
			}
			else if (a[i] !== b[i]) {
				return false;
			}
		}
		return true;
	}

	function groupEquality(inner) {
		return function (a, b) {
			if (a.group !== b.group) {
				return false;
			}
			return arraysAreEqual(a.items, b.items, inner || function (a, b) { return a === b; });
		};
	}

	function assertRemoved(source, inputTransform, groupNesting, changes, equality) {
		return function (removedAt, removedItem) {
			ok(changes.length > 0, "Should be changes");
			ok(changes.some(function (change) {
				if (!change.oldItems) {
					return false;
				}
				var idx;
				for (var i = 0; i < change.oldItems.length; i++) {
					var isEqual = false;
					if (equality) {
						isEqual = equality(change.oldItems[i], removedItem);
					}
					else {
						isEqual = change.oldItems[i] === removedItem;
					}
					if (isEqual) {
						idx = change.oldStartingIndex + i;
						equal(change.oldStartingIndex + i, removedAt, "Expected removal of item " + removedItem + " at index " + removedAt);
						return true;
					}
				}
				return idx === removedAt;
			}), "Expected item " + removedItem + " to be removed at " + removedAt);

			return {
				andTheResultIs: assertResult(source, inputTransform, groupNesting)
			};
		};
	}

	function resultEquality(groupNesting) {
		var equalityFn;
		for (var i = 0; i < groupNesting; i++) {
			equalityFn = groupEquality(equalityFn);
		}
		return equalityFn;
	}

	function removeItem(source, liveTransform, groupNesting) {
		return function (item) {
			var changes = [];
			Sys.Observer.addCollectionChanged(liveTransform, function (sender, args) {
				Array.prototype.push.apply(changes, args.get_changes());
			});
			source.remove(item);
			return {
				itemIsRemoved: assertRemoved(source, liveTransform, groupNesting, changes, resultEquality(groupNesting))
			};
		};
	}

	function live(source, inputTransform, groupNesting) {
		return function () {
			var liveTransform = inputTransform.live();
			var changes = [];
			Sys.Observer.addCollectionChanged(liveTransform, function (sender, args) {
				Array.prototype.push.apply(changes, args.get_changes());
			});
			var equalityFn = resultEquality(groupNesting);
			return {
				theLiveResultIsNewArray: liveResultIsCopy(source, inputTransform, liveTransform, groupNesting),
				andRemove: removeItem(source, liveTransform, groupNesting),
				itemIsRemoved: assertRemoved(source, liveTransform, groupNesting, changes, equalityFn)
			};
		};
	}

	function assertResult(source, transform, groupNesting) {
		return function (/* expectedResult */) {
			equal(transform.length, arguments.length, "should be " + arguments.length + " items after array update");
			var equalityFn = resultEquality(groupNesting);
			ok(arraysAreEqual(transform, Array.prototype.slice.call(arguments), equalityFn), "The items should match");

			return {
				whenLive: live(source, transform, groupNesting)
			};
		};
	}

	function groupedBy(source, inputTransform, groupNesting) {
		return function (expr) {
			var stepTransform = inputTransform.groupBy(expr);
			var newGroupNesting = groupNesting + 1;
			return {
				theResultIs: assertResult(source, stepTransform, newGroupNesting),
				andLive: live(source, stepTransform, newGroupNesting)
			};
		};
	}

	function orderedBy(source, inputTransform, groupNesting) {
		return function (expr) {
			var stepTransform = inputTransform.orderBy(expr);
			return {
				theResultIs: assertResult(source, stepTransform, groupNesting),
				andLive: live(source, stepTransform, groupNesting)
			};
		};
	}

	function filteredBy(source, inputTransform, groupNesting) {
		return function (expr) {
			var stepTransform = inputTransform.where(expr);
			return {
				theResultIs: assertResult(source, stepTransform, groupNesting),
				andLive: live(source, stepTransform, groupNesting)
			};
		};
	}

	function givenList(/* items */) {
		var array = Array.prototype.slice.call(arguments);
		var transform = $transform(array);
		Sys.Observer.makeObservable(array);
		return {
			whenGroupedBy: groupedBy(array, transform, 0),
			whenOrderedBy: orderedBy(array, transform, 0),
			whenFilteredBy: filteredBy(array, transform, 0)
		};
	}

	window.givenList = givenList;

}());

module("Transform");
test("where expression", function () {
	deepEqual($transform([mh, bm, pg, jd, sg, ag]).where("LastName == 'Gindhart'"), [pg, sg, ag]);
	deepEqual($transform([mh, bm, pg, jd, sg, ag]).where("LastName !== 'Gindhart'"), [mh, bm, jd]);
	deepEqual($transform([mh, bm, pg, jd, sg, ag]).where("Grade !== null"), [mh, bm, pg, sg, ag]);
	deepEqual($transform([mh, bm, pg, jd, sg, ag]).where("Grade == null"), [jd]);
	deepEqual($transform([mh, bm, pg, jd, sg, ag]).where("$item.LastName != 'Doe'"), [mh, bm, pg, sg, ag]);

	// TODO
	//				deepEqual($transform([mh, bm, pg, jd, sg, ag]).where("Grade == '01' || LastName == 'Doe'"), [mh, bm, jd]);
	//				deepEqual($transform([mh, bm, pg, jd, sg, ag]).where("Grade == '02' && FirstName == 'Sam'"), [sg]);
});

test("where function", function () {
	deepEqual($transform([mh, bm, pg, jd, sg, ag]).where(function (item) { return item.LastName != "Gindhart"; }), [mh, bm, jd]);
});

test("where function w/context", function () {
	deepEqual($transform([mh, bm, pg, jd, sg, ag]).where(function (item) { return item != this; }, jd), [mh, bm, pg, sg, ag]);
});

test("where w/$item", function () {
	deepEqual($transform(["Apple", "Orange", "Banana"]).where("$item !== 'Banana'"), ["Apple", "Orange"]);
	deepEqual($transform(["Apple", "Orange", "Banana"]).where("$item.length > 5"), ["Orange", "Banana"]);
});

test("orderBy single", function () {
	deepEqual($transform([mh, bm, pg, jd]).orderBy("LastName"), [jd, pg, mh, bm]);
	deepEqual($transform([mh, bm, pg, jd]).orderBy("LastName asc"), [jd, pg, mh, bm]);
	deepEqual($transform([mh, bm, pg, jd]).orderBy("LastName desc"), [bm, mh, pg, jd]);
});

test("orderBy multiple", function () {
	deepEqual($transform([mh, bm, pg, jd, sg, ag]).orderBy("LastName, FirstName"), [jd, ag, pg, sg, mh, bm]);
	deepEqual($transform([mh, bm, pg, jd, sg, ag]).orderBy("LastName, FirstName desc"), [jd, sg, pg, ag, mh, bm]);
});

test("orderBy w/null", function () {
	deepEqual($transform([mh, bm, null, pg, jd]).orderBy("LastName desc"), [null, bm, mh, pg, jd]);
	deepEqual($transform([mh, bm, null, pg, jd]).orderBy("null LastName desc"), [null, bm, mh, pg, jd]);
	deepEqual($transform([mh, bm, null, pg, jd]).orderBy("LastName desc null"), [bm, mh, pg, jd, null]);
	deepEqual($transform([mh, bm, null, pg, jd]).orderBy("LastName null"), [jd, pg, mh, bm, null]);
});

test("orderBy function", function () {
	deepEqual($transform([jd, mh, pg, bm, sg, ag]).orderBy(function (a, b) {
		var a = parseInt(a.Grade, 10), b = parseInt(b.Grade, 10);
		if (isNaN(a)) { a = -1; }
		if (isNaN(b)) { b = -1; }
		return a > b ? -1 : (a < b ? 1 : 0);
	}), [pg, sg, ag, mh, bm, jd]);
});

test("orderBy function w/context", function () {
	deepEqual($transform([mh, bm, pg, jd, sg, ag]).orderBy(function (a, b) { return a === this ? 1 : (b === this ? -1 : 0); }, jd), [mh, bm, pg, sg, ag, jd]);
	deepEqual($transform([mh, bm, pg, jd, sg, ag]).orderBy(function (a, b) { return a === this ? -1 : (b === this ? 1 : 0); }, jd), [jd, mh, bm, pg, sg, ag]);
});

test("groupBy function", function () {
	var list = ["Apple", "Orange", "Banana", "Artichoke"];
	var grouped = $transform(list).groupBy(function (item) { return item[0]; });
	equal(3, grouped.length, "should result in three groups.");
});

test("select function", function () {
	var list = ["Apple", "Orange", "Banana", "Artichoke"];
	var selected = $transform(list).select(function (item) { return item.toLowerCase(); });
	deepEqual(selected, ["apple", "orange", "banana", "artichoke"], "should result in lower-case versions of input");
});

test("select path", function () {
	var list = ["Apple", "Orange", "Banana", "Artichoke"];
	var selected = $transform(list).select("length");
	deepEqual(selected, [5, 6, 6, 9], "should result in string lengths");
});

test("selectMany function", function () {
	var list = ["Apple", "Orange"];
	var selected = $transform(list).selectMany(function (item) { return Array.prototype.map.call(item, function (c) { return c; }); });
	deepEqual(selected, ["A", "p", "p", "l", "e", "O", "r", "a", "n", "g", "e"], "should result in all characters");
});

test("selectMany path", function () {
	deepEqual($transform([{ Users: [mh, bm, pg] }, { Users: [jd, sg, ag] }]).selectMany("Users"), [mh, bm, pg, jd, sg, ag]);
});

test("live mode", function () {
	var transform = $transform(["Apple", "Orange", "Banana", "Artichoke"], true).where("$item[0] !== 'A'");
	ok(transform instanceof ExoWeb.Transform, "When live mode is used the result is a transform object prior to calling 'live'.");
	ok(transform.live() instanceof Array, "The result is an array after live is called.");
});

test("groupBy(item[0])", function () {

	givenList("Apple", "Orange", "Banana", "Artichoke")
		.whenGroupedBy(function (item) { return item[0]; })
		.theResultIs({ group: "A", items: ["Apple", "Artichoke"] },
						 { group: "O", items: ["Orange"] },
						 { group: "B", items: ["Banana"] });

});

test("groupBy(item[0]).live() common constraints", function () {

	givenList("Apple", "Orange", "Banana", "Artichoke")
		.whenGroupedBy(function (item) { return item[0]; })
		.andLive()
		.theLiveResultIsNewArray()
		.butHasTheSameItems();

});

test("groupBy(item[0]).live() removed item results in removed group", function () {

	givenList("Apple", "Orange", "Banana", "Artichoke")
		.whenGroupedBy(function (item) { return item[0]; })
		.andLive()
		.andRemove("Banana")
		.itemIsRemoved(2, { group: "B", items: [] })
		.andTheResultIs({ group: "A", items: ["Apple", "Artichoke"] },
						{ group: "O", items: ["Orange"] });

});

test("orderBy(length desc).live() common constraints", function () {

	givenList("Apple", "Orange", "Banana", "Artichoke")
		.whenOrderedBy("length desc")
		.andLive()
		.theLiveResultIsNewArray()
		.butHasTheSameItems();

});

test("orderBy(length desc).live() removed item is removed from result", function () {

	givenList("Apple", "Orange", "Banana", "Artichoke")
		.whenOrderedBy("length desc")
		.andLive()
		.andRemove("Banana")
		.itemIsRemoved(2, "Banana")
		.andTheResultIs("Artichoke", "Orange", "Apple");

});

test("where($item[0] !== 'A').live() common constraints", function () {

	givenList("Apple", "Orange", "Banana", "Artichoke")
		.whenFilteredBy("$item[0] !== 'A'")
		.andLive()
		.theLiveResultIsNewArray()
		.butHasTheSameItems();

});

test("where($item[0] !== 'A').live() removed item is removed from result", function () {

	givenList("Apple", "Orange", "Banana", "Artichoke")
		.whenFilteredBy("$item[0] !== 'A'")
		.theResultIs("Orange", "Banana")
		.whenLive()
		.andRemove("Banana")
		.itemIsRemoved(1, "Banana")
		.andTheResultIs("Orange");

});

test("live function", function () {
	var list = ["Apple", "Orange", "Banana", "Artichoke"];
	Sys.Observer.makeObservable(list);

	var where = $transform(list).where("$item[0] !== 'A'");
	deepEqual(where, ["Orange", "Banana"]);

	var ordered = $transform(list).orderBy("length desc");
	deepEqual(ordered, ["Artichoke", "Orange", "Banana", "Apple"]);

	var grouped = $transform(list).groupBy(function (item) { return item[0]; });
	equal(grouped.length, 3, "should result in three groups");

	function liveAsserts(live, original) {
		ok(original !== live, "live returns a copy of the current transform's output");
		deepEqual(live, original, "live array is not equivelent with input, but should contain the same data");
		equal(live.where, undefined, "live is terminal, does not return a transform but a copy of the transformed array");
	}

	// Make transform results live and make assertions about the output
	var whereLive = where.live();
	liveAsserts(whereLive, where);
	var orderedLive = ordered.live();
	liveAsserts(orderedLive, ordered);
	var groupedLive = grouped.live();
	liveAsserts(groupedLive, grouped);

	// Basic assertions about the results after performing various operations
	list.remove("Banana");
	equal(grouped.length, 3, "non-live grouped output should not be affected");
	equal(groupedLive.length, 2, "should be two groups after array update");
	deepEqual(ordered, ["Artichoke", "Orange", "Banana", "Apple"], "non-live ordered output should not be affected");
	deepEqual(orderedLive, ["Artichoke", "Orange", "Apple"], "item should be removed from live ordered output");
	deepEqual(where, ["Orange", "Banana"], "non-live where output should not be affected");
	deepEqual(whereLive, ["Orange"], "item should be removed from live where output");
	list.add("Banana");

	deepEqual(list, ["Apple", "Orange", "Artichoke", "Banana"]);
	list.add("Avocado");
	list.add("Lemon");
	deepEqual(list, ["Apple", "Orange", "Artichoke", "Banana", "Avocado", "Lemon"]);
	equal(grouped.length, 3, "non-live grouped output should not be affected");
	equal(groupedLive.length, 4, "should be three groups after array update");
	deepEqual(ordered, ["Artichoke", "Orange", "Banana", "Apple"], "non-live ordered output should not be affected");
	deepEqual(orderedLive, ["Artichoke", "Avocado", "Orange", "Banana", "Apple", "Lemon"], "item should be added to live ordered output");
	deepEqual(where, ["Orange", "Banana"], "non-live where output should not be affected");
	deepEqual(whereLive, ["Orange", "Banana", "Lemon"], "item should be removed from live where output");
	list.remove("Lemon");
	list.remove("Avocado");

	list.insert(0, "Raspberry");
	equal(grouped.length, 3, "non-live grouped output should not be affected");
	equal(groupedLive.length, 4, "should be four groups after array update");
	equal(groupedLive[0].group, "R", "'R' group should be first");
	deepEqual(ordered, ["Artichoke", "Orange", "Banana", "Apple"], "non-live ordered output should not be affected");
	deepEqual(orderedLive, ["Raspberry", "Artichoke", "Orange", "Banana", "Apple"], "item should be added to live ordered output");
	deepEqual(where, ["Orange", "Banana"], "non-live where output should not be affected");
	deepEqual(whereLive, ["Raspberry", "Orange", "Banana"], "item should be added to live where output");
	list.remove("Raspberry");

	// Perform assertions about events raised on existing transform results
	var orderedChanges = [];
	Sys.Observer.addCollectionChanged(orderedLive, function (sender, args) { orderedChanges.addRange(args.get_changes()); });

	var whereChanges = [];
	Sys.Observer.addCollectionChanged(whereLive, function (sender, args) { whereChanges.addRange(args.get_changes()); });

	var groupedChanges = [];
	Sys.Observer.addCollectionChanged(groupedLive, function (sender, args) { groupedChanges.addRange(args.get_changes()); });

	list.insert(0, "Tangerine");
	equal(orderedChanges.length, 1, "should only be one change");
	equal(orderedChanges[0].oldItems, undefined, "Should be no removed items");
	equal(orderedChanges[0].newItems.length, 1, "Should be one new item");
	equal(orderedChanges[0].newStartingIndex, 0, "Should be inserted before 'Artichoke'");
	equal(whereChanges.length, 1, "should only be one change");
	equal(whereChanges[0].oldItems, undefined, "Should be no removed items");
	equal(whereChanges[0].newItems.length, 1, "Should be one new item");
	equal(whereChanges[0].newStartingIndex, 0, "Should be inserted before 'Artichoke'");
	equal(groupedChanges.length, 1, "should only be one change");
	equal(groupedChanges[0].oldItems, undefined, "Should be no removed items");
	equal(groupedChanges[0].newItems.length, 1, "Should be one new item");
	equal(groupedChanges[0].newStartingIndex, 0, "Should be inserted before 'Artichoke'");
	list.remove("Tangerine");

	list.insert(0, "Olive");
	equal(groupedLive[0].group, "O", "'O' group should now be the first group.");
	list.remove("Olive");

	groupedChanges = [];

	var groupItemChanges = [];
	Sys.Observer.addCollectionChanged(groupedLive.filter(function (g) { return g.group === "A"; })[0].items, function (sender, args) { groupItemChanges.addRange(args.get_changes()); });

	list.insert(0, "Apricot");
	equal(groupedChanges.length, 0, "should be no changes to groups");
	equal(groupItemChanges.length, 1, "should be one change to the 'A' group's items");
	equal(groupItemChanges[0].oldItems, undefined, "should be no removed items");
	equal(groupItemChanges[0].newItems.length, 1, "should be one added item");
	equal(groupItemChanges[0].newStartingIndex, 0, "should be added at beginning of items list");
	equal(groupItemChanges[0].newItems[0], "Apricot", "should be apricot");
	equal(groupedLive.filter(function (g) { return g.group === "A"; })[0].items[0], "Apricot", "Apricot should be the first item.");
	list.remove("Apricot");

	// Test multiple levels of grouping
	list = ["Apple", "Orange", "Banana", "Artichoke", "Raspberry", "Tangerine", "Apricot"];
	Sys.Observer.makeObservable(list);
	groupedLive = $transform(list).groupBy(function (item) { return item[0]; }).orderBy("group").groupBy(function (item) { return item.group.charCodeAt(0) % 2 === 0 ? "even" : "odd"; }).orderBy("group desc").live();
	groupedChanges = [];
	Sys.Observer.addCollectionChanged(groupedLive, function (sender, args) { groupedChanges.addRange(args.get_changes()); });
	groupItemChanges = [];
	var groupSubItemChanges = [];
	groupedLive.forEach(function (group) {
		Sys.Observer.addCollectionChanged(group.items, function (sender, args) { groupItemChanges.addRange(args.get_changes()); });
		group.items.forEach(function (subGroup) {
			Sys.Observer.addCollectionChanged(subGroup.items, function (sender, args) { groupSubItemChanges.addRange(args.get_changes()); });
		});
	});
	list.add("Cantelope");
	equal(groupedChanges.length, 0, "should be no changes to groups");
	equal(groupItemChanges.length, 1, "should be one change to the 'odd' group's items");
	equal(groupItemChanges[0].oldItems, undefined, "should be no removed items");
	equal(groupItemChanges[0].newItems.length, 1, "should be one added item");
	equal(groupItemChanges[0].newStartingIndex, 1, "should be added at index 1");
	equal(groupItemChanges[0].newItems[0].group, 'C', "should be a new 'C' sub-group");
	deepEqual(groupItemChanges[0].newItems[0].items, ["Cantelope"], "items should contain the new item");
	equal(groupSubItemChanges.length, 0, "should be no changes to sub-items since a new sub-group was added");
	groupedChanges = [];
	groupItemChanges = [];
	groupSubItemChanges = [];
	list.add("Olive");
	equal(groupedChanges.length, 0, "should be no changes to groups");
	equal(groupItemChanges.length, 0, "should be no changes to items since the groups already exist");
	equal(groupSubItemChanges.length, 1, "should be one change to the 'O' group's items");
	equal(groupSubItemChanges[0].oldItems, undefined, "should be no removed items");
	equal(groupSubItemChanges[0].newItems.length, 1, "should be one added item");
	equal(groupSubItemChanges[0].newStartingIndex, 1, "should be added at index 1");
	var group = groupedLive.filter(function (g) { return g.group === "odd"; })[0].items.filter(function (g) { return g.group === 'O'; })[0];
	deepEqual(group.items, ["Orange", "Olive"], "items should contain the new item");

	// Live changes to filtered list
	list = ["Apple", "Orange", "Banana", "Artichoke", "Raspberry", "Tangerine", "Apricot"];
	Sys.Observer.makeObservable(list);
	var whereChanges = [];
	var whereLive = $transform(list).where("$item[0] !== 'A'").live();
	Sys.Observer.addCollectionChanged(whereLive, function (sender, args) { whereChanges.addRange(args.get_changes()); });
	list.add("Pineapple");
	equal(whereChanges.length, 1, "should be 1 change to filtered list");
	equal(whereChanges[0].newItems.length, 1, "should be 1 change to filtered list");
	equal(whereChanges[0].newItems[0], "Pineapple", "should be 1 change to filtered list");
	whereChanges = [];
	list.add("Avocado");
	equal(whereChanges.length, 0, "should be no changes to filtered list");

	list = ["Apple", "Orange", "Banana", "Artichoke"];
	Sys.Observer.makeObservable(list);
	var selectedLive = $transform(list).select("length").live();
	deepEqual(selectedLive, [5, 6, 6, 9], "should result in string lengths");
	var selectChanges = [];
	Sys.Observer.makeObservable(selectChanges);
	Sys.Observer.addCollectionChanged(selectedLive, function (sender, args) { selectChanges.addRange(args.get_changes()); });
	list.insert(0, "Olive");
	deepEqual(selectedLive, [5, 5, 6, 6, 9], "should result in update to live selected transform");
	equal(selectChanges.length, 1, "should be 1 list change");
	ok(selectChanges[0].newItems, "should be new items");
	equal(selectChanges[0].newItems.length, 1, "should be 1 new item");
	equal(selectChanges[0].newItems[0], 5, "added item should be 5");
	ok(!selectChanges[0].oldItems || selectChanges[0].oldItems.length === 0, "should be no old items");
	selectChanges.clear();
	list.removeAt(4);
	deepEqual(selectedLive, [5, 5, 6, 6], "should result in update to live selected transform");
	equal(selectChanges.length, 1, "should be 1 list change");
	ok(!selectChanges[0].newItems || selectChanges[0].newItems.length === 0, "should be no new items");
	ok(selectChanges[0].oldItems, "should be old items");
	equal(selectChanges[0].oldItems.length, 1, "should be 1 old item");
	equal(selectChanges[0].oldItems[0], 9, "removed item should be 9");
	selectChanges.clear();

	list = ["Apple", "Orange", "Banana", "Artichoke"];
	Sys.Observer.makeObservable(list);
	var live = $transform(list).select(function (item) { return item.toLowerCase(); }).groupBy(function (item) { return item[0]; }).live();
	equal(live.length, 3, "should be 3 groups");
	equal(live[0].group, "a");
	equal(live[1].group, "o");
	equal(live[2].group, "b");
	list.insert(0, "Olive");
	equal(live.length, 3, "should still be 3 groups");
	equal(live[0].group, "o");
	equal(live[1].group, "a");
	equal(live[2].group, "b");

	list = ["Apple", "Orange"];
	Sys.Observer.makeObservable(list);
	var live = $transform(list).selectMany(function (item) { return Array.prototype.map.call(item, function (c) { return c; }); }).live();
	equal(live.length, 11, "should be 11 characters");
	equal(live.join(""), "AppleOrange", "should be 'AppleOrange'");
	list.insert(0, "Olive");
	equal(live.length, 16, "should now be 16 characters");
	equal(live.join(""), "OliveAppleOrange", "should be 'OliveAppleOrange'");
	list.removeAt(1);
	equal(live.length, 11, "should now be 11 characters");
	equal(live.join(""), "OliveOrange", "should be 'OliveOrange'");
});
