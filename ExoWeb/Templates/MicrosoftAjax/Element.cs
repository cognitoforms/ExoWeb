using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Represents an HTML element containing bound attributes or element content.
	/// </summary>
	internal class Element : Block
	{
		public string Tag { get; internal set; }

		public List<Attribute> Attributes { get; internal set; }

		public Binding Binding { get; internal set; }

		public Binding If { get; internal set; }

		public bool IsClosed { get; internal set; }

		internal override void Render(AjaxPage page, System.IO.TextWriter writer)
		{
			// Exit immediately if the element is conditionally hidden
			if (If != null && If.Evaluate(page) as bool? == false)
				return;

			RenderStartTag(page, writer);

			// Element Binding
			if (Binding != null)
			{
				var data = Binding.Evaluate(page);
				if (data != null)
					writer.Write(data);
				else
					writer.Write(Binding.Expression);
				RenderEndTag(page, writer);
			}
		}

		protected void RenderStartTag(AjaxPage page, System.IO.TextWriter writer)
		{
			// Immediately abort if no tag name
			if (Tag == null)
				return;

			// Open Tag
			writer.Write("<" + Tag);

			// Attributes
			if (Attributes != null)
			{
				foreach (var attribute in Attributes)
				{
					var data = attribute.Binding != null ? attribute.Binding.Evaluate(page) : null;
					if (data != null)
					{
						writer.Write(" " + (attribute.Name.StartsWith("sys:") ? attribute.Name.Substring(4) : attribute.Name) + "=\"");
						writer.Write(data);
					}
					else
					{
						writer.Write(" " + attribute.Name + "=\"");
						writer.Write(attribute.Value);
					}
					writer.Write("\"");
				}
			}

			// Close Tag
			if (IsClosed && Binding == null)
				writer.Write(" />");
			else
				writer.Write(">");
		}

		protected void RenderEndTag(AjaxPage page, System.IO.TextWriter writer)
		{
			// Immediately abort if no tag name
			if (Tag == null)
				return;

			writer.Write("</" + Tag + ">");
		}

		public override string ToString()
		{
			return Markup;
		}
	}
}
