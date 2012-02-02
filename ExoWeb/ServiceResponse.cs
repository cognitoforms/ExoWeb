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
	internal class ServiceResponse : IJsonSerializable
	{
		public Dictionary<string, ModelType> Types { get; internal set; }

		public Dictionary<string, ModelTypeInfo> Instances { get; internal set; }

		public Dictionary<string, List<Condition>> Conditions { get; internal set; }

		public object[] Events { get; internal set; }

		public ModelTransaction Changes { get; set; }

		public ServerInformation ServerInfo { get; set; }

		public Dictionary<string, ServiceRequest.Query> Model { get; set; }

		public ModelTypeInfo GetModelTypeInfo(ModelType type)
		{
			// Create the set of type instance information if not initialized
			if (Instances == null)
				Instances = new Dictionary<string,ModelTypeInfo>();
			
			// Get or initialize the model type instance information store
			ModelTypeInfo typeInfo;
			if (!Instances.TryGetValue(type.Name, out typeInfo))
				Instances[type.Name] = typeInfo = new ModelTypeInfo();

			// Return the requested value
			return typeInfo;
		}

		#region IJsonSerializable

		void IJsonSerializable.Serialize(Json json)
		{
			if (Types != null && Types.Any())
				json.Set("types", Types);

			if (Instances != null && Instances.Any())
				json.Set("instances", Instances);

			if (Conditions != null && Conditions.Any())
				json.Set("conditions", Conditions);

			if (Events != null && Events.Any())
				json.Set("events", Events);

			if (Model != null && Model.Any())
				json.Set("model", Model);

			if (ServerInfo != null)
				json.Set("serverinfo", ServerInfo);

			if (Changes != null && Changes.Any())
				json.Set("changes", (IEnumerable<ModelEvent>)Changes.Where(modelEvent => !(modelEvent is ModelValueChangeEvent) || ExoWeb.IncludeInClientModel(((ModelValueChangeEvent)modelEvent).Property)));
		}

		object IJsonSerializable.Deserialize(Json json)
		{
			throw new NotSupportedException("JSON service responses should never be deserialized on the server.");
		}

		#endregion
	}
}
