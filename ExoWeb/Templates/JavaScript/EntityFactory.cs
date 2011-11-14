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
	internal class EntityFactory
	{
		ScriptEngine engine;
		IDictionary<string, Entity> entities = new Dictionary<string,Entity>();

		public EntityFactory(ScriptEngine engine)
		{
			this.engine = engine;
		}

		public Entity GetEntity(GraphInstance instance)
		{
			string key = instance.Type.Name + "|" + instance.Id;

			Entity entity;

			if (entities.TryGetValue(key, out entity))
				return entity;

			entity = new Entity(engine, instance, this);
			entities.Add(key, entity);

			return entity;
		}
	}
}
