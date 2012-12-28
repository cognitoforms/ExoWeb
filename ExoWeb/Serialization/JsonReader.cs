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
			if (TokenType == JsonToken.PropertyName)
			{
				property = (string)Value;
				return Read();
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
