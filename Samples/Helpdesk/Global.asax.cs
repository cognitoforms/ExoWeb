using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.Web.Routing;
using ExoGraph.EntityFramework;
using ExoWeb;

namespace Helpdesk
{
	// Note: For instructions on enabling IIS6 or IIS7 classic mode, 
	// visit http://go.microsoft.com/?LinkId=9394801

	public class MvcApplication : System.Web.HttpApplication
	{
		public static void RegisterRoutes(RouteCollection routes)
		{
			routes.IgnoreRoute("{resource}.axd/{*pathInfo}");

			routes.MapRoute(
				 "Default",                                              // Route name
				 "{controller}/{action}/{id}",                           // URL with parameters
				 new { controller = "Home", action = "Index", id = "" }  // Parameter defaults
			);

		}

		protected void Application_Start()
		{
			RegisterRoutes(RouteTable.Routes);

			new ExoGraph.GraphContextProvider().CreateContext += (source, args) =>
			{
				// Create the entity framework graph context with an extension to support rules
				args.Context = new EntityFrameworkGraphContext(() => new Helpdesk.RequestModel(), ExoRule.Rule.CreateRuleRoot);

				// Register all type-based rules and errors
				ExoRule.Rule.RegisterRules(typeof(Request).Assembly);
			};

			ServiceHandler.Adapter = new DataAnnotationsAdapter();
		}
	}
}