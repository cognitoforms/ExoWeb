using ApprovalTests.Reporters;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.Approvals.Templates.MicrosoftAjax
{
	[TestClass]
	[UseReporter(typeof(DiffReporter))]
	public class SysContentTemplateTests : BaseRenderTests
	{
		private static readonly string templatesMarkup = @"
			<div class=""sys-template readonly"" sys:attach=""template"" template:name=""readonly"" template:datatype=""Request"">
				<span>{binding Description}</span>
			</div>
			<div class=""sys-template"" sys:attach=""template"" template:datatype=""Request"">
				<span>Description: <input type=""text"" sys:value=""{binding Description}"" /></span>
			</div>";

		protected override string Render(string pageMarkup)
		{
			return base.Render(templatesMarkup, pageMarkup);
		}

		[TestMethod]
		public void SysContentTemplate_Literal()
		{
			var outputMarkup = Render(@"
				<div class=""sys-template"" sys:attach=""dataview"" dataview:data=""{~ context.model.request, source=window }"" sys:content-template=""readonly"">
					<div sys:attach=""content"" content:data=""{{ $dataItem }}""></div>
				</div>");

			ApprovalTests.Approvals.VerifyHtml(outputMarkup);
		}

		[TestMethod]
		public void SysContentTemplate_CodeExpression()
		{
			var outputMarkup = Render(@"
				<div class=""sys-template"" sys:attach=""dataview"" dataview:data=""{~ context.model.request, source=window }"">
					<div sys:content-template=""{{ $dataItem.get_User().get_IsActive() ? '' : 'readonly' }}"" sys:attach=""content"" content:data=""{{ $dataItem }}""></div>
				</div>");

			ApprovalTests.Approvals.VerifyHtml(outputMarkup);
		}
	}
}
