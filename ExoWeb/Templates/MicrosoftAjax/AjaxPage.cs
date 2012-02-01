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
		internal bool IsTopLevel { get; set; }

		int nextControlId;
		internal string NextControlId
		{
			get
			{
				return "exo" + nextControlId++;
			}
		}

		public override ITemplate Parse(string template)
		{
			return Template.Parse(template);
		}

		public override IEnumerable<ITemplate> ParseTemplates(string template)
		{
			return Block.Parse(template).OfType<ITemplate>();
		}

		public override IEnumerable<ITemplate> LoadTemplates(string path)
		{
			return Template.Load(path).Cast<ITemplate>();
		}
	}
}
