function Template(element) {
	/// <summary locid="M:J#ExoWeb.UI.Template.#ctor">
	/// In addition to defining template markup, also defines rules that are used
	/// to determine if it should be chosen as the template for a given element
	/// based on a CSS selector as well as a javascript filter that is evaluated 
	/// against the element in question.
	/// </summary>
	/// <param name="element"></param>
	Template.initializeBase(this, [element]);
}

var allTemplates = {};

Template.prototype = {

	get_name: function Template$get_name() {
		/// <value mayBeNull="true" type="String" locid="P:J#ExoWeb.UI.Template.name"></value>
		return this._name;
	},
	set_name: function Template$set_name(value) {
		this._name = value;
	},

	get_nameArray: function Template$get_nameArray() {
		/// <value mayBeNull="true" type="String" locid="P:J#ExoWeb.UI.Template.nameArray"></value>
		if (this._name && !this._nameArray) {
			this._nameArray = this._name.trim().split(/\s+/);
		}
		return this._nameArray;
	},

	get_kind: function Template$get_kind() {
		/// <value mayBeNull="true" type="String" locid="P:J#ExoWeb.UI.Template.kind"></value>
		return this._kind;
	},
	set_kind: function Template$set_kind(value) {
		this._kind = value;
	},

	get_dataType: function Template$get_dataType() {
		/// <value mayBeNull="true" type="String" locid="P:J#ExoWeb.UI.Template.dataType"></value>
		return this._dataType;
	},
	set_dataType: function Template$set_dataType(value) {
		if (ExoWeb.isType(value, Function)) {
			this._dataType = parseFunctionName(value);
			this._dataTypeCtor = value;
		}
		else if (ExoWeb.isType(value, String)) {
			this._dataType = value;
		}
	},

	get_dataTypeCtor: function Template$get_dataTypeCtor() {
		/// <value mayBeNull="true" type="String" locid="P:J#ExoWeb.UI.Template.dataTypeCtor"></value>
		if (!this._dataTypeCtor && ExoWeb.isType(this._dataType, String)) {
			// lazy evaluate the actual constructor
			this._dataTypeCtor = ExoWeb.getCtor(this._dataType);
		}
		return this._dataTypeCtor;
	},

	get_isReference: function Template$get_isReference() {
		/// <value mayBeNull="true" type="Boolean" locid="P:J#ExoWeb.UI.Template.isReference"></value>
		return this._isReference;
	},
	set_isReference: function Template$set_isReference(value) {
		if (value && value.constructor === String) {
			var str = value.toLowerCase().trim();
			if (str === "true") {
				value = true;
			}
			else if (str === "false") {
				value = false;
			}
			else {
				this._isReferenceText = value;
				value = null;
			}
		}
		this._isReference = value;
	},

	get_isList: function Template$get_isList() {
		/// <value mayBeNull="true" type="Boolean" locid="P:J#ExoWeb.UI.Template.isList"></value>
		return this._isList;
	},
	set_isList: function Template$set_isList(value) {
		if (value && value.constructor === String) {
			var str = value.toLowerCase().trim();
			if (str === "true") {
				value = true;
			}
			else if (str === "false") {
				value = false;
			}
			else {
				this._isListText = value;
				value = null;
			}
		}
		this._isList = value;
	},

	get_aspects: function Template$get_aspects() {
		/// <value mayBeNull="true" type="Boolean" locid="P:J#ExoWeb.UI.Template.aspects"></value>
		if (!this._aspects) {
			var aspects = this._aspects = {};
			if (this._isList !== null && this._isList !== undefined) {
				aspects.isList = this._isList;
			}
			if (this._isReference !== null && this._isReference !== undefined) {
				aspects.isReference = this._isReference;
			}
			if (this.get_dataType() !== null && this.get_dataType() !== undefined) {
				aspects.dataType = this.get_dataTypeCtor();
			}
		}
		return this._aspects;
	},

	isCorrectKind: function Template$isCorrectKind(obj) {
		/// <summary locid="M:J#ExoWeb.UI.Template.isCorrectKind">
		/// Determines whether the given object is of the correct kind
		/// for the template, if a kind is specified.
		/// </summary>
		/// <param name="obj" optional="false" mayBeNull="false"></param>
		/// <returns type="Boolean"></returns>
		if (obj instanceof ExoWeb.View.Adapter) {
			return this._kind === "@";
		}
		else {
			return this._kind === undefined;
		}
	},

	_namesSatisfiedBy: function Template$_namesSatisfiedBy(names) {
		/// <summary locid="M:J#ExoWeb.UI.Template._namesSatisfiedBy">
		/// Determines whether the given names collection satisifes all
		/// required template names.
		/// </summary>
		/// <param name="names" type="Array" optional="false" mayBeNull="false"></param>
		/// <returns type="Boolean"></returns>
		return !this.get_nameArray() || !this.get_nameArray().some(function(n) { return !names.contains(n); });
	},

	_aspectsSatisfiedBy: function Template$_aspectsSatisfiedBy(aspects) {
		/// <summary locid="M:J#ExoWeb.UI.Template._aspectsSatisfiedBy">
		/// Determines whether the given data satisfies special aspects
		/// required by the template.
		/// </summary>
		/// <param name="aspects" type="Array" optional="false" mayBeNull="false"></param>
		/// <returns type="Boolean"></returns>
		var satisfied = true;
		eachProp(this.get_aspects(), function(name, value) {
			if (!aspects.hasOwnProperty(name) || (value === null || value === undefined) || (name !== "dataType" && aspects[name] !== value) || (name === "dataType" && aspects[name] !== value && !(aspects[name] && aspects[name].meta && aspects[name].meta.isSubclassOf(value.meta)))) {
				return (satisfied = false);
			}
		});
		return satisfied;
	},

	matches: function Template$matches(data, names) {
		/// <summary locid="M:J#ExoWeb.UI.Template.matches">
		/// Determines whether the given data and name array match the template.
		/// </summary>
		/// <param name="data" optional="false" mayBeNull="false"></param>
		/// <param name="names" type="Array" optional="false" mayBeNull="false"></param>
		/// <returns type="Boolean"></returns>
		if (this._namesSatisfiedBy(names)) {
			var aspects;
			if (data && data.aspects && data.aspects instanceof Function) {
				aspects = data.aspects();
			}
			else {
				aspects = {
					isList: (data && data instanceof Array),
					isReference: (data && data instanceof ExoWeb.Model.Entity)
				};
				if (data === null || data === undefined) {
					aspects.dataType = null;
				}
				else if (data instanceof ExoWeb.Model.Entity) {
					aspects.dataType = data.meta.type.get_jstype();
				}
				else if (data instanceof Array) {
					aspects.dataType = Array;
				}
				else if (data instanceof Object) {
					aspects.dataType = Object;
				}
				else {
					aspects.dataType = data.constructor;
				}
			}
			return this._aspectsSatisfiedBy(aspects);
		}
	},

	toString: function() {
		return $format("<{0} name=\"{1}\" kind=\"{2}\" datatype=\"{3}\" isreference=\"{4}\" islist=\"{5}\" />",
			this._element.tagName.toLowerCase(),
			this._name || "",
			this._kind || "",
			this._dataType || "",
			isNullOrUndefined(this._isReference) ? "" : this._isReference,
			isNullOrUndefined(this._isList) ? "" : this._isList
		);
	},

	dispose: function Template$dispose() {
		this._aspects = this._contentTemplate = this._dataType = this._dataTypeCtor = this._isList = this._isListText =
			this._isReference = this._isReferenceText = this._kind = this._name = this._nameArray = null;
		ExoWeb.UI.Template.callBaseMethod(this, "dispose");
	},

	initialize: function() {
		/// <summary locid="M:J#ExoWeb.UI.Template.initialize" />
		Template.callBaseMethod(this, "initialize");

		// add a class that can be used to search for templates 
		// and make sure that the template element is hidden
		$(this._element).addClass("exoweb-template").hide();

		if (this._element.control.constructor !== String) {
			var el = this._element;
			var tagName = el.tagName.toLowerCase();
			var cache = allTemplates[tagName];
			if (!cache) {
				cache = allTemplates[tagName] = [];
			}
			cache.push(el);
		}
	}

};

function findTemplate(tagName, data, names) {
	/// <summary locid="M:J#ExoWeb.UI.Template.find">
	/// Finds the first field template that match the given data and names and returns the template.
	/// </summary>

	if (data === undefined || data === null) {
		logWarning("Attempting to find template for " + (data === undefined ? "undefined" : "null") + " data.");
	}

	var cache;
	if (cache = allTemplates[tagName]) {
		for (var t = cache.length - 1; t >= 0; t--) {
			var tmplEl = cache[t];
			var tmpl = tmplEl.control;
	
			if (tmpl instanceof Template) {
				var isCorrectKind = tmpl.isCorrectKind(data);
				if ((isCorrectKind === undefined || isCorrectKind === true) && tmpl.matches(data, names)) {
					return tmplEl;
				}
			}
		}
	}

	return null;
}

// bookkeeping for Template.load
// TODO: consider wrapper object to clean up after templates are loaded?
var templateCount = 0;
var externalTemplatesSignal = new ExoWeb.Signal("external templates");
var lastTemplateRequestSignal;

Template.load = function Template$load(path, options) {
	/// <summary locid="M:J#ExoWeb.UI.Template.load">
	/// Loads external templates into the page.
	/// </summary>

	var id = "exoweb-templates-" + (templateCount++);

	var lastReq = lastTemplateRequestSignal;

	// set the last request signal to the new signal and increment
	var signal = lastTemplateRequestSignal = new ExoWeb.Signal(id);
	var callback = externalTemplatesSignal.pending(signal.pending(function () {
		// Activate template controls within the response.
		Sys.Application.activateElement(this);
	}));

	$(function ($) {
		var tmpl = $("<div id='" + id + "'/>")
				.hide()
				.appendTo("body");

		//if the template is stored locally look for the path as a div on the page rather than the cache
		if (options && options.isLocal === true) {
			var localTemplate = $('#' + path);
			callback.call(localTemplate.get(0));
		}
		else {
			var html = ExoWeb.cache(path);

			if (html) {
				tmpl.append(html);
				callback.call(tmpl.get(0));
			} 
			else {
				tmpl.load(path, function(responseText, textStatus, jqXHR) {
					// Ensure that jqXHR is loaded.  'state' check for jquery 1.7+, 'isResolved' check for jQuery 1.5 - 1.7
					if ((jqXHR.state && jqXHR.state() === "resolved") || (jqXHR.isResolved && jqXHR.isResolved())) {
						// Cache the template
						ExoWeb.cache(path, responseText);

						// if there is a pending request then wait for it to complete
						if (lastReq) {
							lastReq.waitForAll(callback, this);
						}
						else {
							callback.call(this);
						}
					}
				});
			}
		}
	});
};

ExoWeb.UI.Template = Template;
Template.registerClass("ExoWeb.UI.Template", Sys.UI.Control, Sys.UI.IContentTemplateConsumer);
