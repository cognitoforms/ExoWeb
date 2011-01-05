function Translator() {
	this._forwardDictionary = {};
	this._reverseDictionary = {};
}

Translator.prototype = {
	lookup: function Translator$lookup(source, category, key) {
		if (source[category]) {
			return source[category][key] || null;
		}
	},
	forward: function Translator$forward(category, key) {
		return this.lookup(this._forwardDictionary, category, key);
	},
	reverse: function Translator$reverse(category, key) {
		return this.lookup(this._reverseDictionary, category, key);
	},
	add: function Translator$addMapping(category, key, value/*, suppressReverse*/) {
		// look for optional suppress reverse lookup argument
		var suppressReverse = (arguments.length == 4 && arguments[3].constructor === Boolean) ? arguments[3] : false;

		// lazy initialize the forward dictionary for the category
		if (!this._forwardDictionary[category]) {
			this._forwardDictionary[category] = {};
		}
		this._forwardDictionary[category][key] = value;

		// don't add to the reverse dictionary if the suppress flag is specified
		if (!suppressReverse) {
			// lazy initialize the reverse dictionary for the category
			if (!this._reverseDictionary[category]) {
				this._reverseDictionary[category] = {};
			}
			this._reverseDictionary[category][value] = key;
		}
	}
};

ExoWeb.Translator = Translator;
