using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;

namespace ExoWeb
{
	#region IServiceAdapter

	public interface IServiceAdapter
	{
		IEnumerable<Rule> GetRules(GraphType type);

		string GetFormatName(GraphProperty property);

		void OnError(IServiceError error);
	}

	#endregion


}
