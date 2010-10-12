using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using ExoRule;

namespace ExoWeb
{
	/// <summary>
	/// Represents the set of information to serialize to the client for a
	/// load request for a specific <see cref="GraphType"/>.
	/// </summary>
	/// <remarks>
	/// Serializes as:
	/// <code>
	/// {
	///		static : {
	///			prop1 : "",
	///			prop2 : "",
	///			...
	///			propN : ""
	///		},
	///		instance1 : ["v1", "v2", "...", "vN"],
	///		instance2 : ["v1", "v2", "...", "vN"],
	///		...,
	///		instanceN : ["v1", "v2", "...", "vN"]
	///	}
	///	</code>
	/// </remarks>
	internal class GraphTypeInfo : IJsonSerializable
	{
		internal GraphTypeInfo()
		{
			StaticProperties = new HashSet<GraphProperty>();
			Instances = new Dictionary<string, GraphInstanceInfo>();
		}

		public HashSet<GraphProperty> StaticProperties { get; private set; }

		public Dictionary<string, GraphInstanceInfo> Instances { get; private set; }

		#region IJsonSerializable

		void IJsonSerializable.Serialize(Json json)
		{
			// Serialize static property values
			if (StaticProperties.Count > 0)
				json.Set("static", StaticProperties.ToDictionary(
					property => property.Name, 
					property => JsonConverter.GetPropertyValue(property, property.DeclaringType)));

			// Serialize instances
			foreach (var instance in Instances)
				json.Set(instance.Key, instance.Value);
		}

		object IJsonSerializable.Deserialize(Json json)
		{
			throw new NotSupportedException();
		}

		#endregion
	}
}
