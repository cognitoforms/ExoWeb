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