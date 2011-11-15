using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using Jurassic;

namespace ExoWeb.Templates.JavaScript
{
	/// <summary>
	/// Factory should be used to create all Entities to limit the number of extra objects created and
	/// as a way to implement object equality
	/// </summary>
	internal class EntityWrapperFactory
	{
		ScriptEngine engine;
		IDictionary<string, EntityWrapper> entities = new Dictionary<string,EntityWrapper>();

		public EntityWrapperFactory(ScriptEngine engine)
		{
			this.engine = engine;
		}

		public EntityWrapper GetEntity(GraphInstance instance)
		{
			string key = instance.Type.Name + "|" + instance.Id;

			EntityWrapper entity;

			if (entities.TryGetValue(key, out entity))
				return entity;

			entity = new EntityWrapper(engine, instance, this);
			entities.Add(key, entity);

			return entity;
		}
	}
}
