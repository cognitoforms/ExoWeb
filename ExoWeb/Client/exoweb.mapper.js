
// from jQuery.aop...
//(function() {

//	var _after = 1;
//	var _afterThrow = 2;
//	var _afterFinally = 3;
//	var _before = 4;
//	var _around = 5;
//	var _intro = 6;
//	var _regexEnabled = true;
//	var _arguments = 'arguments';
//	var _undef = 'undefined';

//	var getType = (function() {

//		var toString = Object.prototype.toString,
//			toStrings = {},
//			nodeTypes = { 1: 'element', 3: 'textnode', 9: 'document', 11: 'fragment' },
//			types = 'Arguments Array Boolean Date Document Element Error Fragment Function NodeList Null Number Object RegExp String TextNode Undefined Window'.split(' ');

//		for (var i = types.length; i--; ) {
//			var type = types[i], constructor = window[type];
//			if (constructor) {
//				try { toStrings[toString.call(new constructor)] = type.toLowerCase(); }
//				catch (e) { }
//			}
//		}

//		return function(item) {
//			return item == null && (item === undefined ? _undef : 'null') ||
//				item.nodeType && nodeTypes[item.nodeType] ||
//				typeof item.length == 'number' && (
//					item.callee && _arguments ||
//					item.alert && 'window' ||
//					item.item && 'nodelist') ||
//				toStrings[toString.call(item)];
//		};

//	})();

//	var isFunc = function(obj) { return getType(obj) == 'function'; };

//	/**
//	* Private weaving function.
//	*/
//	var weaveOne = function(source, method, advice) {

//		var old = source[method];

//		// Work-around IE6/7 behavior on some native method that return object instances
//		if (advice.type != _intro && !isFunc(old)) {
//			var oldObject = old;
//			old = function() {
//				var code = arguments.length > 0 ? _arguments + '[0]' : '';

//				for (var i = 1; i < arguments.length; i++) {
//					code += ',' + _arguments + '[' + i + ']';
//				}

//				return eval('oldObject(' + code + ');');
//			};
//		}

//		var aspect;
//		if (advice.type == _after || advice.type == _afterThrow || advice.type == _afterFinally)
//			aspect = function() {
//				var returnValue, exceptionThrown = null;

//				try {
//					returnValue = old.apply(this, arguments);
//				} catch (e) {
//					exceptionThrown = e;
//				}

//				if (advice.type == _after)
//					if (exceptionThrown == null)
//					returnValue = advice.value.apply(this, [returnValue, method]);
//				else
//					throw exceptionThrown;
//				else if (advice.type == _afterThrow && exceptionThrown != null)
//					returnValue = advice.value.apply(this, [exceptionThrown, method]);
//				else if (advice.type == _afterFinally)
//					returnValue = advice.value.apply(this, [returnValue, exceptionThrown, method]);

//				return returnValue;
//			};
//		else if (advice.type == _before)
//			aspect = function() {
//				advice.value.apply(this, [arguments, method]);
//				return old.apply(this, arguments);
//			};
//		else if (advice.type == _intro)
//			aspect = function() {
//				return advice.value.apply(this, arguments);
//			};
//		else if (advice.type == _around) {
//			aspect = function() {
//				var invocation = { object: this, args: Array.prototype.slice.call(arguments) };
//				return advice.value.apply(invocation.object, [{ arguments: invocation.args, method: method, proceed:
//					function() {
//						return old.apply(invocation.object, invocation.args);
//					}
//}]);
//				};
//			}

//			aspect.unweave = function() {
//				source[method] = old;
//				pointcut = source = aspect = old = null;
//			};

//			source[method] = aspect;

//			return aspect;

//		};

//		/**
//		* Private method search
//		*/
//		var search = function(source, pointcut, advice) {

//			var methods = [];

//			for (var method in source) {

//				var item = null;

//				// Ignore exceptions during method retrival
//				try {
//					item = source[method];
//				}
//				catch (e) { }

//				if (item != null && method.match(pointcut.method) && isFunc(item))
//					methods[methods.length] = { source: source, method: method, advice: advice };

//			}

//			return methods;
//		};

//		/**
//		* Private weaver and pointcut parser.
//		*/
//		var weave = function(pointcut, advice) {

//			var source = typeof (pointcut.target.prototype) != _undef ? pointcut.target.prototype : pointcut.target;
//			var advices = [];

//			// If it's not an introduction and no method was found, try with regex...
//			if (advice.type != _intro && typeof (source[pointcut.method]) == _undef) {

//				// First try directly on target
//				var methods = search(pointcut.target, pointcut, advice);

//				// No method found, re-try directly on prototype
//				if (methods.length == 0)
//					methods = search(source, pointcut, advice);

//				for (var i in methods)
//					advices[advices.length] = weaveOne(methods[i].source, methods[i].method, methods[i].advice);

//			}
//			else {
//				// Return as an array of one element
//				advices[0] = weaveOne(source, pointcut.method, advice);
//			}

//			return _regexEnabled ? advices : advices[0];

//		};

//	//	jQuery.aop
//	window.aspect = {
//		after: function(pointcut, advice) {
//			return weave(pointcut, { type: _after, value: advice });
//		},

//		afterThrow: function(pointcut, advice) {
//			return weave(pointcut, { type: _afterThrow, value: advice });
//		},

//		afterFinally: function(pointcut, advice) {
//			return weave(pointcut, { type: _afterFinally, value: advice });
//		},

//		before: function(pointcut, advice) {
//			return weave(pointcut, { type: _before, value: advice });
//		},

//		around: function(pointcut, advice) {
//			return weave(pointcut, { type: _around, value: advice });
//		},

//		introduction: function(pointcut, advice) {
//			return weave(pointcut, { type: _intro, value: advice });
//		},

//		setup: function(settings) {
//			_regexEnabled = settings.regexMatch;
//		}
//	};

//})();


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

			for (var type in metadata) {
				var jstype = model.addType(type, null, metadata[type].attributes).get_jstype();

//				jstype.formats.$wire = new Format({
//					convert: function(val) { return val.meta.id; },
//					convertBack: function(str) { return type.get(str); }
//				});
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
					var propType = obj.meta.property(prop).last().get_fullTypeName();

					if (typeof (objectData[prop]) == "undefined" || objectData[prop] == null) {
						obj[prop] = null;
					}
					else {
						if (propType == "String")
							obj[prop] = objectData[prop].toString();
						else if (propType == "Date") {
							if (objectData[prop].constructor == Date)
								obj[prop] = objectData[prop];
							else
								obj[prop] = Date.formats.$default.convertBack(objectData[prop].toString());
						}
						else if (propType == "Boolean") {
							if (objectData[prop].constructor == Boolean)
								obj[prop] = objectData[prop];
							else
								obj[prop] = Boolean.formats.$default.convertBack(objectData[prop].toString());
						}
						else if (propType == "Integer")
							obj[prop] = Number.formats.Integer.convertBack(objectData[prop].toString());
						else if (propType == "Float")
							obj[prop] = Number.formats.Float.convertBack(objectData[prop].toString());
						else {
							if (propType.indexOf("|") >= 0) {
								var typeDef = propType.split("|");
								var multiplicity = typeDef[0];
								var relatedType = typeDef[1];

								if (multiplicity == "One") {
									var ctor = window[relatedType];
									var related = obj[prop] = new ctor(objectData[prop]);
									if (!related._loaded)
										loadObject(related, relatedType, objectData[prop], depth + 1);
								}
								else if (multiplicity == "Many") {
									var src = objectData[prop];
									var dst = obj[prop] = [];
									for (var i = 0; i < src.length; i++) {
										var ctor = window[relatedType];
										var child = dst[dst.length] = new ctor(src[i]);
										if (!child._loaded)
											loadObject(child, relatedType, src[i], depth + 1);
									}
								}
								else {
									throw ($format("Unknown multiplicity \"{m}\".", { m: multiplicity }));
								}
							}
							else {
								throw ($format("Unknown property type \"{t}\".", { t: propType }));
							}
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
