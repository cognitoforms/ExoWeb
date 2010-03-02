using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Data.Objects.DataClasses;
using ExoWeb;
using ExoGraph.EntityFramework;

namespace Helpdesk
{
	[AllowedValues(From = "All")]
	public partial class Category
	{
		public static List<Category> All
		{
			get
			{
				return new List<Category>(ObjectContext.Categories);
			}
		}
	}
}
