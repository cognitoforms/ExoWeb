using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using ExoRule;

namespace ExoWeb
{
	#region ServiceAdapter

	public abstract class ServiceAdapter
	{
		public abstract IEnumerable<ConditionType> GetConditionTypes(GraphType type);

		public abstract string GetFormatName(GraphProperty property);

		public virtual void OnError(IServiceError error)
		{
		}

		public virtual bool InClientModel(GraphProperty property)
		{
			return !(property is GraphValueProperty) || 
				ServiceMethod.GetJsonValueType(((GraphValueProperty)property).PropertyType) != null;
		}
	}

	#endregion


}
