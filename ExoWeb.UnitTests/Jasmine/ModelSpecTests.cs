using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Jasmine
{
	[TestClass]
	public class ModelSpecTests : BaseJasmineSpecTests
	{
		public ModelSpecTests() : base("..\\ExoWeb\\Client\\specs\\base\\model") { }

		[TestMethod]
		public void LazyLoaderSpecs()
		{
			RunSpec("LazyLoaderSpecs.js");
		}

		[TestMethod]
		public void ModelSpecs()
		{
			RunSpec("ModelSpecs.js");
		}

		[TestMethod]
		public void PathTokensSpecs()
		{
			RunSpec("PathTokensSpecs.js");
		}

		[TestMethod]
		public void PropertyChainSpecs()
		{
			RunSpec("PropertyChainSpecs.js");
		}

		[TestMethod]
		public void TypeSpecs()
		{
			RunSpec("TypeSpecs.js");
		}
	}
}
