module("Object");
test("Simple Copy of Object", function() {
    var obj = { "a": 1, "b": 2 };
    var copy = Object.copy(obj);

    equal(obj.a, copy.a, "Value type properties of copy should equal original object.");
    equal(obj.b, copy.b, "Value type properties of copy should equal original object.");
    ok(obj !== copy, "Copy should not equal the original object.");
});

test("Copy of Object with Object properties", function() {
    var reference = { "z": 1000 };

    var obj = { "a": 1, "ref": reference };
    var copy = Object.copy(obj);

    equal(obj.a, copy.a, "Value type properties of copy should equal original object.");
    equal(obj.ref, copy.ref, "Object type properties of copy should equal original object.");
    equal(obj.ref.z, copy.ref.z, "Value type properties of copy (of object property) should equal original object.");
    ok(obj !== copy, "Copy should not equal the original object.");

    var copy2 = Object.copy(obj, { copyChildren: true });
    ok(obj.ref !== copy2.ref, "Object type properties of copy should NOT equal original object when \"copyChildren\" setting is true.");
});

test("Copy of Array", function() {
    var arr = [1, 2, 3];
    var copy = Object.copy(arr);

    deepEqual(arr, copy, "Copy of array should contain the same elements as the original.");
});
