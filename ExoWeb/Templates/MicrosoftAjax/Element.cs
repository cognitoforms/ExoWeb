using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;
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

		public bool IsEmpty { get; internal set; }

		protected static IEnumerable<AttributeBinding> AbortSysAttachDataAttribute(IEnumerable<AttributeBinding> attributes)
		{
			return attributes.Select(a => a.Name == "data-sys-attach" ? new AttributeBinding(new Attribute() { Name = "sys:attach", Value = a.DisplayValue }, null) : a);
		}

		internal override void Render(AjaxPage page, IEnumerable<string> templateNames, System.IO.TextWriter writer)
		{
			RenderStartTag(page, writer);
		}

		protected void RenderStartTag(AjaxPage page, System.IO.TextWriter writer, params AttributeBinding[] bindings)
		{
			RenderStartTag(page, writer, null, bindings);
		}

		protected void RenderStartTag(AjaxPage page, System.IO.TextWriter writer, Func<IEnumerable<AttributeBinding>, IEnumerable<AttributeBinding>> attributeTransform, params AttributeBinding[] bindings)
		{
			RenderStartTag(page, writer, attributeTransform, false, bindings);
		}

		protected void RenderStartTag(AjaxPage page, System.IO.TextWriter writer, Func<IEnumerable<AttributeBinding>, IEnumerable<AttributeBinding>> attributeTransform, bool abort, params AttributeBinding[] bindings)
		{
			// Immediately abort if no tag name
			if (Tag == null)
				return;

			// Open Tag
			writer.Write("<" + Tag);

			// Attributes
			string innerHtml = null;
			var attributes = (Attributes ?? new List<Attribute>())
				.Select(attribute => attribute.Binding == null ? new AttributeBinding(attribute, null) : attribute.Binding.Evaluate(page));

			// Adding binding attributes if necessary
			if (bindings != null && bindings.Length > 0)
				attributes = attributes.Concat(bindings.Where(b => b != null));

			// Transform the attributes if necessary
			if (attributeTransform != null)
				attributes = attributeTransform(attributes);

			bool foundId = false;

			// Write the attributes to the output stream
			foreach (var attribute in attributes)
			{
				// Ensure that multiple id attributes are not specified
				if (!page.Context.IsGlobal && (attribute.Name == "id" || attribute.Name == "sys:id"))
				{
					if (foundId)
						throw new ApplicationException("Found multiple id attributes: " + Markup);
					foundId = true;
				}

				// Determine if the attribute represents bound element content
				if (attribute.IsBound)
				{
					if (attribute.Name == "sys:innerhtml")
						innerHtml = (attribute.DisplayValue ?? "").ToString();
					else if (attribute.Name == "sys:innertext")
						innerHtml = HttpUtility.HtmlEncode(attribute.DisplayValue ?? "");
				}

				bool isHtmlBoolean;
				var attributeName = attribute.Name.StartsWith("sys:") ? attribute.Name.Substring(4) : attribute.Name;
				if (Tag.Equals("input", StringComparison.InvariantCultureIgnoreCase))
				{
					var attr = attributes.SingleOrDefault(a => a.Name.Equals("type", StringComparison.InvariantCultureIgnoreCase) && a.IsValid && a.Value != null);
					if (attr == null)
						isHtmlBoolean = HtmlHelpers.IsBooleanAttribute(attributeName, Tag, null, true);
					else
						isHtmlBoolean = HtmlHelpers.IsBooleanAttribute(attributeName, Tag, attr.Value.ToString());
				}
				else
					isHtmlBoolean = HtmlHelpers.IsBooleanAttribute(attributeName, Tag);

				if (abort)
					attribute.Abort(writer, isHtmlBoolean);
				else
					attribute.Render(page, writer, isHtmlBoolean, !page.Context.IsGlobal);
			}

			// Close Tag
			if (IsEmpty)
			{
				if (innerHtml != null)
					writer.Write(">" + innerHtml + "</" + Tag + ">");
				else if (HtmlHelpers.IsSelfClosing(Tag))
					writer.Write(" />");
				else
					writer.Write("></" + Tag + ">");
			}
			else if (innerHtml != null)
				writer.Write(">" + innerHtml);
			else
				writer.Write(">");
		}

		protected void RenderEndTag(System.IO.TextWriter writer)
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
