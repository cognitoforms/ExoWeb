using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.Web;
using ExoGraph;

namespace ExoWeb.Templates
{
	internal class Page
	{
		public Page()
		{
			Templates = new List<Template>();
			Model = new Dictionary<string, IEnumerable<GraphInstance>>();
		}

		public List<Template> Templates { get; set; }

		public Dictionary<string, IEnumerable<GraphInstance>> Model { get; set; }

		public object Context { get; set; }

		public static Page Current
		{
			get
			{
				var page = HttpContext.Current.Items["ExoWeb.Page"] as Page;
				if (page == null)
					HttpContext.Current.Items["ExoWeb.Page"] = page = new Page();
				return page;
			}
		}
	}
}
