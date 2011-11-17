using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using System.Web;

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
			RenderStartTag(page, writer, null);
		}

		protected void RenderStartTag(AjaxPage page, System.IO.TextWriter writer, Func<IEnumerable<KeyValuePair<string, object>>, IEnumerable<KeyValuePair<string, object>>> attributeTransform)
		{
			// Immediately abort if no tag name
			if (Tag == null)
				return;

			// Open Tag
			writer.Write("<" + Tag);

			// Attributes
			string innerHtml = null;
			var attributes = (Attributes ?? new List<Attribute>())
				.Select(attribute =>
				{
					var data = attribute.Binding != null ? attribute.Binding.Evaluate(page) : null;
					if (data != null)
						return new KeyValuePair<string, object>((attribute.Name.StartsWith("sys:") ? attribute.Name.Substring(4).ToLower() : attribute.Name.ToLower()), data);
					else
						return new KeyValuePair<string, object>(attribute.Name.ToLower(), attribute.Value);

				})
				.Where(attribute =>
				{
					if (attribute.Value == null)
						return false;
					var html = attribute.Value.ToString();
					if (attribute.Key == "sys:innerhtml")
						innerHtml = html;
					else if (attribute.Key == "sys:innertext")
						innerHtml = HttpUtility.HtmlEncode(html);
					else
						return true;
					return false;
				});

			// Transform the attributes if necessary
			if (attributeTransform != null)
				attributes = attributeTransform(attributes);

			// Write the attributes to the output stream
			foreach (var attribute in attributes)
				writer.Write(" " + attribute.Key + "=\"" + HttpUtility.HtmlEncode(attribute.Value.ToString()) + "\"");

			// Close Tag
			if (IsClosed && Binding == null)
			{
				if (innerHtml != null)
					writer.Write(">" + innerHtml + "</" + Tag + ">");
				else
					writer.Write(" />");
			}
			else if (innerHtml != null)
				writer.Write(">" + innerHtml);
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
