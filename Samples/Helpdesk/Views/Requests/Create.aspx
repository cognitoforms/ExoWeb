<%@ Page Title="" Language="C#" MasterPageFile="~/Views/Shared/Site.Master" Inherits="System.Web.Mvc.ViewPage" %>

<asp:Content ID="Content1" ContentPlaceHolderID="TitleContent" runat="server">
	Create Request
</asp:Content>

<asp:Content ID="Content2" ContentPlaceHolderID="MainContent" runat="server">

	<script>
		Sys.require(ExoWeb.AllScripts,
			function () {

				// Preload types and static lookup data
				window.context = ExoWeb.context({
					model: {
						user: {
							id: "<%= ViewData["UserId"] %>",
							from: "User",
							and: [ ]
						}
					},
					types: [
						{
							from: "Request",
							and: ["this.Category", "this.Priority", "Category.All", "Priority.All"]
						}
					]
				});

				// Perform initialization once the context is ready
				context.ready(function () {

					// Create a new request
					context.model.request = new Request();
					
					// Assign the user for the new request
					context.model.request.set_User(context.model.user);

					// Redirect the user back when the form is saved
					context.server.addSaveSuccess(function (e) {
						history.back();
					});

					// Finally, activate the page
					Sys.Application.activateElement(document.documentElement);
				});
				
			});
	</script>
	<div class="sys-template section" dataview:data="{~ context.model.request, source=window }"
		sys:attach="dataview">
		<h2>
			Create Request
		</h2>
        <fieldset class="form">
            <legend>Request Information</legend>
			<div class="field" sys:attach='content' content:data='{@ Category }'></div>
			<div class="field" sys:attach='content' content:data='{@ Priority }'></div>
			<div class="readonly" sys:attach='content' content:data='{@ AssignedTo }'></div>
			<div class="text" sys:attach='content' content:data='{@ Description }'></div>
			<p>
				<button onclick="context.server.save(context.model.request); return false;">Save</button>
				<button onclick="history.back();">Cancel</button>
			</p>
		</fieldset>
	</div>

</asp:Content>
