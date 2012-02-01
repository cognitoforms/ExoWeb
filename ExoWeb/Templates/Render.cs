using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoPage = ExoWeb.Templates.Page;
using AspControl = System.Web.UI.Control;
using HtmlTextWriter = System.Web.UI.HtmlTextWriter;
using LiteralControl = System.Web.UI.LiteralControl;
using System.IO;

namespace ExoWeb.Templates
{
	public class Render : System.Web.UI.Control
	{
		private string GetMarkup()
		{
			string text;

			// optimize for literal content
			if (Controls.Count == 1 && Controls[0] is LiteralControl)
				text = ((System.Web.UI.LiteralControl)Controls[0]).Text;
			else
			{
				StringBuilder builder = new StringBuilder();
				using (TextWriter textWriter = new StringWriter(builder))
				{
					using (HtmlTextWriter htmlWriter = new HtmlTextWriter(textWriter))
					{
						foreach (AspControl control in Controls)
						{
							control.RenderControl(htmlWriter);
						}
					}
					text = builder.ToString();
				}
			}

			return text;
		}

		public override void RenderControl(System.Web.UI.HtmlTextWriter writer)
		{
			// Parse and render the template
			if (ExoWeb.EnableServerRendering)
				ExoPage.Current.Parse(GetMarkup()).Render(ExoPage.Current, writer);
			else
				writer.Write(GetMarkup());
		}
	}
}
