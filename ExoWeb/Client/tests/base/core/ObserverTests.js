module("Observer");
test("addPropertyChanged", function() {
    var driver = getDriver("Joe", 30);

    var numCalls;
    var handler = function() { numCalls++; };

    ExoWeb.Observer.addPropertyChanged(driver, "name", handler);

    numCalls = 0;
    ExoWeb.Observer.setValue(driver, "name", "Bob");
    equal(driver.name, "Bob", "Name should be changed to Bob");
    equal(numCalls, 1, "Handler should have been called");

    numCalls = 0;
    ExoWeb.Observer.setValue(driver, "age", 5);
    equal(driver.age, 5, "Age should be changed to 5");
    equal(numCalls, 0, "Handler should NOT have been called on a different property");

    ExoWeb.Observer.removePropertyChanged(driver, "name", handler);

    numCalls = 0;
    ExoWeb.Observer.setValue(driver, "name", "Bill");
    equal(driver.name, "Bill", "Name should be changed to Bill");
    equal(numCalls, 0, "Handler should NOT have been called after removing");
});

test("PropertyObserver - start", function () {
    var source = { foo: "bar" };

    var observer = new ExoWeb.PropertyObserver("foo");

    var numCalls = 0;
    observer.start(source, function () { numCalls++; });

    numCalls = 0;
    ExoWeb.Observer.setValue(source, "foo", "foo");
    equal(numCalls, 1, "Handler should be called after setting property value");
});

test("PropertyObserver - start (Array)", function () {
    var source = { foo: ["a", "b"] };
    ExoWeb.Observer.makeObservable(source.foo);

    var observer = new ExoWeb.PropertyObserver("foo");

    var numCalls = 0;
    observer.start(source, function () { numCalls++; });

    numCalls = 0;
    source.foo.remove(source.foo[1]);
    equal(numCalls, 1, "Handler should be called after removing item");

    numCalls = 0;
    source.foo.add("c");
    equal(numCalls, 1, "Handler should be called after adding item");

    numCalls = 0;
    ExoWeb.Observer.setValue(source, "foo", []);
    equal(numCalls, 1, "Handler should be called after resetting array property value");
});

test("PropertyObserver - stop", function () {
    var source = { foo: "bar" };

    var observer = new ExoWeb.PropertyObserver("foo");

    var numCalls = 0;
    observer.start(source, function () { numCalls++; });

    // stop observing immediately
    observer.stop();

    numCalls = 0;
    ExoWeb.Observer.setValue(source, "foo", "foo");
    equal(numCalls, 0, "Handler should NOT be called since the observer is stopped");
});

test("PropertyObserver - stop (Array)", function () {
    var source = { foo: [] };
    ExoWeb.Observer.makeObservable(source.foo);

    var observer = new ExoWeb.PropertyObserver("foo");

    var numCalls = 0;
    observer.start(source, function () { numCalls++; });

    var originalFoo = source.foo;
    var newFoo = ["a", "b"];
    ExoWeb.Observer.makeObservable(newFoo);
    ExoWeb.Observer.setValue(source, "foo", newFoo);

    numCalls = 0;
    originalFoo.add("d");
    equal(numCalls, 0, "Handler should NOT be called after adding item to original array since value since the array property value has been changed");

    numCalls = 0;
    originalFoo.remove("d");
    equal(numCalls, 0, "Handler should NOT be called after removing item from original array since the array property value has been changed");

    // stop observing immediately
    observer.stop();

    numCalls = 0;
    source.foo.remove(source.foo[1]);
    equal(numCalls, 0, "Handler should NOT be called after removing item since the observer is stopped");

    numCalls = 0;
    source.foo.add("c");
    equal(numCalls, 0, "Handler should NOT be called after adding item since the observer is stopped");

    numCalls = 0;
    ExoWeb.Observer.setValue(source, "foo", originalFoo);
    equal(numCalls, 0, "Handler should NOT be called after resetting array property value since the observer is stopped");
});

test("addPathChanged - One Property", function() {
    var driver = getDriver("Joe", 30);

    var numCalls;
    var handler = function() { numCalls++; };

    ExoWeb.Observer.addPathChanged(driver, "name", handler);

    numCalls = 0;
    ExoWeb.Observer.setValue(driver, "name", "Bob");
    equal(driver.name, "Bob", "Name should be changed to Bob");
    equal(numCalls, 1, "Handler should have been called");

    numCalls = 0;
    ExoWeb.Observer.setValue(driver, "age", 100);
    equal(driver.age, 100, "Age should be changed to 100");
    equal(numCalls, 0, "Handler should NOT have been called for a property ouside of the path");

    // Add a separate handler to the same source and path.
    var otherNumCalls = 0;
    ExoWeb.Observer.addPathChanged(driver, "name", function() { otherNumCalls++; });

    // Remove the original handler.
    ExoWeb.Observer.removePathChanged(driver, "name", handler);

    numCalls = 0;
    ExoWeb.Observer.setValue(driver, "name", "Joe");
    equal(driver.name, "Joe", "Name should be changed to Joe");
    equal(numCalls, 0, "Handler should NOT have been called after removing");
    equal(otherNumCalls, 1, "Second handler should have been called even after removing the first handler");
});

test("addPathChanged - Multiple Properties", function() {
    var driver = getDriver("Joe", 30, getCar("Ford"), getOwner("Larry", 40));

    var numCalls;
    var handler = function() { numCalls++; };

    ExoWeb.Observer.addPathChanged(driver, "car.owner.name", handler);

    numCalls = 0;
    ExoWeb.Observer.setValue(driver.car.owner, "name", "Curly");
    equal(driver.car.owner.name, "Curly", "Name should be changed to Curly");
    equal(numCalls, 1, "Handler should have been called");
    
    numCalls = 0;
    ExoWeb.Observer.setValue(driver.car, "owner", getOwner("Moe", 35));
    equal(driver.car.owner.name, "Moe", "New owner should be Moe");
    equal(numCalls, 1, "Handler should have been called");

    ExoWeb.Observer.removePathChanged(driver, "car.owner.name", handler);

    numCalls = 0;
    ExoWeb.Observer.setValue(driver.car, "owner", getOwner("Larry", 40));
    equal(driver.car.owner.name, "Larry", "Owner should be Larry");
    equal(numCalls, 0, "Handler should NOT have been called after removing");
});

test("addPathChanged - Multiple Properties - Initial Nulls", function() {
    var driver = getDriver("Joe", 30);

    var numCalls;
    var handler = function() { numCalls++; };

    ExoWeb.Observer.addPathChanged(driver, "car.owner.name", handler);

    numCalls = 0;
    ExoWeb.Observer.setValue(driver, "car", getCar("Chevy"));
    equal(driver.car.make, "Chevy", "Car should be a Chevy");
    equal(numCalls, 1, "Handler should have been called");

    numCalls = 0;
    ExoWeb.Observer.setValue(driver.car, "owner", getOwner("Larry", 40, driver.car));
    equal(driver.car.owner.name, "Larry", "Owner should be Larry");
    equal(numCalls, 1, "Handler should have been called");

    numCalls = 0;
    ExoWeb.Observer.setValue(driver.car.owner, "name", "Curly");
    equal(driver.car.owner.name, "Curly", "Name should be changed to Curly");
    equal(numCalls, 1, "Handler should have been called");
});

test("addPathChanged - Multiple Properties - Split Path", function() {
    var driver = getDriver("Joe", 30, getCar("Ford"), getOwner("Larry", 40));

    var numCalls;
    var handler = function() { numCalls++; };

    ExoWeb.Observer.addPathChanged(driver, "car.owner.name", handler);

    var ford = driver.car;
    equal(driver.car.make, "Ford", "Car should be a Ford");

    numCalls = 0;
    var chevy = getCar("Chevy", driver.car.owner);
    ExoWeb.Observer.setValue(driver, "car", chevy);
    equal(driver.car.make, "Chevy", "Car should be a Chevy");
    equal(numCalls, 1, "Handler should have been called");

    numCalls = 0;
    Array.remove(ford.owner.cars, ford);
    ExoWeb.Observer.setValue(ford, "owner", getOwner("Curly", 40, ford));
    equal(numCalls, 0, "Handler should NOT have been called on an object that used to be a part of the path");

    numCalls = 0;
    ExoWeb.Observer.setValue(driver.car.owner, "name", "Moe");
    equal(driver.car.owner.name, "Moe", "Name should be changed to Moe");
    equal(numCalls, 1, "Handler should have been called");
});

test("addPathChanged - Array", function () {
    var driver1 = getDriver("Joe", 30, getCar("Ford"), getOwner("Larry", 40));
    var driver2 = getDriver("Bob", 22, getCar("Chevy"), getOwner("Moe", 35));

    var drivers = [driver1, driver2];
    ExoWeb.Observer.makeObservable(drivers);

    var numCalls;
    var handler = function () { numCalls++; };

    ExoWeb.Observer.addPathChanged(drivers, "car.owner.name", handler);

    var ford = driver1.car;
    equal(driver1.car.make, "Ford", "Car should be a Ford");

    // ensure that path changed handles an array as the root
    numCalls = 0;
    var chevy = getCar("Chevy", driver1.car.owner);
    ExoWeb.Observer.setValue(driver1, "car", chevy);
    equal(driver1.car.make, "Chevy", "Car should be a Chevy");
    equal(numCalls, 1, "Handler should have been called");

    var container = { drivers: drivers };

    var numCalls2 = 0;
    var handler2 = function () { numCalls2++; };

    ExoWeb.Observer.addPathChanged(container, "drivers.car.owner.name", handler2);

    // ensure that path changed handle an array in the path
    numCalls2 = 0;
    equal(container.drivers.length, 2, "Should be two drivers in the list");
    container.drivers.remove(driver1);
    equal(container.drivers.length, 1, "Should be one driver in the list after removing");
    equal(numCalls2, 1, "Handler should have been called because of remove from array");
});
