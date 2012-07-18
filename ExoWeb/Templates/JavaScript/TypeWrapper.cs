using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;
using Jurassic;
using Jurassic.Library;

namespace ExoWeb.Templates.JavaScript
{
	class TypeWrapper : Wrapper<ModelType>
	{
		internal TypeWrapper(ScriptEngine engine, ModelType modelType)
			: base(modelType, engine, engine.Object.InstancePrototype)
		{
			this.PopulateFunctions();
		}

		[JSFunction(Name="get_fullName")]
		public string GetFullName()
		{
			return this.RealObject.Name;
		}
	}
}
