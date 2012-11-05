using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;
using ExoRule;

namespace ExoWeb
{
	/// <summary>
	/// Represents a response to a service request.  Depending on the type of request, different values will be 
	/// initialize on the instance.
	/// </summary>
	internal class ServiceResponse
	{
		static string typeCacheHash;

		static Dictionary<string, string> typeJson;

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
		/// Efficiently serializes the request to json leveraging caching for model type requests.
		/// </summary>
		/// <returns></returns>
		internal string ToJson()
		{
			var builder = new StringBuilder();

			builder.Append("{");

			if (Types != null && Types.Any())
			{
				builder.Append("\"types\":{");
				foreach (var type in Types)
					builder.Append(builder.Length > 10 ? ",\"" : "\"").Append(type).Append("\":").Append(GetTypeJson(type));
				builder.Append("}");
			}

			if (Instances != null && Instances.Any())
				builder.Append(builder.Length > 1 ? "," : "").Append("\"instances\":").Append(ExoWeb.ToJson(Instances.GetType(), Instances));

			if (Conditions != null && Conditions.Any())
				builder.Append(builder.Length > 1 ? "," : "").Append("\"conditions\":").Append(ExoWeb.ToJson(Conditions.GetType(), Conditions));

			if (Events != null && Events.Any())
				builder.Append(builder.Length > 1 ? "," : "").Append("\"events\":").Append(ExoWeb.ToJson(Events.GetType(), Events));

			if (Model != null && Model.Any())
				builder.Append(builder.Length > 1 ? "," : "").Append("\"model\":").Append(ExoWeb.ToJson(Model.GetType(), Model));

			if (ServerInfo != null)
				builder.Append(builder.Length > 1 ? "," : "").Append("\"serverInfo\":").Append(ExoWeb.ToJson(ServerInfo.GetType(), ServerInfo));

			if (Changes != null && Changes.Any())
				builder.Append(builder.Length > 1 ? "," : "").Append("\"changes\":").Append(ExoWeb.ToJson(typeof(IEnumerable<ModelEvent>), Changes.Where(modelEvent => !(modelEvent is ModelValueChangeEvent) || ExoWeb.IncludeInClientModel(((ModelValueChangeEvent)modelEvent).Property))));

			builder.Append("}");
			return builder.ToString();
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
			typeJson[type] = json = ExoWeb.ToJson(typeof(ModelType), ModelContext.Current.GetModelType(type));
			return json;
		}
	}
}
