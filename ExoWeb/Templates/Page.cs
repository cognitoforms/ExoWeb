using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.Web;
using ExoGraph;

namespace ExoWeb.Templates
{
	public abstract class Page
	{
		public Page()
		{
			Templates = new List<ITemplate>();
			Model = new Dictionary<string, IEnumerable<GraphInstance>>();
		}

		public List<ITemplate> Templates { get; private set; }

		public Dictionary<string, IEnumerable<GraphInstance>> Model { get; private set; }

		public object Context { get; set; }

		public static Page Current
		{
			get
			{
				var page = HttpContext.Current.Items["ExoWeb.Page"] as Page;
				if (page == null)
					HttpContext.Current.Items["ExoWeb.Page"] = page = new MicrosoftAjax.Page();
				return page;
			}
		}

		public abstract ITemplate Parse(string template);

		public abstract IEnumerable<ITemplate> LoadTemplates(string path);
	}
}
