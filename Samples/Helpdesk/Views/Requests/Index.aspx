<%@ Page Title="" Language="C#" MasterPageFile="~/Views/Shared/Site.Master" Inherits="System.Web.Mvc.ViewPage" %>

<asp:Content ID="Content1" ContentPlaceHolderID="TitleContent" runat="server">
	My Requests
</asp:Content>

<asp:Content ID="Content2" ContentPlaceHolderID="MainContent" runat="server">
	<script>
		Sys.require(ExoWeb.AllScripts,
			function () {
				window.context = ExoWeb.context({
					model: {
						user: {
							id: "<%= ViewData["UserId"] %>",
							from: "User",
							and: ["this.Requests.Category", "this.Requests.Priority", "this.Requests.AssignedTo"]
						}
					}
				});

				window.context.ready(function () {
					Sys.Application.activateElement(document.documentElement);
				});
			});
	</script>
	<div class="sys-template section" dataview:data="{~ context.model.user, source=window }"
		sys:attach="dataview">
		<h2>
			My Requests
		</h2>
		<table width="100%">
			<thead>
				<tr>
					<th>Id</th>
					<th>Category</th>
					<th>Priority</th>
					<th>Assigned To</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody class="sys-template" sys:attach="dataview" dataview:data="{~ Requests }">
				<tr>
					<td><a sys:href="{{ '../Requests/Edit/' + $dataItem.get_RequestId() }}">{binding RequestId}</a></td>
					<td>{binding Category}</td>
					<td>{binding Priority}</td>
					<td>{binding AssignedTo}</td>
					<td>{binding Description}</td>
				</tr>
			</tbody>
		</table>
	</div>
	<p>
		<%= Html.ActionLink<RequestsController>(r => r.Create(), "Create Request") %>
	</p>
</asp:Content>
