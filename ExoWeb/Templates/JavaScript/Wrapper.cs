using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Jurassic.Library;
using Jurassic;

namespace ExoWeb.Templates.JavaScript
{
	/// <summary>
	/// Base class to simplify wrapping .NET classes. Properties are defined on an as needed basis.
	/// Override GetMissingPropertyValue() to declare properties.
	/// </summary>
	/// <typeparam name="T"></typeparam>
	abstract class Wrapper<T> : ObjectInstance
	{
		protected Wrapper(T realObject, ScriptEngine engine, ObjectInstance prototype)
			: base(engine, prototype)
		{
			this.RealObject = realObject;
		}

		/// <summary>
		/// The object being wrapped
		/// </summary>
		protected T RealObject { get; private set; }

		/// <summary>
		/// Automatically expose declared property getters.
		/// </summary>
		/// <param name="jsPropertyName"></param>
		/// <returns></returns>
		protected override object GetMissingPropertyValue(string jsPropertyName)
		{
			if (jsPropertyName.StartsWith("get_"))
			{
				var property = typeof(T).GetProperty(jsPropertyName.Substring(4), System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic);
				if (property != null)
					return LazyDefineMethod(jsPropertyName, item => property.GetValue(item, null));
			}

			return base.GetMissingPropertyValue(jsPropertyName);
		}

		/// <summary>
		/// Call from GetMissingPropertyValue() to define a property
		/// </summary>
		protected object LazyDefineProperty(string propertyName, object value)
		{
			DefineProperty(propertyName, new PropertyDescriptor(value, PropertyAttributes.Sealed), true);
			return value;
		}

		/// <summary>
		/// Call from GetMissingPropertyValue() to define a method
		/// </summary>
		protected object LazyDefineMethod<TResult>(string methodName, Func<T, TResult> impl)
		{
			FunctionInstance method = new Method<TResult>(Engine, impl);
			DefineProperty(methodName, new PropertyDescriptor(method, PropertyAttributes.Sealed), true);

			return method;
		}

		/// <summary>
		/// Wraps a single method
		/// </summary>
		/// <typeparam name="TResult"></typeparam>
		class Method<TResult> : FunctionInstance
		{
			Func<T, TResult> impl;

			public Method(ScriptEngine engine, Func<T, TResult> impl)
				: base(engine, engine.Object.InstancePrototype)
			{
				this.impl = impl;
			}

			public override object CallLateBound(object thisObject, params object[] arguments)
			{
				Wrapper<T> wrapper = (Wrapper<T>)thisObject;
				return impl(wrapper.RealObject);
			}
		}
	}
}
