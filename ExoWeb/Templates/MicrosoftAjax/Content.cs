using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using System.Collections;
using ExoWeb.Templates.JavaScript;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Represents a content control for rendering strongly-typed content using a contextually selected template.
	/// </summary>
	internal class Content : Control
	{
		public Binding Data { get; internal set; }

		public Binding Template { get; internal set; }

		internal override void Render(AjaxPage page, IEnumerable<string> templateNames, System.IO.TextWriter writer)
		{
			// Exit immediately if the element is conditionally hidden
			AttributeBinding ifBinding = null;
			if (If != null)
			{
				ifBinding = If.Evaluate(page);

				if (!ifBinding.IsValid)
				{
					Abort(page, templateNames, writer);
					return;
				}
				else if (!JavaScriptHelpers.IsTruthy(ifBinding.Value))
					return;
			}

			// Output the original template if data source was not specified
			if (Data == null)
			{
				Abort(page, templateNames, writer);
				return;
			}

			// Get the data associated with the content control
			var dataBinding = Data.Evaluate(page);
			var templateBinding = Template != null ? Template.Evaluate(page) : null;

			// Output the original template if the data binding expression could not be evaluated
			if (!dataBinding.IsValid || (templateBinding != null && !templateBinding.IsValid))
			{
				Abort(page, templateNames, writer);
				return;
			}

			// Just render an empty content element if the data is null
			if (dataBinding.Value == null)
			{
				RenderStartTag(page, writer, ifBinding, dataBinding);
				RenderEndTag(writer);
				return;
			}

			// Get the binding data
			var data = dataBinding.Value;
			var isAdapter = data is Adapter;
			var realData = isAdapter ? ((Adapter)data).RawValue : data;
			var property = dataBinding.Property;
			var referenceType = realData is GraphInstance ? ((GraphInstance)realData).Type :
								property is GraphReferenceProperty ? ((GraphReferenceProperty)property).PropertyType : null;
			var valueType = realData != null && !(realData is GraphInstance || realData is IEnumerable<GraphInstance>) ? realData.GetType() :
							property is GraphValueProperty ?  ((GraphValueProperty)property).PropertyType : null;
			var isList = (property != null && property.IsList) || (realData is IEnumerable && !(realData is string));

			// Evaluate content:template binding to get this content control's declare template(s)
			var templates = templateBinding != null && templateBinding.DisplayValue != null ? templateBinding.DisplayValue.Split(' ') : new string[0];

			// Join in the ContentTemplateNames value (sys:content-template) and the context's template names
			templates = templateNames.Concat(templates).Concat(ContentTemplateNames).Distinct().ToArray();

			// Find the correct template
			var template = FindTemplate(page, isAdapter, referenceType, valueType, isList, templates);

			// Output the original template if a matching template could not be found
			if (template == null)
			{
				writer.Write(string.Format("<!-- A template could not be found matching the specified criteria (TagName={0}, Adapter={1}, Type={2}{3}, IsList={4}, Names='{5}') -->", Tag, isAdapter, referenceType, valueType, isList, string.Join(", ", templates)));
				Abort(page, templateNames, writer);
				return;
			}

			// Render the inline template for top level dataviews
			var isTopLevel = page.IsTopLevel;
			page.IsTopLevel = false;

			// Render the original content start tag
			RenderStartTag(page, writer, attributes => template.Class.Length > 0 ? MergeClassName(attributes, template) : attributes, ifBinding, dataBinding, templateBinding);

			// Render the template inside a new template context
			using (page.BeginContext(data, null))
			{
				template.Render(page, templates.Where(t => !template.Name.Contains(t)).Concat(template.ContentTemplateNames), writer);
			}

			// Render the original content end tag
			RenderEndTag(writer);
			page.IsTopLevel = isTopLevel;
		}

		Template FindTemplate(AjaxPage page, bool isAdapter, GraphType entityType, Type valueType, bool isList, string[] names)
		{
			// Find the appropriate template
			return page.Templates.OfType<Template>().Reverse().FirstOrDefault(
				t =>
				{
					// First ensure the template tags match
					if (t.Tag != Tag)
						return false;

					// Then see if the template is for adapter bindings
					if (isAdapter != t.IsAdapter)
						return false;

					// Then verify the datatypes
					if (!String.IsNullOrEmpty(t.DataType))
					{
						// Reference
						if (entityType != null)
						{
							// Verify the type matches if it is not the base type
							var type = entityType;
							while (type != null && type.Name != t.DataType)
								type = type.BaseType;
							if (type == null)
								return false;
						}

						// Value
						else
						{
							string type = JsonConverter.GetJsonValueType(valueType);

							// Use "Array" as the type name for template matching for value types that are IEnumerable and not string.
							// JsonConverter is primarily used for serialization of instance data and so the type returned will be
							// the declared type of the property. Currently value type arrays are not fully supported but can be
							// represented as "Object" for minimal functionality. For template matching we really want "Array" instead,
							// since even in the case of custom serialization the value would be deserialized as an Array client-side
							// and so if used in template matching the type name would be "Array".
							if ((type == null || type == "Object") && valueType is IEnumerable)
								type = "Array";

							if (type == null || type != t.DataType)
								return false;
						}
					}

					// Check whether the template is specific to references
					if (t.IsReference != null && t.IsReference != (entityType != null))
						return false;

					// Check whether the template is specific to lists
					if (t.IsList != null && t.IsList != isList)
						return false;

					// Finally, verify that the template names match sufficiently
					foreach (var name in t.Name)
					{
						if (!names.Contains(name))
							return false;
					}

					return true;
				});
		}

		/// <summary>
		/// Merges the set of attributes defined on the content tag with attributes from the target template.
		/// </summary>
		/// <param name="attributes"></param>
		/// <param name="template"></param>
		/// <returns></returns>
		IEnumerable<AttributeBinding> MergeClassName(IEnumerable<AttributeBinding> attributes, Template template)
		{
			return MergeAttribute(attributes, "class", value =>
			{
				foreach(string className in template.Class)
					value = AttributeHelper.EnsureClassName(value, className);
				return value;
			});
		}

		public override string ToString()
		{
			return "<content data=\"" + Data + "\">";
		}
	}
}
