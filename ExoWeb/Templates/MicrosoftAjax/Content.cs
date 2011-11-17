using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Represents a content control for rendering strongly-typed content using a contextually selected template.
	/// </summary>
	internal class Content : Control
	{
		public Binding Data { get; internal set; }

		public string[] Template { get; internal set; }

		internal override void Render(AjaxPage page, System.IO.TextWriter writer)
		{
			// Exit immediately if the element is conditionally hidden
			if (If != null && If.Evaluate(page) as bool? == false)
				return;

			// Output the original template if data source was not specified
			if (Data == null)
			{
				writer.Write(Markup);
				return;
			}

			// Get the data associated with the data view
			GraphProperty property;
			GraphInstance source;
			var data = Data.Evaluate(page, out source, out property);
			var realData = data is Adapter ? ((Adapter)data).RawValue : data;

			// Output the original template if data is not available
			if (realData == null)
			{
				writer.Write(Markup);
				return;
			}

			// Find the appropriate template
			var template = page.Templates.OfType<Template>().FirstOrDefault(
				t =>
				{
					// First ensure the template tags match
					if (t.Tag != Tag)
						return false;

					// Then see if the template is for adapter bindings
					if (data is Adapter != t.IsAdapter)
						return false;

					// Then verify the datatypes
					if (!String.IsNullOrEmpty(t.DataType))
					{
						// Entity
						if (realData is GraphInstance)
						{
							// Verify the type matches if it is not the base type
							if (t.DataType != "ExoWeb.Model.Entity")
							{
								var type = ((GraphInstance)realData).Type;
								while (type != null && type.Name != t.DataType)
									type = type.BaseType;
								if (type == null)
									return false;
							}
						}

						// List
						else if (realData is IEnumerable<GraphInstance>)
						{

						}

						// Value
						else
						{
							string type = JsonConverter.GetJsonValueType(realData.GetType());
							if (type != null)
							{
								if (type != t.DataType)
									return false;
							}
						}
					}

					// Check whether the template is specific to lists
					if (t.IsList != null && property is GraphReferenceProperty && t.IsList != ((GraphReferenceProperty)property).IsList)
						return false;

					// Finally, verify that the template names match sufficiently
					foreach (var name in t.Name)
					{
						if (!Template.Contains(name))
							return false;
					}

					return true;
				});

			// Output the original template if a matching template could not be found
			if (template == null)
			{
				writer.Write(Markup);
				return;
			}

			// Render the original content start tag
			RenderStartTag(page, writer, attributes => template.Class.Length > 0 ? MergeAttributes(attributes, template) : attributes);

			// Render the template inside a new template context
			using (page.BeginContext(data, null))
			{
				template.Render(page, writer);
			}

			// Render the original content end tag
			RenderEndTag(page, writer);
		}

		/// <summary>
		/// Merges the set of attributes defined on the content tag with attributes from the target template.
		/// </summary>
		/// <param name="attributes"></param>
		/// <param name="template"></param>
		/// <returns></returns>
		IEnumerable<KeyValuePair<string, object>> MergeAttributes(IEnumerable<KeyValuePair<string, object>> attributes, Template template)
		{
			bool classFound = false;
			foreach (var attribute in attributes)
			{
				if (attribute.Key == "class")
				{
					classFound = true;
					yield return new KeyValuePair<string, object>(attribute.Key, String.Join(" ", attribute.Value.ToString().Split(' ').Union(template.Class).ToArray()));
				}
				yield return attribute;
			}
			if (!classFound)
				yield return new KeyValuePair<string, object>("class", String.Join(" ", template.Class));
		}

		public override string ToString()
		{
			return "<content data=\"" + Data + "\">";
		}
	}
}
