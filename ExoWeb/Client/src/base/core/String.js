if (!String.prototype.endsWith) {
	String.prototype.endsWith = function endsWith(text) {
		return this.length === (this.indexOf(text) + text.length);
	};
}

function isNullOrEmpty(str) {
	return str === null || str === undefined || str === "";
}
exports.isNullOrEmpty = isNullOrEmpty; // IGNORE
