using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;
using ExoRule;
using ExoWeb.Serialization;

namespace ExoWeb
{
	/// <summary>
	/// Represents the set of information to serialize to the client for a
	/// load request for a specific <see cref="ModelType"/>.
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
	internal class ModelTypeInfo : IJsonSerializable
	{
		internal ModelTypeInfo()
		{
			StaticProperties = new HashSet<ModelProperty>();
			Instances = new Dictionary<string, ModelInstanceInfo>();
		}

		public HashSet<ModelProperty> StaticProperties { get; private set; }

		public Dictionary<string, ModelInstanceInfo> Instances { get; private set; }

		#region IJsonSerializable

		void IJsonSerializable.Serialize(JsonWriter writer)
		{
			// Serialize static property values
			if (StaticProperties.Count > 0)
				writer.Set("static", StaticProperties.ToDictionary(
					property => property.Name, 
					property => JsonConverter.GetPropertyValue(property, property.DeclaringType)));

			// Serialize instances
			foreach (var instance in Instances)
				writer.Set(instance.Key, instance.Value);
		}

		object IJsonSerializable.Deserialize(JsonReader reader)
		{
			throw new NotSupportedException();
		}

		#endregion
	}
}
