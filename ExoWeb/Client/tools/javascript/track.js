module.exports = (function() {

	var objs = {};
	var props = {};

	var res = function(name, obj) {

		objs[name] = obj;

		var arr = props[name] = [];

		for (var p in obj) {
			if (obj.hasOwnProperty(p)) {
				if (arr.indexOf(p) < 0) {
					arr.push(p);
				}
			}
		}

	};

	res.test = function (name, obj, detectClassMembers) {

		if (!obj) {
			obj = objs[name];
		}

		var arr = props[name];

		for (var p in obj) {
			if (obj.hasOwnProperty(p)) {	
				if (arr.indexOf(p) < 0) {
					var val = obj[p];
					if (typeof val === "function" && p[0].toLowerCase() !== p[0]) {
						console.log("Found " + name + " class '" + p + "'.");
						if (detectClassMembers) {
							for (var m in val.prototype) {
								if (val.prototype.hasOwnProperty(m) && m !== "constructor") {
									console.log("  Found prototype member '" + p + "." + m + "'.");
								}
							}
						}
					} else {
						console.log("Found " + name + " property '" + p + "'.");
					}
					arr.push(p);
				}
			}
		}

	};

	return res;

}());
