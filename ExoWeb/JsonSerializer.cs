using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;

namespace ExoWeb
{
	internal class JsonSerializer : JavaScriptSerializer
	{
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

		internal void Set<T>(string name, T value)
		{
			globals[name] = value;
		}
	}
}
