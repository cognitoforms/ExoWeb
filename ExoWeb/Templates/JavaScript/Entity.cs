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
		Meta meta;

		internal Entity(ScriptEngine engine, GraphInstance instance)
			: base(engine, engine.Object.InstancePrototype)
		{
			this.instance = instance;

		}

		protected override object GetMissingPropertyValue(string jsPropertyName)
		{
			// special meta property
			if (jsPropertyName == "meta")
			{
				if (meta == null)
					meta = new Meta(Engine, instance);

				return meta;
			}

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
				return new ValuePropertyGetter(Engine, (GraphValueProperty)property);

			else if (((GraphReferenceProperty)property).IsList)
				throw new NotImplementedException("List properties are not implemented"); //return null; //new ArrayInstance(Engine, instance.GetList((GraphReferenceProperty)property).Select(i => new ModelInstance(Engine, i)).ToArray());

			return new ReferencePropertyGetter(Engine, (GraphReferenceProperty)property);
		}

		/// <summary>
		/// Function for property getter of value-typed properties
		/// </summary>
		class ValuePropertyGetter : ClrFunction
		{
			GraphValueProperty property;

			public ValuePropertyGetter(ScriptEngine engine, GraphValueProperty property)
				: base(engine.Function, property.Name, engine.Object.InstancePrototype)
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
		class ReferencePropertyGetter : ClrFunction
		{
			GraphReferenceProperty property;

			public ReferencePropertyGetter(ScriptEngine engine, GraphReferenceProperty property)
				: base(engine.Function, property.Name, engine.Object.InstancePrototype)
			{
				this.property = property;
			}

			public override object CallLateBound(object thisObject, params object[] arguments)
			{
				Entity mi = (Entity)thisObject;

				GraphInstance result = mi.instance.GetReference(property);

				if (result == null)
					return null;

				return new Entity(Engine, result);
			}
		}
	}
}
