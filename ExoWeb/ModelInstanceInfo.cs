using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;
using System.Collections;

namespace ExoWeb
{
	/// <summary>
	/// Tracks an instance being serialized and each list property that must be serialized with it.
	/// </summary>
	internal class ModelInstanceInfo : IEnumerable<object>
	{
		HashSet<string> lists;

		internal ModelInstance Instance { get; private set; }

		internal ModelInstanceInfo(ModelInstance instance)
		{
			this.Instance = instance;
		}

		internal void IncludeList(ModelProperty list)
		{
			if (lists == null)
				lists = new HashSet<string>();
			lists.Add(list.Name);
		}

		internal bool HasList(ModelProperty list)
		{
			return lists != null && lists.Contains(list.Name);
		}

		/// <summary>
		/// Gets the set of property values to be serialized for the current instance
		/// </summary>
		/// <returns></returns>
		IEnumerator<object> IEnumerable<object>.GetEnumerator()
		{
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
