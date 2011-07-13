Sys.Application.registerMarkupExtension("~",
	function LazyMarkupExtension(component, targetProperty, templateContext, properties) {
		if (!properties.targetProperty) {
			properties.targetProperty = targetProperty;
		}

		var isDisposed = false;

		if (component.add_disposing) {
			component.add_disposing(function() {
				isDisposed = true;
			});
		}

		var getMessage = function getMessage(msg, value) {
			return $format("~ {path}, required=[{required}] ({operation}) {message}{value}", {
				path: (properties.$default || "(no path)"),
				required: properties.required || "",
				message: msg ? msg + " " : "",
				value: arguments.length === 1 ? "" : "- " + value,
				operation: arguments.length === 1 ? "info" : "set"
			});
		};

		var lazyLog = function lazyLog(msg, value) {
//					ExoWeb.trace.log(["~", "markupExt"], getMessage(msg, value));
		};

		lazyLog("initialized");

		var source;
		var scopeChain;

		var updatePending = false;

		var isEl = Sys.UI.DomElement.isDomElement(component);

		function queueUpdate(callback) {
			if (!updatePending) {
				updatePending = true;
				ExoWeb.Batch.whenDone(function() {
					callback(function(value, msg) {
						updatePending = false;

						if (isDisposed) {
							ExoWeb.trace.logWarning(["~", "markupExt"], getMessage("Component is disposed - " + msg, value));
							return;
						}

						lazyLog(msg, value);

						var finalValue = value;
						if (prepareValue && prepareValue instanceof Function) {
							finalValue = prepareValue(value);
						}

						if ((finalValue === null || finalValue === undefined) && properties.ifNull) {
							finalValue = properties.ifNull;
						}

						if (isEl && (properties.targetProperty === "innerText" || properties.targetProperty === "innerHTML")) {
							if (finalValue && finalValue.constructor !== String)
								finalValue = finalValue.toString();

							// taken from Sys$Binding$_sourceChanged
							Sys.Application._clearContent(component);
							if (properties.targetProperty === "innerHTML")
								component.innerHTML = finalValue;
							else
								component.appendChild(document.createTextNode(finalValue));
							Sys.Observer.raisePropertyChanged(component, properties.targetProperty);
						}
						else if (isEl && finalValue === null) {
							// IE would set the value to "null"
							Sys.Observer.setValue(component, properties.targetProperty, "");
						}
						else {
							Sys.Observer.setValue(component, properties.targetProperty, finalValue);
						}
					});
				});
			}
		}

		if (properties.source) {
			var evalSource = new Function("$element", "$index", "$dataItem", "$context", "return " + properties.source + ";");
			var element = null;
			if (Sys.Component.isInstanceOfType(component)) {
				element = component.get_element();
			}
			else if (Sys.UI.DomElement.isDomElement(component)) {
				element = component;
			}
			source = evalSource(element, templateContext.index, templateContext.dataItem, templateContext);

			// don't try to eval the path against window
			scopeChain = [];
		}
		else {
			source = templateContext.dataItem;
		}

		var prepareValue = null;

		var setup = function lazy$setup(result, monitorChangesFromSource) {
			if (properties.transform && result instanceof Array) {
				// generate transform function
				var doTrans = new Function("list", "$element", "$index", "$dataItem", "return $transform(list)." + properties.transform + ";");

				// setup prepare function to perform the transform
				prepareValue = function doTransform(listValue) {
					return doTrans(listValue, component.get_element(), templateContext.index, templateContext.dataItem);
				};

				// watch for changes to the list and refresh
				var list = result;
				Sys.Observer.makeObservable(list);
				Sys.Observer.addCollectionChanged(list, function lazy$listChanged$transform(list, evt) {
					// take a count of all added and removed items
					var added = 0, removed = 0;
					Array.forEach(evt.get_changes(), function(change) {
						if (change.newItems) {
							added += change.newItems.length;
						}
						if (change.oldItems) {
							removed += change.oldItems.length;
						}
					});

					var msg = "changes to underlying list [" + added + " added, " + removed + " removed]";

					// if additional paths are required then load them before updating the value
					if (properties.required) {
						Array.forEach(evt.get_changes(), function(change) {
							queueUpdate(function(setValue) {
								ExoWeb.Model.LazyLoader.evalAll(change.newItems || [], properties.required, function(requiredResult, performedLoading) {
									if (performedLoading) {
										lazyLog("New items added to list:  eval caused loading to occur on required path");
									}
									setValue(result, msg);
								});
							});
						});
					}
					// otherwise, simply update the value
					else {
						queueUpdate(function(setValue) {
							setValue(result, msg);
						});
					}
				});
			}
			else {
				// setup prepare function to use the specified format
				prepareValue = function doFormat(obj) {
					if (obj && properties.format && obj.constructor.formats && obj.constructor.formats[properties.format]) {
						return obj.constructor.formats[properties.format].convert(obj);
					}

					return obj;
				};

				if (properties.$default && monitorChangesFromSource) {
					Sys.Observer.addPathChanged(source, properties.$default, function(sender, args) {
						queueUpdate(function(setValue) {
							var msg = (args instanceof Sys.NotifyCollectionChangedEventArgs) ? "collection changed" :
								((args instanceof Sys.PropertyChangedEventArgs) ? args.get_propertyName() + " property change" : "unknown change");
							setValue(ExoWeb.evalPath(source, properties.$default), msg);
						});
					}, true);
				}
			}
			if (properties.required) {
				var watchItemRequiredPaths = function watchItemRequiredPaths(item) {
					if (item.meta) {
						try {
							var props = properties.required.split(".");

							// static property: more than one step, first step is not an instance property, first step IS a type
							if (props.length > 1 && !item.meta.type.property(props[0], true) && ExoWeb.Model.Model.getJsType(props[0], true)) {
								Sys.Observer.addPathChanged(window, properties.required, function(sender, args) {
									queueUpdate(function(setValue) {
										var msg = (args instanceof Sys.NotifyCollectionChangedEventArgs) ? "collection" :
											((args instanceof Sys.PropertyChangedEventArgs) ? args.get_propertyName() : "unknown");
										setValue(result, "required path step change [" + msg + "]");
									});
								}, true);
							}
							else {
								ExoWeb.Model.Model.property("this." + properties.required, item.meta.type, true, function(chain) {
									chain.addChanged(function lazy$requiredChanged(sender, args) {
										queueUpdate(function(setValue) {
											// when a point in the required path changes then load the chain and refresh the value
											ExoWeb.Model.LazyLoader.evalAll(sender, args.property.get_path(), function lazy$requiredChanged$load(requiredResult, performedLoading) {
												if (performedLoading) {
													lazyLog("Required path change.  Eval caused loading to occur.");
												}
												var triggeredBy = args.triggeredBy || args.property;
												setValue(result, "required path property change [" + triggeredBy.get_name() + "]");
											});
										});
									}, item);
								});
							}
						}
						catch (e) {
							ExoWeb.trace.logError(["markupExt", "~"], e);
						}
					}
					else {
						Sys.Observer.addPathChanged(item, properties.required, function(sender, args) {
							queueUpdate(function(setValue) {
								var msg = (args instanceof Sys.NotifyCollectionChangedEventArgs) ? "collection" :
									((args instanceof Sys.PropertyChangedEventArgs) ? args.get_propertyName() : "unknown");
								setValue(result, "required path step change [" + msg + "]");
							});
						}, true);
					}
				};

				// attempt to watch changes along the required path
				var listToWatch = (result instanceof Array) ? result : [result];
				Array.forEach(listToWatch, watchItemRequiredPaths);
				Sys.Observer.makeObservable(listToWatch);
				Sys.Observer.addCollectionChanged(listToWatch, function lazy$listChanged$watchRequired(list, evt) {
					Array.forEach(evt.get_changes(), function(change) {
						Array.forEach(change.newItems || [], watchItemRequiredPaths);
					});
				});
			}
		}

		ExoWeb.Model.LazyLoader.eval(source, properties.$default,
			function lazy$Loaded(result, message) {
				lazyLog("path loaded <.>");

				var init = function lazy$init(result) {
					try {
						// Load additional required paths
						if (properties.required) {
							queueUpdate(function(setValue) {
								ExoWeb.Model.LazyLoader.evalAll(result, properties.required, function(requiredResult, performedLoading) {
									if (performedLoading) {
										lazyLog("Initial setup.  Eval caused loading to occur on required path");
									}
									setValue(result, message || "required path loaded");
								});
							});
						}
						else {
							queueUpdate(function(setValue) {
								setValue(result, message || "no required path");
							});
						}
					}
					catch (err) {
						ExoWeb.trace.throwAndLog(["~", "markupExt"], "Path '{0}' was evaluated but the '{2}' property on the target could not be set, {1}", [properties.$default, err, properties.targetProperty || targetProperty]);
					}
				}

				if (result === undefined || result === null) {
					queueUpdate(function(setValue) {
						setValue(result, "no value");
					});

					var isSetup = false;

					Sys.Observer.addPathChanged(source, properties.$default, function(target, args) {
						queueUpdate(function(setValue) {
							ExoWeb.Model.LazyLoader.eval(source, properties.$default, function lazy$Loaded(result, message) {
								var msg = (args instanceof Sys.NotifyCollectionChangedEventArgs) ? "collection changed" :
									((args instanceof Sys.PropertyChangedEventArgs) ? args.get_propertyName() + " property change" : "unknown change");

								// If we now have a value, ensure initialization and set the value.
								if (result !== undefined && result !== null) {
									if (!isSetup) {
										setup(result, false);
										init(result, msg);
										isSetup = true;
									}
								}

								setValue(result, msg);
							});
						});
					}, true);
				}
				else {
					setup(result, true);
					init(result);
				}
			},
			function(err) {
				ExoWeb.trace.throwAndLog(["~", "markupExt"], "Couldn't evaluate path '{0}', {1}", [properties.$default, err]);
			},
			scopeChain
		);
	},
	false
);
