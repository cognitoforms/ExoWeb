using System;
using System.Collections.Generic;
using System.Linq;
using System.IO;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Represents a reusuable template for rendering databound HTML markup and controls.
	/// </summary>
	internal class Template : Control, ITemplate
	{
		private static readonly Dictionary<string, IEnumerable<Template>> templates = new Dictionary<string, IEnumerable<Template>>();

		private static readonly Dictionary<string, FileSystemWatcher> watchers = new Dictionary<string, FileSystemWatcher>();

		public string Source { get; internal set; }

		public string[] Name { get; internal set; }

		public string DataType { get; internal set; }

		public string Kind { get; internal set; }

		public bool IsAdapter { get { return Kind == "@"; } }

		public bool? IsList { get; internal set; }

		public bool? IsReference { get; internal set; }

		public string[] Class { get; internal set; }

		public string[] ContentTemplateNames { get; set; }

		public static new Template Parse(string source, string template)
		{
			return new Template() { Markup = template, Source = source, Blocks = Block.Parse(source, template), ContentTemplateNames = new string[0] };
		}

		/// <summary>
		/// Loads and caches the template at the specified path.
		/// </summary>
		/// <param name="path"></param>
		/// <returns></returns>
		public static IEnumerable<Template> Load(string path)
		{
			IEnumerable<Template> t;
			if (templates.TryGetValue(path.ToLower(), out t))
				return t;

			t = Block.Parse(Path.GetFileName(path), File.ReadAllText(path)).OfType<Template>().ToArray();
			templates[path.ToLower()] = t;
			string directory = Path.GetDirectoryName(path).ToLower();
			if (!watchers.ContainsKey(directory))
			{
				var watcher = new FileSystemWatcher(directory);
				watcher.Changed += (s, e) => templates.Remove(e.FullPath.ToLower());
				watcher.EnableRaisingEvents = true;
				watchers[directory] = watcher;
			}
			return t;
		}

		/// <summary>
		/// Returns a string representation of the current template.
		/// </summary>
		/// <returns></returns>
		public override string ToString()
		{
			return String.Format(@"<{0} isadapter=""{1}"" islist=""{2}"" isreference=""{3}"" datatype=""{4}"" name=""{5}"" />", Tag, IsAdapter, IsList, IsReference, DataType, string.Join(", ", Name));
		}

		internal override void Render(AjaxPage page, string[] templateNames, TextWriter writer)
		{
			try
			{
				ExoWeb.OnBeginRender(page, this);
				foreach (var block in Blocks)
					block.Render(page, templateNames.Concat(ContentTemplateNames).ToArray(), writer);
			}
			finally
			{
				ExoWeb.OnEndRender(page, this);
			}
		}

		/// <summary>
		/// Implements the <see cref="ITemplate.Render"/> method by delegating the to internal instance method.
		/// </summary>
		/// <param name="page"></param>
		/// <param name="writer"></param>
		void ITemplate.Render(Page page, TextWriter writer)
		{
			// Add sys-ignore class to root level controls before rendering the inline template
			foreach (var control in Blocks.OfType<Control>())
			{
				var classAttribute = control.Attributes.FirstOrDefault(a => a.Name == "class");
				if (classAttribute != null)
					classAttribute.Value = (string.IsNullOrEmpty(classAttribute.Value) ? "" : classAttribute.Value + " ") + "sys-ignore";
				else
					control.Attributes.Add(new Attribute() { Name = "class", Value = "sys-ignore" });
			}

			Render((AjaxPage)page, new string[0], writer);
		}
	}
}
