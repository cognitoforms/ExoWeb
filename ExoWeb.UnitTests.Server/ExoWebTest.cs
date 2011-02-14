using ExoWeb;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System;
using System.Collections.Generic;

namespace ExoWeb.UnitTests.Server
{
	/// <summary>
	///This is a test class for ExoWebTest and is intended
	///to contain all ExoWebTest Unit Tests
	///</summary>
	[TestClass()]
	public class ExoWebTest
	{
		private TestContext testContextInstance;

		/// <summary>
		///Gets or sets the test context which provides
		///information about and functionality for the current test run.
		///</summary>
		public TestContext TestContext
		{
			get
			{
				return testContextInstance;
			}
			set
			{
				testContextInstance = value;
			}
		}

		#region Additional test attributes
		// 
		//You can use the following additional attributes as you write your tests:
		//
		//Use ClassInitialize to run code before running the first test in the class
		//[ClassInitialize()]
		//public static void MyClassInitialize(TestContext testContext)
		//{
		//}
		//
		//Use ClassCleanup to run code after all tests in a class have run
		//[ClassCleanup()]
		//public static void MyClassCleanup()
		//{
		//}
		//
		//Use TestInitialize to run code before running each test
		//[TestInitialize()]
		//public void MyTestInitialize()
		//{
		//}
		//
		//Use TestCleanup to run code after each test has run
		//[TestCleanup()]
		//public void MyTestCleanup()
		//{
		//}
		//
		#endregion

		/// <summary>
		///A test for NormalizePaths
		///</summary>
		[TestMethod()]
		[DeploymentItem("ExoWeb.dll")]
		public void NormalizePathsTest()
		{
			NormalizePathsTest(new string[] { }, new string[] { });

			NormalizePathsTest(new string[] { 
				"this.Student"
			}, new string[] {
				"this.Student"
			});

			NormalizePathsTest(new string[] { 
				"this.Student",
				"this.Parent"
			}, new string[] {
				"this.Student",
				"this.Parent"
			});

			NormalizePathsTest(new string[] { 
				"this.Student{Prop1}",
			}, new string[] {
				"this.Student.Prop1",
			});

			NormalizePathsTest(new string[] { 
				"this.Student{Prop1, Prop2}",
			}, new string[] {
				"this.Student.Prop1",
				"this.Student.Prop2",
			});

			NormalizePathsTest(new string[] { 
				"this{Student{Prop1, Prop2}}",
			}, new string[] {
				"this.Student.Prop1",
				"this.Student.Prop2",
			});

			NormalizePathsTest(new string[] { 
				"this.Student{Prop1, Prop2{PropA, PropB}, Prop3}}",
			}, new string[] {
				"this.Student.Prop1",
				"this.Student.Prop2.PropA",
				"this.Student.Prop2.PropB",
				"this.Student.Prop3",
			});

			NormalizePathsTest(new string[] { 
				"this.Student<Type>{Prop1, Prop2}}",
			}, new string[] {
				"this.Student<Type>.Prop1",
				"this.Student<Type>.Prop2",
			});

			NormalizePathsTest(new string[] {
				"this.ItemDef{ItemType.IsRootItemType, IsVersioned, ItemOutcomes.NextStatus, DocumentDefinitions{Inputs, FinalizeType}}"
			}, new string[] {
				"this.ItemDef.ItemType.IsRootItemType",
				"this.ItemDef.IsVersioned",
				"this.ItemDef.ItemOutcomes.NextStatus",
				"this.ItemDef.DocumentDefinitions.Inputs",
				"this.ItemDef.DocumentDefinitions.FinalizeType"
			});

			NormalizePathsTest(new string[] { 
				"this.Student<Type.ABC>{Prop1<A>.Prop3, Prop2}}",
			}, new string[] {
				"this.Student<Type.ABC>.Prop1<A>.Prop3",
				"this.Student<Type.ABC>.Prop2",
			});
		}

		private void NormalizePathsTest(string[] collapsed, string[] expected)
		{
			string[] actual = ExoWeb_Accessor.NormalizePaths(collapsed);

			Assert.AreEqual("\r\n\r\n" + string.Join("\r\n", expected) + "\r\n\r\n", "\r\n\r\n" + string.Join("\r\n", actual) + "\r\n\r\n");
			// verify the arrays have the same elements, without regard for order
			CollectionAssert.IsSubsetOf(actual, expected, "extra paths were returned");
			CollectionAssert.IsSubsetOf(expected, actual, "too few paths were returned");
		}

		[TestMethod]
		public void TraversePathsTest()
		{
			TraversePathsTest(new string[] {
				"this.ItemDef{ItemType.IsRootItemType, IsVersioned, ItemOutcomes.NextStatus, DocumentDefinitions{Inputs, FinalizeType}}"
			}, new string[] {
				"this",
				"this.ItemDef",
				"this.ItemDef.ItemType",
				"this.ItemDef.ItemType.IsRootItemType",
				"this.ItemDef.IsVersioned",
				"this.ItemDef.ItemOutcomes",
				"this.ItemDef.ItemOutcomes.NextStatus",
				"this.ItemDef.DocumentDefinitions",
				"this.ItemDef.DocumentDefinitions.Inputs",
				"this.ItemDef.DocumentDefinitions.FinalizeType"
			});
		}

		private void TraversePathsTest(string[] collapsed, string[] expected)
		{
			List<string> actual = new List<string>();
			ExoWeb_Accessor.TraversePaths(collapsed, (seg, c) =>
			{
				actual.Add(seg);
			});

			Assert.AreEqual("\r\n\r\n" + string.Join("\r\n", expected) + "\r\n\r\n", "\r\n\r\n" + string.Join("\r\n", actual) + "\r\n\r\n");
			// verify the arrays have the same elements, without regard for order
			CollectionAssert.IsSubsetOf(actual, expected, "extra paths were returned");
			CollectionAssert.IsSubsetOf(expected, actual, "too few paths were returned");
		}
	}
}
