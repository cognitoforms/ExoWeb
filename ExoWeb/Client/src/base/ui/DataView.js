var dataViewsRendering = 0;

registerActivity("DataView rendering", function() {
	if (dataViewsRendering < 0) {
		logWarning("Number of dataview controls rendering should never dip below zero.");
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
		logWarning("Attempting to refresh, but DataView was being disposed.");
	}

	dataViewsRendering--;
};
