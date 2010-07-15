using System;
using System.Collections.Generic;
using ExoGraph;
using ExoRule;

namespace ExoWeb
{
	#region ServiceAdapter

	public abstract class ServiceAdapter
	{
		public abstract IEnumerable<ConditionType> GetConditionTypes(GraphType type);

		/// <summary>
		/// 
		/// </summary>
		protected event Action<ServiceMethod> BeforeMethod;

		internal void OnBeforeMethod(ServiceMethod method)
		{
			if (BeforeMethod != null)
			{
				BeforeMethod(method);
			}
		}

		/// <summary>
		/// 
		/// </summary>
		protected event Action<ServiceMethod> AfterMethod;

		internal void OnAfterMethod(ServiceMethod method)
		{
			if (AfterMethod != null)
			{
				AfterMethod(method);
			}
		}

		/// <summary>
		/// Returns the default display format name for the given graph property.
		/// </summary>
		/// <param name="property">The graph property</param>
		/// <returns>The default display format name</returns>
		public abstract string GetFormatName(GraphProperty property);

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
