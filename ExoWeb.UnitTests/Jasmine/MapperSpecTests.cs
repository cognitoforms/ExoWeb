using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Jasmine
{
	[TestClass]
	public class MapperSpecTests : BaseJasmineSpecTests
	{
		public MapperSpecTests() : base("..\\ExoWeb\\Client\\specs\\base\\mapper") { }

		[TestMethod]
		public void ChangeLogSpecs()
		{
			RunSpec("ChangeLogSpecs.js");
		}

		[TestMethod]
		public void ChangeSetSpecs()
		{
			RunSpec("ChangeSetSpecs.js");
		}

		[TestMethod]
		public void ResponseHandlerSpecs()
		{
			RunSpec("ResponseHandlerSpecs.js");
		}
	}
}
