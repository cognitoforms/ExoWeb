using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;
using System.Reflection;
using ExoModel;
using ExoRule;
using System.Runtime.Serialization;
using System.Diagnostics;
using System.Xml;
using System.ComponentModel;

namespace ExoWeb.Serialization
{
	/// <summary>
	/// Supports conversion to JSON of types implementing <see cref="IJsonConverter"/> or having
	/// <see cref="DataContractAttribute"/> used for enabling WCF serialization.
	/// </summary>
	public class JsonConverter : Newtonsoft.Json.JsonConverter
	{
		#region Fields

		static Dictionary<Type, string> jsonIntrinsicTypes = new Dictionary<Type, string>() 
		{ 
			{ typeof(string),		    "String"  },
			{ typeof(char),			    "String"  },
			{ typeof(Guid),			    "String"  },
			{ typeof(bool),			    "Boolean" },
			{ typeof(byte),			    "Number"  },
			{ typeof(int),			    "Number"  },
			{ typeof(long),			    "Number"  },
			{ typeof(float),		    "Number"  },
			{ typeof(double),		    "Number"  },
			{ typeof(decimal),		    "Number"  },
			{ typeof(DateTime),		    "Date"    },
			{ typeof(TimeSpan),		    "TimeSpan"},
			{ typeof(bool?),		    "Boolean" },
			{ typeof(byte?),		    "Number"  },
			{ typeof(int?),			    "Number"  },
			{ typeof(long?),		    "Number"  },
			{ typeof(float?),		    "Number"  },
			{ typeof(double?),		    "Number"  },
			{ typeof(decimal?),		    "Number"  },
			{ typeof(DateTime?),	    "Date"    },
			{ typeof(TimeSpan?),	    "TimeSpan"},
			{ typeof(Guid?),		    "String"  }
		};


		Action<object, JsonWriter> serialize;
		Func<JsonReader, object> deserialize;

		internal Type Type { get; set; }
		internal IEnumerable<Newtonsoft.Json.JsonConverter> Converters { get; set; }

		#endregion

		#region Constructors

		public JsonConverter(Type type, Action<object, JsonWriter> serialize, Func<JsonReader, object> deserialize)
		{
			this.Type = type;
			this.serialize = serialize;
			this.deserialize = deserialize;
		}

		#endregion

		#region Methods

		public override bool CanConvert(Type objectType)
		{
			// Immediately return true if the specified type matches the target type of the converter
			if (objectType == Type)
				return true;

			// Immediately return false if the specified type is not a subclass of the target type of the converter
			if (!objectType.IsSubclassOf(Type))
				return false;
			
			// Ensure that a more suitable converter is not available before indicating that this converter will work
			for (var subType = objectType; subType != Type; subType = subType.BaseType)
			{
				foreach (var converter in Converters.OfType<JsonConverter>())
				{
					if (converter != this && converter.Type == subType)
						return false;
				}
			}
			return true;
		}

		public override bool CanRead
		{
			get
			{
				return deserialize != null;
			}
		}

		public override bool CanWrite
		{
			get
			{
				return serialize != null;
			}
		}

		public override object ReadJson(Newtonsoft.Json.JsonReader reader, Type objectType, object value, Newtonsoft.Json.JsonSerializer serializer)
		{
			if (reader.TokenType == Newtonsoft.Json.JsonToken.StartObject && reader.Read())
			{
				value = deserialize((JsonReader)reader);
				if (reader.TokenType != Newtonsoft.Json.JsonToken.EndObject)
					throw new FormatException("End object '}' expected");
			}
			return value;
		}


		public override void WriteJson(Newtonsoft.Json.JsonWriter writer, object value, Newtonsoft.Json.JsonSerializer serializer)
		{
			writer.WriteStartObject();
			serialize(value, (JsonWriter)writer);
			writer.WriteEndObject();
		}

		public static IEnumerable<JsonConverter> Infer(IEnumerable<Type> types)
		{
			foreach (Type type in types)
			{
				// Classes implementing IJsonSerializable
				if (typeof(IJsonSerializable).IsAssignableFrom(type) && type.IsClass && !type.IsGenericTypeDefinition && !type.IsAbstract)
				{
					ConstructorInfo constructor = type.GetConstructor(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance, null, Type.EmptyTypes, null);
					if (constructor != null)
					{
						yield return new JsonConverter(type,
							(value, json) => ((IJsonSerializable)value).Serialize(json),
							(json) => ((IJsonSerializable)constructor.Invoke(null)).Deserialize(json));
					}
				}
			}
		}

		/// <summary>
		/// Gets the serializable value of a <see cref="ModelProperty"/>.
		/// </summary>
		/// <param name="property"></param>
		/// <param name="source"></param>
		/// <returns></returns>
		internal static object GetPropertyValue(ModelProperty property, IModelPropertySource source)
		{
			ModelReferenceProperty reference = property as ModelReferenceProperty;
			if (reference != null)
			{
				// Serialize lists
				if (reference.IsList)
					return source.GetList(reference).Select(item => GetReference(reference, item));

				// Serialize references
				else
					return GetReference(reference, source.GetReference(reference));
			}

			// Serialize values
			else
				return source.GetValue((ModelValueProperty)property);
		}

		/// <summary>
		/// Gets the serializable representation of a <see cref="ModelInstance"/>.
		/// </summary>
		/// <param name="property"></param>
		/// <param name="instance"></param>
		/// <returns></returns>
		internal static object GetReference(ModelReferenceProperty property, ModelInstance instance)
		{
			if (instance == null)
				return null;
			else if (instance.Type != property.PropertyType)
				return new { id = instance.Id, type = JsonConverter.GetJsonReferenceType(instance.Type) };
			else
				return instance.Id;
		}

		/// <summary>
		/// Gets the javascript type name for the specified .NET type.
		/// </summary>
		/// <param name="type"></param>
		/// <returns></returns>
		internal static string GetJsonValueType(Type type)
		{
			string jsonType;
			if (jsonIntrinsicTypes.TryGetValue(type, out jsonType))
				return jsonType;

			// Assume all enumerations of intrinsic types are supported and map to Array
			var enumerableType = type.GetInterfaces().FirstOrDefault(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEnumerable<>));
			if (enumerableType != null && jsonIntrinsicTypes.ContainsKey(enumerableType.GetGenericArguments()[0]))
				return "Array";

			// For unknown values types, return the object type
			if (JsonUtility.IsSerializable(type))
				return "Object";

			return null;
		}

		/// <summary>
		/// Gets the name of the specified <see cref="ModelType"/>.
		/// </summary>
		/// <param name="type"></param>
		/// <returns></returns>
		internal static string GetJsonReferenceType(ModelType type)
		{
			string jsonType = "";
			for (ModelType t = type; t != null; t = t.BaseType)
				jsonType += (string.IsNullOrEmpty(jsonType) ? "" : ">") + t.Name;
			return jsonType;
		}

		/// <summary>
		/// Add additional type mappings to the list of intrinsic type mappings
		/// </summary>
		/// <param name="serverType"></param>
		/// <param name="clientType"></param>
		public static void AddInstrinsicType(Type serverType, string clientType)
		{
			jsonIntrinsicTypes[serverType] = clientType;
		}
		#endregion
	}

		/// <summary>
	/// Supports conversion to JSON of types.
	/// </summary>
	public class JsonConverter<TType> : JsonConverter
		where TType : class
	{
		public JsonConverter(Action<TType, JsonWriter> serialize, Func<JsonReader, TType> deserialize)
			: base(typeof(TType), 
				serialize != null ? (instance, json) => serialize((TType)instance, json) : (Action<object, JsonWriter>)null,
				deserialize != null ? (json) => (TType)deserialize(json) : (Func<JsonReader, object>)null)
		{ }
	}
}
