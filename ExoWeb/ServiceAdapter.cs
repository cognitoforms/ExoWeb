using System;
using System.Linq;
using System.Collections.Generic;
using ExoGraph;
using ExoRule;

namespace ExoWeb
{
	#region ServiceAdapter

	public class ServiceAdapter
	{
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
	}

	#endregion
}
