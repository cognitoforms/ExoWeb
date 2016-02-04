using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Jasmine
{
	[TestClass]
	public class CoreSpecTests : BaseJasmineSpecTests
	{
		public CoreSpecTests() : base("..\\ExoWeb\\Client\\specs\\base\\core") { }

		[TestMethod]
		public void ArraySpecs()
		{
			RunSpec("ArraySpecs.js");
		}

		[TestMethod]
		public void BatchSpecs()
		{
			RunSpec("BatchSpecs.js");
		}

		[TestMethod]
		public void DateSpecs()
		{
			RunSpec("DateSpecs.js");
		}

		[TestMethod]
		public void FunctionSpecs()
		{
			RunSpec("FunctionSpecs.js");
		}

		[TestMethod]
		public void FunctionChainSpecs()
		{
			RunSpec("FunctionChainSpecs.js");
		}

		[TestMethod]
		public void RandomSpecs()
		{
			RunSpec("RandomSpecs.js");
		}

		[TestMethod]
		public void SignalSpecs()
		{
			RunSpec("SignalSpecs.js");
		}

		[TestMethod]
		public void TransformSpecs()
		{
			RunSpec("TransformSpecs.js");
		}

		[TestMethod]
		public void TranslatorSpecs()
		{
			RunSpec("TranslatorSpecs.js");
		}

		[TestMethod]
		public void TypeCheckingSpecs()
		{
			RunSpec("TypeCheckingSpecs.js");
		}

		[TestMethod]
		public void UtilitiesSpecs()
		{
			RunSpec("UtilitiesSpecs.js");
		}
	}
}
