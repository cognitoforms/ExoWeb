using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using ExoRule.Validation;
using System.Collections;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Represents a dataview control for rendering repeated content using templates.
	/// </summary>
	public class DataView : Control
	{
		public Binding Data { get; internal set; }

		/// <summary>
		/// Render the data view to the output for the current page.
		/// </summary>
		/// <param name="page"></param>
		/// <param name="writer"></param>
		internal override void Render(Page page, System.IO.TextWriter writer)
		{
			// Output the original template if data source was not specified
			if (Data == null)
			{
				base.Render(page, writer);
				return;
			}

			// Get the data associated with the data view
			GraphProperty source;
			var data = Data.Evaluate(page, out source);

			// Output the original template if no data was found
			if (data == null)
			{
				base.Render(page, writer);
				return;
			}

			// Convert the data into a list
			var list = data is IEnumerable ? (IEnumerable)data : new object[] { data };

			// Process the template for each list item
			var parentContext = page.Context;
			foreach (var item in list)
			{
				writer.Write("<!--item-->");
				page.Context = item;
				foreach (var block in Blocks)
					block.Render(page, writer);
				writer.Write("<!--/item-->");
			}
			page.Context = parentContext;
		}

		public override string ToString()
		{
			return "<dataview data=\"" + Data + "\">";
		}
	}
}
