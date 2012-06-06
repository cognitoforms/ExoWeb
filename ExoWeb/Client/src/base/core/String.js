// Add String.trim() if not natively supported
if (typeof String.prototype.trim !== 'function') {
	String.prototype.trim = function () {
		return this.replace(/^\s+|\s+$/g, '');
	}
}
function isNullOrEmpty(str) {
	return str === null || str === undefined || str === "";
}
exports.isNullOrEmpty = isNullOrEmpty; // IGNORE
