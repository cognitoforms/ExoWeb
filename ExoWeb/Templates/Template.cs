using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Xml;
using System.IO;

namespace ExoWeb.Templates
{
	/// <summary>
	/// Represents a reusuable template for rendering databound HTML markup and controls.
	/// </summary>
	public class Template : Control
	{
		static Dictionary<string, IEnumerable<Template>> templates = new Dictionary<string, IEnumerable<Template>>();
		static Dictionary<string, FileSystemWatcher> watchers = new Dictionary<string, FileSystemWatcher>();

		public string[] Name { get; internal set; }

		public string DataType { get; internal set; }

		public bool IsAdapter { get; internal set; }

		public bool? IsList { get; internal set; }

		public static Template Parse(string template)
		{
			return new Template() { Markup = template, Blocks = Block.Parse(template) };
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
			else
			{
				t = Block.Parse(File.ReadAllText(path)).OfType<Template>().ToArray();
				templates[path.ToLower()] = t;
				string directory = Path.GetDirectoryName(path).ToLower();
				if (!watchers.ContainsKey(directory))
				{
					var watcher = new FileSystemWatcher(directory);
					watcher.Changed += (s, e) => templates.Remove(e.FullPath.ToLower());
					watchers[directory] = watcher;
				}
				return t;
			}
		}

		/// <summary>
		/// Returns a string representation of the current template.
		/// </summary>
		/// <returns></returns>
		public override string ToString()
		{
			return String.Format(@"<{0} isadapter=""{1}"" islist=""{2}"" datatype=""{3}"" />", Tag, IsAdapter, IsList, DataType);
		}
	}
}
