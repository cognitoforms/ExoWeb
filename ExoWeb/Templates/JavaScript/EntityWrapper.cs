using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Jurassic.Library;
using ExoModel;
using Jurassic;

namespace ExoWeb.Templates.JavaScript
{
	internal class EntityWrapper : Wrapper<ModelInstance>
	{
		const string GetterPrefix = "get_";
		const string SetterPrefix = "set_";

		Marshaler factory;

		internal EntityWrapper(ScriptEngine engine, ModelInstance instance, Marshaler factory)
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

			ModelProperty property = RealObject.Type.Properties[modelPropertyName];

			if (property == null)
				throw new InvalidPropertyException(RealObject.Type, modelPropertyName);

			if (property is ModelValueProperty)
			{
				// optimization: cast outside of delegate
				ModelValueProperty valueProperty = (ModelValueProperty)property;

				return LazyDefineMethod(jsPropertyName, instance => instance.GetValue(valueProperty));
			}

			ModelReferenceProperty refProperty = (ModelReferenceProperty)property;

			if (refProperty.IsList)
			{
				return LazyDefineMethod(jsPropertyName, instance =>
				{
					return factory.Wrap(instance.GetList(refProperty));
				});
			}
			else
			{
				return LazyDefineMethod(jsPropertyName, instance =>
				{
					ModelInstance result = instance.GetReference(refProperty);

					if (result == null)
						return null;

					return factory.Wrap(result);
				});
			}
		}
	}
}
