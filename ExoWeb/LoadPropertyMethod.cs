using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using System.Web;
using System.Runtime.Serialization;

namespace ExoWeb
{
	/// <summary>
	/// Outputs the JSON for the specified property to the response stream.
	/// </summary>
	[DataContract]
	internal class LoadPropertyMethod : ServiceMethod
	{
		[DataMember]
		string Type { get; set; }

		[DataMember]
		string Id { get; set; }

		[DataMember]
		GraphTransaction Changes { get; set; }

		[DataMember]
		string Property { get; set; }

		/// <summary>
		/// Outputs the JSON for the specified property to the response stream.
		/// </summary>
		/// <param name="response"></param>
		internal override void Invoke(HttpResponse response)
		{
			// Subscribe to all graph changes
			GraphContext.Current.Event += MonitorChanges;
			instances = new Dictionary<GraphType, Dictionary<string, GraphInstance>>();

			try
			{
				using (GraphTransaction transaction = GraphContext.Current.BeginTransaction())
				{
					GraphInstance instance = GraphContext.Current.GraphTypes["Customer"].Create();
					instance["YearFounded"] = 2009;
					instance.SetReference("PrimaryContact", GraphContext.Current.GraphTypes["Contact"].Create());
					instance.GetReference("PrimaryContact")["Name"] = "Jamie Thomas";
					instance.GetList("OtherContacts").Add(GraphContext.Current.GraphTypes["Contact"].Create());
					instance.GetList("OtherContacts").Clear();
					//response.Write(ToJson(typeof(GraphTransaction), transaction));
					response.Write(ToJson(typeof(GraphTransaction), FromJson<GraphTransaction>(ToJson(typeof(GraphTransaction), transaction))));
				}
			}
			finally
			{
				instances = null;
				GraphContext.Current.Event -= MonitorChanges;
			}
		}

		void MonitorChanges(object sender, GraphEvent e)
		{
			GraphInitEvent initEvent = e as GraphInitEvent;
			if (initEvent != null)
			{
				Dictionary<string, GraphInstance> typeInstances;
			}
		}

		Dictionary<GraphType, Dictionary<string, GraphInstance>> instances;
	}
}
