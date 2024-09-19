---
title: Template Syntax
description: A guide to the MS Ajax template language.
---

Unlike many modern JavaScript frameworks which utilize a design-time build process, MS Ajax templates
work by "activating" HTML elements in the DOM. This means that by default **all template markup is standard HTML**
that is parsed by the browser, and any additional behavior is a result of this template activation.

The following are a few primary ways that activation augments the raw markup:
- Execute JavaScript (one-time) via [literal `{{ }}` expression](/exoweb/reference/templates/literal-expressions) syntax, ex: `{{ alert('test') }}`
- Two-way data binding using the ["{binding}" markup extension](/exoweb/reference/templates/binding-markup-extension), ex: `{binding SomeProperty}`
- Conditionally render elements via the [`sys:if` attribute](/exoweb/reference/templates/sys-if-attribute)
- Conditionally add/remove class names via [`sys:class-*` attribute](/exoweb/reference/templates/conditional-class-attribute)
- Create and activate _controls_, specified via `sys:attach="x"` and `x:*` attributes

Example:

```html
<div id='app'>
	<h1>My App</h1>
	<div class="sys-template" sys:attach="dataview" dataview:data="{{$rootContext.data}}">
		<span class="item-number">Item <span>{{ $index }}</span></span>
		<div sys:class-item-editable="{{$dataItem.canEdit}}">
			<input sys:disabled="{{!$dataItem.canEdit}}" sys:value="{binding text}" />
			<a sys:if="{{$dataItem.canEdit}}" href="#">Save</a>
		</div>
	</div>
</div>
```

---

First, the template markup must make its way into the DOM. Either the markup is included in server-rendered
page source, or it is injected into the DOM on the client. Then, the markup is "activated" via a call
to `Sys.Application.activateElement(element)`.

## Activation

The root element and its children are scanned, looking for controls to create, identified by the `sys:attach` attribute.
In these cases, the control is created and initialize. If the control has the `sys-template` class, then activation does
not recurse into its children.

## Templates

Template controls (those marked with `sys-template`, ex: [DataView](/exoweb/reference/templates/dataview-control)) are expected to treat
their child nodes as a template, which is why activation skips over them. The control will typically create a `Template`
object targeting its root element, which will scan the element's children to produce a template function. The original
DOM elements will be removed, and the control will use the template function to render the template for one or more data
objects, which produces DOM nodes and a `TemplateContext` for each object.
