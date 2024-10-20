﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Xml;
using System.IO;
using System.Text.RegularExpressions;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Represents a block of markup in a template, which could be a bound element, control, or just plain text markup.
	/// </summary>
	class Block
	{
		#region Html Entity Mapping

		private static readonly Regex entityParser = new Regex(@"\&(?<entity>[A-Za-z]+)\;", RegexOptions.Compiled);
		private static readonly Regex ampParser = new Regex(@"\&(?!\#\d+\;)");
		private static readonly Regex xmlnsParser = new Regex(@"\sxmlns\:\w+=\"".*?\""");

		private static readonly IReadOnlyDictionary<string, string> entities = new Dictionary<string, string>() 
		{
			{ "quot", "&#34;" },
			{ "amp", "&#38;" },
			{ "lt", "&#60;" },
			{ "gt", "&#62;" },
			{ "nbsp", "&#160;" },
			{ "iexcl", "&#161;" },
			{ "cent", "&#162;" },
			{ "pound", "&#163;" },
			{ "curren", "&#164;" },
			{ "yen", "&#165;" },
			{ "brvbar", "&#166;" },
			{ "sect", "&#167;" },
			{ "uml", "&#168;" },
			{ "copy", "&#169;" },
			{ "ordf", "&#170;" },
			{ "laquo", "&#171;" },
			{ "not", "&#172;" },
			{ "shy", "&#173;" },
			{ "reg", "&#174;" },
			{ "macr", "&#175;" },
			{ "deg", "&#176;" },
			{ "plusmn", "&#177;" },
			{ "sup2", "&#178;" },
			{ "sup3", "&#179;" },
			{ "acute", "&#180;" },
			{ "micro", "&#181;" },
			{ "para", "&#182;" },
			{ "middot", "&#183;" },
			{ "cedil", "&#184;" },
			{ "sup1", "&#185;" },
			{ "ordm", "&#186;" },
			{ "raquo", "&#187;" },
			{ "frac14", "&#188;" },
			{ "frac12", "&#189;" },
			{ "frac34", "&#190;" },
			{ "iquest", "&#191;" },
			{ "Agrave", "&#192;" },
			{ "Aacute", "&#193;" },
			{ "Acirc", "&#194;" },
			{ "Atilde", "&#195;" },
			{ "Auml", "&#196;" },
			{ "Aring", "&#197;" },
			{ "AElig", "&#198;" },
			{ "Ccedil", "&#199;" },
			{ "Egrave", "&#200;" },
			{ "Eacute", "&#201;" },
			{ "Ecirc", "&#202;" },
			{ "Euml", "&#203;" },
			{ "Igrave", "&#204;" },
			{ "Iacute", "&#205;" },
			{ "Icirc", "&#206;" },
			{ "Iuml", "&#207;" },
			{ "ETH", "&#208;" },
			{ "Ntilde", "&#209;" },
			{ "Ograve", "&#210;" },
			{ "Oacute", "&#211;" },
			{ "Ocirc", "&#212;" },
			{ "Otilde", "&#213;" },
			{ "Ouml", "&#214;" },
			{ "times", "&#215;" },
			{ "Oslash", "&#216;" },
			{ "Ugrave", "&#217;" },
			{ "Uacute", "&#218;" },
			{ "Ucirc", "&#219;" },
			{ "Uuml", "&#220;" },
			{ "Yacute", "&#221;" },
			{ "THORN", "&#222;" },
			{ "szlig", "&#223;" },
			{ "agrave", "&#224;" },
			{ "aacute", "&#225;" },
			{ "acirc", "&#226;" },
			{ "atilde", "&#227;" },
			{ "auml", "&#228;" },
			{ "aring", "&#229;" },
			{ "aelig", "&#230;" },
			{ "ccedil", "&#231;" },
			{ "egrave", "&#232;" },
			{ "eacute", "&#233;" },
			{ "ecirc", "&#234;" },
			{ "euml", "&#235;" },
			{ "igrave", "&#236;" },
			{ "iacute", "&#237;" },
			{ "icirc", "&#238;" },
			{ "iuml", "&#239;" },
			{ "eth", "&#240;" },
			{ "ntilde", "&#241;" },
			{ "ograve", "&#242;" },
			{ "oacute", "&#243;" },
			{ "ocirc", "&#244;" },
			{ "otilde", "&#245;" },
			{ "ouml", "&#246;" },
			{ "divide", "&#247;" },
			{ "oslash", "&#248;" },
			{ "ugrave", "&#249;" },
			{ "uacute", "&#250;" },
			{ "ucirc", "&#251;" },
			{ "uuml", "&#252;" },
			{ "yacute", "&#253;" },
			{ "thorn", "&#254;" },
			{ "yuml", "&#255;" },
			{ "euro", "&#8364;" }
		};

		#endregion

		public string Markup { get; internal set; }

		/// <summary>
		/// Parses and returns the blocks represented by the specified template markup.
		/// </summary>
		/// <param name="source"></param>
		/// <param name="markup"></param>
		/// <returns></returns>
		protected internal static List<Block> Parse(string source, string markup)
		{
			// Convert html entities to xml entities
			string xml = entityParser.Replace(markup, m =>
				{
					var group = m.Groups["entity"].Value;
					string entity;
					if (group != "" && entities.TryGetValue(group, out entity))
						return entity;
					return m.Value;
				});

			// Replace & with &amp; when not used to specify an xml entity
			xml = ampParser.Replace(xml, "&amp;");

			// Wrap the xml in a container to provide namespace aliases for supported controls
			xml = "<templates xmlns:sys='javascript:Sys' xmlns:dataview='javascript:Sys.UI.DataView' xmlns:content='javascript:ExoWeb.UI.Content' xmlns:template='javascript:ExoWeb.UI.Template' xmlns:toggle='javascript:ExoWeb.UI.Toggle' xmlns:behavior='javascript:ExoWeb.UI.Behavior' xmlns:html='javascript:ExoWeb.UI.Html' xmlns:togglegroup='javascript:ExoWeb.UI.ToggleGroup' xmlns:adapter='javascript:ExoWeb.View.Adapter'>" +
				xml +
				"</templates>";

			// Load and parse the template markup
			XmlDocument templates = new XmlDocument();
			templates.PreserveWhitespace = true;
			try
			{
				templates.LoadXml(xml);
			}
			catch (XmlException e)
			{
				throw new ApplicationException("Invalid XML: " + xml, e);
			}
			return ParseChildren(source, templates.DocumentElement, false);
		}

		/// <summary>
		/// Parses the children of the specified element into a list of template blocks.
		/// </summary>
		/// <param name="source"></param>
		/// <param name="element"></param>
		/// <param name="withinTemplate"></param>
		/// <returns></returns>
		static List<Block> ParseChildren(string source, XmlElement element, bool withinTemplate)
		{
			int nestedTemplates;
			return ParseChildren(source, element, withinTemplate, -1, out nestedTemplates);
		}

		/// <summary>
		/// Parses the children of the specified element into a list of template blocks.
		/// </summary>
		/// <param name="source">The original string source of the template.</param>
		/// <param name="element">The element to parse</param>
		/// <param name="withinTemplate">Indicates that the children of the given element are within a template control.</param>
		/// <param name="lastNestedTemplateIndex">Tracks the index of the last template element that was encountered. Passed through to recursive calls excluding templates.</param>
		/// <param name="nestedTemplates">Out parameter that returns the number of template controls represented by the children of the given element.</param>
		/// <returns>A list of template blocks.</returns>
		static List<Block> ParseChildren(string source, XmlElement element, bool withinTemplate, int lastNestedTemplateIndex, out int nestedTemplates)
		{
			// Track the blocks represented by the current element
			var blocks = new List<Block>();

			nestedTemplates = 0;

			// Process the child nodes of the current element
			foreach (XmlNode node in element.ChildNodes)
			{
				switch (node.NodeType)
				{
					// XML Element, which could be a control, bound element start tag, or just literal content
					case XmlNodeType.Element:

						var child = (XmlElement)node;

						// Control
						if (child.HasAttribute("sys:attach") ||
							child.HasAttribute("sys:if") ||
							child.HasAttribute("sys:content-template") ||
							child.HasAttribute("sys:id") ||
							child.HasAttribute("id"))
						{
							bool parseChildren = true;
							Control control;
							if (child.HasAttribute("sys:attach"))
							{
								switch (child.GetAttribute("sys:attach"))
								{
									// Template
									case "template":
										control = new Template()
										{
											Attributes = GetAttributes(child, "class", "sys:attach", "sys:if", "sys:content-template", "template:name", "template:kind", "template:datatype", "template:islist", "template:isreference"),
											Name = GetLiteralTokens(child, "template:name"),
											Source = source + " [" + child.GetAttribute("template:name") + "]" + (child.HasAttribute("template:datatype") ? " - " + child.GetAttribute("template:datatype") : ""),
											IsList = GetBoolean(child, "template:islist"),
											IsReference = GetBoolean(child, "template:isreference"),
											Kind = GetStringLiteral(child, "template:kind"),
											DataType = GetStringLiteral(child, "template:datatype"),
											Class = GetLiteralTokens(child, "class").Where(c => c.ToLower() != "sys-template").ToArray(),
											ContentTemplateNames = GetLiteralTokens(child, "sys:content-template")
										};
										break;

									// DataView
									case "dataview":
										control = new DataView()
										{
											Attributes = GetAttributes(child, "sys:attach", "sys:if", "sys:content-template", "dataview:data"),
											Data = GetBinding(child, "dataview:data"),
											Template = GetTemplate(child),
											ContentTemplate = GetBinding(child, "sys:content-template")
										};
										break;

									// Content
									case "content":
										control = new Content()
										{
											Attributes = GetAttributes(child, "sys:attach", "sys:if", "sys:content-template", "content:data", "content:template"),
											Data = GetBinding(child, "content:data"),
											Template = GetBinding(child, "content:template"),
											DataType = GetBinding(child, "content:datatype"),
											ContentTemplate = GetBinding(child, "sys:content-template")
										};
										break;

									// Toggle
									case "toggle":
										control = new Toggle() 
										{
											Attributes = GetAttributes(child, "sys:attach", "sys:if", "sys:content-template", "toggle:on", "toggle:action", "toggle:class", "toggle:groupname", "toggle:strictmode", "toggle:when"),
											On = GetBinding(child, "toggle:on"),
											Class = GetBinding(child, "toggle:class"),
											ClassName = GetBinding(child, "toggle:classname"),
											Action = GetBinding(child, "toggle:action"),
											GroupName = GetBinding(child, "toggle:groupname"),
											StrictMode = GetBinding(child, "toggle:strictmode"),
											When = GetBinding(child, "toggle:when"),
											ContentTemplate = GetBinding(child, "sys:content-template")
										};
										break;

									// ToggleGroup
									case "togglegroup":
										control = new ToggleGroup()
										{
											Attributes = GetAttributes(child, "sys:attach", "sys:if", "sys:content-template"),
											ContentTemplate = GetBinding(child, "sys:content-template")
										};
										break;

									// Behavior
									case "behavior":
										control = new Behavior()
										{
											Attributes = GetAttributes(child, "sys:attach", "sys:if", "sys:content-template"),
											ContentTemplate = GetBinding(child, "sys:content-template")
										};
										break;

									// Html
									case "html":
										control = new Html()
										{
											Attributes = GetAttributes(child, "sys:attach", "sys:if", "sys:content-template"),
											ContentTemplate = GetBinding(child, "sys:content-template")
										};
										break;

									default:
										throw new ArgumentException("Controls of type '" + child.GetAttribute("sys:attach") + "' are not supported for server rendering.");
								}

								// Add data-sys-attach to indicate the control type when performing linking on the client
								control.Attributes.Add(new Attribute() { Name = "data-sys-attach", Value = child.GetAttribute("sys:attach") });
							}
							else
							{
								control = new Control()
								{
									Attributes = GetAttributes(child, "sys:if", "sys:content-template", "sys:innerhtml", "sys:innertext"),
									ContentTemplate = GetBinding(child, "sys:content-template"),
									IsEmpty = child.ChildNodes.Count == 0
								};
								if (child.InnerXml.Trim().StartsWith("{") && child.InnerXml.Trim().EndsWith("}"))
								{
									parseChildren = false;
									control.Attributes.Add(new Attribute() { Name = "innerhtml", Binding = Binding.Parse(GetDefaultProperty(child), child.InnerXml.Trim()), Value = child.InnerXml.Trim() });
									control.IsEmpty = true;
								}
							}

							var isTemplate = IsTemplate(control);

							// If the sys:content-template attribute is found, then ensure it is within or on a templated control
							if (child.HasAttribute("sys:content-template") && !withinTemplate && !isTemplate)
								throw new ApplicationException("The sys:content-template attribute must be used on or within an control that implements Sys.UI.IContentTemplateConsumer.");

							// Process the controls child blocks
							if (parseChildren)
							{
								// Determine the number of top-level templates represented by this node
								int numTopLevelTemplates;

								if (isTemplate)
								{
									// A templated control represents only 1 top-level nested template
									numTopLevelTemplates = 1;

									// Set nested template index
									control.NestedTemplateIndex = lastNestedTemplateIndex + 1;

									// Parse child blocks as a new template region.  This means that lastNestedTemplateIndex
									// starts fresh (-1) and the number of child templates are not relevant here.
									control.Blocks = ParseChildren(source, child, true);
								}
								else
									// Parse children and capture the number of top-level templates contained within
									control.Blocks = ParseChildren(source, child, withinTemplate, lastNestedTemplateIndex, out numTopLevelTemplates);

								// Increment the number of nested templates and last index by
								// the number of top-level templates that this node represents
								nestedTemplates += numTopLevelTemplates;
								lastNestedTemplateIndex += numTopLevelTemplates;
							}
							else
								// A non-control with a binding expression as its inner-html contains no blocks
								control.Blocks = new List<Block>();

							control.Tag = child.Name;
							control.Markup = GetMarkup(child);
							control.If = GetBinding(child, "sys:if");

							// Add the control
							blocks.Add(control);
						}

						// Element
						else if (child.Attributes.Cast<XmlAttribute>().Any(a => a.Value.StartsWith("{") && a.Value.EndsWith("}")) ||
								 (child.ChildNodes.Cast<XmlNode>().All(n => n.NodeType != XmlNodeType.Element) && child.InnerXml.Trim().StartsWith("{") && child.InnerXml.Trim().EndsWith("}")))
						{
							var isBinding = child.InnerXml.Trim().StartsWith("{") && child.InnerXml.Trim().EndsWith("}");

							// Add the bound element
							var e = new Element()
							{
								Markup = isBinding || child.ChildNodes.Count == 0 ? GetMarkup(child) : GetElementMarkup(child),
								Attributes = GetAttributes(child),
								Tag = child.Name,
								IsEmpty = isBinding || child.ChildNodes.Count == 0
							};

							if (isBinding)
								e.Attributes.Add(new Attribute() { Name = "innerhtml", Binding = Binding.Parse(GetDefaultProperty(child), child.InnerXml.Trim()) });

							blocks.Add(e);

							// Process child nodes, if the element content is not bound
							if (!e.IsEmpty)
							{
								int numTopLevelTemplates;
								var children = ParseChildren(source, child, withinTemplate, lastNestedTemplateIndex, out numTopLevelTemplates);
								lastNestedTemplateIndex += numTopLevelTemplates;
								nestedTemplates += numTopLevelTemplates;

								blocks.AddRange(children);
								blocks.Add(new Block() { Markup = "</" + child.Name + ">" });
							}
						}

						// Literal
						else
						{
							// Get the blocks contained by the literal element
							int numTopLevelTemplates;
							var children = ParseChildren(source, child, withinTemplate, lastNestedTemplateIndex, out numTopLevelTemplates);
							lastNestedTemplateIndex += numTopLevelTemplates;
							nestedTemplates += numTopLevelTemplates;

							// Add the entire element as a block if it only contains literal content
							if (children.Count == 0 || (children.Count == 1 && children.First().GetType() == typeof(Block)))
								blocks.Add(new Block() { Markup = GetMarkup(child) });

							// Otherwise, process the child blocks
							else
							{
								blocks.Add(new Block() { Markup = GetElementMarkup(child) });
								blocks.AddRange(children);
								blocks.Add(new Block() { Markup = "</" + child.Name + ">" });
							}
						}
						break;

					// Literal content
					case XmlNodeType.Text:
						blocks.Add(new Block() { Markup = GetMarkup(node) });
						break;
				}
			}

			// Condense adjacent literal blocks
			Block literal = null;
			for (int i = blocks.Count - 1; i >= 0; i--)
			{
				if (blocks[i].GetType() == typeof(Block))
				{
					if (literal == null)
						literal = blocks[i];
					else
					{
						literal.Markup = blocks[i].Markup + literal.Markup;
						blocks.RemoveAt(i);
					}
				}
				else
					literal = null;
			}

			return blocks;
		}

		private static string GetDefaultProperty(XmlNode node)
		{
			return node.Name.ToLower() == "textarea" ? "sys:value" : "sys:innerhtml";
		}

		/// <summary>
		/// Determines whether the given control is a template (should have the sys-template class)
		/// </summary>
		/// <param name="control"></param>
		/// <returns></returns>
		private static bool IsTemplate(Control control)
		{
			bool result = false;

			// DataView and Template create a new template context
			if (control is DataView || control is Template)
				result = true;
			// Toggle creates a new template context if using render/dispose mode
			else if (control is Toggle)
				result = ((Toggle)control).IsTemplate();

			return result;
		}

		static void EnsureValidMarkup(XmlNode node)
		{
			if (node.ChildNodes.Count == 0)
			{
				string markup = node.OuterXml;
				bool selfClosing = markup.EndsWith("/>");
				if (selfClosing)
				{
					string tag = node.Name;
					if (!HtmlHelpers.IsSelfClosing(tag))
						throw new ApplicationException("The \"" + tag + "\" tag cannot be self-closed:" + markup);
				}
			}
		}

		/// <summary>
		/// Gets the HTML markup for the specified <see cref="XmlNode"/>.
		/// </summary>
		/// <param name="node"></param>
		/// <returns></returns>
		static string GetMarkup(XmlNode node)
		{
			EnsureValidMarkup(node);
			return xmlnsParser.Replace(node.OuterXml, "");
		}

		/// <summary>
		/// Gets the HTML template for the specified <see cref="XmlNode"/>.
		/// </summary>
		/// <param name="element"></param>
		/// <returns></returns>
		static string GetTemplate(XmlElement element)
		{
			return xmlnsParser.Replace(element.InnerXml, "");
		}

		static string GetStringLiteral(XmlElement element, string attributeName)
		{
			string literalValue;

			if (!element.HasAttribute(attributeName))
				literalValue = null;
			else
			{
				literalValue = element.GetAttribute(attributeName);

				if (literalValue.StartsWith("{") && literalValue.EndsWith("}"))
					throw new ApplicationException("The " + attributeName + " attribute must be a literal.");
			}

			return literalValue;
		}

		private static bool? GetBoolean(XmlElement element, string attributeName)
		{
			bool? booleanValue = null;
			string literalValue = GetStringLiteral(element, attributeName);
			if (literalValue != null)
			{
				literalValue = literalValue.ToLower().Trim();
				if (literalValue == "true")
					booleanValue = true;
				else if (literalValue == "false")
					booleanValue = false;
				else
					throw new ApplicationException("The " + attributeName + " attribute must be either 'true' or 'false'.");
			}
			return booleanValue;
		}

		private static string[] GetLiteralTokens(XmlElement element, string attributeName)
		{
			string literalValue = GetStringLiteral(element, attributeName);
			return string.IsNullOrEmpty(literalValue) ? new string[0] : literalValue.Split(new[] {' '}, StringSplitOptions.RemoveEmptyEntries);
		}

		static Binding GetBinding(XmlElement element, string attributeName)
		{
			return element.HasAttribute(attributeName) ? Binding.Parse(attributeName, element.GetAttribute(attributeName)) : null;
		}

		static List<Attribute> GetAttributes(XmlElement element, params string[] exceptions)
		{
			return element.Attributes
				.Cast<XmlAttribute>()
				.Where(a => exceptions == null || !exceptions.Contains(a.Name))
				.Select(a => new Attribute()
					{
						Name = a.Name.ToLower(),
						Value = a.Name.ToLower() == "class" ? a.Value.Replace("sys-template", "").Trim() : a.Value,
						Binding = a.Name.ToLower().StartsWith("sys:") && a.Value.Trim().StartsWith("{") && a.Value.Trim().EndsWith("}") ? Binding.Parse(a.Name.ToLower(), a.Value.Trim()) : null
					})
				.ToList();
		}

		/// <summary>
		/// Gets the markup for the start element tag.
		/// </summary>
		/// <param name="element"></param>
		/// <returns></returns>
		static string GetElementMarkup(XmlElement element)
		{
			string markup = "<" + element.Name;
			foreach (XmlAttribute attribute in element.Attributes)
				markup += " " + attribute.Name + "=\"" + attribute.Value + "\"";
			markup += ">";
			return markup;
		}

		public override string ToString()
		{
			return Markup;
		}

		/// <summary>
		/// Renders the block's markup to the specified writer in the context of the specified page.
		/// </summary>
		/// <param name="page"></param>
		/// <param name="templateNames"></param>
		/// <param name="writer"></param>
		internal virtual void Abort(AjaxPage page, string[] templateNames, TextWriter writer)
		{
			writer.Write(Markup);
		}

		/// <summary>
		/// Renders the block to the specified writer in the context of the specified page.
		/// </summary>
		/// <param name="page"></param>
		/// <param name="templateNames"></param>
		/// <param name="writer"></param>
		internal virtual void Render(AjaxPage page, string[] templateNames, TextWriter writer)
		{
			writer.Write(Markup);
		}

		/// <summary>
		/// Renders an element that marks the beginning of a template context in rendered HTML.
		/// </summary>
		internal static void RenderContextBeginMarker(Context context, string parentTagName, TextWriter writer)
		{
			var isWithinSelect = parentTagName.Equals("select", StringComparison.CurrentCultureIgnoreCase);

			if (isWithinSelect)
				writer.Write("<option style=\"display:none;\" data-sys-ctx=\"{0}\"></option>", context.Id);
			else
				writer.Write("<!--item:" + context.Id + "-->");
		}

		/// <summary>
		/// Renders an element that marks the end of a template context in rendered HTML.
		/// </summary>
		internal static void RenderContextEndMarker(Context context, string parentTagName, TextWriter writer)
		{
			var isWithinSelect = parentTagName.Equals("select", StringComparison.CurrentCultureIgnoreCase);

			if (isWithinSelect)
				writer.Write("<option style=\"display:none;\" data-sys-ctx=\"/{0}\"></option>", context.Id);
			else
				writer.Write("<!--/item:" + context.Id + "-->");
		}
	}
}
