var dataViewsRendering = 0;

ExoWeb.registerActivity(function() {
	if (dataViewsRendering < 0) {
		ExoWeb.trace.logWarning("ui", "Number of dataview controls rendering should never dip below zero.");
	}

	return dataViewsRendering > 0;
});

var dataViewRefresh = Sys.UI.DataView.prototype.refresh;
Sys.UI.DataView.prototype.refresh = function refresh() {
	dataViewsRendering++;

	dataViewRefresh.apply(this, arguments);

	dataViewsRendering--;
};
