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
	internal class DataView : Control
	{
		public Binding Data { get; internal set; }

		/// <summary>
		/// Render the data view to the output for the current page.
		/// </summary>
		/// <param name="page"></param>
		/// <param name="writer"></param>
		internal override void Render(AjaxPage page, System.IO.TextWriter writer)
		{
			// Exit immediately if the element is conditionally hidden
			if (If != null && If.Evaluate(page) as bool? == false)
				return;

			// Output the original template if data source was not specified
			if (Data == null)
			{
				base.Render(page, writer);
				return;
			}

			// Get the data associated with the data view
			var data = Data.Evaluate(page);

			// Output the original template if no data was found
			if (data == null)
			{
				base.Render(page, writer);
				return;
			}

			RenderStartTag(page, writer);

			// Convert the data into a list
			var list = data is IEnumerable ? (IEnumerable)data : new object[] { data };

			// Process the template for each list item
			var parentContext = page.Context;
			var variables = page.Variables;
			var index = 0;
			foreach (var item in list)
			{
				page.Variables = new Dictionary<string, object>() { {"$index", index++} };
				writer.Write("<!--item-->");
				page.Context = item;
				foreach (var block in Blocks)
					block.Render(page, writer);
				writer.Write("<!--/item-->");
				page.Variables = null;
			}
			page.Context = parentContext;
			page.Variables = variables;

			RenderEndTag(page, writer);
		}

		public override string ToString()
		{
			return "<dataview data=\"" + Data + "\">";
		}
	}
}
