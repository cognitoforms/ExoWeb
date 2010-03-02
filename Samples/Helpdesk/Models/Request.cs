using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Data.Objects.DataClasses;
using ExoGraph.EntityFramework;
using ExoRule;


namespace Helpdesk
{
	public partial class Request
	{
		static readonly Rule AutoAssign = new Rule<Request>(
			request =>
			{
				// Assign high priority requests to the escalation manager
				if (request.Priority != null && request.Priority.PriorityId == 1)
					request.AssignedTo = User.GetUser("EscalationManager");

				else if (request.Category != null)
				{
					// Assign client requests to the client support user
					if (request.Category.Name == "Client")
						request.AssignedTo = User.GetUser("ClientSupport");

					// Assign server requests to the server support user
					else if (request.Category.Name == "Server")
						request.AssignedTo = User.GetUser("ServerSupport");
				}
			});	
	}
}
