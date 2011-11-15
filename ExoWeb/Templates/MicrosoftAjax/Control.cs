using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Represents an attached template control, such as dataview or content.
	/// </summary>
	internal abstract class Control : Element
	{
		public List<Block> Blocks { get; internal set; }

		internal override void Render(AjaxPage page, System.IO.TextWriter writer)
		{
			// Exit immediately if the element is conditionally hidden
			if (If != null && If.Evaluate(page) as bool? == false)
				return;

			RenderStartTag(page, writer);

			foreach (var block in Blocks)
				block.Render(page, writer);

			RenderEndTag(page, writer);
		}
	}
}
