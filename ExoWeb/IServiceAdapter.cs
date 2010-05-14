using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using ExoRule;

namespace ExoWeb
{
	#region IServiceAdapter

	public interface IServiceAdapter
	{
		IEnumerable<ConditionType> GetConditionTypes(GraphType type);

		string GetFormatName(GraphProperty property);

		void OnError(IServiceError error);
	}

	#endregion


}
