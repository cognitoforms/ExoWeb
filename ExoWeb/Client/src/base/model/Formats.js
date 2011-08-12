Number.formats = {};
String.formats = {};
Date.formats = {};
TimeSpan.formats = {};
Boolean.formats = {};
Object.formats = {};
Array.formats = {};

//TODO: number formatting include commas
Number.formats.Integer = new Format({
	description: "#,###",
	convert: function(val) {
		return Math.round(val).toString();
	},
	convertBack: function(str) {
		if (!/^([-\+])?(\d+)?\,?(\d+)?\,?(\d+)?\,?(\d+)$/.test(str)) {
			throw new Error("invalid format");
		}

		return parseInt(str, 10);
	}
});

Number.formats.Float = new Format({
	description: "#,###.#",
	convert: function(val) {
		return val.toString();
	},
	convertBack: function(str) {
		if (!/^\s*([-\+])?(\d+)?\,?(\d+)?\,?(\d+)?\,?(\d+)?(\.(\d\d*))?\s*$/.test(str)) {
			throw new Error("invalid format");
		}
		var valString = str.replace(/,/g, "");
		var val = parseFloat(valString);
		if (isNaN(val)) {
			throw new Error("invalid format");
		}
		return val;
	}
});

Number.formats.Percent = new Format({
	description: "##.#%",
	convert: function(val) {
		return (val * 100).toPrecision(3).toString() + " %";
	}
});

Number.formats.Currency = new Format({
	description: "$#,###.##",
	convert: function(val) {
		var valString = val.toFixed(2).toString().replace(/\B(?=(?:\d{3})+(?!\d))/g, ",");
		return "$" + valString;
	},
	convertBack: function(str) {
		var valString = str.replace(/[\$,]/g, "");
		if (!/^\s*([-\+])?(\d+)?\,?(\d+)?\,?(\d+)?\,?(\d+)?(\.(\d){0,2})?\s*$/.test(valString)) {
			 throw new Error("invalid format");
		}

		var val = parseFloat(valString);

		return val;
	}
});

Number.formats.$system = Number.formats.Float;

String.formats.Phone = new Format({
	description: "###-###-#### x####",
	convertBack: function(str) {
		if (!/^\s*\(?([1-9][0-9][0-9])\)?[ -]?([0-9]{3})-?([0-9]{4})( ?x[0-9]{1,8})?\s*$/.test(str)) {
			throw new Error("invalid format");
		}

		return str;
	}
});

String.formats.PhoneAreaCodeOptional = new Format({
	description: "###-###-#### x#### or ###-#### x####",
	convertBack: function(str) {
		if (!/^\s*\(?([1-9][0-9][0-9])\)?[ -]?([0-9]{3})-?([0-9]{4})( ?x[0-9]{1,8})?\s*$/.test(str) &&
			!/^\s*([0-9]{3})-?([0-9]{4})( ?x[0-9]{1,8})?\s*$/.test(str)) {
			throw new Error("invalid format");
		}

		return str;
	}
});

String.formats.Email = new Format({
	description: "name@address.com",
	convertBack: function(str) {
		// based on RFC 2822 token definitions for valid email and RFC 1035 tokens for domain names:
		if (!/^\s*([a-zA-Z0-9\!\#\$\%\&\'\*\+\-\/\=\?\^_\`\{\|\}\~]+(\.[a-zA-Z0-9\!\#\$\%\&\'\*\+\-\/\=\?\^_\`\{\|\}\~]+)*@([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*\.[a-zA-Z]{2,6}|([0-9]{1,3}(\.[0-9]{1,3}){3})))\s*$/.test(str)) {
			throw new Error("invalid format");
		}

		return str;
	}
});

String.formats.ZipCode = new Format({
	description: "##### or #####-####",
	convertBack: function(str){
		if(!/^\s*(\d{5})(-\d{4})?\s*$/.test(str)){
			throw new Error("invalid format");
		}

		return str;
	}
});

String.formats.$system = String.formats.$display = new Format({
	convertBack: function(val) {
		return val ? $.trim(val) : val;
	}
});

Boolean.formats.YesNo = new Format({
	convert: function(val) { return val ? "Yes" : "No"; },
	convertBack: function(str) { return str.toLowerCase() == "yes"; }
});

Boolean.formats.TrueFalse = new Format({
	convert: function(val) { return val ? "true" : "false"; },
	convertBack: function(str) {
		if (str.toLowerCase() == "true") {
			return true;
		}
		else if (str.toLowerCase() == "false") {
			return false;
		}
	}
});

Boolean.formats.$system = Boolean.formats.TrueFalse;
Boolean.formats.$display = Boolean.formats.YesNo;

Date.formats.DateTime = new Format({
	description: "mm/dd/yyyy hh:mm AM/PM",
	convert: function(val) {
		return val.format("MM/dd/yyyy h:mm tt");
	},
	convertBack: function(str) {
		var val = Date.parse(str);

		if (val !== null) {
			return new Date(val);
		}

		throw new Error("invalid date");
	}
});

Date.formats.ShortDate = new Format({
	description: "mm/dd/yyyy",
	convert: function(val) {
		return val.format("M/d/yyyy");
	},
	convertBack: function(str) {
		var val = Date._parseExact(str, Sys.CultureInfo.InvariantCulture.dateTimeFormat.ShortDatePattern, Sys.CultureInfo.InvariantCulture);

		if (val !== null) {
			return val;
		}

		if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str.trim())) {
			throw new FormatError("{value} is not a valid date", str);
		}
		else {
			throw new Error("invalid date");
		}
	}
});

Date.formats.Time = new Format({
	description: "HH:MM AM/PM",
	convert: function(val) {
		return val.format("h:mm tt");
	},
	convertBack: function(str) {
		var parser = /^(1[0-2]|0?[1-9]):([0-5][0-9]) *(AM?|(PM?))$/i;

		var parts = str.match(parser);

		if (!parts) {
			throw new Error("invalid time");
		}

		// build new date, start with current data and overwite the time component
		var val = new Date();

		// hours
		if (parts[4]) {
			val.setHours((parseInt(parts[1], 10) % 12) + 12);  // PM
		}
		else {
			val.setHours(parseInt(parts[1], 10) % 12);  // AM
		}

		// minutes
		val.setMinutes(parseInt(parts[2], 10));

		// keep the rest of the time component clean
		val.setSeconds(0);
		val.setMilliseconds(0);

		return val;
	}
});

var dateRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})\:(\d{2})\:(\d{2})(\.\d{3})?Z$/g;
var dateRegexReplace = "$2/$3/$1 $4:$5:$6 GMT";

// Format that converts from a date to a JSON string
// (using JSON.stringify) and then converts back to a date.
Date.formats.$json = new ExoWeb.Model.Format({
	convert: function(obj) {
		return JSON.stringify(obj);
	},
	convertBack: function(str) {
		dateRegex.lastIndex = 0;
		str = str.replace(dateRegex, dateRegexReplace);
		return new Date(str);
	}
});

Date.formats.$system = Date.formats.DateTime;
Date.formats.$display = Date.formats.DateTime;

TimeSpan.formats.Meeting = new ExoWeb.Model.Format({
	convert: function(val) {
		var num;
		var label;

		if (val.totalHours < 1) {
			num = Math.round(val.totalMinutes);
			label = "minute";
		}
		else if (val.totalDays < 1) {
			num = Math.round(val.totalHours * 100) / 100;
			label = "hour";
		}
		else {
			num = Math.round(val.totalDays * 100) / 100;
			label = "day";
		}

		return num == 1 ? (num + " " + label) : (num + " " + label + "s");
	},
	convertBack: function(str) {
		var parser = /^([0-9]+(\.[0-9]+)?) *(m((inute)?s)?|h((our)?s?)|hr|d((ay)?s)?)$/i;

		var parts = str.match(parser);

		if (!parts) {
			throw new Error("invalid format");
		}

		var num = parseFloat(parts[1]);
		var ms;

		if (parts[3].startsWith("m")) {
			ms = num * 60 * 1000;
		}
		else if (parts[3].startsWith("h")) {
			ms = num * 60 * 60 * 1000;
		}
		else if (parts[3].startsWith("d")) {
			ms = num * 24 * 60 * 60 * 1000;
		}

		return new TimeSpan(ms);
	}
});

TimeSpan.formats.$display = TimeSpan.formats.Meeting;
TimeSpan.formats.$system = TimeSpan.formats.Meeting;  // TODO: implement Exact format

Array.formats.$display = new ExoWeb.Model.Format({
	convert: function (val) {
		if (!val)
			return "";

		var builder = [];
		for (var i = 0; i < val.length; ++i)
			builder.push(val[i].toString());

		return builder.join(", ");
	}
});