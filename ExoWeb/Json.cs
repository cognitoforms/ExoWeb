using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;
using System.Reflection;

namespace ExoWeb
{
	public class Json
	{
		static MethodInfo getMethod = typeof(Json).GetMethod("Get", new Type[] { typeof(string) });

		JavaScriptSerializer serializer;
		IDictionary<string, object> values;

		internal Json(JavaScriptSerializer serializer, IDictionary<string, object> values)
			: this(serializer, null, values)
		{ }

		internal Json(JavaScriptSerializer serializer, Type type, IDictionary<string, object> values)
		{
			this.Type = type;
			this.serializer = serializer;
			this.values = values;
		}

		public Type Type { get; set; }

		public bool IsNull(string name)
		{
			object value;
			return !values.TryGetValue(name, out value) || value == null;
		}

		public T Get<T>(string name)
		{
			object value;
			if (!values.TryGetValue(name, out value))
				return default(T);
			if (typeof(T) == typeof(Json))
				return (T)(object)new Json(serializer, (IDictionary<string, object>)value);
			return serializer.ConvertToType<T>(value);
		}

		public object Get(Type type, string name)
		{
			return getMethod.MakeGenericMethod(type).Invoke(this, new object[] { name });
		}

		public void Set(string name, object value)
		{
			values[name] = value;
		}
	}
}
