function Html(element) {
	/// <summary>
	/// </summary>
	/// <example>
	///		<div sys:attach="html" html:url="http://www.google.com"></div>
	/// </example>

	Html.initializeBase(this, [element]);
}

Html.prototype = {
	get_source: function Html$get_source() {
		return this._source;
	},
	set_source: function Html$set_source(value) {
		this._source = value;
	},
	get_loadingClass: function Html$get_loadingClass() {
		return this._loadingClass;
	},
	set_loadingClass: function Html$set_loadingClass(value) {
		this._loadingClass = value;
	},
	get_url: function Html$get_url() {
		return this._url;
	},
	set_url: function Html$set_url(value) {
		this._url = value;
	},
	get_path: function Html$get_path() {
		var source = this.get_source();
		var url = this.get_url();
		if (source instanceof ExoWeb.Model.Entity) {
			url = source.toString(url);
		}
		return $format(url, source);
	},
	initialize: function Html$initialize() {
		Html.callBaseMethod(this, "initialize");

		var path = this.get_path();
		var element = this.get_element();
		var loadingClass = this.get_loadingClass();

		$(element).addClass(loadingClass);

		$(element).load(path, function(responseText, status, response) {
			$(element).removeClass(loadingClass);

			if (status != "success" && status != "notmodified") {
				ExoWeb.trace.throwAndLog("ui", "Failed to load html: status = {0}", status);
			}
		});
	}
};

ExoWeb.UI.Html = Html;
Html.registerClass("ExoWeb.UI.Html", Sys.UI.Control);
