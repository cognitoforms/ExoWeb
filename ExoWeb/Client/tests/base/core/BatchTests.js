module("Batch");
test("Simple Batch Test", function () {
    var b1 = ExoWeb.Batch.start("1");

    var invoked = false;
    ExoWeb.Batch.whenDone(function () {
        invoked = true;
    });

    ok(!invoked, "Callback should not yet be invoked since batch is pending");

    ExoWeb.Batch.end(b1);

    ok(invoked, "Callback should be invoked since batch is now complete");

    equal(ExoWeb.Batch.all().length, 0, "All batches should be ended: length of all() = 0");
});

test("Transfer Test", function () {
    // Create the initial batch (b2).
    var b2 = ExoWeb.Batch.start("2");

    var invoked2 = false;
    ExoWeb.Batch.whenDone(function () {
        invoked2 = true;
    });

    // Suspend the initial batch (b2).
    var b = ExoWeb.Batch.suspendCurrent();

    equal(b, b2, "Result of suspendCurrent should be the batch that was created.");

    // Create a new batch (b3) and leave it active.
    var b3 = ExoWeb.Batch.start("3");

    var invoked3 = false;
    ExoWeb.Batch.whenDone(function () {
        invoked3 = true;
    });

    // Resuming b (b2) will cause b3 to be transferred to it, since b3 is currently active.
    ExoWeb.Batch.resume(b);

    ExoWeb.Batch.end(b3);
    ok(!invoked2, "Callback 2 should not yet be invoked since batch is pending");
    ok(!invoked3, "Callback 3 should not yet be invoked since batch is pending");

    ExoWeb.Batch.end(b2);
    ok(invoked2, "Callback 2 should have been invoked since the batch was ended");
    ok(invoked3, "Callback 3 should have been invoked since the batch was ended");

    equal(ExoWeb.Batch.all().length, 0, "All batches should be ended: length of all() = 0");
});
