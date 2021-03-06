﻿using System;
using System.Linq;
using System.Collections;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Represents a dataview control for rendering repeated content using templates.
	/// </summary>
	internal class DataView : Control
	{
		public string Template { get; internal set; }

		public Binding Data { get; internal set; }

		/// <summary>
		/// Render the data view to the output for the current page.
		/// </summary>
		/// <param name="page"></param>
		/// <param name="templateNames"></param>
		/// <param name="writer"></param>
		internal override void Render(AjaxPage page, string[] templateNames, System.IO.TextWriter writer)
		{
			bool canRender;
			AttributeBinding ifBinding;
			if (!TryRenderIf(page, templateNames, writer, out ifBinding, out canRender))
			{
				Abort(page, templateNames, writer);
				return;
			}

			if (!canRender)
				return;

			// Output the original template if data source was not specified
			if (Data == null)
			{
				Abort(page, templateNames, writer);
				return;
			}

			// Get the data associated with the data view
			var dataBinding = Data.Evaluate(page);

			// Output the original template if no data was found
			if (!dataBinding.IsValid)
			{
				Abort(page, templateNames, writer);
				return;
			}

			// Render the inline template for top level dataviews
			string templateId = null;
			string controlId = null;
			bool renderControlId = false;
			if (page.Context.IsGlobal)
			{
				templateId = page.NextControlId;
				controlId = Attributes.Where(a => a.Name == "id").Select(a => a.Value).FirstOrDefault();
				if (controlId == null)
				{
					renderControlId = true;
					controlId = page.NextControlId;
				}
				writer.Write("<");
				writer.Write(Tag);
				writer.Write(" class='sys-template' id='");
				writer.Write(templateId);
				writer.Write("'>");
				writer.Write(Template);
				writer.Write("</");
				writer.Write(Tag);
				writer.Write(">");
			}

			AttributeBinding contentTemplateBinding;
			if (!TryContentTemplate(page, templateNames, writer, out contentTemplateBinding))
			{
				Abort(page, templateNames, writer);
				return;
			}

			var ownTemplateNames = contentTemplateBinding != null ?
				((string) contentTemplateBinding.Value).Split(new[] {' '}, StringSplitOptions.RemoveEmptyEntries) :
				new string[0];

			RenderStartTag(page, writer, ifBinding, dataBinding, contentTemplateBinding,
				// Include the nested template index as a special attribute
				new AttributeBinding(new Attribute() { Name = "data-sys-tmplidx", Value = NestedTemplateIndex.ToString() }, null),
				// If this is a top-level dataview then we will need to ensure an id so that linking can occur
				renderControlId ? new AttributeBinding(new Attribute() { Name = "id", Value = controlId }, null) : null);

			// Convert the data into a list
			IEnumerable list;
			if (dataBinding.Value == null)
				list = new object[0];
			else if (dataBinding.Value is IEnumerable && !(dataBinding.Value is string))
				list = (IEnumerable) dataBinding.Value;
			else
				list = new[] {dataBinding.Value};

			// Process the template for each list item
			var index = 0;
			foreach (var item in list)
			{
				// Begin a new template context
				using (var context = page.BeginContext(item, index++, null))
				{
					RenderContextBeginMarker(context, Tag, writer);

					foreach (var block in Blocks)
						block.Render(page, templateNames.Concat(ownTemplateNames).ToArray(), writer);

					RenderContextEndMarker(context, Tag, writer);
				}
			}

			RenderEndTag(writer);

			// Render script linking logic
			if (page.Context.IsGlobal)
				writer.Write("<script type=\"text/javascript\">$exoweb({{ domReady: function() {{ Sys.Application.linkElement(document.getElementById(\"{0}\"), document.getElementById(\"{1}\")); }} }});</script>", controlId, templateId);
		}

		public override string ToString()
		{
			return "<dataview data=\"" + Data + "\">";
		}
	}
}
