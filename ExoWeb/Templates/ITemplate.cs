using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ExoWeb.Templates
{
	public interface ITemplate
	{
		void Render(Page page, System.Web.UI.HtmlTextWriter writer);
	}
}
