using System;
using System.Collections.Generic;
using ExoGraph;
using ExoRule;

namespace ExoWeb
{
	#region ServiceAdapter

	public class ServiceAdapter
	{
        public virtual IEnumerable<ConditionType> GetConditionTypes(GraphType type)
        {
            return new ConditionType[] { };
        }

		/// <summary>
		/// Called before service methods occur to allow custom adapters to perform setup work
        /// based on the specified configuration values.
		/// </summary>
		public virtual void OnBeforeMethod(Dictionary<string, object> config)
        { }

        /// <summary>
		/// Called after service methods occur to allow custom adapters to perform setup work
        /// based on the specified configuration values.
		/// </summary>
        public virtual void OnAfterMethod(Dictionary<string, object> config)
        { }

		/// <summary>
		/// Returns the default display format name for the given graph property.
		/// </summary>
		/// <param name="property">The graph property</param>
		/// <returns>The default display format name</returns>
        public virtual string GetFormatName(GraphProperty property)
        {
            return null;
        }

		/// <summary>
		/// Allows the service adapter to perform custom logic when 
		/// an error is encountered.
		/// </summary>
		/// <param name="error">The error that occured.</param>
		public virtual void OnError(IServiceError error)
		{
		}

		/// <summary>
		/// Indicates whether all error information should be available on 
		/// the client.  This option should be used with caution.
		/// </summary>
		public virtual bool EnableExceptionInformation
		{
			get { return false; }
		}

		/// <summary>
		/// Determines whether a given property should be included in the
		/// model on the client.  By defult, non-value properties are included.
		/// Also, value properties that can be translated to a JavaScript type.
		/// </summary>
		/// <param name="property">The graph property that may be included.</param>
		/// <returns>A boolean value indicating whether to include the property.</returns>
		public virtual bool InClientModel(GraphProperty property)
		{
			return !(property is GraphValueProperty) || 
				ServiceMethod.GetJsonValueType(((GraphValueProperty)property).PropertyType) != null;
		}

		/// <summary>
		/// Allows the service adapter to perform custom logic before a 
		/// graph instance is serialized within an ExoWeb service method.
		/// </summary>
		/// <param name="instance">The graph instance that will be serialized.</param>
		public virtual void BeforeSerializeInstance(GraphInstance instance)
		{
		}

		public virtual string GetLabel(GraphProperty property)
		{
			return null;
		}
	}

	#endregion
}
