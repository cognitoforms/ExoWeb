using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using System.Collections;

namespace ExoWeb
{
	/// <summary>
	/// Tracks an instance being serialized and each list property that must be serialized with it.
	/// </summary>
	internal class GraphInstanceInfo : IEnumerable<object>
	{
		HashSet<string> lists;

		internal GraphInstance Instance { get; private set; }

		internal GraphInstanceInfo(GraphInstance instance)
		{
			this.Instance = instance;
		}

		internal void IncludeList(GraphProperty list)
		{
			if (lists == null)
				lists = new HashSet<string>();
			lists.Add(list.Name);
		}

		internal bool HasList(GraphProperty list)
		{
			return lists != null && lists.Contains(list.Name);
		}

		/// <summary>
		/// Gets the set of property values to be serialized for the current instance
		/// </summary>
		/// <returns></returns>
		IEnumerator<object> IEnumerable<object>.GetEnumerator()
		{
			// Prepare the instance for serialization
			ExoWeb.OnSerialize(Instance);

			return Instance.Type.Properties
				.Where(property => ExoWeb.IncludeInClientModel(property) && !property.IsStatic)
				.Select(property => property.IsList && !HasList(property) ? "?" : JsonConverter.GetPropertyValue(property, Instance))
				.GetEnumerator();
		}

		IEnumerator IEnumerable.GetEnumerator()
		{
			return ((IEnumerable<object>)this).GetEnumerator();
		}
	}
}
