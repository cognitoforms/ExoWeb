Type.registerNamespace("ExoWeb.Mapper");

(function() {

	function toWire(obj) {
		if (obj instanceof Array) {
			var wire = [];
			for (var i = 0; i < obj.length; ++i) {
				wire.push(toWire(obj[i]));
			}

			return wire;
		}
		else if (obj.constructor.formats && obj.constructor.formats.$wire) {
			return obj.constructor.formats.$wire.convert(obj);
		}
		else {
			return obj;
		}
	}

	function ServerSync(model) {
		this._queue = [];
		var _this = this;

		// update object
		model.addAfterPropertySet(function(obj, property, newVal) {
			_this.enqueue("update", obj, {
				property: property.get_name(),
				value: toWire(newVal)
			});
		});

		// add object
		model.addObjectRegistered(function(obj) {
			if (obj.meta.isNew)
				_this.enqueue("new", obj);
		});

		// delete object
		model.addObjectUnregistered(function(obj) {
			_this.enqueue("delete", obj);
		});

		// lists
		model.addListChanged(function(obj, property, changes) {

			for (var i = 0; i < changes.length; ++i) {
				var change = changes[i];

				var addl = {
					property: property.get_name(),
				};
					
				if(change.newStartingIndex >= 0 || addl.newItems) {
					addl.newStartingIndex = change.newStartingIndex;
					addl.newItems = toWire(change.newItems);
				}
				if(change.oldStartingIndex >= 0 || addl.oldItems) {
					addl.oldStartingIndex = change.oldStartingIndex;
					addl.oldItems = toWire(change.oldItems);
				}

				// add changes, convert objects to values
				_this.enqueue("list", obj, addl);
			}
		});
	}

	ServerSync.prototype = {
		enqueue: function(oper, obj, addl) {
			var entry = { oper: oper, type: obj.meta.type.get_fullName(), id: toWire(obj) };

			if (addl) {
				for (var i in addl) {
					entry[i] = addl[i];
				}
			}
			this._queue.push(entry);
			
			if(this.enableConsole && console && console.log) {
				var s = "";
				
				if(addl && addl.property)
					s += "." + addl.property;

				for(var key in addl){
					if(key != "property")
						s += "; " + key + "=" + addl[key];
				}
				
				console.log($format("{oper}: {type}({id}){addl}", {oper: entry.oper, type: entry.type, id: entry.id, addl: s}));
			}
		}
	}
	ExoWeb.Mapper.ServerSync = ServerSync;
	ServerSync.registerClass("ExoWeb.Mapper.ServerSync");


	///////////////////////////////////////////////////////////////////////////////
	// Globals
	function $load(metadata, data) {
		var model = null;

		if (metadata) {
			model = new ExoWeb.Model.Model();

			function createWireFormat(jstype) {
				jstype.formats.$wire = new ExoWeb.Model.Format({
					convert: function(val) { return val.meta.id; },
					convertBack: function(str) { return jstype.meta.get(str); }
				});
			}

			for (var type in metadata) {
				var jstype = model.addType(type, null, metadata[type].attributes).get_jstype();
				createWireFormat(jstype, type);
			}
		}

		if (data) {
			// Note: load object depends on local "data" variable to access data for related objects
			var loadObject = function(obj, type, id, depth) {
				obj._loaded = true;

				// don't hang the browser
				if (depth > loadObject.MAX_DEPTH)
					throw ($format("Maximum recursion depth of {depth} was exceeded.", { depth: loadObject.MAX_DEPTH }));

				var objectData = data[type][id];

				for (var propName in objectData) {
					var prop = obj.meta.property(propName).lastProperty();
					var propType = prop.get_fullTypeName();

					if (typeof (objectData[prop]) == "undefined" || objectData[propName] == null) {
						prop.init(obj, null);
					}
					else {
						var ctor = prop.get_dataType();

						if (ctor.meta) {
							if (prop.get_isList()) {
								var src = objectData[propName];
								var dst = [];
								for (var i = 0; i < src.length; i++) {
									var child = dst[dst.length] = new ctor(src[i]);
									if (!child._loaded)
										loadObject(child, prop.get_typeName(), src[i], depth + 1);
								}
								prop.init(obj, dst);
							}
							else {
								var related = new ctor(objectData[propName]);
								prop.init(obj, related);
								if (!related._loaded)
									loadObject(related, prop.get_typeName(), objectData[propName], depth + 1);
							}
						}
						else {
							var format = prop.get_format();
							prop.init(obj, format ? format.convertBack(objectData[propName]) : objectData[propName]);
						}
					}
				}

				return obj;
			}

			loadObject.MAX_DEPTH = 10;

			for (var type in data) {
				var ctor = window[type];
				for (var id in data[type]) {
					var obj = new ctor(id);
					if (!obj._loaded)
						loadObject(obj, type, id, 0);
				}
			}
		}

		return model;
	}
	window.$load = $load;
})();
