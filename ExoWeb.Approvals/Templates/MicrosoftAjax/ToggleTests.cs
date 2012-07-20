using ApprovalTests.Reporters;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.Approvals.Templates.MicrosoftAjax
{
	[TestClass]
	[UseReporter(typeof(DiffReporter))]
	public class ToggleTests : BaseRenderTests
	{
		[TestMethod]
		public void Toggle_Show()
		{
			var outputMarkup = Render(
				@"<div class=""sys-template"" sys:attach=""dataview"" dataview:data=""{~ context.model.request, source=window }"">
					<div sys:attach=""toggle"" toggle:on=""{binding Description}"">
						<span>{binding Description}</span>
					</div>
				</div>");

			ApprovalTests.Approvals.VerifyHtml(outputMarkup);
		}

		[TestMethod]
		public void Toggle_ShowWithInlineDisplayStyle()
		{
			var outputMarkup = Render(@"
				<div class=""sys-template"" sys:attach=""dataview"" dataview:data=""{~ context.model.request, source=window }"">
					<div style=""display:inline;"" sys:attach=""toggle"" toggle:on=""{binding Description}"">
						<span>{binding Description}</span>
					</div>
				</div>");

			ApprovalTests.Approvals.VerifyHtml(outputMarkup);
		}
	}
}
