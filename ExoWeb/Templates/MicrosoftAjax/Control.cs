using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoWeb.Templates.JavaScript;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Represents an attached template control, such as dataview or content.
	/// </summary>
	internal class Control : Element
	{
		public Binding If { get; internal set; }

		public List<Block> Blocks { get; internal set; }

		public int NestedTemplateIndex { get; internal set; }

		public string[] ContentTemplateNames { get; set; }

		/// <summary>
		/// Merges the set of attributes defined on the content tag with attributes from the target template.
		/// </summary>
		/// <param name="attributes"></param>
		/// <param name="template"></param>
		/// <returns></returns>
		protected IEnumerable<AttributeBinding> MergeAttribute(IEnumerable<AttributeBinding> attributes, string name, Func<string, string> transformValue)
		{
			bool found = false;
			foreach (var attribute in attributes)
			{
				if (attribute.Name == name)
				{
					found = true;
					var result = AttributeBinding.Transform(name, attribute, transformValue);
					if (result != null)
						yield return result;
				}
				else
					yield return attribute;
			}
			if (!found)
			{
				var result = AttributeBinding.Transform(name, null, transformValue);
				if (result != null)
					yield return result;
			}
		}

		internal override void Render(AjaxPage page, IEnumerable<string> templateNames, System.IO.TextWriter writer)
		{
			// Exit immediately if the element is conditionally hidden
			AttributeBinding ifBinding = null;
			if (If != null)
			{
				ifBinding = If.Evaluate(page);

				if (!ifBinding.IsValid)
				{
					Abort(page, templateNames, writer);
					return;
				}
				else if (!JavaScriptHelpers.IsTruthy(ifBinding.Value))
					return;
			}

			RenderStartTag(page, writer, ifBinding);

			foreach (var block in Blocks)
				block.Render(page, templateNames.Concat(ContentTemplateNames), writer);

			RenderEndTag(writer);
		}
	}
}
