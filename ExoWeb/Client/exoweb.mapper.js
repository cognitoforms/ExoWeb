Type.registerNamespace("ExoWeb.Mapper");

(function() {

	// change logging
	// track changes to properties

	function ServerSync(model) {
		this._queue = [];
		var _this = this;

		// update object
		model.addAfterPropertySet(function(obj, property, newVal) {
			var wireFormat = property.get_dataType().formats.$wire;

			_this.enqueue("update", obj, {
				property: property.get_name(),
				value: wireFormat ? wireFormat.convert(newVal) : newVal
			});
		});

		// add object
		model.addObjectRegistered(function(obj) {
			if (obj.meta.isNew)
				_this.enqueue("add", obj);
		});

		// delete object
		model.addObjectUnregistered(function(obj) {
			_this.enqueue("delete", obj);
		});

		// lists???
	}

	ServerSync.prototype = {
		enqueue: function(oper, obj, addl) {
			var entry = { oper: oper, type: obj.meta.type.get_fullName(), id: obj.meta.id };

			if (addl) {
				for (var i in addl) {
					entry[i] = addl[i];
				}
			}
			this._queue.push(entry);
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

				for (var prop in objectData) {
					var propType = obj.meta.property(prop).lastProperty().get_fullTypeName();

					if (typeof (objectData[prop]) == "undefined" || objectData[prop] == null) {
						obj[prop] = null;
					}
					else {
						var prop = obj.meta.property(prop).lastProperty();
						var ctor = prop.get_dataType();
						
						if (ctor.meta) {
							if (prop.get_isList()) {
								var src = objectData[prop];
								var dst = obj[prop] = [];
								Sys.Observer.makeObservable(dst);
								for (var i = 0; i < src.length; i++) {
									var child = dst[dst.length] = new ctor(src[i]);
									if (!child._loaded)
										loadObject(child, prop.get_typeName(), src[i], depth + 1);
								}
							}
							else {
								var related = obj[prop] = new ctor(objectData[prop]);
								if (!related._loaded)
									loadObject(related, prop.get_typeName(), objectData[prop], depth + 1);
							}
						}
						else {
							var format = prop.get_format();
							obj[prop] = format ? format.convertBack(objectData[prop]) : objectData[prop];
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
					if (!Array.contains(ctor.All, obj))
						Array.add(ctor.All, obj);
					if (!obj._loaded)
						loadObject(obj, type, id, 0);
				}
			}
		}

		return model;
	}
	window.$load = $load;
})();
