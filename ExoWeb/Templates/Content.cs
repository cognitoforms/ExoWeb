using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;

namespace ExoWeb.Templates
{
	/// <summary>
	/// Represents a content control for rendering strongly-typed content using a contextually selected template.
	/// </summary>
	public class Content : Control
	{
		public Binding Data { get; internal set; }

		public string[] Template { get; internal set; }

		internal override void Render(Page page, System.IO.TextWriter writer)
		{
			// Output the original template if data source was not specified
			if (Data == null)
			{
				writer.Write(Markup);
				return;
			}

			// Get the data associated with the data view
			GraphProperty source;
			var data = Data.Evaluate(page, out source);

			// Output the original template if data is not available
			if (data == null)
			{
				writer.Write(Markup);
				return;
			}

			// Find the appropriate template
			var template = page.Templates.FirstOrDefault(
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
						if (data is GraphInstance)
						{
							// Verify the type matches if it is not the base type
							if (t.DataType != "ExoWeb.Model.Entity")
							{
								var type = ((GraphInstance)data).Type;
								while (type != null && type.Name != t.DataType)
									type = type.BaseType;
								if (type == null)
									return false;
							}
						}

						// List
						else if (data is IEnumerable<GraphInstance>)
						{

						}

						// Value
						else
						{
							string type = JsonConverter.GetJsonValueType(data.GetType());
							if (type != null)
							{
								if (type != t.DataType)
									return false;
							}
						}
					}

					// Check whether the template is specific to lists
					if (t.IsList != null && source is GraphReferenceProperty && t.IsList != ((GraphReferenceProperty)source).IsList)
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

			var parentContext = page.Context;
			page.Context = data;
			template.Render(page, writer);
			page.Context = parentContext;
		}

		public override string ToString()
		{
			return "<content data=\"" + Data + "\">";
		}
	}
}
