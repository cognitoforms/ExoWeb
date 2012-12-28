using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using System.IO;

namespace ExoWeb.Serialization
{
	public class JsonWriter : JsonTextWriter
	{
		JsonSerializer serializer;

		internal JsonWriter(TextWriter writer, JsonSerializer serializer)
			: base(writer)
		{
			this.serializer = serializer;
			this.CloseOutput = false;
		}

		public void Set(string name, object value)
		{
			WritePropertyName(name);
			serializer.Serialize(this, value);
		}

		public void Serialize(object value)
		{
			serializer.Serialize(this, value);
		}

		Dictionary<string, object> globals = new Dictionary<string, object>();

		internal bool TryGetGlobal<T>(string name, out T value)
		{
			if (globals.ContainsKey(name))
			{
				value = (T)globals[name];
				return true;
			}
			value = default(T);
			return false;
		}

		internal void SetGlobal<T>(string name, T value)
		{
			globals[name] = value;
		}

		/// <summary>
		/// Gets or creates a global variable with the specified type and name.
		/// </summary>
		/// <typeparam name="T"></typeparam>
		/// <param name="name"></param>
		/// <returns></returns>
		public T Global<T>(string name)
			where T : class, new()
		{
			T global;
			if (!TryGetGlobal(name, out global))
				SetGlobal(name, global = new T());
			return global;
		}
	}
}
