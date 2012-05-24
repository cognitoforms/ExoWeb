(function() {
	function liveResultHasSameItems(source, inputTransform, liveTransform, groupNesting) {
		return function() {
			ok(arraysAreEqual(inputTransform, liveTransform, resultEquality(groupNesting)), "Live array should have the same items as the source transform");
		};
	}
	
	function liveResultIsCopy(source, inputTransform, liveTransform, groupNesting) {
		return function() {
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
		return function(a, b) {
			if (a.group !== b.group) {
				return false;
			}
			return arraysAreEqual(a.items, b.items, inner || function(a, b) { return a === b; });
		};
	}
	
	function assertRemoved(source, inputTransform, groupNesting, changes, equality) {
		return function(removedAt, removedItem) {
			ok(changes.length > 0, "Should be changes");
			ok(changes.some(function(change) {
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
						equals(change.oldStartingIndex + i, removedAt, "Expected removal of item " + removedItem + " at index " + removedAt);
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
		return function(item) {
			var changes = [];
			Sys.Observer.addCollectionChanged(liveTransform, function(sender, args) {
				Array.prototype.push.apply(changes, args.get_changes());
			});
			source.remove(item);
			return {
				itemIsRemoved: assertRemoved(source, liveTransform, groupNesting, changes, resultEquality(groupNesting))
			};
		};
	}
	
	function live(source, inputTransform, groupNesting) {
		return function() {
			var liveTransform = inputTransform.live();
			var changes = [];
			Sys.Observer.addCollectionChanged(liveTransform, function(sender, args) {
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
		return function(/* expectedResult */) {
			equals(transform.length, arguments.length, "should be " + arguments.length + " items after array update");
			var equalityFn = resultEquality(groupNesting);
			ok(arraysAreEqual(transform, Array.prototype.slice.call(arguments), equalityFn), "The items should match");

			return {
				whenLive: live(source, transform, groupNesting)
			};
		};
	}
	
	function groupedBy(source, inputTransform, groupNesting) {
		return function(expr) {
			var stepTransform = inputTransform.groupBy(expr);
			var newGroupNesting = groupNesting + 1;
			return {
				theResultIs: assertResult(source, stepTransform, newGroupNesting),
				andLive: live(source, stepTransform, newGroupNesting)
			};
		};
	}
	
	function orderedBy(source, inputTransform, groupNesting) {
		return function(expr) {
			var stepTransform = inputTransform.orderBy(expr);
			return {
				theResultIs: assertResult(source, stepTransform, groupNesting),
				andLive: live(source, stepTransform, groupNesting)
			};
		};
	}
	
	function filteredBy(source, inputTransform, groupNesting) {
		return function(expr) {
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