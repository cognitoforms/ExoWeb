using System.Collections.Generic;
using ExoModel.Json;

namespace ExoWeb.UnitTests.Models.Requests
{
	public class User : JsonEntity, IUser<User, Category, Priority, Request, ICollection<Request>, ICollection<Category>>
	{
		public string UserName { get; set; }

		public bool IsActive { get; set; }

		public ICollection<Request> Requests { get; set; }

		public ICollection<Request> Assignments { get; set; }
	}

	public interface IUser<TUser, TCategory, TPriority, TRequest, out TRequestList, TCategoryList>
		where TUser : IUser<TUser, TCategory, TPriority, TRequest, TRequestList, TCategoryList>
		where TCategory : ICategory<TUser, TCategory, TPriority, TRequest, TRequestList, TCategoryList>
		where TPriority : IPriority<TUser, TCategory, TPriority, TRequest, TRequestList, TCategoryList>
		where TRequest : IRequest<TUser, TCategory, TPriority, TRequest, TRequestList, TCategoryList>
		where TRequestList : ICollection<TRequest>
		where TCategoryList : ICollection<TCategory>
	{
		string UserName { get; set; }
		TRequestList Requests { get; }
		TRequestList Assignments { get; }
	}
}
