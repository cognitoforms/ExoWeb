using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Microsoft AJAX specific implementation of <see cref="ExoWeb.Templates.Page"/> that supports
	/// parsing and loading templates using the Microsoft AJAX syntax.
	/// </summary>
	internal class AjaxPage : Page
	{
		internal AjaxPage()
		{
			IsIE = System.Web.HttpContext.Current.Request.Browser.IsBrowser("IE");
		}

		internal bool IsTopLevel { get; set; }

		int nextControlId;
		internal string NextControlId
		{
			get
			{
				return "exo" + nextControlId++;
			}
		}

		internal bool IsIE { get; private set; }

		public override ITemplate Parse(string name, string template)
		{
			return Template.Parse(name, template);
		}

		public override IEnumerable<ITemplate> ParseTemplates(string source, string template)
		{
			return Block.Parse(source, template).OfType<ITemplate>();
		}

		public override IEnumerable<ITemplate> LoadTemplates(string path)
		{
			return Template.Load(path).Cast<ITemplate>();
		}
	}
}
