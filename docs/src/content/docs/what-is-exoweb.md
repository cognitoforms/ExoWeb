---
title: What is ExoWeb
description: A brief introduction to the purpose of ExoWeb.
---

ExoWeb aims to provide a rich JavaScript object model, intuitive UI code based on the fundamental
languages of the web (HTML, CSS, and JavaScript), model- and UI-driven validation, and seamless
synchronization of changes between client and server.

## Object Model

Using the open source [ExoModel](https://github.com/cognitoforms/ExoModel) library, a server-side
object model, e.g., Entity Framework or NHibernate, can be represented in a basic form on the client
(check out the ExoModel project page for support details). This client-side model is built and modified
based on JSON, which can be fetched from the server as needed. Each model type is represented by a
unique JavaScript type of the same name. For this reason, mixing of these generated types with intrinsic
JavaScript types (String, Number, etc) should be relatively transparent and easy. Also, types can be
extended on the client to add additional behavior or properties.

Instances can be fetched from the server using a simple querying interface, or they can be created on
the client. Changes to the model are detected - including property value changes, list modification,
and creating and deleting objects. These changes can trigger rules, drive UI behavior, and are replayed
on the server with each asynchronous request.

## User Interface

The UI strategy is currently based on the open source ASP.NET AJAX library's client-side templates,
which are designed to be intuitive for someone who is familiar with the fundamental languages of the
web: HTML, CSS, and JavaScript. Some notable additions are: dynamic template selection, toggling,
metadata, and lazy loading.

## Rules & Validation

Properties on the model can be calculated based on the values of other properties. When changes occur
to those properties, the calculated value is automatically updated. It is also possible to define
arbitrary rule logic that is triggered by property changes.

Characteristics of the server-side model can enable some validation automatically based on type metadata.
These validation rules react to user input in order to provide immediate feedback, which can be styled
to your liking. Information about these issues is embedded in the model until resolved.

## Client-Server Synchronization

The ExoWeb client model maintains a set of events that have occurred, whether on the client or the
server. These events are replayed on the server as needed, which allows for the client and server
models to be kept in sync. Also, operations can easily be moved to the client to improve performance
but can remain on the server when this is not appropriate or practical.
