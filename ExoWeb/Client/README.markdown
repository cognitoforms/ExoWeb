A JavaScript library that aims to facilitate developing client-focussed web apps with a server-based object model.

What is ExoWeb?
--------------------
ExoWeb is primarily a JavaScript library but also includes a supporting ASP.NET service layer. It aims to provide a rich JavaScript object model, intuitive UI code based on the fundamental languages of the web (HTML, CSS, and JavaScript), model- and UI-driven validation, and seamless synchronization of changes between client and server.

JavaScript Object Model
--------------------
Using the open source ExoGraph library, a server-side object model, e.g., Entity Framework or NHibernate, can be represented in a basic form on the client (check out the ExoGraph project page for support details). This client-side model is built and modified based on JSON, which can be fetched from the server as needed. Each model type is represented by a unique JavaScript type of the same name. For this reason, mixing of these generated types with intrinsic JavaScript types (String, Number, etc) should be relatively transparent and easy. Also, types can be extended on the client to add additional behavior or properties.

Instances can be fetched from the server using a simple querying interface, or they can be created on the client. Changes to the model are detected - including property value changes, list modification, and creating and deleting objects. These changes can trigger rules, drive UI behavior, and are replayed on the server with each asynchronous request.

User Interface
--------------------
The UI strategy is currently based on the open source ASP.NET AJAX library's client-side templates, which are designed to be intuitive for someone who is familiar with the fundamental languages of the web: HTML, CSS, and JavaScript. Some notable additions are: CSS selector- and JavaScript-based template selection, toggling, metadata, and lazy loading.

Validation
--------------------
Characteristics of the server-side model can enable some validation automatically based on type metadata. These validation rules react to user input in order to provide immediate feedback, which can be styled to your liking. Information about these issues is embedded in the model until resolved.

Client-Server Synchronization
--------------------
The ExoWeb client model maintains a set of transactions that have occurred, whether on the client or the server. These changes are replayed on the server as needed, which means that the client and server models are always in sync. Also, operations can easily be moved to the client to improve performance but can remain on the server when this is not appropriate or practical.

Blog Posts
--------------------
[A Brief Introduction to ExoWeb](http://endlessobsession.com/2011/01/10/a-brief-introduction-to-exoweb/)

[Intro to Client-Server Mapping in ExoWeb](http://endlessobsession.com/2011/01/10/into-to-client-server-mapping-in-exoweb/)

[ExoWeb's Entity System](http://mhoop.wordpress.com/2011/01/13/exowebs-entity-system/)

More to come...
