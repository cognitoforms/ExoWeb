function randomInteger(min, max) {
	var scale;
	if (arguments.length === 0) {
		min = 0;
		max = 9;
	}
	else if (arguments.length === 1) {
		if (!isInteger(min)) {
			throw new Error("Minimum argument must be an integer.");
		}

		if (min < 0) {
			max = 0;
		}
		else {
			max = min;
			min = 0;
		}
	}
	else if (!isInteger(min)) {
		throw new Error("Minimum argument must be an integer.");
	}
	else if (!isInteger(max)) {
		throw new Error("Maximum argument must be an integer.");
	}
	else if (min >= max) {
		throw new Error("Minimum argument must be less than maximum argument.");
	}

	var rand = Math.random();
	return rand === 1 ? max : Math.floor(rand * (max - min + 1)) + min;
}

exports.randomInteger = randomInteger;

function randomText(len, includeDigits) {
	if (arguments.length === 0) {
		throw new Error("Length argument is required.");
	}
	else if (!isNatural(len)) {
		throw new Error("Length argument must be a natural number.");
	}

	var result = "";
	for (var i = 0; i < len; i++) {
		var min = 0;
		var max = includeDigits ? 35 : 25;
		var rand = randomInteger(min, max);
		var charCode;
		if (rand <= 25) {
			// Alpha: add 97 for 'a'
			charCode = rand + 97;
		}
		else {
			// Num: start at 0 and add 48 for 0
			charCode = (rand - 26) + 48;
		}
		result += String.fromCharCode(charCode);
	}
	return result;
}

exports.randomText = randomText;
