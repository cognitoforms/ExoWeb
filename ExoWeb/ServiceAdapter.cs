using System;
using System.Linq;
using System.Collections.Generic;
using ExoGraph;
using ExoRule;
using System.Reflection;

namespace ExoWeb
{
	#region ServiceAdapter

	public class ServiceAdapter
	{
		static string cacheHash;

		/// <summary>
		/// Returns the default display format name for the given graph property.
		/// </summary>
		/// <param name="property">The graph property</param>
		/// <returns>The default display format name</returns>
        public virtual string GetFormatName(GraphProperty property)
        {
            return null;
        }

		public virtual string GetLabel(GraphProperty property)
		{
			return null;
		}

		public virtual string GetCacheHash()
		{
			if (cacheHash == null)
			{
				int code = 0;

				foreach (Assembly a in AppDomain.CurrentDomain.GetAssemblies())
					code = code == 0 ? a.GetHashCode() : code ^ a.GetHashCode();

				cacheHash = code.ToString();
			}
			return cacheHash;
		}
	}

	#endregion
}
