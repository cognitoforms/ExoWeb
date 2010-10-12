using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;
using System.Reflection;
using ExoGraph;
using ExoRule;
using System.Runtime.Serialization;
using System.Diagnostics;
using System.Xml;
using System.ComponentModel;

namespace ExoWeb
{
	/// <summary>
	/// Supports conversion to JSON of types implementing <see cref="IJsonConverter"/> or having
	/// <see cref="DataContractAttribute"/> used for enabling WCF serialization.
	/// </summary>
	public class JsonConverter : JavaScriptConverter
	{
		#region Fields

		static Dictionary<Type, string> jsonIntrinsicTypes = new Dictionary<Type, string>() 
		{ 
			{ typeof(string),		"String"  },
			{ typeof(char),			"String"  },
			{ typeof(Guid),			"String"  },
			{ typeof(bool),			"Boolean" },
			{ typeof(byte),			"Number"  },
			{ typeof(int),			"Number"  },
			{ typeof(long),			"Number"  },
			{ typeof(float),		"Number"  },
			{ typeof(double),		"Number"  },
			{ typeof(decimal),		"Number"  },
			{ typeof(DateTime),		"Date"    },
			{ typeof(bool?),		"Boolean" },
			{ typeof(byte?),		"Number"  },
			{ typeof(int?),			"Number"  },
			{ typeof(long?),		"Number"  },
			{ typeof(float?),		"Number"  },
			{ typeof(double?),		"Number"  },
			{ typeof(decimal?),		"Number"  },
			{ typeof(DateTime?),	"Date"    }
		};

		Type type;
		Action<object, Json> serialize;
		Func<Json, object> deserialize;

		#endregion

		#region Constructors

		public JsonConverter(Type type, Action<object, Json> serialize, Func<Json, object> deserialize)
		{
			this.type = type;
			this.serialize = serialize;
			this.deserialize = deserialize;
		}

		#endregion

		#region Methods

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

				// Classes with DataContract attributes
				else if (type.GetCustomAttributes(typeof(DataContractAttribute), true).Any())
				{
					// Get the names and the property info instances of properties to be serialized for the current type
					var properties =
					(
						from member in GetMembers(type)
						let dataMember = (DataMemberAttribute)member.GetCustomAttributes(typeof(DataMemberAttribute), false).FirstOrDefault()
						where dataMember != null
						select new { Name = dataMember.Name ?? member.Name, MemberInfo = member }
					)

					// Force the enumeration to run immediately to ensure the closure tracks a precalculated value
					.ToArray();

					// Cache the current type to make the closure works (.NET compiler bug?)
					var currentType = type;

					// Serialize and deserialize properties based on their DataMember attributes
					yield return new JsonConverter(type,
						(instance, json) =>
						{
							foreach (var property in properties)
								json.Set(property.Name, property.MemberInfo is FieldInfo ? 
									((FieldInfo)property.MemberInfo).GetValue(instance) : 
									((PropertyInfo)property.MemberInfo).GetValue(instance, null));
						},
						(json) =>
						{
							object instance = FormatterServices.GetUninitializedObject(currentType);
							foreach (var property in properties)
							{
								// Get the property value from the json
								object value = json.Get(property.MemberInfo is FieldInfo ? 
									((FieldInfo)property.MemberInfo).FieldType : 
									((PropertyInfo)property.MemberInfo).PropertyType, property.Name);

								// Set the property value if it is not null
								if (value != null)
								{
									if (property.MemberInfo is FieldInfo)
										((FieldInfo)property.MemberInfo).SetValue(instance, value);
									else
										((PropertyInfo)property.MemberInfo).SetValue(instance, value, null);
								}
							}
							return instance;
						});
				}
			}
		}

		static IEnumerable<MemberInfo> GetMembers(Type type)
		{
			HashSet<string> members = new HashSet<string>();
			while (type != null)
			{
				foreach (var member in type.GetMembers(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance))
				{
					if ((member is FieldInfo || member is PropertyInfo) && !members.Contains(member.Name) && member.GetCustomAttributes(typeof(DataMemberAttribute), false).Any())
					{
						members.Add(member.Name);
						yield return member;
					}
				}
				type = type.BaseType;
			}
		}

		/// <summary>
		/// Gets the serializable value of a <see cref="GraphProperty"/>.
		/// </summary>
		/// <param name="property"></param>
		/// <param name="source"></param>
		/// <returns></returns>
		internal static object GetPropertyValue(GraphProperty property, IGraphPropertySource source)
		{
			GraphReferenceProperty reference = property as GraphReferenceProperty;
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
				return source.GetValue((GraphValueProperty)property);
		}

		/// <summary>
		/// Gets the serializable representation of a <see cref="GraphInstance"/>.
		/// </summary>
		/// <param name="property"></param>
		/// <param name="instance"></param>
		/// <returns></returns>
		internal static object GetReference(GraphReferenceProperty property, GraphInstance instance)
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

			// For unknown values types, return the object type
			if (IsWcfSerializable(type))
				return "Object";

			return null;
		}

		/// <summary>
		/// Gets the name of the specified <see cref="GraphType"/>.
		/// </summary>
		/// <param name="type"></param>
		/// <returns></returns>
		internal static string GetJsonReferenceType(GraphType type)
		{
			string jsonType = "";
			for (GraphType t = type; t != null; t = t.BaseType)
				jsonType += (string.IsNullOrEmpty(jsonType) ? "" : ">") + t.Name;
			return jsonType;
		}

		/// <summary>
		/// Indicates whether the specified type can be serialized using WCF.
		/// </summary>
		/// <param name="type"></param>
		/// <returns></returns>
		internal static bool IsWcfSerializable(Type type)
		{
			object[] attributes = type.GetCustomAttributes(false);

			foreach (object attribute in attributes)
				if (attribute is DataContractAttribute || attribute is CollectionDataContractAttribute)
					return true;

			return false;
		}

		#endregion

		#region JavaScriptConverter

		public override object Deserialize(IDictionary<string, object> dictionary, Type type, JavaScriptSerializer serializer)
		{
			if (deserialize == null)
				throw new NotSupportedException("Deserialization of " + type.FullName + " is not supported.");

			return deserialize(new Json(serializer, type, dictionary));
		}

		public override IDictionary<string, object> Serialize(object value, JavaScriptSerializer serializer)
		{
			if (serialize == null)
				throw new NotSupportedException("Serialization of " + type.FullName + " is not supported.");

			IDictionary<string, object> values = new Dictionary<string, object>();
			serialize(value, new Json(serializer, values));
			return values;
		}

		public override IEnumerable<Type> SupportedTypes
		{
			get
			{
				yield return type;
			}
		}

		#endregion
	}

		/// <summary>
	/// Supports conversion to JSON of types implementing <see cref="IJsonConverter"/> or having
	/// <see cref="DataContractAttribute"/> used for enabling WCF serialization.
	/// </summary>
	internal class JsonConverter<TType> : JsonConverter
		where TType : class
	{
		public JsonConverter(Action<TType, Json> serialize, Func<Json, TType> deserialize)
			: base(typeof(TType), (instance, json) => serialize((TType)instance, json), (json) => (TType)deserialize(json))
		{ }
	}
}
