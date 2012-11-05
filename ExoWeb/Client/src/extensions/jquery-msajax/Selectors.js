var exoWebAndModel = false;

jQuery.expr[":"].rule = function (obj, index, meta, stack) {
	if (exoWebAndModel === false) {
		if (!(window.ExoWeb && ExoWeb.Model))
			return false;
		exoWebAndModel = true;
	}

	var ruleName = meta[3];
	var ruleType = ExoWeb.Model.Rule[ruleName];

	if (!ruleType) {
		throw new Error("Unknown rule in selector: " + ruleName);
	}

	return $(obj).rules(ruleType).length > 0;
};

jQuery.expr[":"].bound = function (obj, index, meta, stack) {
	if (exoWebAndModel === false) {
		if (!(window.ExoWeb && ExoWeb.Model))
			return false;
		exoWebAndModel = true;
	}

	return $(obj).liveBindings().length > 0;
};

//////////////////////////////////////////////////////////////////////////////////////
// helpers for working with controls
var dataviewPrereqs = false;
jQuery.expr[":"].dataview = function (obj, index, meta, stack) {
	if (dataviewPrereqs === false) {
		if (!(window.Sys !== undefined && Sys.UI !== undefined && obj.control !== undefined && Sys.UI.DataView !== undefined))
			return false;
		dataviewPrereqs = true;
	}

	return obj.control instanceof Sys.UI.DataView;
};

var contentPrereqs = false;
jQuery.expr[":"].content = function (obj, index, meta, stack) {
	if (contentPrereqs === false) {
		if (!(window.ExoWeb !== undefined && ExoWeb.UI !== undefined && obj.control !== undefined && ExoWeb.UI.Content !== undefined && obj.control))
			return false;

		contentPrereqs = true;
	}

	return obj.control instanceof ExoWeb.UI.Content;
};

var togglePrereqs = false;
jQuery.expr[":"].toggle = function (obj, index, meta, stack) {
	if (togglePrereqs === false) {
		if (!(window.ExoWeb !== undefined && ExoWeb.UI !== undefined && obj.control !== undefined && ExoWeb.UI.Toggle !== undefined && obj.control))
			return false;

		togglePrereqs = true;
	}

	return obj.control instanceof ExoWeb.UI.Toggle;
};

jQuery.expr[":"].control = function (obj, index, meta, stack) {
	var typeName = meta[3];
	var jstype = new Function("{return " + typeName + ";}");

	return obj.control instanceof jstype();
};
