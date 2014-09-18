function Element (tagName) {
	this.tagName = tagName;
	this.children = [];

	var nesting = [];
	if (tagName === "div") {
		nesting = ["link", "table", "a", "input"];
	}

	nesting.forEach(function(e) {
		this.appendChild(new Element(e));
	}, this);

	if (tagName === "script") {
		this.src = "";
	}
}

Element.prototype.getElementsByTagName = function(tagName) {
	return this.children.filter(function(e) { return e.tagName === tagName; });
};

Element.prototype.addEventListener = function() {
};

Element.prototype.setAttribute = function noop() {
};

Element.prototype.insertBefore = function noop() {
};

Element.prototype.appendChild = function(c) {
	this.children.push(c);
	if (!this.firstChild) {
		this.firstChild = c;
	}
	this.lastChild = c;
};

Element.prototype.removeChild = function(c) {
};

global.Element = Element;

function Document() {
}

Document.prototype = new Element("document");

Document.prototype.createElement = function(tagName) {
	return new Element(tagName);
};

Document.prototype.createComment = function(text) {
	return {
		nodeValue: text
	};
};

Document.prototype.getElementById = function (id) {
	return null;
};

Document.prototype.createDocumentFragment = function () {
	return new Document();
};

var window = global;
window.window = window;
window.location = {
	pathname: "",
	href: ""
};
window.navigator = {
	userAgent: ""
};

window.addEventListener = Element.prototype.addEventListener;

var document = global.document = new Document();
window.document = document;
var navigator = global.navigator = window.navigator;

window.eval = function (path) {
	var steps = path.split('.');
	var obj = window;
	steps.forEach(function(s) {
		obj = obj[s];
	});
	return obj;
};

document.documentElement = new Element("document");
