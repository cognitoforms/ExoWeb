using System;
using System.Text;
using System.Collections.Generic;
using System.Linq;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Jurassic;
using Jurassic.Library;
using ExoGraph.UnitTest;
using System.Reflection;
using ExoGraph;

namespace ExoWeb.UnitTests.Server
{
	[TestClass]
	public class JavascriptTest
	{
		#region Events
		[TestInitialize]
		public void CreateContext()
		{
			GraphContext.Init(new TestGraphTypeProvider());
		}
		#endregion

		#region Tests
		[TestMethod]
		public void TestMetaProperty()
		{
			var data = new Request
			{
				User = new User { UserName = "auser" },
				Description = "abc123"
			};

			TestExpression(data, "$data.meta.id", ((IGraphInstance)data).Instance.Id);
			TestExpression(data, "$data.get_User().meta.id", ((IGraphInstance)data.User).Instance.Id);
		}

		[TestMethod]
		public void TestValueProperties()
		{
			var data = new Request
			{
				Description = "abc123"
			};

			TestExpression(data, "$data.get_Description()", data.Description);
		}

		[TestMethod]
		public void TestReferenceProperties()
		{
			var data = new Request
			{
				User = new User { UserName = "some_user" }
			};

			TestExpression(data, "$data.get_User().get_UserName()", data.User.UserName);
		}

		[TestMethod]
		public void TestSetterPropertiesArentValid()
		{
			var data = new Request
			{
				Description = "abc123"
			};

			TestException(data, "$data.set_Description('newvalue')", e => true);
		}

		[TestMethod]
		public void TestPropertyGetPrefixRequired()
		{
			var data = new Request
			{
				Description = "abc123"
			};

			TestException(data, "$data.Description", e => true);
		}

		[TestMethod]
		public void TestUnknownProperty()
		{
			var data = new Request
			{
				Description = "abc123"
			};

			TestException(data, "$data.get_UNKNOWN('newvalue')", e => e.GetType().Name == "InvalidPropertyException");
		}

		[TestMethod]
		public void TestEntityPropertyEquality()
		{
			var data = new Request
			{
				Description = "abc123",
				User = new User { UserName = "auser" }
			};

			// value property function
			TestExpression(data, "$data.get_Description === $data.get_Description", true);

			// reference property function
			TestExpression(data, "$data.get_User === $data.get_User", true);

			// reference property valye
			TestExpression(data, "$data.get_User() === $data.get_User()", true);

			// meta property
			TestExpression(data, "$data.meta === $data.meta", true);
		}
		#endregion

		#region Helpers
		void TestExpression<T>(IGraphInstance data, string javascript, T expectedResult)
		{
			var engine = new Jurassic.ScriptEngine();
			engine.ForceStrictMode = true;

			engine.SetGlobalValue("$data", EntityAccessor.CreateEntity(engine, data));
			var result = engine.Evaluate<T>(javascript);
			
			Assert.AreEqual(expectedResult, result, javascript + " ---> " + expectedResult);
		}

		void TestException(IGraphInstance data, string javascript, Predicate<Exception> expected)
		{
			var engine = new Jurassic.ScriptEngine();
			engine.ForceStrictMode = true;
			engine.SetGlobalValue("$data", EntityAccessor.CreateEntity(engine, data));

			try
			{
				var result = engine.Evaluate(javascript);
				Assert.Fail("Expected an exception but one was not thrown: " + javascript);
			}
			catch (Exception error)
			{
				Assert.IsTrue(expected(error), "An error was expected but not '" + error.Message + "': " + javascript);
				return;
			}
		}
		#endregion
	}
}
