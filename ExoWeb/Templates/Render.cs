using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoPage = ExoWeb.Templates.Page;

namespace ExoWeb.Templates
{
	public class Render : System.Web.UI.Control
	{
		public override void RenderControl(System.Web.UI.HtmlTextWriter writer)
		{
			// Verify that the control only contains literal content
			if (Controls.Count != 1 || !(Controls[0] is System.Web.UI.LiteralControl))
				throw new ApplicationException("Only literal content may be specified when using the Render control to render templates server-side.");

			// Parse and render the template
			ExoPage.Current.Parse(((System.Web.UI.LiteralControl)Controls[0]).Text).Render(ExoPage.Current, writer);
		}
	}
}
