using System;
using System.Text;
using System.Text.RegularExpressions;
using ExoModel;
using ExoModel.UnitTest;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using ExoWeb.UnitTests;
using System.Xml;

namespace ExoWeb.Approvals.Templates.MicrosoftAjax
{
	[TestClass]
	public abstract class BaseRenderTests
	{
		#region Events
		[TestInitialize]
		public void CreateContext()
		{
			ModelContext.Init(new TestModelTypeProvider());
		}
		#endregion

		#region Helpers
		/// <summary>
		/// Converts the given XML string into a more readable format.
		/// </summary>
		internal static string PrettyPrintXml(string xml)
		{
			XmlWriterSettings settings = new XmlWriterSettings();
			settings.OmitXmlDeclaration = true;
			settings.ConformanceLevel = ConformanceLevel.Fragment;
			settings.NewLineHandling = NewLineHandling.Replace;
			settings.NewLineChars = "\r\n";
			settings.Indent = true;
			settings.IndentChars = "\t";
			settings.NewLineOnAttributes = true;

			XmlDocument doc = new XmlDocument();
			try
			{
				doc.LoadXml(xml);
			}
			catch (Exception e)
			{
				throw new Exception("Invalid XML: " + xml, e);
			}

			var sb = new StringBuilder();
			using (var writer = XmlTextWriter.Create(sb, settings))
				doc.WriteTo(writer);

			return sb.ToString();
		}

		protected virtual string Render(string pageMarkup)
		{
			return Render(null, pageMarkup);
		}

		protected virtual string Render(string templateMarkup, string pageMarkup)
		{
			return Render(null, templateMarkup, pageMarkup);
		}

		protected virtual string Render(Action<Request> action, string templateMarkup, string pageMarkup)
		{
			ExoWeb.Model(new { request = ExoWeb.Query<Request>(null) }, (Request request) =>
			{
				request.Description = "Something doesn't work";
				request.User = new User() { UserName = "johndoe", IsActive = true };
				request.User.Requests.Add(request);

				if (action != null)
					action(request);
			});

			if (!string.IsNullOrEmpty(templateMarkup))
				Accessors.AddTemplates(templateMarkup);

			var outputMarkup = Accessors.Render(pageMarkup);

			// Wrap the xml in a container to provide namespace aliases for supported controls
			var xml = @"<output
				xmlns:sys='javascript:Sys'
				xmlns:dataview='javascript:Sys.UI.DataView'
				xmlns:content='javascript:ExoWeb.UI.Content'
				xmlns:template='javascript:ExoWeb.UI.Template'
				xmlns:toggle='javascript:ExoWeb.UI.Toggle'
				xmlns:behavior='javascript:ExoWeb.UI.Behavior'
				xmlns:html='javascript:ExoWeb.UI.Html'
				xmlns:togglegroup='javascript:ExoWeb.UI.ToggleGroup'>" +
				outputMarkup +
				"</output>";

			return PrettyPrintXml(xml);
		}
		#endregion
	}
}
