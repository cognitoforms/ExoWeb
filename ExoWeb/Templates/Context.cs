using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ExoWeb.Templates
{
	/// <summary>
	/// Represents the current template binding context.
	/// </summary>
	public class Context : IDisposable
	{
		internal static IEnumerable<KeyValuePair<string, object>> NoVariables = new KeyValuePair<string, object>[0];

		internal Page Page { get; set; }

		public int? Index { get; internal set; }

		public string Id { get; internal set; }

		public object DataItem { get; internal set; }

		public IEnumerable<KeyValuePair<string, object>> Variables { get; internal set; }

		public Context ParentContext { get; internal set; }

		public bool IsGlobal
		{
			get { return ParentContext == null; }
		}

		internal string GetInstanceId(string id)
		{
			return id + Id;
		}

		void IDisposable.Dispose()
		{
			Page.EndContext();
		}
	}
}
