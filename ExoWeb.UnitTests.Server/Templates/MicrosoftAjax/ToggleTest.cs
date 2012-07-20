using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using ExoModel.UnitTest;
using FluentAssertions;
using ExoModel;
using System.Text.RegularExpressions;

namespace ExoWeb.UnitTests.Server.Templates.MicrosoftAjax
{
	[TestClass]
	public class ToggleTest
	{
		static readonly string linkScript = "<script type='text/javascript'>$exoweb({ domReady: function() { Sys.Application.linkElement(document.getElementById('__id__'), document.getElementById('__id__')); } });</script>";

		#region Events
		[TestInitialize]
		public void CreateContext()
		{
			ModelContext.Init(new TestModelTypeProvider());
		}
		#endregion

		#region Tests
		[TestMethod]
		public void SimpleShowBehaviorWithNoneDisplayStyleRemoved()
		{
			TestRequest((Request request) =>
			{
				request.User = new User();
				request.Description = "Enter description here...";
			}, "<div class='sys-template' sys:attach='dataview' dataview:data='{~ context.model.request, source=window }'>" +
				"<div style='display:none;' sys:attach='toggle' toggle:on='{binding Description}'>" +
					"<span>{binding Description}</span>" +
				"</div>" +
			"</div>",
			"<div class='sys-ignore' data-sys-attach='dataview' data-dataview-data='{~ context.model.request, source=window }' data-sys-tmplidx='0' id='__id__'>" +
				"<!--item-->" +
				"<div data-sys-attach='toggle' data-toggle-on='{binding Description}' class='toggle-on'>" +
					"<span data-sys-innerhtml='{binding Description}'>Enter description here...</span>" +
				"</div>" +
				"<!--/item-->" +
			"</div>");
		}

		[TestMethod]
		public void SimpleHideBehavior()
		{
			TestRequest((Request request) =>
			{
				request.User = new User();
				request.Description = "Enter description here...";
			}, "<div class='sys-template' sys:attach='dataview' dataview:data='{~ context.model.request, source=window }'>" +
				"<div sys:attach='toggle' toggle:on='{binding Description}' toggle:action='hide'>" +
					"<span>{binding Description}</span>" +
				"</div>" +
			"</div>",
			"<div class='sys-ignore' data-sys-attach='dataview' data-dataview-data='{~ context.model.request, source=window }' data-sys-tmplidx='0' id='__id__'>" +
				"<!--item-->" +
				"<div data-sys-attach='toggle' data-toggle-on='{binding Description}' data-toggle-action='hide' class='toggle-on' style='display:none;'>" +
					"<span data-sys-innerhtml='{binding Description}'>Enter description here...</span>" +
				"</div>" +
				"<!--/item-->" +
			"</div>");
		}

		[TestMethod]
		public void SimpleHideBehaviorWithStyle()
		{
			TestRequest((Request request) =>
			{
				request.User = new User();
				request.Description = "Enter description here...";
			}, "<div class='sys-template' sys:attach='dataview' dataview:data='{~ context.model.request, source=window }'>" +
				"<div sys:attach='toggle' toggle:on='{binding Description}' toggle:action='hide' style='border:1'>" +
					"<span>{binding Description}</span>" +
				"</div>" +
			"</div>",
			"<div class='sys-ignore' data-sys-attach='dataview' data-dataview-data='{~ context.model.request, source=window }' data-sys-tmplidx='0' id='__id__'>" +
				"<!--item-->" +
				"<div style='display:none; border:1' data-sys-attach='toggle' data-toggle-on='{binding Description}' data-toggle-action='hide' class='toggle-on'>" +
					"<span data-sys-innerhtml='{binding Description}'>Enter description here...</span>" +
				"</div>" +
				"<!--/item-->" +
			"</div>");
		}

		[TestMethod]
		public void SimpleAddClassBehavior()
		{
			TestRequest((Request request) =>
			{
				request.User = new User();
				request.Description = "Enter description here...";
			}, "<div class='sys-template' sys:attach='dataview' dataview:data='{~ context.model.request, source=window }'>" +
				"<div sys:attach='toggle' toggle:on='{binding Description}' toggle:action='addClass' toggle:class='active'>" +
					"<span>{binding Description}</span>" +
				"</div>" +
			"</div>",
			"<div class='sys-ignore' data-sys-attach='dataview' data-dataview-data='{~ context.model.request, source=window }' data-sys-tmplidx='0' id='__id__'>" +
				"<!--item-->" +
				"<div data-sys-attach='toggle' data-toggle-on='{binding Description}' data-toggle-class='active' data-toggle-action='addClass' class='active toggle-on'>" +
					"<span data-sys-innerhtml='{binding Description}'>Enter description here...</span>" +
				"</div>" +
				"<!--/item-->" +
			"</div>");
		}

		[TestMethod]
		public void SimpleAddClassBehaviorWithExistingClass()
		{
			TestRequest((Request request) =>
			{
				request.User = new User();
				request.Description = "Enter description here...";
			}, "<div class='sys-template' sys:attach='dataview' dataview:data='{~ context.model.request, source=window }'>" +
				"<div sys:attach='toggle' class='foo' toggle:on='{binding Description}' toggle:action='addClass' toggle:class='active'>" +
					"<span>{binding Description}</span>" +
				"</div>" +
			"</div>",
			"<div class='sys-ignore' data-sys-attach='dataview' data-dataview-data='{~ context.model.request, source=window }' data-sys-tmplidx='0' id='__id__'>" +
				"<!--item-->" +
				"<div class='foo active toggle-on' data-sys-attach='toggle' data-toggle-on='{binding Description}' data-toggle-class='active' data-toggle-action='addClass'>" +
					"<span data-sys-innerhtml='{binding Description}'>Enter description here...</span>" +
				"</div>" +
				"<!--/item-->" +
			"</div>");
		}

		[TestMethod]
		public void SimpleAddClassBehaviorWithExistingBlankClass()
		{
			TestRequest((Request request) =>
			{
				request.User = new User();
				request.Description = "Enter description here...";
			}, "<div class='sys-template' sys:attach='dataview' dataview:data='{~ context.model.request, source=window }'>" +
				"<div sys:attach='toggle' class='' toggle:on='{binding Description}' toggle:action='addClass' toggle:class='active'>" +
					"<span>{binding Description}</span>" +
				"</div>" +
			"</div>",
			"<div class='sys-ignore' data-sys-attach='dataview' data-dataview-data='{~ context.model.request, source=window }' data-sys-tmplidx='0' id='__id__'>" +
				"<!--item-->" +
				"<div class='active toggle-on' data-sys-attach='toggle' data-toggle-on='{binding Description}' data-toggle-class='active' data-toggle-action='addClass'>" +
					"<span data-sys-innerhtml='{binding Description}'>Enter description here...</span>" +
				"</div>" +
				"<!--/item-->" +
			"</div>");
		}
		#endregion

		#region Helpers
		void TestRequest(Action<Request> action, string template, string expected)
		{
			ExoWeb.Model(new { request = ExoWeb.Query<Request>(null) }, action);

			string output = Accessors.Render(template);

			template = template.Replace("\"", "'");

			output = Regex.Replace(output.Replace("\"", "'"), "exo[0-9]+", "__id__");

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
