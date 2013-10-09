if (ExoPerf) {

	// Rules
	var rule_execute = Rule$execute;
	Rule$execute = function ExoPerf$Rule$execute(rule) {
		var activity = new ExoPerf.Activity(rule, "Rule", rule.name);
		try {
			rule_execute.apply(this, arguments);
		}
		finally {
			activity.stop();
		}
	};

	// Rendering
	var sys_application_activateElements = Sys.Application.activateElements;
	Sys.Application.activateElements = function ExoPerf$Sys$Application$activateElements() {
		var activity = new ExoPerf.Activity(this, "Templates", "Render");
		try {
			sys_application_activateElements.apply(this, arguments);
		}
		finally {
			activity.stop();
		}
	};

	// Rendering
	var content_render = Content$render;
	Content$render = function ExoPerf$Content$render() {
		var activity = new ExoPerf.Activity(this, "Templates", "Render");
		try {
			content_render.apply(this, arguments);
		}
		finally {
			activity.stop();
		}
	};

	// Linking
	var sys_application_linkElement = Sys.Application.linkElement;
	Sys.Application.linkElement = function ExoPerf$Sys$Application$linkElement() {
		var activity = new ExoPerf.Activity(this, "Templates", "Link");
		try {
			sys_application_linkElement.apply(this, arguments);
		}
		finally {
			activity.stop();
		}
	};

	// Linking
	var content_link = Content$_link;
	Content$_link = function ExoPerf$Content$link() {
		var activity = new ExoPerf.Activity(this, "Templates", "Link");
		try {
			content_link.apply(this, arguments);
		}
		finally {
			activity.stop();
		}
	};

	// Loading
	var object_from_json = objectFromJson;
	objectFromJson = function ExoPerf$objectFromJson(model, typeName) {
		var activity = new ExoPerf.Activity(this, "Loading", typeName);
		try {
			object_from_json.apply(this, arguments);
		}
		finally {
			activity.stop();
		}
	};

	objectsFromJson

}