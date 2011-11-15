using System;
using System.IO;
using System.Linq;
using ExoWeb.Templates.MicrosoftAjax;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Server.Jasmine
{
	[TestClass]
	public class Core : JasmineTest
	{
		public Core() : base("ExoWeb\\Client\\specs\\base\\core") { }

		[TestMethod]
		public void Array()
		{
			RunSpec("test_Array.js");
		}

		[TestMethod]
		public void Batch()
		{
			RunSpec("test_Batch.js");
		}

		[TestMethod]
		public void Date()
		{
			RunSpec("test_Date.js");
		}

		[TestMethod]
		public void Function()
		{
			RunSpec("test_Function.js");
		}

		[TestMethod]
		public void FunctionChain()
		{
			RunSpec("test_FunctionChain.js");
		}

		[TestMethod]
		public void MessageQueue()
		{
			RunSpec("test_MessageQueue.js");
		}

		[TestMethod]
		public void Random()
		{
			RunSpec("test_Random.js");
		}

		[TestMethod]
		public void Signal()
		{
			RunSpec("test_Signal.js");
		}

		[TestMethod]
		public void Transform()
		{
			RunSpec("test_Transform.js");
		}

		[TestMethod]
		public void Translator()
		{
			RunSpec("test_Translator.js");
		}

		[TestMethod]
		public void TypeChecking()
		{
			RunSpec("test_TypeChecking.js");
		}

		[TestMethod]
		public void Utilities()
		{
			RunSpec("test_Utilities.js");
		}
	}
}
