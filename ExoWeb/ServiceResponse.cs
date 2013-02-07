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
	/// Represents a response to a service request.  Depending on the type of request, different values will be 
	/// initialize on the instance.
	/// </summary>
	internal class ServiceResponse : IJsonSerializable
	{
		static string typeCacheHash;

		static Dictionary<string, string> typeJson;

		static Dictionary<string, string> cachedInstances = new Dictionary<string, string>();

		public string[] Types { get; internal set; }

		public Dictionary<string, ModelTypeInfo> Instances { get; internal set; }

		public Dictionary<string, List<Condition>> Conditions { get; internal set; }

		public object[] Events { get; internal set; }

		public ModelTransaction Changes { get; set; }

		public ServerInformation ServerInfo { get; set; }

		public Dictionary<string, ServiceRequest.Query> Model { get; set; }

		internal HashSet<ModelInstance> inScopeInstances = new HashSet<ModelInstance>();

		public ModelTypeInfo GetModelTypeInfo(ModelType type)
		{
			// Create the set of type instance information if not initialized
			if (Instances == null)
				Instances = new Dictionary<string, ModelTypeInfo>();

			// Get or initialize the model type instance information store
			ModelTypeInfo typeInfo;
			if (!Instances.TryGetValue(type.Name, out typeInfo))
				Instances[type.Name] = typeInfo = new ModelTypeInfo();

			// Return the requested value
			return typeInfo;
		}

		/// <summary>
		/// Gets the type json for the specified <see cref="ModelType"/>.
		/// </summary>
		/// <param name="type"></param>
		/// <returns></returns>
		static string GetTypeJson(string type)
		{
			// Reinitialize the json type cache of the cache hash has changed
			if (typeCacheHash != ExoWeb.CacheHash)
			{
				typeJson = new Dictionary<string, string>();
				typeCacheHash = ExoWeb.CacheHash;
			}

			// Return the type json if it is cached
			string json;
			if (typeJson.TryGetValue(type, out json))
				return json;

			// Create and cache the type json if it does not yet exist
			ModelType value = ModelContext.Current.GetModelType(type);
			json = JsonUtility.Serialize(value);
			if(value != null && value.Provider.IsCachable)
				typeJson[type] = json;

			return json;
		}

		void IJsonSerializable.Serialize(JsonWriter writer)
		{
			// Types
			if (Types != null && Types.Any())
			{
				writer.WritePropertyName("types");
				writer.WriteStartObject();
				foreach (var type in Types)
				{
					writer.WritePropertyName(type);
					writer.WriteRawValue(GetTypeJson(type));
				}
				writer.WriteEndObject();
			}

			if (Instances != null && Instances.Any())
			{
				writer.WritePropertyName("instances");
				writer.WriteStartObject();

				foreach (var typeItem in Instances)
				{
					writer.WritePropertyName(typeItem.Key);
					writer.WriteStartObject();

					// Serialize static property values
					if (typeItem.Value.StaticProperties.Count > 0)
					{
						writer.WritePropertyName("static");
						writer.Serialize(
							typeItem.Value.StaticProperties.ToDictionary(
							property => property.Name,
							property => JsonConverter.GetPropertyValue(property, property.DeclaringType)));
					}

					// Serialize instances
					foreach (var instanceItem in typeItem.Value.Instances)
					{
						writer.WritePropertyName(instanceItem.Key);
						writer.Serialize(instanceItem.Value);
					}

					writer.WriteEndObject();
				}

				writer.WriteEndObject();
			}

			if (Conditions != null && Conditions.Any())
			{
				writer.WritePropertyName("conditions");
				writer.Serialize(Conditions);
			}

			if (Events != null && Events.Any())
			{
				writer.WritePropertyName("events");
				writer.Serialize(Events);
			}

			if (Model != null && Model.Any())
			{
				writer.WritePropertyName("model");
				writer.Serialize(Model);
			}

			if (ServerInfo != null)
			{
				writer.WritePropertyName("serverInfo");
				writer.Serialize(ServerInfo);
			}

			if (Changes != null && Changes.Any())
			{
				writer.WritePropertyName("changes");
				writer.Serialize(Changes.Where(modelEvent => !(modelEvent is ModelValueChangeEvent) || ExoWeb.IncludeInClientModel(((ModelValueChangeEvent)modelEvent).Property)));
			}
		}

		object IJsonSerializable.Deserialize(JsonReader reader)
		{
			throw new NotImplementedException();
		}
	}
}
