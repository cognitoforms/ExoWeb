using System;
using FluentAssertions;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using ExoGraph.UnitTest;
using ExoWeb.Templates.JavaScript;
using System.Collections;
using System.Linq;
using ExoGraph;
using System.Collections.Generic;

namespace ExoWeb.UnitTests.Server.Templates.MicrosoftAjax
{
	[TestClass]
	public class TransformTest
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
		public void BalancedText()
		{
			string run;
			string remainder;

			run = Accessors.GetBalancedText("[outer[inner] []] - extra", '[', ']', out remainder);
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

		[TestMethod]
		public void SimpleWhereFilter()
		{
			DoTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => GraphContext.Current.GetGraphInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "where('User.IsActive')", "where('Category.Name === \"Server\"')");

				Assert.IsNotNull(results);
				var outputInstances = results as IEnumerable<GraphInstance>;
				Assert.IsNotNull(outputInstances);

				Assert.AreEqual(1, outputInstances.Count());

				var outputRequests = outputInstances.Select(i => (Request)i.Instance);
				Assert.AreEqual("Server request", outputRequests.First().Description);
			});
		}

		[TestMethod]
		public void SimpleGrouping()
		{
			DoTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => GraphContext.Current.GetGraphInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "where('User.IsActive')", "groupBy('Category')");

				Assert.IsNotNull(results);
				IEnumerable<object> resultObjects = results.Cast<object>();
				Assert.AreEqual(2, resultObjects.Count());

				object firstGroup = Accessors.GetTransformGroup(resultObjects.First());

				Assert.IsInstanceOfType(firstGroup, typeof(GraphInstance));
				Assert.AreEqual("Server", ((Category)((GraphInstance)firstGroup).Instance).Name);
			});
		}

		[TestMethod]
		public void FilterGrouping()
		{
			DoTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => GraphContext.Current.GetGraphInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "groupBy('User')", "where('group.IsActive')");

				Assert.IsNotNull(results);
				IEnumerable<object> resultObjects = results.Cast<object>();
				Assert.AreEqual(1, resultObjects.Count());

				object firstGroup = Accessors.GetTransformGroup(resultObjects.First());

				Assert.IsInstanceOfType(firstGroup, typeof(GraphInstance));
				Assert.AreEqual("TestUser", ((User)((GraphInstance)firstGroup).Instance).UserName);
			});
		}

		[TestMethod]
		public void DoubleGrouping()
		{
			DoTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => GraphContext.Current.GetGraphInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "groupBy('User')", "groupBy('group.IsActive')", "orderBy('group asc')");

				Assert.IsNotNull(results);
				IEnumerable<object> resultObjects = results.Cast<object>();
				Assert.AreEqual(2, resultObjects.Count());

				object firstGroup = Accessors.GetTransformGroup(resultObjects.First());
				Assert.IsFalse((bool)firstGroup);

				IEnumerable<object> inactiveGroups = Accessors.GetTransformItems(resultObjects.First());
				Assert.AreEqual(1, inactiveGroups.Count());

				object firstInactiveGroup = Accessors.GetTransformGroup(inactiveGroups.First());
				Assert.IsInstanceOfType(firstInactiveGroup, typeof(GraphInstance));
				Assert.AreEqual("ArchivedUser", ((User)((GraphInstance)firstInactiveGroup).Instance).UserName);
			});
		}
		#endregion

		#region Helpers
		private void DoTransform(Action<IEnumerable<Request>> action)
		{
			User user = new User() { IsActive = true, UserName = "TestUser" };
			Category serverCategory = new Category() { Name = "Server" };
			Category clientCategory = new Category() { Name = "Client" };

			Priority normalPriority = new Priority() { Name = "Normal" };
			Priority lowPriority = new Priority() { Name = "Low" };

			Request request1 = new Request();
			request1.User = user;
			request1.Category = serverCategory;
			request1.Priority = normalPriority;
			request1.Description = "Server request";

			Request request2 = new Request();
			request2.User = user;
			request2.Category = clientCategory;
			request2.Priority = normalPriority;
			request2.Description = "Client request";

			Request request3 = new Request();
			request3.User = user;
			request3.Category = clientCategory;
			request3.Priority = lowPriority;
			request3.Description = "Low priority client request";

			User archivedUser = new User() { IsActive = false, UserName = "ArchivedUser" };

			Request archivedRequest = new Request();
			archivedRequest.User = archivedUser;
			archivedRequest.Category = new Category() { Name = "Legacy" };
			archivedRequest.Priority = lowPriority;
			archivedRequest.Description = "Archived request";

			action(new Request[] { request1, request2, request3, archivedRequest });
		}
		#endregion
		
	}
}
