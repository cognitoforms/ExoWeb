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
	public partial class Priority
	{
		public static List<Priority> All
		{
			get
			{
				return new List<Priority>(ObjectContext.Priorities);
			}
		}
	}
}
