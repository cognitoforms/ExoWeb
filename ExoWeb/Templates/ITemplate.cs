using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ExoWeb.Templates
{
	public interface ITemplate
	{
		string Source { get; }

		void Render(Page page, System.IO.TextWriter writer);
	}
}
