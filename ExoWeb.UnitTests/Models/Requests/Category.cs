using System.Collections.Generic;
using ExoModel.Json;

namespace ExoWeb.UnitTests.Models.Requests
{
	public class Category : JsonEntity, ICategory<User, Category, Priority, Request, ICollection<Request>, ICollection<Category>>
	{
		public string Name { get; set; }

		public Category ParentCategory { get; set; }

		public ICollection<Category> ChildCategories { get; set; }
	}

	public interface ICategory<TUser, TCategory, TPriority, TRequest, TRequestList, out TCategoryList>
		where TUser : IUser<TUser, TCategory, TPriority, TRequest, TRequestList, TCategoryList>
		where TCategory : ICategory<TUser, TCategory, TPriority, TRequest, TRequestList, TCategoryList>
		where TPriority : IPriority<TUser, TCategory, TPriority, TRequest, TRequestList, TCategoryList>
		where TRequest : IRequest<TUser, TCategory, TPriority, TRequest, TRequestList, TCategoryList>
		where TRequestList : ICollection<TRequest>
		where TCategoryList : ICollection<TCategory>
	{
		string Name { get; set; }
		TCategory ParentCategory { get; set; }
		TCategoryList ChildCategories { get; }
	}
}
