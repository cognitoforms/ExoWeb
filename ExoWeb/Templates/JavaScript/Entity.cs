using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Jurassic.Library;
using ExoGraph;
using Jurassic;

namespace ExoWeb.Templates.JavaScript
{
	internal class Entity : ObjectInstance
	{
		const string GetterPrefix = "get_";
		const string SetterPrefix = "set_";

		GraphInstance instance;
		EntityFactory factory;

		internal Entity(ScriptEngine engine, GraphInstance instance, EntityFactory factory)
			: base(engine, engine.Object.InstancePrototype)
		{
			this.instance = instance;
			this.factory = factory;
		}

		protected object LazyDefineProperty(string propertyName, object value)
		{
			DefineProperty(propertyName, new PropertyDescriptor(value, PropertyAttributes.Sealed), true);
			return value;
		}

		protected override object GetMissingPropertyValue(string jsPropertyName)
		{
			// special meta property
			if (jsPropertyName == "meta")
				return LazyDefineProperty("meta", new Meta(Engine, instance));

			// handle model properties
			string modelPropertyName;

			if (jsPropertyName.StartsWith(GetterPrefix))
				modelPropertyName = jsPropertyName.Substring(GetterPrefix.Length);
			else if (jsPropertyName.StartsWith(SetterPrefix))
				throw new InvalidOperationException("Properties are read-only");
			else
				throw new InvalidOperationException("Only property get accessors are supported on model objects: " + jsPropertyName);

			GraphProperty property = instance.Type.Properties[modelPropertyName];

			if (property == null)
				throw new InvalidPropertyException(instance.Type, modelPropertyName);

			if(property is GraphValueProperty)
				return LazyDefineProperty(jsPropertyName, new ValuePropertyGetter(Engine, (GraphValueProperty)property));

			else if (((GraphReferenceProperty)property).IsList)
				throw new NotImplementedException("List properties are not implemented"); //return null; //new ArrayInstance(Engine, instance.GetList((GraphReferenceProperty)property).Select(i => new ModelInstance(Engine, i)).ToArray());

			return LazyDefineProperty(jsPropertyName, new ReferencePropertyGetter(Engine, (GraphReferenceProperty)property, factory));
		}

		/// <summary>
		/// Function for property getter of value-typed properties
		/// </summary>
		class ValuePropertyGetter : FunctionInstance
		{
			GraphValueProperty property;

			public ValuePropertyGetter(ScriptEngine engine, GraphValueProperty property)
				: base(engine, engine.Object.InstancePrototype)
			{
				this.property = property;
			}

			public override object CallLateBound(object thisObject, params object[] arguments)
			{
				Entity mi = (Entity)thisObject;

				return mi.instance.GetValue(property);
			}
		}

		/// <summary>
		/// Function for property getter of reference-typed properties
		/// </summary>
		class ReferencePropertyGetter : FunctionInstance
		{
			GraphReferenceProperty property;
			EntityFactory factory;

			public ReferencePropertyGetter(ScriptEngine engine, GraphReferenceProperty property, EntityFactory factory)
				: base(engine, engine.Object.InstancePrototype)
			{
				this.property = property;
				this.factory = factory;
			}

			public override object CallLateBound(object thisObject, params object[] arguments)
			{
				Entity mi = (Entity)thisObject;

				GraphInstance result = mi.instance.GetReference(property);

				if (result == null)
					return null;

				return factory.GetEntity(result);
			}
		}
	}
}
