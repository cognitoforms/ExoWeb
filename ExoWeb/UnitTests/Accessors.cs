using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using ExoWeb.Templates.JavaScript;
using Jurassic;
using ExoWeb.Templates.MicrosoftAjax;
using ExoWeb.Templates;

namespace ExoWeb.UnitTests
{
	public class Accessors
	{
		public static object CreateEntity(ScriptEngine engine, IGraphInstance instance)
		{
			EntityWrapperFactory factory = new EntityWrapperFactory(engine);
			return factory.GetEntity(instance.Instance);
		}

		public static object CreateAdapter(ScriptEngine engine, IGraphInstance instance, string propertyName)
		{
			GraphInstance source;
			GraphProperty property;
			return new AdapterWrapper(engine, (Adapter)new Binding.AdapterExtension("{@ " + propertyName + "}").Evaluate(new AjaxPage() { Context = instance.Instance }, out source, out property));
		}
	}
}
