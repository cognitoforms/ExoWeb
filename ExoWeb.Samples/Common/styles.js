
(function() {

	function setState(el, prefix, current, all) {
		all.forEach(function(state) {
			if (current === state)
				el.addClass(prefix + "-" + state);
			else
				el.removeClass(prefix + "-" + state);
		});
	}

	$("input:rule(required), select:rule(required), textarea:rule(required)").ever(function() {
		$(this).addClass('required');
	});

	$("input:rule(stringLength)").ever(function() {
		var rules = $(this).rules(ExoWeb.Model.Rule.stringLength);
		rules.forEach(function(rule) {
			if(rule.max)
				$(this).attr('maxlength', rule.max);
		}, this);
	});

	$("textarea:rule(stringLength)").ever(function() {
		var rules = $(this).rules(ExoWeb.Model.Rule.stringLength);
		rules.forEach(function(rule) {
			if (rule.max)
				$(this).attr('maxlength', rule.max);
		}, this);
	});

	$("input, select, textarea").ever(function() {
		$(this).validated(function(sender, issues) {

			// locate validation area
			var $area = $(this).closest(".validated");
			var $validation = $area.find(".validation");

			if ($validation.size() == 0) {
				$validation = $(this).next();

				if (!$validation.is('.validation')) {
					// container not found so inject it
					$validation = $(this).after("<div class='validation'></div>").next();
				}
			}

			var states = ["some", "none"];

			if (issues.length == 0) {
				setState($(this), "validated", "none", states);
				setState($validation, "validation", "none", states);
				setState($area, "validated", "none", states);
			} else {
				setState($(this), "validated", "some", states);
				setState($validation, "validation", "some", states);
				setState($area, "validated", "some", states);

				$validation.text(issues[0].get_message());
			}
		});
	});

})();



var qs = {};

(function() {
	var query = window.location.search.substring(1);
	var vars = query.split("&");
	for (var i = 0; i < vars.length; i++) {
		var pair = vars[i].split("=");
		qs[pair[0]] = pair[1];
	}
})();