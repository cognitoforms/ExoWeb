using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Web;
using ExoModel;
using ExoWeb.Templates.JavaScript;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Represents an attribute as it is being rendered.
	/// </summary>
	internal class AttributeBinding
	{
		Attribute attribute; 
		BindingResult binding;
	
		internal AttributeBinding(Attribute attribute, BindingResult binding)
		{
			this.attribute = attribute;
			this.binding = binding;
		}

		public string Name
		{
			get
			{
				return attribute.Name;
			}
		}

		public string DisplayValue
		{
			get
			{
				return binding == null ? attribute.Value : (binding.Value != null ? binding.Value.ToString() : null);
			}
		}

		public object Value
		{
			get
			{
				return binding == null ? attribute.Value : binding.Value;
			}
		}

		public ModelProperty Property
		{
			get
			{
				return binding == null ? null : binding.Property;
			}
		}

		public ModelInstance Source
		{
			get
			{
				return binding == null ? null : binding.Source;
			}
		}

		public bool IsValid
		{
			get
			{
				return binding == null || binding.IsValid;
			}
		}

		public bool IsBound
		{
			get
			{
				return binding != null;
			}
		}

		public void Render(AjaxPage page, System.IO.TextWriter writer, bool isHtmlBool, bool generateIds)
		{
			// Bound attribute
			if (binding != null)
			{
				// Valid binding
				if (binding.IsValid)
				{
					// Render the binding value for sys attributes
					if (attribute.Name.StartsWith("sys:"))
					{
						var attributeName = attribute.Name.Substring(4);

						// Render two-way binding expressions
						if (attribute.Binding.IsTwoWay)
							RenderAttribute(writer, "data-sys-" + attributeName, attribute.Binding.Expression);

						if (binding.Value != null)
						{
							if (attributeName != "if" && attributeName != "innerhtml" && attributeName != "innertext")
							{
								if (!isHtmlBool)
									RenderAttribute(writer, attributeName, binding.Value.ToString());
								else if (JavaScriptHelpers.IsTruthy(binding.Value))
									RenderAttribute(writer, attributeName, attributeName);
							}
						}
					}
					else
						RenderAttribute(writer, "data-" + attribute.Name.Replace(':', '-'), attribute.Binding.Expression);
				}

				// Invalid binding
				else
					RenderAttribute(writer, attribute.Name, attribute.Binding.Expression);
			}
			else if (generateIds && (attribute.Name == "id" || attribute.Name == "sys:id"))
				RenderAttribute(writer, "id", page.Context.GetInstanceId(attribute.Value));
			// Simple attribute
			else if (attribute.Name.Contains(":") && attribute.Name != "sys:id")
				RenderAttribute(writer, "data-" + attribute.Name.Replace(':', '-'), attribute.Value);
			else if (!isHtmlBool)
				RenderAttribute(writer, attribute.Name, attribute.Value);
			else if (JavaScriptHelpers.IsTruthy(attribute.Value))
				RenderAttribute(writer, attribute.Name, attribute.Name);
		}

		public void Abort(System.IO.TextWriter writer, bool isHtmlBool)
		{
			// Bound attribute
			if (binding != null)
				RenderAttribute(writer, attribute.Name, attribute.Binding.Expression);
			// Simple attribute
			else if (!isHtmlBool)
				RenderAttribute(writer, attribute.Name, attribute.Value);
			else if (JavaScriptHelpers.IsTruthy(attribute.Value))
				RenderAttribute(writer, attribute.Name, attribute.Name);
		}

		/// <summary>
		/// Renders the specified attribute name and value to the response stream.
		/// </summary>
		/// <param name="writer"></param>
		/// <param name="name"></param>
		/// <param name="value"></param>
		void RenderAttribute(System.IO.TextWriter writer, string name, string value)
		{
			writer.Write(" ");
			writer.Write(name);
			writer.Write("=\"");
			HttpUtility.HtmlAttributeEncode(value, writer);
			writer.Write("\"");
		}

		/// <summary>
		/// Creates a new attribute, optionally based on an existing attribute (and binding) and
		/// returns the new attribute after transforming its attribute or binding value.
		/// </summary>
		/// <param name="attributeName"></param>
		/// <param name="original"></param>
		/// <param name="transformValue"></param>
		/// <returns></returns>
		internal static AttributeBinding Transform(string attributeName, AttributeBinding original, Func<string, string> transformValue)
		{
			var exists = original != null;
			var attr = exists ? original.attribute : null;
			var result = exists ? original.binding : null;
			var bound = result != null;

			string value;
			if (bound)
				value = result.Value == null ? "" : result.Value.ToString();
			else if (exists)
				value = attr.Value;
			else
				value = "";

			value = transformValue(value);

			if (bound)
				return new AttributeBinding(new Attribute() { Name = attributeName, Value = attr.Value, Binding = attr.Binding }, new BindingResult() { Source = result.Source, Property = result.Property, IsValid = result.IsValid, Value = value });
			else if (!string.IsNullOrEmpty(value))
				return new AttributeBinding(new Attribute() { Name = attributeName, Value = value }, null);
			else
				return null;
		}
	}
}
