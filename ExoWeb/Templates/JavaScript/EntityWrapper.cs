using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Jurassic.Library;
using ExoGraph;
using Jurassic;

namespace ExoWeb.Templates.JavaScript
{
	internal class EntityWrapper : Wrapper<GraphInstance>
	{
		const string GetterPrefix = "get_";
		const string SetterPrefix = "set_";

		EntityWrapperFactory factory;

		internal EntityWrapper(ScriptEngine engine, GraphInstance instance, EntityWrapperFactory factory)
			: base(instance, engine, engine.Object.InstancePrototype)
		{
			this.factory = factory;
		}

		protected override object GetMissingPropertyValue(string jsPropertyName)
		{
			// special meta property
			if (jsPropertyName == "meta")
				return LazyDefineProperty("meta", new Meta(Engine, RealObject));

			// handle model properties
			string modelPropertyName;

			if (jsPropertyName.StartsWith(GetterPrefix))
				modelPropertyName = jsPropertyName.Substring(GetterPrefix.Length);
			else if (jsPropertyName.StartsWith(SetterPrefix))
				throw new InvalidOperationException("Properties are read-only");
			else
				throw new InvalidOperationException("Only property get accessors are supported on model objects: " + jsPropertyName);

			GraphProperty property = RealObject.Type.Properties[modelPropertyName];

			if (property == null)
				throw new InvalidPropertyException(RealObject.Type, modelPropertyName);

			if (property is GraphValueProperty)
			{
				// optimization: cast outside of delegate
				GraphValueProperty valueProperty = (GraphValueProperty)property;

				return LazyDefineMethod(jsPropertyName, instance => instance.GetValue(valueProperty));
			}

			GraphReferenceProperty refProperty = (GraphReferenceProperty)property;
			if (refProperty.IsList)
				throw new NotImplementedException("List properties are not implemented");

			return LazyDefineMethod(jsPropertyName,
				instance =>
				{
					GraphInstance result = instance.GetReference(refProperty);

					if (result == null)
						return null;

					return factory.GetEntity(result);
				}
			);
		}
	}
}
