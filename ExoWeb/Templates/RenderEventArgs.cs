using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;

namespace ExoWeb.Templates
{
	public class RenderEventArgs : EventArgs
	{
		internal RenderEventArgs(Page page, ITemplate template)
		{
			this.Page = page;
			this.Template = template;
		}

		public Page Page { get; private set; }

		public ITemplate Template { get; private set; }
	}
}
