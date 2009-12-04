using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Runtime.Serialization;
using ExoGraph;
using System.Collections.ObjectModel;

namespace ExoWeb
{
	class ContractSurrogate : IDataContractSurrogate
	{
		static Dictionary<Type, Type> surrogateTypes = new Dictionary<Type, Type>();

		static ContractSurrogate()
		{
			surrogateTypes.Add(typeof(GraphInstance), typeof(GraphInstanceSurrogate));
		}

		Dictionary<GraphType, Dictionary<string, GraphInstance>> instances = new Dictionary<GraphType,Dictionary<string,GraphInstance>>();
		Dictionary<GraphInstance, int> newInstanceIds = new Dictionary<GraphInstance,int>();
		int nextInstanceId;

		#region IDataContractSurrogate Members

		object IDataContractSurrogate.GetCustomDataToExport(Type clrType, Type dataContractType)
		{
			throw new NotImplementedException();
		}

		object IDataContractSurrogate.GetCustomDataToExport(System.Reflection.MemberInfo memberInfo, Type dataContractType)
		{
			throw new NotImplementedException();
		}

		Type IDataContractSurrogate.GetDataContractType(Type type)
		{
			Type contractType;
			return surrogateTypes.TryGetValue(type, out contractType) ? contractType : type;
		}

		object IDataContractSurrogate.GetDeserializedObject(object obj, Type targetType)
		{
			if (obj is GraphInstanceSurrogate)
			{
				// Cast the object to a surrogate
				GraphInstanceSurrogate surrogate = (GraphInstanceSurrogate)obj;

				// Get the actual graph type
				GraphType type = GraphContext.Current.GraphTypes[surrogate.Type];

				// Create the type instance cache if not initialized
				Dictionary<string, GraphInstance> typeInstances;
				if (!instances.TryGetValue(type, out typeInstances))
					instances[type] = typeInstances = new Dictionary<string,GraphInstance>();

				// Create the graph instance if it is not in the cache
				GraphInstance instance;
				if (!typeInstances.TryGetValue(surrogate.Id, out instance))
					typeInstances[surrogate.Id] = instance = surrogate.IsNew ? type.Create() : type.Create(surrogate.Id);

				// Return the graph instance
				return instance;
			}

			return obj;
		}

		void IDataContractSurrogate.GetKnownCustomDataTypes(Collection<Type> customDataTypes)
		{ }

		object IDataContractSurrogate.GetObjectToSerialize(object obj, Type targetType)
		{
			if (obj is GraphInstance)
			{
				GraphInstance instance = (GraphInstance)obj;
				GraphInstanceSurrogate surrogate = new GraphInstanceSurrogate();
				surrogate.Type = instance.Type.Name;
				surrogate.IsNew = instance.IsNew;
				
				// Set the id of the surrogate
				if (surrogate.IsNew)
				{
					int id;
					if (!newInstanceIds.TryGetValue(instance, out id))
						newInstanceIds[instance] = id = nextInstanceId++;
					surrogate.Id = id.ToString();
				}
				else
					surrogate.Id = instance.Id;

				return surrogate;
			}

			return obj;
		}

		Type IDataContractSurrogate.GetReferencedTypeOnImport(string typeName, string typeNamespace, object customData)
		{
			throw new NotImplementedException();
		}

		System.CodeDom.CodeTypeDeclaration IDataContractSurrogate.ProcessImportedType(System.CodeDom.CodeTypeDeclaration typeDeclaration, System.CodeDom.CodeCompileUnit compileUnit)
		{
			throw new NotImplementedException();
		}

		#endregion

		#region GraphInstanceSurrogate

		[DataContract]
		class GraphInstanceSurrogate
		{
			[DataMember]
			public string Type;

			[DataMember]
			public string Id;

			[DataMember(EmitDefaultValue = false)]
			public bool IsNew;
		}
		#endregion
	}

}
