using System;
using System.Collections.Generic;
using System.Linq;
using ExoWeb.Templates.JavaScript;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Represents an attached template control, such as dataview or content.
	/// </summary>
	internal class Control : Element
	{
		public Binding If { get; internal set; }

		public ICollection<Block> Blocks { get; internal set; }

		public int NestedTemplateIndex { get; internal set; }

		public Binding ContentTemplate { get; internal set; }

		/// <summary>
		/// Merges the set of attributes defined on the content tag with attributes from the target template.
		/// </summary>
		/// <param name="attributes"></param>
		/// <param name="name"></param>
		/// <param name="transformValue"></param>
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

		protected bool TryRenderIf(AjaxPage page, IEnumerable<string> templateNames, System.IO.TextWriter writer, out AttributeBinding ifBinding, out bool canRender)
		{
			if (If == null)
			{
				ifBinding = null;
				canRender = true;
				return true;
			}

			ifBinding = If.Evaluate(page);

			if (!ifBinding.IsValid)
			{
				canRender = false;
				return false;
			}

			canRender = JavaScriptHelpers.IsTruthy(ifBinding.Value);
			return true;
		}

		protected bool TryContentTemplate(AjaxPage page, IEnumerable<string> templateNames, System.IO.TextWriter writer, out AttributeBinding contentTemplateBinding)
		{
			if (ContentTemplate == null)
			{
				contentTemplateBinding = null;
				return true;
			}

			contentTemplateBinding = ContentTemplate.Evaluate(page);
			return contentTemplateBinding.IsValid && contentTemplateBinding.Value is string;
		}

		internal override void Render(AjaxPage page, string[] templateNames, System.IO.TextWriter writer)
		{
			bool canRender;
			AttributeBinding ifBinding;
			if (!TryRenderIf(page, templateNames, writer, out ifBinding, out canRender))
			{
				Abort(page, templateNames, writer);
				return;
			}

			if (!canRender)
				return;

			AttributeBinding contentTemplateBinding;
			if (!TryContentTemplate(page, templateNames, writer, out contentTemplateBinding))
			{
				Abort(page, templateNames, writer);
				return;
			}

			var ownTemplateNames = contentTemplateBinding != null ?
				((string) contentTemplateBinding.Value).Split(new[] {' '}, StringSplitOptions.RemoveEmptyEntries) :
				new string[0];

			RenderStartTag(page, writer, ifBinding, contentTemplateBinding);

			foreach (var block in Blocks)
				block.Render(page, templateNames.Concat(ownTemplateNames).ToArray(), writer);

			RenderEndTag(writer);
		}
	}
}
