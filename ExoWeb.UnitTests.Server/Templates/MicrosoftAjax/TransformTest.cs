using System;
using FluentAssertions;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using ExoModel.UnitTest;
using ExoWeb.Templates.JavaScript;
using System.Collections;
using System.Linq;
using ExoModel;
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
			ModelContext.Init(new TestModelTypeProvider());
		}
		#endregion

		#region Tests
		[TestMethod]
		public void WhereExpression_WhereExpression()
		{
			DoRequestTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => ModelContext.Current.GetModelInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "where('User.IsActive')", "where('Category.Name === \"Server\"')");

				Assert.IsNotNull(results);
				var outputInstances = results as IEnumerable<ModelInstance>;
				Assert.IsNotNull(outputInstances);

				Assert.AreEqual(1, outputInstances.Count());

				var outputRequests = outputInstances.Select(i => (Request)i.Instance);
				Assert.AreEqual("Server request", outputRequests.First().Description);
			});
		}

		[TestMethod]
		public void WhereExpression_GroupByExpression()
		{
			DoRequestTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => ModelContext.Current.GetModelInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "where('User.IsActive')", "groupBy('Category')");

				Assert.IsNotNull(results);
				IEnumerable<object> resultObjects = results.Cast<object>();
				Assert.AreEqual(2, resultObjects.Count());

				object firstGroup = Accessors.GetTransformGroup(resultObjects.First());

				Assert.IsInstanceOfType(firstGroup, typeof(ModelInstance));
				Assert.AreEqual("Server", ((Category)((ModelInstance)firstGroup).Instance).Name);
			});
		}

		[TestMethod]
		public void GroupByExpression_FilterExpression()
		{
			DoRequestTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => ModelContext.Current.GetModelInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "groupBy('User')", "where('group.IsActive')");

				Assert.IsNotNull(results);
				IEnumerable<object> resultObjects = results.Cast<object>();
				Assert.AreEqual(1, resultObjects.Count());

				object firstGroup = Accessors.GetTransformGroup(resultObjects.First());

				Assert.IsInstanceOfType(firstGroup, typeof(ModelInstance));
				Assert.AreEqual("TestUser", ((User)((ModelInstance)firstGroup).Instance).UserName);
			});
		}

		[TestMethod]
		public void GroupByExpression_GroupByExpression_OrderByExpression()
		{
			DoRequestTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => ModelContext.Current.GetModelInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "groupBy('User')", "groupBy('group.IsActive')", "orderBy('group asc')");

				Assert.IsNotNull(results);
				IEnumerable<object> resultObjects = results.Cast<object>();
				Assert.AreEqual(2, resultObjects.Count());

				object firstGroup = Accessors.GetTransformGroup(resultObjects.First());
				Assert.IsFalse((bool)firstGroup);

				IEnumerable<object> inactiveGroups = Accessors.GetTransformItems(resultObjects.First());
				Assert.AreEqual(1, inactiveGroups.Count());

				object firstInactiveGroup = Accessors.GetTransformGroup(inactiveGroups.First());
				Assert.IsInstanceOfType(firstInactiveGroup, typeof(ModelInstance));
				Assert.AreEqual("ArchivedUser", ((User)((ModelInstance)firstInactiveGroup).Instance).UserName);
			});
		}

		[TestMethod]
		public void SelectExpression()
		{
			DoRequestTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => ModelContext.Current.GetModelInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "select('User')");

				Assert.IsNotNull(results);
				Assert.AreEqual(4, results.Cast<object>().Count());

				var outputUsers = results.Cast<ModelInstance>().Select(i => (User)i.Instance);
				Assert.AreEqual(string.Join(",", requests.Select(r => r.User.UserName).ToArray()), string.Join(",", outputUsers.Select(u => u.UserName).ToArray()));
			});
		}

		[TestMethod]
		public void SelectExpression_WhereExpression()
		{
			DoRequestTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => ModelContext.Current.GetModelInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "select('User')", "where('IsActive')");

				Assert.IsNotNull(results);
				Assert.AreEqual(3, results.Cast<object>().Count());

				var outputUsers = results.Cast<ModelInstance>().Select(i => (User)i.Instance);
				Assert.AreEqual(string.Join(",", requests.Where(r => r.User.IsActive).Select(r => r.User.UserName).ToArray()), string.Join(",", outputUsers.Select(u => u.UserName).ToArray()));
			});
		}

		[TestMethod]
		public void SelectFunction()
		{
			DoRequestTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => ModelContext.Current.GetModelInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "select(function(obj) { return obj.get_User(); })");

				Assert.IsNotNull(results);
				Assert.AreEqual(4, results.Cast<object>().Count());

				var outputUsers = results.Cast<ModelInstance>().Select(i => (User)i.Instance);
				Assert.AreEqual(string.Join(",", requests.Select(r => r.User.UserName).ToArray()), string.Join(",", outputUsers.Select(u => u.UserName).ToArray()));
			});
		}

		[TestMethod]
		public void SelectFunction_WhereExpression()
		{
			DoRequestTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => ModelContext.Current.GetModelInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "select(function(obj) { return obj.get_User(); })", "where('IsActive')");

				Assert.IsNotNull(results);
				Assert.AreEqual(3, results.Cast<object>().Count());

				var outputUsers = results.Cast<ModelInstance>().Select(i => (User)i.Instance);
				Assert.AreEqual(string.Join(",", requests.Where(r => r.User.IsActive).Select(r => r.User.UserName).ToArray()), string.Join(",", outputUsers.Select(u => u.UserName).ToArray()));
			});
		}

		[TestMethod]
		public void SelectManyExpression()
		{
			DoUserTransform(users =>
			{
				IEnumerable inputInstances = users.Select(r => ModelContext.Current.GetModelInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "selectMany('Requests')");

				Assert.IsNotNull(results);
				Assert.AreEqual(4, results.Cast<object>().Count());

				var outputRequests = results.Cast<ModelInstance>().Select(i => (Request)i.Instance);
				Assert.AreEqual(string.Join(",", users.SelectMany(u => u.Requests).Select(r => r.Description).ToArray()), string.Join(",", outputRequests.Select(r => r.Description).ToArray()));
			});
		}

		[TestMethod]
		public void SelectManyExpression_WhereExpression()
		{
			DoUserTransform(users =>
			{
				IEnumerable inputInstances = users.Select(r => ModelContext.Current.GetModelInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "selectMany('Requests')", "where('User.IsActive')");

				Assert.IsNotNull(results);
				Assert.AreEqual(3, results.Cast<object>().Count());

				var outputRequests = results.Cast<ModelInstance>().Select(i => (Request)i.Instance);
				Assert.AreEqual(string.Join(",", users.SelectMany(u => u.Requests).Where(r => r.User.IsActive).Select(r => r.Description).ToArray()), string.Join(",", outputRequests.Select(r => r.Description).ToArray()));
			});
		}

		[TestMethod]
		public void SelectManyFunction()
		{
			DoUserTransform(users =>
			{
				IEnumerable inputInstances = users.Select(r => ModelContext.Current.GetModelInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "selectMany(function(obj) { return obj.get_Requests(); })");

				Assert.IsNotNull(results);
				Assert.AreEqual(4, results.Cast<object>().Count());

				var outputRequests = results.Cast<ModelInstance>().Select(i => (Request)i.Instance);
				Assert.AreEqual(string.Join(",", users.SelectMany(u => u.Requests).Select(r => r.Description).ToArray()), string.Join(",", outputRequests.Select(r => r.Description).ToArray()));
			});
		}

		[TestMethod]
		public void SelectManyFunction_WhereExpression()
		{
			DoUserTransform(users =>
			{
				IEnumerable inputInstances = users.Select(r => ModelContext.Current.GetModelInstance(r));

				IEnumerable results = Accessors.DoTransform(inputInstances, "selectMany(function(obj) { return obj.get_Requests(); })", "where('User.IsActive')");

				Assert.IsNotNull(results);
				Assert.AreEqual(3, results.Cast<object>().Count());

				var outputRequests = results.Cast<ModelInstance>().Select(i => (Request)i.Instance);
				Assert.AreEqual(string.Join(",", users.SelectMany(u => u.Requests).Where(r => r.User.IsActive).Select(r => r.Description).ToArray()), string.Join(",", outputRequests.Select(r => r.Description).ToArray()));
			});
		}

		#endregion

		#region Helpers
		private void CreateTransformData(Action<User, Request, Request, Request, User, Request> action)
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
			user.Requests.Add(request1);

			Request request2 = new Request();
			request2.User = user;
			request2.Category = clientCategory;
			request2.Priority = normalPriority;
			request2.Description = "Client request";
			user.Requests.Add(request2);

			Request request3 = new Request();
			request3.User = user;
			request3.Category = clientCategory;
			request3.Priority = lowPriority;
			request3.Description = "Low priority client request";
			user.Requests.Add(request3);

			User archivedUser = new User() { IsActive = false, UserName = "ArchivedUser" };

			Request archivedRequest = new Request();
			archivedRequest.User = archivedUser;
			archivedRequest.Category = new Category() { Name = "Legacy" };
			archivedRequest.Priority = lowPriority;
			archivedRequest.Description = "Archived request";
			archivedUser.Requests.Add(archivedRequest);

			action(user, request1, request2, request3, archivedUser, archivedRequest);
		}

		private void DoRequestTransform(Action<IEnumerable<Request>> action)
		{
			CreateTransformData((user, request1, request2, request3, archivedUser, archivedRequest) => action(new Request[] { request1, request2, request3, archivedRequest }));
		}

		private void DoUserTransform(Action<IEnumerable<User>> action)
		{
			CreateTransformData((user, request1, request2, request3, archivedUser, archivedRequest) => action(new User[] { user, archivedUser }));
		}
		#endregion
		
	}
}
