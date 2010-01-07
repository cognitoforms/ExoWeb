using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;

namespace ExoWeb
{
	#region IRuleProvider

	public interface IServiceAdapter
	{
		IEnumerable<Rule> GetRules(GraphType type);
	}

	#endregion


}
