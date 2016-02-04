using System;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Jurassic.Library;
using ExoModel;
using System.Threading;
using System.Collections;
using ExoModel.UnitTests.Models;
using ExoWeb.UnitTests.Models.Requests;
using FluentAssertions;

namespace ExoWeb.UnitTests
{
	[TestClass]
	[TestModel(Name = "Requests")]
	public partial class JavaScriptTests : TestModelBase
	{
#if SLOW
		[TestMethod]
#endif
		public void TestEntitiesArentLeaked()
		{
			int finalizeCount = 0;

			Allocate(delegate { ++finalizeCount; });

			int expectedFinalizedCount = 1;

			// force GC, ensure entities are collected
			for (int i = 0; i < 100 && finalizeCount < expectedFinalizedCount; ++i)
			{
				GC.Collect();
				Thread.Sleep(100);
				GC.Collect(i % (GC.MaxGeneration+1), GCCollectionMode.Forced);
				Thread.Sleep(100);
			}

			Assert.AreEqual(expectedFinalizedCount, finalizeCount, "objects should be garbage collected");
		}

		[TestMethod]
		public void TestCompiledExpressions()
		{	
			// basic test to make sure functions compile
			var plus = Accessors.CreateScriptFunction("a", "b", "a + b");
			Assert.AreEqual(1.0 + 2.0, plus(1.0, 2.0));

			// create a second function with same arg names to test function isolation
			var minus = Accessors.CreateScriptFunction("a", "b", "a - b");
			Assert.AreEqual(1.0 - 2.0, minus(1.0, 2.0));
			Assert.AreEqual(1.0 + 2.0, plus(1.0, 2.0));

			// make sure arguments are declared locally (in above functions)
			try
			{
				Accessors.CreateScriptFunction("a", "b");
				Assert.Fail("Should not be able to reference undefined arguments");
			}
			catch { }

			// make sure arguments are local (again)
			var localSideEffects = Accessors.CreateScriptFunction("a", "++a");
			Assert.AreEqual(2.0, localSideEffects(1.0));
			Assert.AreEqual(2.0, localSideEffects(1.0));

			// test full function body
			Assert.AreEqual("xyz", Accessors.CreateScriptFunction("a", "var b=a; return b;", false)("xyz"));
		}

		[TestMethod]
		public void TestCompiledExpressionsSyntaxError()
		{
			try
			{
				Accessors.CreateScriptFunction("a", "a ==== a");
				Assert.Fail("Syntax error should be detected");
			}
			catch(Exception e)
			{
				Assert.IsTrue(e.GetType().Name.EndsWith("ScriptFunctionSyntaxException"), "a special syntax exception should be thrown");
			}
		}

		[TestMethod]
		public void TestCompiledExpressionsObjectMarshaling()
		{
			var data = new Request
			{
				User = new User()
			};

			var path = Accessors.CreateScriptFunction("arg", "arg.get_User()");
			Assert.AreEqual(((IModelInstance)data.User).Instance, path(((IModelInstance)data).Instance), "marshal ModelInstance");

			var f = Accessors.CreateScriptFunction("arg", "arg");
			Assert.AreEqual(true, f(true));
			Assert.AreEqual("abc", f("abc"));
			Assert.AreEqual(1.0, f(1.0));
			Assert.AreEqual(((IModelInstance)data).Instance, f(((IModelInstance)data).Instance));
		}

		[TestMethod]
		public void TestCompiledExpressionsNullAndUndefinedMarshalling()
		{
			Assert.AreEqual(true, Accessors.CreateScriptFunction("x", "x === null")(null), "marshal null === null");
			Assert.AreEqual(true, Accessors.CreateScriptFunction("x", "x !== undefined")(null), "marshal null !== undefined");
			Assert.AreEqual(null, Accessors.CreateScriptFunction("x", "null")(null), "marshal return null");
			Assert.AreEqual(null, Accessors.CreateScriptFunction("x", "undefined")(null), "marshal return undefined");
		}

		[TestMethod]
		public void TestCompiledExpressionsFunctionMarshaling()
		{
			int value = 7;

			var add = Accessors.CreateScriptFunction("arg", "arg(3)");
			Assert.AreEqual(
				value + 3,
				add((Func<int, int>)(i => value + i)),
				"marshal ModelInstance");
		}

		[TestMethod]
		public void TestMetaProperty()
		{
			var data = new Request
			{
				User = new User { UserName = "auser" },
				Description = "abc123"
			};

			TestEntityExpression(data, "$instance.meta.id", ((IModelInstance)data).Instance.Id);
			TestEntityExpression(data, "$instance.get_User().meta.id", ((IModelInstance)data.User).Instance.Id);
		}

		[TestMethod]
		public void TestValueProperties()
		{
			var data = new Request
			{
				Description = "abc123"
			};

			TestEntityExpression(data, "$instance.get_Description()", data.Description);
		}

		[TestMethod]
		public void TestReferenceProperties()
		{
			var data = new Request
			{
				User = new User { UserName = "some_user" }
			};

			TestEntityExpression(data, "$instance.get_User().get_UserName()", data.User.UserName);
		}

		[TestMethod]
		public void TestSetterPropertiesArentValid()
		{
			var data = new Request
			{
				Description = "abc123"
			};

			TestEntityException(data, "$instance.set_Description('newvalue')", e => true);
		}

		[TestMethod]
		public void TestPropertyGetPrefixRequired()
		{
			var data = new Request
			{
				Description = "abc123"
			};

			TestEntityException(data, "$instance.Description", e => true);
		}

		[TestMethod]
		public void TestUnknownProperty()
		{
			var data = new Request
			{
				Description = "abc123"
			};

			TestEntityException(data, "$instance.get_UNKNOWN('newvalue')", e => e.GetType().Name == "InvalidPropertyException");
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
			TestEntityExpression(data, "$instance.get_Description === $instance.get_Description", true);

			// reference property function
			TestEntityExpression(data, "$instance.get_User === $instance.get_User", true);

			// reference property valye
			TestEntityExpression(data, "$instance.get_User() === $instance.get_User()", true);

			// meta property
			TestEntityExpression(data, "$instance.meta === $instance.meta", true);
		}


		[TestMethod]
		public void TestAdapterIsList()
		{
			// single hop - item
			TestAdapterExpression(new Request(), "User", "$instance.get_isList()", false);

			// single hop - list
			TestAdapterExpression(new Category(), "ChildCategories", "$instance.get_isList()", true);
		}

		[TestMethod]
		public void TestAdapterWithNulls()
		{
			// multi hop - item w/ nulls
			TestAdapterExpression(new Request(), "Category.ParentCategory", "$instance.get_isList()", false);

			// multi hop - list w/ nulls
			TestAdapterExpression(new Request(), "Category.ChildCategories", "$instance.get_isList()", true);
		}

		[TestMethod]
		public void TestExpressionsReturningFunctions()
		{
			var functionGenerator = Accessors.CreateScriptFunction("a", "function(x) {return x;}");

			var f = (FunctionInstance)functionGenerator("1");
			Assert.AreEqual("abc", f.Call(null, "abc"));
		}

		[TestMethod]
		public void TestEntityArrays()
		{
			var data = new Category() { Name = "parent "};
			data.ChildCategories.Add(new Category() { Name = "child1"});
			data.ChildCategories.Add(new Category() { Name = "child2" });

			var echo = Accessors.CreateScriptFunction("list", "list");
			AssertLists.AreSame(data.ChildCategories, (IEnumerable)echo(data.ChildCategories), "lists should be the same");

			// test wrap/unwrap
			Assert.AreEqual((uint)data.ChildCategories.Count, Accessors.CreateScriptFunction("list", "list.length")(data.ChildCategories));

			// make sure the list is an array
			Assert.AreEqual((uint)data.ChildCategories.Count, Accessors.CreateScriptFunction("list", "list.length")(data.ChildCategories));

			// test optimization (wrap/unwrap)+
			var unwrapped1 = echo(data.ChildCategories);
			var unwrapped2 = echo(unwrapped1);

			Assert.AreEqual(Accessors.GetUnwrappedArray(unwrapped1), Accessors.GetUnwrappedArray(unwrapped2));
		}

		[TestMethod]
		public void BalancedText()
		{
			string remainder;

			var run = Accessors.GetBalancedText("[outer[inner] []] - extra", '[', ']', out remainder);
			run.Should().Be("[outer[inner] []]");
			remainder.Should().Be(" - extra");

			run = Accessors.GetBalancedText("{Owner{FirstName,LastName}},Tag{Number}", '{', '}', out remainder);
			run.Should().Be("{Owner{FirstName,LastName}}");
			remainder.Should().Be(",Tag{Number}");

			Action openAndClosedAreTheSame = () => Accessors.GetBalancedText("", '|', '|', out remainder);
			openAndClosedAreTheSame.ShouldThrow<ArgumentException>().WithMessage("Open and closed characters cannot be the same.");

			Action doesNotStartWithOpen = () => Accessors.GetBalancedText("abcd", '<', '>', out remainder);
			doesNotStartWithOpen.ShouldThrow<ArgumentException>().WithMessage("Input text must begin with the open character.");

			Action unbalanced = () => Accessors.GetBalancedText("<abc<d>", '<', '>', out remainder);
			unbalanced.ShouldThrow<ArgumentException>().WithMessage("The input text is not balanced.");

			Action missingEnd = () => Accessors.GetBalancedText("<abcd", '<', '>', out remainder);
			missingEnd.ShouldThrow<ArgumentException>().WithMessage("The input text is not valid.");
		}
	}
}
