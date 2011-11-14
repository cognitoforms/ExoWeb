using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using PageBase = ExoWeb.Templates.Page;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Microsoft AJAX specific implementation of <see cref="ExoWeb.Templates.Page"/> that supports
	/// parsing and loading templates using the Microsoft AJAX syntax.
	/// </summary>
	internal class Page : PageBase
	{
		public override ITemplate Parse(string template)
		{
			return Template.Parse(template);
		}

		public override IEnumerable<ITemplate> LoadTemplates(string path)
		{
			return Template.Load(path).Cast<ITemplate>();
		}
	}
}
