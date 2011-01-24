using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoRule;
using ExoGraph;

namespace ExoWeb
{
	public interface IModelBuilder
	{
		void Add(string memberName, object instance, params string[] paths);
	}

	internal class ModelBuilder : IModelBuilder
	{
		public ModelBuilder()
		{
			Members = new Dictionary<string, ModelMember>();
		}

		public Dictionary<string, ModelMember> Members { get; set; }
		
		#region IModel Members

		public void Add(string memberName, object instance, params string[] paths)
		{
			if (!Members.ContainsKey(memberName))
				Members.Add(memberName, new ModelMember(GraphContext.Current.GetGraphInstance(instance), paths));
			else
				throw new ApplicationException(string.Format("{0} already added", memberName));
		}

		#endregion
	}

	internal class ModelMember
	{
		public ModelMember(GraphInstance instance, string[] paths)
		{
			this.Instance = instance;
			this.Paths = paths;
		}

		public GraphInstance Instance { get; set; }
		public string[] Paths { get; set; }
		public HashSet<string> InstancePaths { get; set; }
	}

	internal interface IModelInfo
	{
		Dictionary<string, GraphTypeInfo> Instances { get; set; }
		Dictionary<string, List<Condition>> Conditions { get; set; }
		GraphTransaction Changes { get; set; }
	}

	internal class ModelInfo : IModelInfo
	{
		#region IModelInfo Members

		public Dictionary<string, GraphTypeInfo> Instances { get; set; }

		public Dictionary<string, List<Condition>> Conditions { get; set; }

		public GraphTransaction Changes { get; set; }

		#endregion
	}

	internal static class IModelInfoExtensions
	{
		/// <summary>
		/// Builds the dictionary of conditions by type based on <see cref="GraphInstance"/>s
		/// queried during a request; and based on any new <see cref="GraphInstance"/>s
		/// constructed on the server.
		/// </summary>
		/// <param name="modelInfo"></param>
		public static void BuildConditions(this IModelInfo modelInfo)
		{
			// Get instances loaded by the request
			var instances = modelInfo.Instances != null ?
				modelInfo.Instances.Values.SelectMany(d => d.Instances.Values).Select(instance => instance.Instance) :
				new GraphInstance[0];

			// Add instances created during the request
			instances = modelInfo.Changes != null ?
				instances.Union(modelInfo.Changes.OfType<GraphInitEvent.InitNew>().Select(graphEvent => graphEvent.Instance)) :
				instances;

			// Ensure conditions are evaluated before extracting them
			ExoWeb.OnEnsureConditions(modelInfo, instances);

			// Extract conditions for all instances involved in the request
			Dictionary<string, List<Condition>> conditionsByType = new Dictionary<string, List<Condition>>();
			foreach (var condition in instances.SelectMany(instance => Condition.GetConditions(instance)))
			{
				List<Condition> conditions;
				if (!conditionsByType.TryGetValue(condition.Type.Code, out conditions))
					conditionsByType[condition.Type.Code] = conditions = new List<Condition>();

				if (!conditions.Contains(condition))
					conditions.Add(condition);
			}

			modelInfo.Conditions = conditionsByType;
		}
	}
}
