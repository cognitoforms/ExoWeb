using System;
using ExoModel;
using ExoWeb.UnitTests.Models.Requests;
using Jurassic;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests
{
	public partial class JavaScriptTests
	{
		private static void Allocate(EventHandler onFinalized)
		{
			var data = new Request
			{
				Description = "asdasdasd"
			};

			data.Finalized += onFinalized;
		}

		private static void TestExpression<T>(Func<ScriptEngine, object> instanceFactory, string javascript, T expectedResult)
		{
			var engine = new ScriptEngine();
			engine.ForceStrictMode = true;

			engine.SetGlobalValue("$instance", instanceFactory(engine));
			var result = engine.Evaluate<T>(javascript);

			Assert.AreEqual(expectedResult, result, javascript + " ---> " + expectedResult);
		}

		private static void TestAdapterExpression<T>(object instance, string propertyName, string javascript, T expectedResult)
		{
			TestExpression(engine => Accessors.CreateAdapter(engine, (IModelInstance)instance, propertyName), javascript, expectedResult);
		}

		private static void TestEntityExpression<T>(object instance, string javascript, T expectedResult)
		{
			TestExpression(engine => Accessors.CreateEntity(engine, (IModelInstance)instance), javascript, expectedResult);
		}

		private static void TestEntityException(object instance, string javascript, Predicate<Exception> expected)
		{
			var engine = new ScriptEngine();
			engine.ForceStrictMode = true;
			engine.SetGlobalValue("$instance", Accessors.CreateEntity(engine, (IModelInstance)instance));

			try
			{
				var result = engine.Evaluate(javascript);
				Assert.Fail("Expected an exception but one was not thrown: " + javascript + " --> " + result);
			}
			catch (Exception error)
			{
				Assert.IsTrue(expected(error), "An error was expected but not '" + error.Message + "': " + javascript);
			}
		}
	}
}
