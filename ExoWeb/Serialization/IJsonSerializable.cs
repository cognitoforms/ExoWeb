using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;
using System.Reflection;

namespace ExoWeb.Serialization
{
	public interface IJsonSerializable
	{
		void Serialize(JsonWriter writer);

		object Deserialize(JsonReader reader);
	}
}
