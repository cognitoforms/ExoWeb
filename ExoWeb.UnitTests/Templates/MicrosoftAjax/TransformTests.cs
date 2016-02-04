using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Collections;
using System.Linq;
using ExoModel;
using System.Collections.Generic;
using ExoModel.UnitTests.Models;
using ExoWeb.UnitTests.Models.Requests;

namespace ExoWeb.UnitTests.Templates.MicrosoftAjax
{
	[TestClass]
	public partial class TransformTests : TestModelBase
	{
		[TestMethod]
		public void WhereExpression_WhereExpression()
		{
			DoRequestTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => ModelContext.Current.GetModelInstance(r));

				var results = Accessors.DoTransform(inputInstances, "where('User.IsActive')", "where('Category.Name === \"Server\"')");
				Assert.IsNotNull(results);

				Assert.IsInstanceOfType(results, typeof (IEnumerable<ModelInstance>));

				var outputInstances = ((IEnumerable<ModelInstance>)results).ToArray();
				Assert.AreEqual(1, outputInstances.Length);

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

				var results = Accessors.DoTransform(inputInstances, "where('User.IsActive')", "groupBy('Category')");
				Assert.IsNotNull(results);

				var resultsArray = results.Cast<object>().ToArray();
				Assert.AreEqual(2, resultsArray.Length);

				var firstGroup = Accessors.GetTransformGroup(resultsArray.First());

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

				var results = Accessors.DoTransform(inputInstances, "groupBy('User')", "where('group.IsActive')");
				Assert.IsNotNull(results);

				var resultsArray = results.Cast<object>().ToArray();
				Assert.AreEqual(1, resultsArray.Length);

				var firstGroup = Accessors.GetTransformGroup(resultsArray.First());

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

				var results = Accessors.DoTransform(inputInstances, "groupBy('User')", "groupBy('group.IsActive')", "orderBy('group asc')");
				Assert.IsNotNull(results);

				var resultsArray = results.Cast<object>().ToArray();
				Assert.AreEqual(2, resultsArray.Length);

				var firstGroup = Accessors.GetTransformGroup(resultsArray.First());
				Assert.IsFalse((bool)firstGroup);

				var inactiveGroups = Accessors.GetTransformItems(resultsArray.First());
				var inactiveGroupsArray = inactiveGroups.ToArray();
				Assert.AreEqual(1, inactiveGroupsArray.Length);

				var firstInactiveGroup = Accessors.GetTransformGroup(inactiveGroupsArray.First());
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

				var results = Accessors.DoTransform(inputInstances, "select('User')");
				Assert.IsNotNull(results);

				var resultsArray = results.Cast<object>().ToArray();
				Assert.AreEqual(4, resultsArray.Length);

				var outputUsers = resultsArray.Cast<ModelInstance>().Select(i => (User)i.Instance);
				Assert.AreEqual(string.Join(",", requests.Select(r => r.User.UserName).ToArray()), string.Join(",", outputUsers.Select(u => u.UserName).ToArray()));
			});
		}

		[TestMethod]
		public void SelectExpression_WhereExpression()
		{
			DoRequestTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => ModelContext.Current.GetModelInstance(r));

				var results = Accessors.DoTransform(inputInstances, "select('User')", "where('IsActive')");
				Assert.IsNotNull(results);

				var resultsArray = results.Cast<object>().ToArray();
				Assert.AreEqual(3, resultsArray.Length);

				var outputUsers = resultsArray.Cast<ModelInstance>().Select(i => (User)i.Instance);
				Assert.AreEqual(string.Join(",", requests.Where(r => r.User.IsActive).Select(r => r.User.UserName).ToArray()), string.Join(",", outputUsers.Select(u => u.UserName).ToArray()));
			});
		}

		[TestMethod]
		public void SelectFunction()
		{
			DoRequestTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => ModelContext.Current.GetModelInstance(r));

				var results = Accessors.DoTransform(inputInstances, "select(function(obj) { return obj.get_User(); })");
				Assert.IsNotNull(results);

				var resultsArray = results.Cast<object>().ToArray();
				Assert.AreEqual(4, resultsArray.Length);

				var outputUsers = resultsArray.Cast<ModelInstance>().Select(i => (User)i.Instance);
				Assert.AreEqual(string.Join(",", requests.Select(r => r.User.UserName).ToArray()), string.Join(",", outputUsers.Select(u => u.UserName).ToArray()));
			});
		}

		[TestMethod]
		public void SelectFunction_WhereExpression()
		{
			DoRequestTransform(requests =>
			{
				IEnumerable inputInstances = requests.Select(r => ModelContext.Current.GetModelInstance(r));

				var results = Accessors.DoTransform(inputInstances, "select(function(obj) { return obj.get_User(); })", "where('IsActive')");
				Assert.IsNotNull(results);

				var resultsArray = results.Cast<object>().ToArray();
				Assert.AreEqual(3, resultsArray.Length);

				var outputUsers = resultsArray.Cast<ModelInstance>().Select(i => (User)i.Instance);
				Assert.AreEqual(string.Join(",", requests.Where(r => r.User.IsActive).Select(r => r.User.UserName).ToArray()), string.Join(",", outputUsers.Select(u => u.UserName).ToArray()));
			});
		}

		[TestMethod]
		public void SelectManyExpression()
		{
			DoUserTransform(users =>
			{
				IEnumerable inputInstances = users.Select(r => ModelContext.Current.GetModelInstance(r));

				var results = Accessors.DoTransform(inputInstances, "selectMany('Requests')");
				Assert.IsNotNull(results);

				var resultsArray = results.Cast<object>().ToArray();
				Assert.AreEqual(4, resultsArray.Length);

				var outputRequests = resultsArray.Cast<ModelInstance>().Select(i => (Request)i.Instance);
				Assert.AreEqual(string.Join(",", users.SelectMany(u => u.Requests).Select(r => r.Description).ToArray()), string.Join(",", outputRequests.Select(r => r.Description).ToArray()));
			});
		}

		[TestMethod]
		public void SelectManyExpression_WhereExpression()
		{
			DoUserTransform(users =>
			{
				IEnumerable inputInstances = users.Select(r => ModelContext.Current.GetModelInstance(r));

				var results = Accessors.DoTransform(inputInstances, "selectMany('Requests')", "where('User.IsActive')");
				Assert.IsNotNull(results);

				var resultsArray = results.Cast<object>().ToArray();
				Assert.AreEqual(3, resultsArray.Length);

				var outputRequests = resultsArray.Cast<ModelInstance>().Select(i => (Request)i.Instance);
				Assert.AreEqual(string.Join(",", users.SelectMany(u => u.Requests).Where(r => r.User.IsActive).Select(r => r.Description).ToArray()), string.Join(",", outputRequests.Select(r => r.Description).ToArray()));
			});
		}

		[TestMethod]
		public void SelectManyFunction()
		{
			DoUserTransform(users =>
			{
				IEnumerable inputInstances = users.Select(r => ModelContext.Current.GetModelInstance(r));

				var results = Accessors.DoTransform(inputInstances, "selectMany(function(obj) { return obj.get_Requests(); })");
				Assert.IsNotNull(results);

				var resultsArray = results.Cast<object>().ToArray();
				Assert.AreEqual(4, resultsArray.Length);

				var outputRequests = resultsArray.Cast<ModelInstance>().Select(i => (Request)i.Instance);
				Assert.AreEqual(string.Join(",", users.SelectMany(u => u.Requests).Select(r => r.Description).ToArray()), string.Join(",", outputRequests.Select(r => r.Description).ToArray()));
			});
		}

		[TestMethod]
		public void SelectManyFunction_WhereExpression()
		{
			DoUserTransform(users =>
			{
				IEnumerable inputInstances = users.Select(r => ModelContext.Current.GetModelInstance(r));

				var results = Accessors.DoTransform(inputInstances, "selectMany(function(obj) { return obj.get_Requests(); })", "where('User.IsActive')");
				Assert.IsNotNull(results);

				var resultsArray = results.Cast<object>().ToArray();
				Assert.AreEqual(3, resultsArray.Length);

				var outputRequests = resultsArray.Cast<ModelInstance>().Select(i => (Request)i.Instance);
				Assert.AreEqual(string.Join(",", users.SelectMany(u => u.Requests).Where(r => r.User.IsActive).Select(r => r.Description).ToArray()), string.Join(",", outputRequests.Select(r => r.Description).ToArray()));
			});
		}
	}
}
