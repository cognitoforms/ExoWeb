using System.Collections.Generic;
using ExoModel.Json;

namespace ExoWeb.UnitTests.Models.Requests
{
	public class Request : JsonEntity, IRequest<User, Category, Priority, Request, ICollection<Request>, ICollection<Category>>
	{
		public User User { get; set; }

		public Category Category { get; set; }

		public Priority Priority { get; set; }

		public string Description { get; set; }

		public User AssignedTo { get; set; }
	}

	public interface IRequest<TUser, TCategory, TPriority, TRequest, TRequestList, TCategoryList>
		where TUser : IUser<TUser, TCategory, TPriority, TRequest, TRequestList, TCategoryList>
		where TCategory : ICategory<TUser, TCategory, TPriority, TRequest, TRequestList, TCategoryList>
		where TPriority : IPriority<TUser, TCategory, TPriority, TRequest, TRequestList, TCategoryList>
		where TRequest : IRequest<TUser, TCategory, TPriority, TRequest, TRequestList, TCategoryList>
		where TRequestList : ICollection<TRequest>
		where TCategoryList : ICollection<TCategory>
	{
		TUser User { get; set; }
		TCategory Category { get; set; }
		TPriority Priority { get; set; }
		string Description { get; set; }
		TUser AssignedTo { get; set; }
	}
}
