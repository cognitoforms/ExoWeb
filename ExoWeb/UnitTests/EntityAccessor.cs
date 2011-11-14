using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using ExoWeb.Templates.JavaScript;
using Jurassic;

namespace ExoWeb.UnitTests
{
	public class EntityAccessor
	{
		public static object CreateEntity(ScriptEngine engine, IGraphInstance instance)
		{
			EntityFactory factory = new EntityFactory(engine);
			return factory.GetEntity(instance.Instance);
		}
	}
}
