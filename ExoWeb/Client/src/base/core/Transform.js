/// <reference path="Errors.js" />

function Transform(array, forLive) {
	if (array == null) throw new ArgumentNullError("array", "transform input is required");
	if (!(array instanceof Array)) throw new ArgumentTypeError("array", "array", array);

	this._array = array;
	this.rootInput = array;
	if (forLive === true) {
		this._livePending = true;
		this._liveComplete = false;
	}
}

function TransformGroup(group, items) {
	this.group = group;
	this.items = items;
}

var compileFilterFunction = (function Transform$compileFilterFunction(filter) {
	var parser = /(([a-z_$][0-9a-z_$]*)([.]?))|(('([^']|\')*')|("([^"]|\")*"))/gi;
	var skipWords = ["true", "false", "$index", "null"];

	filter = filter.replace(parser, function (match, ignored, name, more, strLiteral) {
		if ((strLiteral !== undefined && strLiteral !== null && strLiteral.length > 0) || skipWords.indexOf(name) >= 0) {
			return match;
		}

		if (name === "$item") {
			return more ? "" : name;
		}

		if (more.length > 0) {
			return "get('" + name + "')" + more;
		}

		return "get('" + name + "').value";
	});

	return new Function("$item", "$index", "with(new ExoWeb.EvalWrapper($item)){ return (" + filter + ");}");
}).cached();

var compileSelectFunction = (function Transform$compileSelectFunction(selector) {
	return new Function("$item", "$index", "return ExoWeb.evalPath($item, '" + selector + "');");
}).cached();

var compileSelectManyFunction = (function Transform$compileSelectManyFunction(selector) {
	return new Function("$item", "$index", "return ExoWeb.evalPath($item, '" + selector + "');");
}).cached();

var compileGroupsFunction = (function Transform$compileGroupsFunction(groups) {
	return new Function("$item", "$index", "return ExoWeb.evalPath($item, '" + groups + "');");
}).cached();

var compileOrderingFunction = (function Transform$compileOrderingFunction(ordering) {
	var orderings = [];
	var parser = /\s*([a-z0-9_.]+)(\s+null)?(\s+(asc|desc))?(\s+null)? *(,|$)/gi;

	ordering.replace(parser, function (match, path, nullsFirst, ws, dir, nullsLast) {
		var isNullsFirst = (nullsFirst !== undefined && nullsFirst !== null && nullsFirst.length > 0);
		var isNullsLast = (nullsLast !== undefined && nullsLast !== null && nullsLast.length > 0);
		orderings.push({
			path: path,
			ab: dir === "desc" ? 1 : -1,
			nulls: isNullsLast || (!ws && isNullsFirst) ? 1 : -1
		});
	});

	function before(a, b) {
		if (a !== null && a !== undefined && a.constructor === String && b !== null && b !== undefined && b.constructor === String) {
			a = a.toLowerCase();
			b = b.toLowerCase();
		}
		return a < b;
	}

	return function compare(aObj, bObj) {
		for (var i = 0; i < orderings.length; ++i) {
			var order = orderings[i];

			var a = evalPath(aObj, order.path, null, null);
			var b = evalPath(bObj, order.path, null, null);

			if (a === null && b !== null) {
				return order.nulls;
			}
			if (a !== null && b === null) {
				return -order.nulls;
			}
			if (before(a, b)) {
				return order.ab;
			}
			if (before(b, a)) {
				return -order.ab;
			}
		}

		return 0;
	};
}).cached();

var transforms = {
	where: function where(input, filter, thisPtr) {
		var filterFn = filter instanceof Function ? filter : compileFilterFunction(filter);
		return input.filter(filterFn, thisPtr);
	},
	select: function select(input, selector, thisPtr) {
		var mapFn = selector instanceof Function ? selector : compileSelectFunction(selector);
		return input.map(mapFn, thisPtr);
	},
	selectMany: function select(input, selector, thisPtr) {
		var mapFn = selector instanceof Function ? selector : compileSelectFunction(selector);
		return input.mapToArray(mapFn, thisPtr);
	},
	groupBy: function groupBy(input, groups, thisPtr) {
		var groupFn = groups instanceof Function ? groups : compileGroupsFunction(groups);

		var result = [];
		var len = input.length;
		for (var i = 0; i < len; i++) {
			var item = input[i];
			var groupKey = groupFn.apply(thisPtr || item, [item, i]);

			var group = null;
			for (var g = 0; g < result.length; ++g) {
				if (result[g].group == groupKey) {
					group = result[g];
					group.items.push(item);
					break;
				}
			}

			if (!group) {
				result.push(new TransformGroup(groupKey, [item]));
			}
		}

		return result;
	},
	orderBy: function orderBy(input, ordering, thisPtr) {
		var sortFn = ordering instanceof Function ? ordering : compileOrderingFunction(ordering);
		return input.copy().sort(thisPtr ? sortFn.bind(thisPtr) : sortFn);
	}
};

function copyTransform(steps, array, live) {
	var result = $transform(array, live);
	steps.forEach(function (step) {
		result = result[step._transform.method].call(result, step._transform.arg, step._transform.thisPtr)
	});
	return result;
}

function makeTransform(array, priorTransform, method, arg, thisPtr) {
	// Make sure that the same transform is not made live more than once since this can cause collisions.
	if (priorTransform._liveComplete === true) {
		throw new Error("Cannot call live on the same transform multiple times.");
	}

	var result;

	// When creating a live transform, the result cannot be used directly as an array to
	// discourage using part of the result when the intention is to eventually call "live".
	// When live mode is not used, then if live is eventually called it will result in a non-optimal
	// copying of the transform.
	if (priorTransform._livePending === true) {
		result = new Transform(array, true);
	}
	else {
		Function.mixin(Transform.prototype, array);
		result = array;
	}

	result._prior = priorTransform;
	result.rootInput = priorTransform.rootInput;
	result._transform = { method: method, arg: arg, thisPtr: thisPtr };
	return result;
}

Transform.mixin({
	input: function Transform$input() {
		return this._array || this;
	},
	where: function Transform$where(filter, thisPtr) {
		var output = transforms.where(this.input(), filter, thisPtr);
		return makeTransform(output, this, "where", filter, thisPtr);
	},
	select: function Transform$select(selector, thisPtr) {
		var output = transforms.select(this.input(), selector, thisPtr);
		return makeTransform(output, this, "select", selector, thisPtr);
	},
	selectMany: function Transform$selectMany(selector, thisPtr) {
		var output = transforms.selectMany(this.input(), selector, thisPtr);
		return makeTransform(output, this, "selectMany", selector, thisPtr);
	},
	groupBy: function Transform$groupBy(groups, thisPtr) {
		var output = transforms.groupBy(this.input(), groups, thisPtr);
		if (this._livePending) {
			// make the items array observable if the transform is in live mode
			output.forEach(function (group) {
				ExoWeb.Observer.makeObservable(group.items);
			});
		}
		return makeTransform(output, this, "groupBy", groups, thisPtr);
	},
	orderBy: function Transform$orderBy(ordering, thisPtr) {
		var output = transforms.orderBy(this.input(), ordering, thisPtr);
		return makeTransform(output, this, "orderBy", ordering, thisPtr);
	},
	live: function Transform$live() {
		// Watches for changes on the root input into the transform
		// and raises observable change events on this item as the 
		// results change.

		var transform, steps = [], rootStep;

		// determine the set of transform steps and the level of nested grouping
		for (var step = this; step; step = step._prior) {
			if (step._prior) {
				steps.splice(0, 0, step);
			}
			else {
				rootStep = step;
			}
		}

		// copy and return a live-mode transform if live mode was not used originally
		if (this._livePending !== true) {
			return copyTransform(steps, rootStep.input(), true).live();
		}

		// make a copy of the final transformed data and make it observable
		var output = this.input().copy();
		ExoWeb.Observer.makeObservable(output);
		output.rootInput = this.rootInput;

		// watch for changes to root input and update the transform steps as needed
		ExoWeb.Observer.addCollectionChanged(rootStep.input(), function Transform$live$collectionChanged(sender, args) {
			var changes, stepInput, stepResult, modifiedItemsArrays = [];

			//Sys.NotifyCollectionChangedAction.add;

			// copy the set of changes since they will be manipulated
			changes = args.get_changes().map(function (c) {
				return {
					action: c.action,
					oldItems: c.oldItems ? c.oldItems.copy() : null,
					oldStartingIndex: c.oldStartingIndex,
					newItems: c.newItems ? c.newItems.copy() : null,
					newStartingIndex: c.newStartingIndex
				};
			});

			// make a copied version of the input so that it can be manipulated without affecting the result
			stepInput = rootStep.input().copy();

			// re-run the transform on the newly changed input
			steps.forEach(function (step) {
				// store a reference to the output of this step
				stepResult = step.input();

				if (step._transform.method === "where") {
					changes.purge(function (change) {
						if (change.oldItems) {
							var oldItems = change.oldItems;
							// determine which removed items made it through the filter
							change.oldItems = transforms[step._transform.method](change.oldItems, step._transform.arg, step._transform.thisPtr);
							if (change.oldItems.length === 0) {
								// none of the removed items make it through the filter, so discard
								change.oldItems = null;
								change.oldStartingIndex = null;
								return true;
							}
							else {
								// find the actual index of the first removed item in the resulting array
								change.oldStartingIndex = stepResult.indexOf(change.oldItems[0]);

								// remove the filtered items from the result array
								stepResult.splice(change.oldStartingIndex, change.oldItems.length);
							}
						}
						else if (change.newItems) {
							var newItems = change.newItems;
							// determine which added items will make it through the filter
							change.newItems = transforms[step._transform.method](change.newItems, step._transform.arg, step._transform.thisPtr);
							if (change.newItems.length === 0) {
								// none of the new items will make it through the filter, so discard
								change.newItems = null;
								change.newStartingIndex = null;
								return true;
							}
							else {
								// if not added to the beginning or end of the list, determine
								// the real starting index by finding the index of the previous item
								if (change.newStartingIndex !== 0 && (change.newStartingIndex + change.newItems.length) !== stepInput.length) {
									var found = false;
									for (var idx = change.newStartingIndex - 1; !found && idx >= 0; idx--) {
										if (stepResult.indexOf(stepInput[idx]) >= 0) {
											found = true;
										}
									}
									change.newStartingIndex = idx + 1;
								}

								// splice the filtered items into the result array
								var spliceArgs = change.newItems.copy();
								spliceArgs.splice(0, 0, change.newStartingIndex, 0);
								Array.prototype.splice.apply(stepResult, spliceArgs);
							}
						}
						else {
							return true;
						}
					});
				}
				else if (step._transform.method === "select") {
					changes.forEach(function (change) {
						if (change.oldItems) {
							change.oldItems = stepResult.splice(change.oldStartingIndex, change.oldItems.length);
						}
						else if (change.newItems) {
							var mapFn = step._transform.arg instanceof Function ? step._transform.arg : compileSelectFunction(step._transform.arg);
							change.newItems = change.newItems.map(function (item) {
								return mapFn.call(step._transform.thisPtr || item, item);
							});

							// splice the filtered items into the result array
							var spliceArgs = change.newItems.copy();
							spliceArgs.splice(0, 0, change.newStartingIndex, 0);
							Array.prototype.splice.apply(stepResult, spliceArgs);
						}
					});
				}
				else if (step._transform.method === "selectMany") {
					changes.forEach(function (change) {
						if (change.oldItems) {
							var mapFn = step._transform.arg instanceof Function ? step._transform.arg : compileSelectManyFunction(step._transform.arg);
							var oldItemsMany = change.oldItems.mapToArray(function (item) {
								return mapFn.call(step._transform.thisPtr || item, item);
							});
							var oldPreceeding = stepInput.slice(0, change.oldStartingIndex);
							var oldPreceedingMany = oldPreceeding.mapToArray(function (item) {
								return mapFn.call(step._transform.thisPtr || item, item);
							});
							change.oldItems = stepResult.splice(oldPreceedingMany.length, oldItemsMany.length);
							change.oldStartingIndex = oldPreceedingMany.length;
						}
						else if (change.newItems) {
							var mapFn = step._transform.arg instanceof Function ? step._transform.arg : compileSelectManyFunction(step._transform.arg);
							change.newItems = change.newItems.mapToArray(function (item) {
								return mapFn.call(step._transform.thisPtr || item, item);
							});

							// splice the filtered items into the result array
							var spliceArgs = change.newItems.copy();
							spliceArgs.splice(0, 0, change.newStartingIndex, 0);
							Array.prototype.splice.apply(stepResult, spliceArgs);
						}
					});
				}
				else if (step._transform.method === "groupBy") {
					var groupFn = step._transform.arg instanceof Function ? step._transform.arg : compileGroupsFunction(step._transform.arg);
					var copyOfResults = stepResult.copy();
					changes.forEach(function (change) {
						if (change.oldItems) {
							change.oldItems.forEach(function (item) {
								var groupKey = groupFn.call(step._transform.thisPtr || item, item);
								var group = copyOfResults.filter(function (g) { return g.group === groupKey; })[0];
								// begin and end update on items array
								if (modifiedItemsArrays.indexOf(group.items) < 0) {
									group.items.beginUpdate();
									modifiedItemsArrays.push(group.items);
								}
								// remove the item
								var idx = group.items.indexOf(item);
								group.items.remove(item);
								if (idx === 0) {
									var groupIndex = copyOfResults.indexOf(group),
										sourceIndex = stepInput.indexOf(group.items[0]),
										targetIndex = null;
									for (i = 0; i < copyOfResults.length; i++) {
										if (sourceIndex > stepInput.indexOf(copyOfResults[i].items[0])) {
											targetIndex = i + 1;
											break;
										}
									}
									if (targetIndex !== null) {
										copyOfResults.splice(groupIndex, 1);
										copyOfResults.splice(targetIndex, 0, group);
									}
								}
								if (group.items.length === 0) {
									// remove the group from the copy of the array
									copyOfResults.splice(copyOfResults.indexOf(group), 1);
								}
							});
						}
						else if (change.newItems) {
							change.newItems.forEach(function (item) {
								var groupKey = groupFn.call(step._transform.thisPtr || item, item),
									group = copyOfResults.filter(function (g) { return g.group === groupKey; })[0],
									sourceIndex,
									targetIndex,
									resequenceGroup = false,
									groupIndex,
									i;

								if (group) {
									// begin and end update on items array
									if (modifiedItemsArrays.indexOf(group.items) < 0) {
										group.items.beginUpdate();
										modifiedItemsArrays.push(group.items);
									}
									sourceIndex = stepInput.indexOf(item), targetIndex = null;
									for (i = 0; i < group.items.length; i++) {
										if (sourceIndex < stepInput.indexOf(group.items[i])) {
											targetIndex = i;
											break;
										}
									}
									if (targetIndex !== null) {
										group.items.insert(targetIndex, item);
										// group's index may have changed as a result
										if (targetIndex === 0) {
											resequenceGroup = true;
										}
									}
									else {
										group.items.add(item);
									}
								}
								else {
									group = new TransformGroup(groupKey, [item]);
									ExoWeb.Observer.makeObservable(group.items);
									copyOfResults.push(group);
									resequenceGroup = true;
								}

								if (resequenceGroup === true) {
									groupIndex = copyOfResults.indexOf(group);
									sourceIndex = stepInput.indexOf(group.items[0]);
									targetIndex = null;
									for (i = 0; i < groupIndex; i++) {
										if (sourceIndex < stepInput.indexOf(copyOfResults[i].items[0])) {
											targetIndex = i;
											break;
										}
									}
									if (targetIndex !== null) {
										copyOfResults.splice(groupIndex, 1);
										copyOfResults.splice(targetIndex, 0, group);
									}
								}
							});
						}
					});

					// collect new changes to groups
					changes = update(stepResult, copyOfResults, true);
				}
				else if (step._transform.method === "orderBy") {
					// sort the input and update the step result to match
					var sorted = transforms[step._transform.method](stepInput, step._transform.arg, step._transform.thisPtr);
					changes = update(stepResult, sorted, true);
				}

				// move the input forward to the result of the current step
				stepInput = stepResult;
			});

			// apply changes to the ouput array
			output.beginUpdate();
			changes.forEach(function (change) {
				if (change.oldItems) {
					output.removeRange(change.oldStartingIndex, change.oldItems.length);
				}
				else if (change.newItems) {
					output.insertRange(change.newStartingIndex, change.newItems);
				}
			});
			output.endUpdate();

			// release changes to items arrays of groups, changes to the array occur first to allow
			// for changes to groups' items to be ignored if the group is no longer a part of the output
			modifiedItemsArrays.forEach(function (items) {
				items.endUpdate();
			});
		});

		// mark the transform steps as live complete
		rootStep._liveComplete = true;
		steps.forEach(function (step) {
			step._liveComplete = true;
		});

		return output;
	}
});

exports.Transform = Transform;
window.$transform = function transform(array, forLive) { return new Transform(array, forLive); };
