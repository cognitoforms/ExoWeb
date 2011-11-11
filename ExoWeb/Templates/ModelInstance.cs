using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Jurassic.Library;
using ExoGraph;
using Jurassic;

namespace ExoWeb.Templates
{
	internal class ModelInstance : ObjectInstance
	{
		GraphInstance instance;

		internal ModelInstance(ScriptEngine engine, GraphInstance instance)
			: base(engine)
		{
			this.instance = instance;
		}

		protected override object GetMissingPropertyValue(string propertyName)
		{
			var property = instance.Type.Properties[propertyName];
			if (property is GraphValueProperty)
				return instance.GetValue((GraphValueProperty)property);
			else if (((GraphReferenceProperty)property).IsList)
				return null; //new ArrayInstance(Engine, instance.GetList((GraphReferenceProperty)property).Select(i => new ModelInstance(Engine, i)).ToArray());
			else
				return new ModelInstance(Engine, instance.GetReference((GraphReferenceProperty)property));
			return base.GetMissingPropertyValue(propertyName);
		} 
	}
}
