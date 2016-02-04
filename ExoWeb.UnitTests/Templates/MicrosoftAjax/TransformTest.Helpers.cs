using System;
using ExoWeb.UnitTests.Models.Requests;

namespace ExoWeb.UnitTests.Templates.MicrosoftAjax
{
	public partial class TransformTests
	{
		private static void CreateTransformData(Action<User, Request, Request, Request, User, Request> action)
		{
			var user = new User { IsActive = true, UserName = "TestUser" };
			var serverCategory = new Category { Name = "Server" };
			var clientCategory = new Category { Name = "Client" };

			var normalPriority = new Priority { Name = "Normal" };
			var lowPriority = new Priority { Name = "Low" };

			var request1 = new Request
			{
				User = user,
				Category = serverCategory,
				Priority = normalPriority,
				Description = "Server request"
			};

			user.Requests.Add(request1);

			var request2 = new Request
			{
				User = user,
				Category = clientCategory,
				Priority = normalPriority,
				Description = "Client request"
			};

			user.Requests.Add(request2);

			var request3 = new Request
			{
				User = user,
				Category = clientCategory,
				Priority = lowPriority,
				Description = "Low priority client request"
			};

			user.Requests.Add(request3);

			var archivedUser = new User { IsActive = false, UserName = "ArchivedUser" };

			var archivedRequest = new Request
			{
				User = archivedUser,
				Category = new Category() { Name = "Legacy" },
				Priority = lowPriority,
				Description = "Archived request"
			};

			archivedUser.Requests.Add(archivedRequest);

			action(user, request1, request2, request3, archivedUser, archivedRequest);
		}

		private static void DoRequestTransform(Action<Request[]> action)
		{
			CreateTransformData((user, request1, request2, request3, archivedUser, archivedRequest) => action(new[] { request1, request2, request3, archivedRequest }));
		}

		private static void DoUserTransform(Action<User[]> action)
		{
			CreateTransformData((user, request1, request2, request3, archivedUser, archivedRequest) => action(new[] { user, archivedUser }));
		}
	}
}
