using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using System.IO;

namespace ExoWeb.Serialization
{
	/// <summary>
	/// Specialized reader that supports efficient implementation of custom converters.
	/// </summary>
	/// <remarks>
	/// Works in conjunction with <see cref="JsonConverter"/>.
	/// </remarks>
	public class JsonReader : JsonTextReader
	{
		JsonSerializer serializer;

		internal JsonReader(TextReader reader, JsonSerializer serializer)
			: base(reader)
		{
			this.serializer = serializer;
		}

		/// <summary>
		/// Returns true if a property is being read, including the property name
		/// as an out parameter, otherwise false.
		/// </summary>
		/// <param name="property"></param>
		/// <returns></returns>
		public bool ReadProperty(out string property)
		{
			return ReadProperty(out property, null);
		}

		/// <summary>
		/// Returns true if a property is being read, including the property name
		/// as an out parameter, otherwise false.
		/// </summary>
		/// <param name="property"></param>
		/// <param name="readPropertyAsType">The property type to facilitate reading</param>
		/// <returns></returns>
		internal bool ReadProperty(out string property, Type readPropertyAsType)
		{
			if (TokenType == JsonToken.PropertyName)
			{
				property = (string)Value;
				bool wasRead = false;

				//Work around for the Read method not automatically deserializing all types properly
				//Issue reported to Json.NET at http://json.codeplex.com/workitem/23910
				if (readPropertyAsType == typeof(decimal))
					wasRead = ReadAsDecimal() != null;
				else
					wasRead = Read();

				return wasRead;
			}
			else
			{
				property = null;
				return false;
			}
		}

		/// <summary>
		/// Reads the value of a property.
		/// </summary>
		/// <param name="property"></param>
		/// <returns></returns>
		public T ReadValue<T>()
		{
			var value = Value is T ? (T)Value : serializer.Deserialize<T>(this);
			Read();
			return value;
		}

		/// <summary>
		/// Reads the value of a property.
		/// </summary>
		/// <param name="property"></param>
		/// <returns></returns>
		public object ReadValue(Type valueType)
		{
			var value = Value;
			if (CurrentState == State.PostValue)
			{
				if (value != null && ValueType != valueType)
					value = serializer.Deserialize(this, valueType);
			}
			else
				value = serializer.Deserialize(this, valueType);
			Read();
			return value;
		}
	}
}
