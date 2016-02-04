using System;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using FluentAssertions;
using System.Text.RegularExpressions;
using ExoModel.UnitTests.Models;
using ExoWeb.UnitTests.Models.Requests;

namespace ExoWeb.UnitTests.Templates.MicrosoftAjax
{
	[TestClass]
	[TestModel(Name = "Requests")]
	public class ToggleTests : TestModelBase
	{
		private const string linkScript = "<script type='text/javascript'>$exoweb({ domReady: function() { Sys.Application.linkElement(document.getElementById('__id__'), document.getElementById('__id__')); } });</script>";

		[TestMethod]
		public void SimpleShowBehaviorWithNoneDisplayStyleRemoved()
		{
			TestRequest(request =>
			{
				request.User = new User();
				request.Description = "Enter description here...";
			}, "<div class='sys-template' sys:attach='dataview' dataview:data='{~ context.model.request, source=window }'>" +
				"<div style='display:none;' sys:attach='toggle' toggle:on='{binding Description}'>" +
					"<span>{binding Description}</span>" +
				"</div>" +
			"</div>",
			"<div data-sys-attach='dataview' data-dataview-data='{~ context.model.request, source=window }' data-sys-tmplidx='0' id='__id__' class='sys-ignore'>" +
				"<!--item:s#-->" +
				"<div data-sys-attach='toggle' data-toggle-on='{binding Description}' class='toggle-on'>" +
					"<span data-sys-innerhtml='{binding Description}'>Enter description here...</span>" +
				"</div>" +
				"<!--/item:s#-->" +
			"</div>");
		}

		[TestMethod]
		public void SimpleHideBehavior()
		{
			TestRequest(request =>
			{
				request.User = new User();
				request.Description = "Enter description here...";
			}, "<div class='sys-template' sys:attach='dataview' dataview:data='{~ context.model.request, source=window }'>" +
				"<div sys:attach='toggle' toggle:on='{binding Description}' toggle:action='hide'>" +
					"<span>{binding Description}</span>" +
				"</div>" +
			"</div>",
			"<div data-sys-attach='dataview' data-dataview-data='{~ context.model.request, source=window }' data-sys-tmplidx='0' id='__id__' class='sys-ignore'>" +
				"<!--item:s#-->" +
				"<div data-sys-attach='toggle' data-toggle-on='{binding Description}' data-toggle-action='hide' style='display:none;' class='toggle-on'>" +
					"<span data-sys-innerhtml='{binding Description}'>Enter description here...</span>" +
				"</div>" +
				"<!--/item:s#-->" +
			"</div>");
		}

		[TestMethod]
		public void SimpleHideBehaviorWithStyle()
		{
			TestRequest(request =>
			{
				request.User = new User();
				request.Description = "Enter description here...";
			}, "<div class='sys-template' sys:attach='dataview' dataview:data='{~ context.model.request, source=window }'>" +
				"<div sys:attach='toggle' toggle:on='{binding Description}' toggle:action='hide' style='border:1'>" +
					"<span>{binding Description}</span>" +
				"</div>" +
			"</div>",
			"<div data-sys-attach='dataview' data-dataview-data='{~ context.model.request, source=window }' data-sys-tmplidx='0' id='__id__' class='sys-ignore'>" +
				"<!--item:s#-->" +
				"<div style='display:none; border:1' data-sys-attach='toggle' data-toggle-on='{binding Description}' data-toggle-action='hide' class='toggle-on'>" +
					"<span data-sys-innerhtml='{binding Description}'>Enter description here...</span>" +
				"</div>" +
				"<!--/item:s#-->" +
			"</div>");
		}

		[TestMethod]
		public void SimpleAddClassBehavior()
		{
			TestRequest(request =>
			{
				request.User = new User();
				request.Description = "Enter description here...";
			}, "<div class='sys-template' sys:attach='dataview' dataview:data='{~ context.model.request, source=window }'>" +
				"<div sys:attach='toggle' toggle:on='{binding Description}' toggle:action='addClass' toggle:class='active'>" +
					"<span>{binding Description}</span>" +
				"</div>" +
			"</div>",
			"<div data-sys-attach='dataview' data-dataview-data='{~ context.model.request, source=window }' data-sys-tmplidx='0' id='__id__' class='sys-ignore'>" +
				"<!--item:s#-->" +
				"<div data-sys-attach='toggle' data-toggle-on='{binding Description}' data-toggle-class='active' data-toggle-action='addClass' class='active toggle-on'>" +
					"<span data-sys-innerhtml='{binding Description}'>Enter description here...</span>" +
				"</div>" +
				"<!--/item:s#-->" +
			"</div>");
		}

		[TestMethod]
		public void SimpleAddClassBehaviorWithExistingClass()
		{
			TestRequest(request =>
			{
				request.User = new User();
				request.Description = "Enter description here...";
			}, "<div class='sys-template' sys:attach='dataview' dataview:data='{~ context.model.request, source=window }'>" +
				"<div sys:attach='toggle' class='foo' toggle:on='{binding Description}' toggle:action='addClass' toggle:class='active'>" +
					"<span>{binding Description}</span>" +
				"</div>" +
			"</div>",
			"<div data-sys-attach='dataview' data-dataview-data='{~ context.model.request, source=window }' data-sys-tmplidx='0' id='__id__' class='sys-ignore'>" +
				"<!--item:s#-->" +
				"<div data-sys-attach='toggle' data-toggle-on='{binding Description}' data-toggle-class='active' data-toggle-action='addClass' class='foo active toggle-on'>" +
					"<span data-sys-innerhtml='{binding Description}'>Enter description here...</span>" +
				"</div>" +
				"<!--/item:s#-->" +
			"</div>");
		}

		[TestMethod]
		public void SimpleAddClassBehaviorWithExistingBlankClass()
		{
			TestRequest(request =>
			{
				request.User = new User();
				request.Description = "Enter description here...";
			}, "<div class='sys-template' sys:attach='dataview' dataview:data='{~ context.model.request, source=window }'>" +
				"<div sys:attach='toggle' class='' toggle:on='{binding Description}' toggle:action='addClass' toggle:class='active'>" +
					"<span>{binding Description}</span>" +
				"</div>" +
			"</div>",
			"<div data-sys-attach='dataview' data-dataview-data='{~ context.model.request, source=window }' data-sys-tmplidx='0' id='__id__' class='sys-ignore'>" +
				"<!--item:s#-->" +
				"<div data-sys-attach='toggle' data-toggle-on='{binding Description}' data-toggle-class='active' data-toggle-action='addClass' class='active toggle-on'>" +
					"<span data-sys-innerhtml='{binding Description}'>Enter description here...</span>" +
				"</div>" +
				"<!--/item:s#-->" +
			"</div>");
		}

		#region Helpers
		void TestRequest(Action<Request> action, string template, string expected)
		{
			ExoWeb.Model(new { request = ExoWeb.Query<Request>(null) }, action);

			string output = Accessors.Render(template);

			template = template.Replace("\"", "'");

			output = Regex.Replace(Regex.Replace(output.Replace("\"", "'"), "exo[0-9]+", "__id__"), "item:s\\d*\\-\\-", "item:s#--");

			output.Should().Match(
				// template markup converted into an element embedded to be used as a Sys.UI.Template
				Regex.Replace(template, "sys\\-template(\"|')[^\\>]*\\>", "sys-template$1 id='__id__'>") +
				expected + 
				linkScript
			);
		}
		#endregion
	}
}
