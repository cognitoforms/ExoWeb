using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;

namespace ExoWeb.Templates
{
	/// <summary>
	/// Represents an HTML element containing bound attributes or element content.
	/// </summary>
	public class Element : Block
	{
		public string Tag { get; internal set; }

		public List<Attribute> Attributes { get; internal set; }

		public Binding Binding { get; internal set; }

		public bool IsClosed { get; internal set; }

		internal override void Render(Page page, System.IO.TextWriter writer)
		{
			writer.Write("<" + Tag);

			// Attributes
			foreach (var attribute in Attributes)
			{
				writer.Write(" " + attribute.Name + "=\"");
				GraphProperty source;
				var data = attribute.Binding != null ? attribute.Binding.Evaluate(page, out source) : null;
				if (data != null)
					writer.Write(data);
				else
					writer.Write(attribute.Value);
				writer.Write("\"");
			}

			// Element Binding
			if (Binding != null)
			{
				writer.Write(">");
				GraphProperty source;
				var data = Binding.Evaluate(page, out source);
				if (data != null)
					writer.Write(data);
				else
					writer.Write(Binding.Expression);
				writer.Write("</" + Tag + ">");
			}
			else if (IsClosed)
				writer.Write(" />");
			else
				writer.Write(">");
		}

		public override string ToString()
		{
			return Markup;
		}
	}
}
