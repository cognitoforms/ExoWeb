function JsStyleSheet(el) {

	$("input", el).validated(function(sender, issues) {
		if (issues.length == 0) {
			$(this).removeClass("error");
			$(this).attr("title", null);
		} else {
			$(this).addClass("error");
			$(this).attr("title", issues[0].get_message());
		}
	});
}

JsStyleSheet();

$("*").rendered(function() {
	JsStyleSheet(this);
});



var qs = {};

(function() {
	var query = window.location.search.substring(1);
	var vars = query.split("&");
	for (var i = 0; i < vars.length; i++) {
		var pair = vars[i].split("=");
		qs[pair[0]] = pair[1];
	}
})();