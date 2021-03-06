﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Web;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Microsoft AJAX specific implementation of <see cref="ExoWeb.Templates.Page"/> that supports
	/// parsing and loading templates using the Microsoft AJAX syntax.
	/// </summary>
	internal class AjaxPage : Page
	{
		int nextControlId;
		internal string NextControlId
		{
			get
			{
				return "exo" + nextControlId++;
			}
		}

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
