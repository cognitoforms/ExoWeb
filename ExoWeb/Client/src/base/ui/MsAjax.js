/// replaced implementation to use _tcindex instead of _index
/// http://msmvps.com/blogs/luisabreu/archive/2009/10/19/the-dataview-control-going-imperative-take-iii.aspx
Sys.UI.TemplateContext.prototype.getInstanceId = function(prefix) {
	var s;
	if (this._global) {
		s = "";
	}
	else {
		s = this._tcindex;
		var ctx = this.parentContext;
		while (ctx && !ctx._global) {
			s = ctx._tcindex + "_" + s;
			ctx = ctx.parentContext;
		}
	}
	return prefix + s;
};

// call jQuery.ever to make sure it intercepts template rendering since
// we know the ASP.NET AJAX templates script is loaded at this point
if (jQuery.fn.ever) {
	jQuery.fn.ever.call();
}
