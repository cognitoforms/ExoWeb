using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Web.Mvc.Ajax;
using System.Web.Security;

namespace Helpdesk.Controllers
{
    public class RequestsController : Controller
    {
		public ActionResult Index()
		{
			ViewData.Add("UserId", Membership.Provider.GetUser(User.Identity.Name, true).ProviderUserKey);
			return View();
		}

		public ActionResult Create()
		{
			ViewData.Add("UserId", Membership.Provider.GetUser(User.Identity.Name, true).ProviderUserKey);
			return View();
		}

		public ActionResult Edit(int id)
		{
			ViewData.Add("Id", id);
			return View();
		}
    }
}
