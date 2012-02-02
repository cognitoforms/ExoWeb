using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;
using ExoWeb.Templates.JavaScript;
using Jurassic;
using ExoWeb.Templates.MicrosoftAjax;
using Attribute = ExoWeb.Templates.MicrosoftAjax.Attribute;
using ExoWeb.Templates;
using System.Collections;
using System.IO;

namespace ExoWeb.UnitTests
{
	public class Accessors
	{
		#region CreateScriptFunction - 1 arg
		static Func<object, object> CreateScriptFunction(string argName1, string expression, IScriptEngineFactory factory, bool addReturnStatement)
		{
			ScriptFunction function = new ScriptFunction(factory, new string[] { argName1 }, expression, addReturnStatement);
			Marshaler marshaler = new Marshaler(factory.GetScriptEngine());

			return (a) => function.Evaluate(new object[] { a }, marshaler);
		}

		public static Func<object, object> CreateScriptFunction(string argName1, string expression, bool addReturnStatement)
		{
			return CreateScriptFunction(argName1, expression, new ScriptEngineFactory(), addReturnStatement);
		}

		public static Func<object, object> CreateScriptFunction(string argName1, string expression)
		{
			return CreateScriptFunction(argName1, expression, new ScriptEngineFactory(), true);
		}

		public static Func<object, object> CreateScriptFunction(string argName1, string expression, Func<ScriptEngine> createScriptEngine)
		{
			return CreateScriptFunction(argName1, expression, new MockScriptEngineFactory(createScriptEngine), true);
		}
		#endregion

		#region CreateScriptFunction - 2 args
		public static Func<object, object, object> CreateScriptFunction(string argName1, string argName2, string expression)
		{
			ScriptEngineFactory factory = new ScriptEngineFactory();

			ScriptFunction function = new ScriptFunction(factory, new string[] { argName1, argName2 }, expression);
			Marshaler marshaler = new Marshaler(factory.GetScriptEngine());

			return (a, b) => function.Evaluate(new object[] { a, b }, marshaler);
		}
		#endregion

		public static object CreateEntity(ScriptEngine engine, IModelInstance instance)
		{
			Marshaler marshaller = new Marshaler(engine);
			return marshaller.Wrap(instance.Instance);
		}

		public static object CreateAdapter(ScriptEngine engine, IModelInstance instance, string propertyName)
		{
			AjaxPage page = new AjaxPage();

			using (page.BeginContext(instance.Instance, null))
			{
				Adapter realAdapter = (Adapter)Binding.Parse("", "{@ " + propertyName + "}").Evaluate(page).Value;
				return realAdapter == null ? null : new AdapterWrapper(engine, realAdapter);
			}
		}

		class MockScriptEngineFactory : IScriptEngineFactory
		{
			Func<ScriptEngine> getScriptEngine;

			public MockScriptEngineFactory(Func<ScriptEngine> getScriptEngine)
			{
				this.getScriptEngine = getScriptEngine;
			}

			public ScriptEngine GetScriptEngine()
			{
				return getScriptEngine();
			}
		}

		public static object GetUnwrappedArray(object unwrapped)
		{
			return ((Marshaler.UnwrappedArray)unwrapped).Array;
		}

		public static string GetBalancedText(string input, char open, char closed, out string remainder)
		{
			return Transform.GetBalancedText(input, open, closed, out remainder);
		}

		class IDictionaryToken : Evaluator.Token<IDictionary<string, object>>
		{
			internal IDictionaryToken(string path)
			{
				Path = path;
			}

			string Path { get; set; }

			internal override object GetValue(IDictionary<string, object> source)
			{
				object result = source;
				foreach (string step in Path.Split('.'))
					result = ((IDictionary<string, object>)result)[step];
				return result;
			}
		}

		public static bool EvaluateLogicalExpression(string expression, IDictionary<string, object> source)
		{
			return Evaluator.CompileLogicalExpression<IDictionary<string, object>, IDictionaryToken>(expression, path => new IDictionaryToken(path)).Evaluate(source);
		}

		public static string ParseLogicalOperator(string opText)
		{
			return Evaluator.ParseLogicalOperator(opText).ToString();
		}

		public static string Render(string template)
		{
			StringBuilder builder = new StringBuilder();
			using (TextWriter textWriter = new StringWriter(builder))
			{
				Page.Current.Parse(template).Render(Page.Current, textWriter);
			}
			return builder.ToString();
		}

		public static IEnumerable DoTransform(IEnumerable source, params string[] operations)
		{
			var transform = Transform.Compile(string.Join(".", operations));
			return transform.Execute(new AjaxPage(), source);
		}

		public static object GetTransformGroup(object obj)
		{
			return ((Transform.Grouping)obj).Group;
		}

		public static IEnumerable<object> GetTransformItems(object obj)
		{
			return ((Transform.Grouping)obj).Items;
		}
	}
}
