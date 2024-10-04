---
title: Entity Model Overview
description: A guide to defining and working with the client-side entity model.
---

## Model

A model consists of a collection of types. It is typically created by calling the
`$exoweb` function. It can be accessed off of the global context variable -
`window.context.model.meta`.

## Type

A type specifies its schema by way of one or more properties.

Types can be created programatically.

```js
var newType = context.model.meta.addType('MyNamespace.NewType');
newType.addProperty(...);
```

They can also be created by passing the type(s) schema into a call to `$exoweb`.

```js
$exoweb({ types: { 'MyNamespace.MyType': { properties: { ... } } }});
```

A type is realized as a JavaScript constructor function. Given the example above, you can
construct an instance of `MyType` like so:

```js
new MyNamespace.MyType({
	Prop1: "test",
	Prop2: 42
})
```

The (optional) argument to the constructor function is an object that can contain data for any of
the new object's properties.

## Property

A property has a name and type, as well as other optional metadata.

The name will correspond to the name of the actual property on an instance of the type, so it must
be a valid JavaScript identifier.

The type can be one of the built-in value types native to JavaScript (String, Number, Boolean, Date, Object)
or a reference to another entity type. To specify a built-in type, the _constructor_ object for that
type is used to indicate the type. To specify a reference to another entity type, a string with the
full type name is used.

```js
type.meta.addProperty({ name: 'Text', type: String });
type.meta.addProperty({ name: 'Parent', type: 'MyNamespace.OtherType' });
```

A property can also be a list, in which case the `isList` option can be used.

```js
type.meta.addProperty({ name: 'Tags', type: String, isList: true });
```

The property is attached to the contructor function with a `$` prefix, ex: `MyType.$NewProperty`.

Also, for each property defined there are corresponding getter and setter functions on the
type's prototype. So, you can call the getter and setter on any instance of the type, ex:
`myObj.set_Num(myObj.get_Num() + 1);`.

## Rule

A rule performs some logic in response to model events, such as property change or entity "init"
(i.e. entity creation). The two main types of rules are validation and calculations.

## Validation and Conditions

Condition rules inspect the state of an entity and determine if one or more conditions apply. For
example, a validation rule will check the entity's state and potentially apply a validation error
condition.

Conditions are not a part of the entity's data and are tracked separately by the entity's
"object meta" object.

## Calculations

Calculation rules respond to change events and calculate the value for a property, derived from
other property values. A simple example is a "full name" calculation.

```js
Person.meta.addProperty({ name: "FullName", type: String })
	.calculated({
		calculate: function() {
			return this.get_FirstName() + ' ' + this.get_LastName();
		},
		onChangeOf: ["FirstName", "LastName"]
	});
```

## Entity

An entity is an instance of a particular type. It can be created by calling the type's function
as a construtor.

## Object Meta

An entity's "object meta" track's metadata about the entity. For example, what conditions have been
applied, what rules need to execute, etc.
