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

			TestEntityExpression(data, "$data.meta.id", ((IGraphInstance)data).Instance.Id);
			TestEntityExpression(data, "$data.get_User().meta.id", ((IGraphInstance)data.User).Instance.Id);
		}

		[TestMethod]
		public void TestValueProperties()
		{
			var data = new Request
			{
				Description = "abc123"
			};

			TestEntityExpression(data, "$data.get_Description()", data.Description);
		}

		[TestMethod]
		public void TestReferenceProperties()
		{
			var data = new Request
			{
				User = new User { UserName = "some_user" }
			};

			TestEntityExpression(data, "$data.get_User().get_UserName()", data.User.UserName);
		}

		[TestMethod]
		public void TestSetterPropertiesArentValid()
		{
			var data = new Request
			{
				Description = "abc123"
			};

			TestEntityException(data, "$data.set_Description('newvalue')", e => true);
		}

		[TestMethod]
		public void TestPropertyGetPrefixRequired()
		{
			var data = new Request
			{
				Description = "abc123"
			};

			TestEntityException(data, "$data.Description", e => true);
		}

		[TestMethod]
		public void TestUnknownProperty()
		{
			var data = new Request
			{
				Description = "abc123"
			};

			TestEntityException(data, "$data.get_UNKNOWN('newvalue')", e => e.GetType().Name == "InvalidPropertyException");
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
			TestEntityExpression(data, "$data.get_Description === $data.get_Description", true);

			// reference property function
			TestEntityExpression(data, "$data.get_User === $data.get_User", true);

			// reference property valye
			TestEntityExpression(data, "$data.get_User() === $data.get_User()", true);

			// meta property
			TestEntityExpression(data, "$data.meta === $data.meta", true);
		}


		[TestMethod]
		public void TestAdapterIsList()
		{
			// single hop - item
			TestAdapterExpression(new Request(), "User", "$data.isList()", false);

			// single hop - list
			TestAdapterExpression(new Category(), "ChildCategories", "$data.isList()", true);

			// multi hop - list
			// broken: TestAdapterExpression(new Request(), "Category.ChildCategories", "$data.isList()", true);
		}
		#endregion

		#region Helpers
		void TestExpression<T>(Func<ScriptEngine, object> dataFactory, string javascript, T expectedResult)
		{
			var engine = new Jurassic.ScriptEngine();
			engine.ForceStrictMode = true;

			engine.SetGlobalValue("$data", dataFactory(engine));
			var result = engine.Evaluate<T>(javascript);

			Assert.AreEqual(expectedResult, result, javascript + " ---> " + expectedResult);
		}

		void TestAdapterExpression<T>(IGraphInstance data, string propertyName, string javascript, T expectedResult)
		{
			TestExpression(engine => Accessors.CreateAdapter(engine, data, propertyName), javascript, expectedResult);
		}

		void TestEntityExpression<T>(IGraphInstance data, string javascript, T expectedResult)
		{
			TestExpression(engine => Accessors.CreateEntity(engine, data), javascript, expectedResult);
		}

		void TestEntityException(IGraphInstance data, string javascript, Predicate<Exception> expected)
		{
			var engine = new Jurassic.ScriptEngine();
			engine.ForceStrictMode = true;
			engine.SetGlobalValue("$data", Accessors.CreateEntity(engine, data));

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
