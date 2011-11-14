using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using ExoWeb.Templates.JavaScript;
using Jurassic;

namespace ExoWeb.UnitTests
{
	public class Accessors
	{
		public static object CreateEntity(ScriptEngine engine, IGraphInstance instance)
		{
			EntityFactory factory = new EntityFactory(engine);
			return factory.GetEntity(instance.Instance);
		}

		public static object CreateAdapter(ScriptEngine engine, IGraphInstance instance, string propertyName)
		{
			GraphProperty property = instance.Instance.Type.Properties[propertyName];
			Templates.MicrosoftAjax.Adapter templateAdapter = new Templates.MicrosoftAjax.Adapter(property, instance.Instance[property]);
			return new Adapter(engine, templateAdapter);
		}
	}
}
