using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Data.Objects.DataClasses;
using ExoWeb;
using ExoGraph.EntityFramework;
using System.Data.Objects;

namespace Helpdesk
{
	public partial class User
	{
		/// <summary>
		/// Gets the <see cref="User"/> with the specified username.
		/// </summary>
		/// <param name="username"></param>
		/// <returns>The requested user if found, otherwise null</returns>
		public static User GetUser(string username)
		{
			string queryString = 
				@"SELECT VALUE User FROM RequestModel.Users 
                AS User WHERE User.UserName = @username";

			ObjectQuery<User> userQuery = User.ObjectContext.CreateQuery<User>(
				queryString, new ObjectParameter("username", username));

			return userQuery.FirstOrDefault();
		}
	}
}
