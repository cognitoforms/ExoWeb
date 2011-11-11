using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ExoWeb.Templates
{
	/// <summary>
	/// Represents an attached template control, such as dataview or content.
	/// </summary>
	public abstract class Control : Element
	{
		public List<Block> Blocks { get; internal set; }

		internal override void Render(Page page, System.IO.TextWriter writer)
		{
			foreach (var block in Blocks)
				block.Render(page, writer);
		}
	}
}
