function dialog(element, data, options) {

    //The template should be stored in the data hashtable of the anchor
    var $dialogEl = $(element).data("dialog");
    var dataview;

    //If this is the first time we've opened the dialog, then the we need to find the template which will be the div below with a css class of dialog
    if (!$dialogEl) {
        $dialogEl = $(element).next(".dialog");

        //Store off template to anchor
        $(element).data("dialog", $dialogEl);

        // setup the dataview eventing
        dataview = $dialogEl.get(0).control;

        //Set default properties
        var defaults = {
            open: function (event, ui) { $(".ui-dialog-titlebar-close").hide(); },
            modal: true,
            position: "center",
            width: $dialogEl.attr("width") ? parseInt($dialogEl.attr("width")) : 'auto',
            height: $dialogEl.attr("height") ? parseInt($dialogEl.attr("height")) : 'auto',
            closeOnEscape: false,
            resizable: false,
            buttons: {
                "OK": function () {
                    $(this).dialog("close");
                    dataview.set_data(null)
                }
            }
        };

        // init the dialog
        $dialogEl.dialog(defaults);
    }
        //Otherwise we've found used the dialog before so just reuse the template that was stored off
    else {
        dataview = $dialogEl.get(0).control;
    }


    // Override default options with ones passed in
    var mergedOptions = $.extend(true, $dialogEl.dialog('option'), options);
    $dialogEl.dialog('option', mergedOptions);

    //Databind view with data
    dataview.set_data(data);
    // ensure the dialog size is set properly based on the data that was just boudn to the dialog
    dialog.setDialogSize($dialogEl, $dialogEl.attr("width") ? parseInt($dialogEl.attr("width")) : 'auto', $dialogEl.attr("height") ? parseInt($dialogEl.attr("height")) : 'auto');
    // show the dialog
    $dialogEl.dialog("open");
}

dialog.setDialogSize = function ($dialogEl, width, height) {
    $dialogEl.dialog("option", "width", width);
    $dialogEl.dialog("option", "height", height);
    $dialogEl.dialog("option", "position", $dialogEl.dialog("option", "position"));
};
