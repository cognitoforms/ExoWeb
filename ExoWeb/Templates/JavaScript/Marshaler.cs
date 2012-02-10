using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;
using Jurassic;
using Jurassic.Library;
using System.Collections;

namespace ExoWeb.Templates.JavaScript
{
	/// <summary>
	/// Handles passing objects back and forth between the .NET and Jurassic environments.  Cannot be reused across script engines.
	/// </summary>
	class Marshaler
	{
		ScriptEngine engine;
		IDictionary<string, EntityWrapper> entities = new Dictionary<string,EntityWrapper>();

		public Marshaler(ScriptEngine engine)
		{
			this.engine = engine;
		}

		public object Wrap(object clrObject)
		{
			if (clrObject is Transform.Grouping)
				return new Transform.GroupingWrapper(engine, (Transform.Grouping)clrObject);

			if (clrObject is IDictionary<string, object>)
				return new DictionaryWrapper(engine, (IDictionary<string, object>)clrObject);

			if (clrObject is ModelInstance)
				return Wrap((ModelInstance)clrObject);

			if (clrObject is Templates.Adapter)
				return new AdapterWrapper(engine, (Adapter)clrObject);
			
			if (clrObject is Templates.OptionAdapter)
				return new OptionAdapterWrapper(engine, (OptionAdapter)clrObject);

			if (clrObject is Templates.Context)
				return new TemplateContextWrapper(engine, (Context)clrObject);

			if (clrObject is UnwrappedArray)
				return ((UnwrappedArray)clrObject).Array;

			if (clrObject is IEnumerable && !(clrObject is string))
			{
				// copy items into a placeholder javascript array
				ArrayInstance array = engine.Array.Construct();

				foreach (object item in (IEnumerable)clrObject)
					array.Push(Wrap(item));

				return array;
			}

			return clrObject;
		}

		public object Unwrap(object jsObject)
		{
			if (jsObject is IWrapper)
				return ((IWrapper)jsObject).RealObject;

			if (jsObject is ArrayInstance)
				return new UnwrappedArray(this, (ArrayInstance)jsObject);

			return jsObject;
		}

		public EntityWrapper Wrap(ModelInstance instance)
		{
			string key = instance.Type.Name + "|" + instance.Id;

			EntityWrapper entity;

			if (entities.TryGetValue(key, out entity))
				return entity;

			entity = new EntityWrapper(engine, instance, this);
			entities.Add(key, entity);

			return entity;
		}

		/// <summary>
		/// Enumerates an javascript array while exposing a reference to the original array to optimize marshalling.
		/// </summary>
		internal class UnwrappedArray : IEnumerable
		{
			ArrayInstance array;
			Marshaler marshaler;

			public UnwrappedArray(Marshaler marshaler, ArrayInstance array)
			{
				this.marshaler = marshaler;
				this.array = array;
			}

			public IEnumerator GetEnumerator()
			{
				return array.ElementValues.Select(e => marshaler.Unwrap(e)).GetEnumerator();
			}

			/// <summary>
			/// The javascript array being enumerated
			/// </summary>
			public ArrayInstance Array
			{
				get { return array; }
			}
		}
	}
}
