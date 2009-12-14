using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Runtime.Serialization;
using System.Xml;
using System.Runtime.Serialization.Json;
using System.ServiceModel.Dispatcher;
using System.IO;
using System.Web;
using ExoGraph;

namespace ExoWeb
{
	/// <summary>
	/// Base class for web methods exposed by the service.
	/// </summary>
	[DataContract]
	internal abstract class ServiceMethod
	{
		internal abstract void Invoke(HttpResponse response);

		#region JSON Serialization

		static Dictionary<Type, string> jsonIntrinsicTypes = new Dictionary<Type, string>();

		static ServiceMethod()
		{
			jsonIntrinsicTypes[typeof(string)] = "String";
			jsonIntrinsicTypes[typeof(bool)] = "Boolean";
			jsonIntrinsicTypes[typeof(byte)] = "Number";
			jsonIntrinsicTypes[typeof(int)] = "Number";
			jsonIntrinsicTypes[typeof(long)] = "Number";
			jsonIntrinsicTypes[typeof(float)] = "Number";
			jsonIntrinsicTypes[typeof(double)] = "Number";
			jsonIntrinsicTypes[typeof(decimal)] = "Number";
			jsonIntrinsicTypes[typeof(DateTime)] = "Date";
		}

		protected static string GetJsonValueType(Type type)
		{
			string jsonType;
			if (jsonIntrinsicTypes.TryGetValue(type, out jsonType))
				return jsonType;

			return null;
		}
	
		// Cache a converter to serialize and deserialize JSON data
		static JsonQueryStringConverter converter = new JsonQueryStringConverter();

		/// <summary>
		/// Deserializes a JSON string into the specified type.
		/// </summary>
		/// <typeparam name="T"></typeparam>
		/// <param name="json"></param>
		/// <returns></returns>
		protected static T FromJson<T>(string json)
		{
			return (T)FromJson(typeof(T), json);
		}

		/// <summary>
		/// Deserializes a JSON string into the specified type.
		/// </summary>
		/// <typeparam name="T"></typeparam>
		/// <param name="json"></param>
		/// <returns></returns>
		protected static object FromJson(Type type, string json)
		{
			byte[] bytes = Encoding.UTF8.GetBytes(json);
			XmlDictionaryReader reader = JsonReaderWriterFactory.CreateJsonReader(bytes, 0, bytes.Length, Encoding.UTF8, XmlDictionaryReaderQuotas.Max, null);
			// DataContractJsonSerializer serializer = new DataContractJsonSerializer(type, Type.EmptyTypes, Int32.MaxValue, true, new ContractSurrogate(), false);
			DataContractJsonSerializer serializer = new DataContractJsonSerializer(type);
			return serializer.ReadObject(reader);
		}

		/// <summary>
		/// Serializes a typed value into a JSON string.
		/// </summary>
		/// <param name="type"></param>
		/// <param name="value"></param>
		/// <returns></returns>
		protected static string ToJson(Type type, object value)
		{
			MemoryStream stream = new MemoryStream();
			XmlDictionaryWriter writer = JsonReaderWriterFactory.CreateJsonWriter(stream, Encoding.UTF8);
			//DataContractJsonSerializer serializer = new DataContractJsonSerializer(type, Type.EmptyTypes, Int32.MaxValue, true, new ContractSurrogate(), false);
			DataContractJsonSerializer serializer = new DataContractJsonSerializer(type);
			serializer.WriteObject(writer, value);
			writer.Flush();
			stream.Seek(0L, SeekOrigin.Begin);
			return Encoding.UTF8.GetString(stream.GetBuffer(), (int)stream.Position, (int)stream.Length);
		}

		#endregion

		/// <summary>
		/// Invokes a service method that returns reads and writes JSON for the current HTTP request.
		/// </summary>
		/// <param name="context"></param>
		internal static void Invoke(HttpContext context)
		{
			// Read the request JSON
			string request;
			if (context.Request.RequestType == "GET")
			{
				request = "{";
				foreach (string property in context.Request.QueryString.AllKeys)
					request += "\"" + property + "\":" + context.Request.QueryString[property] + ",";
				request = request.Substring(0, request.Length - 1) + "}";
			}
			else
			{
				using (StreamReader reader = new StreamReader(context.Request.InputStream))
					request = reader.ReadToEnd();
			}

			// Determine the service method being called
			Type method = Type.GetType("ExoWeb." + context.Request.PathInfo.Substring(1) + "Method");

			// Set the content type to application/json
			if (context.Request.QueryString["Debug"] == "true")
				context.Response.ContentType = "text/plain";
			else
				context.Response.ContentType = "application/json";
	
			// Deserialize and invoke the service method
			((ServiceMethod)FromJson(method, request)).Invoke(context.Response);
		}
	}
}
