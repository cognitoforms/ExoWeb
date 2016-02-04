using System;
using ExoModel;
using Jurassic;
using Jurassic.Library;

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

			PopulateFunctions();
		}

		[JSFunction(Name = "toString")]
		public string ToString(string format)
		{
			if (!string.IsNullOrEmpty(format))
				return RealObject.ToString(format);

			return RealObject.ToString();
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

				return LazyDefineMethod(jsPropertyName, instance =>
				{
					var value = instance.GetValue(valueProperty);

					if (value is decimal)
						return decimal.ToDouble((decimal) value);

					if (value is float)
						return Convert.ToDouble((float)value);

					if (value is long)
						return Convert.ToInt32((long)value);

					if (value is DateTime)
					{
						var dateTime = (DateTime)value;

						// Use the same serialization format as `JsonUtility.UtcDateTimeConverter`.
						var dateString = dateTime.ToUniversalTime().ToString(@"yyyy-MM-dd\THH:mm:ss.fff\Z");

						var jsDate = Engine.Date.Construct(dateString);

						return jsDate;
					}

					return value;
				});
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
					return factory.Wrap(instance.GetReference(refProperty));
				});
			}
		}
	}
}
