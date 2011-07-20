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

	if (this.get_element()) {
		dataViewRefresh.apply(this, arguments);
	}
	else {
		ExoWeb.trace.logWarning("ui", "Attempting to refresh, but DataView was being disposed.");
	}

	dataViewsRendering--;
};
