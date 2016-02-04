using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Linq.Expressions;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using ExoModel;
using System.Collections;
using System.Globalization;

namespace ExoWeb
{
	/// <summary>
	/// Builds a JavaScript expression based on an <see cref="Expression"/> tree.
	/// </summary>
	public class JavaScriptExpressionTranslator
	{
		#region Fields

		static readonly Dictionary<Type, string> supportedTypes = new Dictionary<Type, string>
		{
            { typeof(Object),	"Object" },		{ typeof(Boolean),	"Boolean" },	{ typeof(Char),		"Char" },
			{ typeof(String),	"String" },		{ typeof(SByte),	"Number" },		{ typeof(Byte),		"Number" }, 
			{ typeof(Int16),	"Number" },		{ typeof(UInt16),	"Number" },		{ typeof(Int32),	"Number" }, 
			{ typeof(UInt32),	"Number" },		{ typeof(Int64),	"Number" },		{ typeof(UInt64),	"Number" }, 
			{ typeof(Single),	"Number" },		{ typeof(Double),	"Number" },		{ typeof(Decimal),	"Number" }, 
			{ typeof(DateTime), "Date" },		{ typeof(TimeSpan), "TimeSpan" },	{ typeof(Guid),		"Guid" }, 
			{ typeof(Math),		"Math" },		{ typeof(Convert),	"Convert" },
			{ typeof(Boolean?),	"Boolean?" },	{ typeof(Char?),	"Char?" },
			{ typeof(SByte?),	"Number?" },	{ typeof(Byte?),	"Number?" }, 
			{ typeof(Int16?),	"Number?" },	{ typeof(UInt16?),	"Number?" },	{ typeof(Int32?),	"Number?" }, 
			{ typeof(UInt32?),	"Number?" },	{ typeof(Int64?),	"Number?" },	{ typeof(UInt64?),	"Number?" }, 
			{ typeof(Single?),	"Number?" },	{ typeof(Double?),	"Number?" },	{ typeof(Decimal?),	"Number?" }, 
			{ typeof(DateTime?),"Date?" },		{ typeof(TimeSpan?),"TimeSpan?" },	{ typeof(Guid?),	"Guid?" },
			{ typeof(DateTime).MakeByRefType(), "Date&" }
        };

		class SupportedMember
		{
			public string Signature { get; set; }
			public string Expression { get; set; }
			public string ExportName { get; set; }
			public string ExportImplementation { get; set; }
			public string Description { get; set; }
		}

		#region Supported Members

		static readonly Dictionary<string, string[]> supportedMembers = new Dictionary<string, string[]>()
		{
			{ "Boolean.CompareTo(Boolean) as Number", new string[] {@"Boolean_compareTo({0}, {1})", "Boolean_compareTo", @"function (a, b) { if (a === b) return 0; if (b === null || (a === true && b === false)) return 1; if (a === false && b === true) return -1; return undefined; }"} },
			{ "Boolean.CompareTo(Object) as Number", new string[] {@"Boolean_compareTo({0}, {1})", "Boolean_compareTo", @"function (a, b) { if (a === b) return 0; if (b === null || (a === true && b === false)) return 1; if (a === false && b === true) return -1; return undefined; }"} },
			{ "Boolean.Equals(Boolean) as Boolean", new string[] {@"{0} === {1}", "", @""} },
			{ "Boolean.Equals(Object) as Boolean", new string[] {@"{0} === {1}", "", @""} },
			{ "Boolean.FalseString as String", new string[] {@"""False""", "", @""} },
			{ "Boolean.ToString() as String", new string[] {@"({0} ? ""True"" : ""False"")", "", @""} },
			{ "Boolean.TrueString as String", new string[] {@"""True""", "", @""} },
			{ "static Boolean.Parse(String) as Boolean", new string[] {@"Boolean_parse({0})", "Boolean_parse", @"function (s) { return s.trim().toLowerCase() === 'true' ? true : (s.trim().toLowerCase() === 'false' ? false :  undefined); }"} },
			{ "Char.CompareTo(Char) as Number", new string[] {@"String_compareTo({0}, {1})", "String_compareTo", @""} },
			{ "Char.CompareTo(Object) as Number", new string[] {@"String_compareTo({0}, {1})", "String_compareTo", @""} },
			{ "Char.Equals(Char) as Boolean", new string[] {@"{0} === {1}", "", @""} },
			{ "Char.Equals(Object) as Boolean", new string[] {@"{0} === {1}", "", @""} },
			{ "Char.ToString() as String", new string[] {@"{0}", "", @""} },
			{ "static Char.IsControl(Char) as Boolean", new string[] {@"Char_isControl({0})", "Char_isControl", @"function(c) { return /[\u0000-\u001F\u007F\u0080-\u009F]/.test(c); }"} },
			{ "static Char.IsControl(String, Number) as Boolean", new string[] {@"Char_isControl({0}.charAt({1}))", "Char_isControl", @"function(c) { return /[\u0000-\u001F\u007F\u0080-\u009F]/.test(c); }"} },
			{ "static Char.IsDigit(Char) as Boolean", new string[] {@"Char_isDigit({0})", "Char_isDigit", @"function(c) { return /\d/.test(c); }"} },
			{ "static Char.IsDigit(String, Number) as Boolean", new string[] {@"Char_isDigit({0}.charAt({1}))", "Char_isDigit", @"function(c) { return /\d/.test(c); }"} },
			{ "static Char.IsLetter(Char) as Boolean", new string[] {@"Char_isLetter({0})", "Char_isLetter", @"function(c) { return /[a-zA-Z\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376-\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0523\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0621-\u064a\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4-\u07f5\u07fa\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0972\u097b-\u097f\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09f0-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58-\u0c59\u0c60-\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d28\u0d2a-\u0d39\u0d3d\u0d60-\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edd\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8b\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10d0-\u10fa\u10fc\u1100-\u1159\u115f-\u11a2\u11a8-\u11f9\u1200-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u1676\u1681-\u169a\u16a0-\u16ea\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19a9\u19c1-\u19c7\u1a00-\u1a16\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae-\u1baf\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u2094\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2c6f\u2c71-\u2c7d\u2c80-\u2ce4\u2d00-\u2d25\u2d30-\u2d65\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31b7\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fc3\ua000-\ua48c\ua500-\ua60c\ua610-\ua61f\ua62a-\ua62b\ua640-\ua65f\ua662-\ua66e\ua67f-\ua697\ua717-\ua71f\ua722-\ua788\ua78b-\ua78c\ua7fb-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua90a-\ua925\ua930-\ua946\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uac00-\ud7a3\uf900-\ufa2d\ufa30-\ufa6a\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]/.test(c); }"} },
			{ "static Char.IsLetter(String, Number) as Boolean", new string[] {@"Char_isLetter({0}.charAt({1}))", "Char_isLetter", @"function(c) { return /[a-zA-Z\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376-\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0523\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0621-\u064a\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4-\u07f5\u07fa\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0972\u097b-\u097f\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09f0-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58-\u0c59\u0c60-\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d28\u0d2a-\u0d39\u0d3d\u0d60-\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edd\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8b\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10d0-\u10fa\u10fc\u1100-\u1159\u115f-\u11a2\u11a8-\u11f9\u1200-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u1676\u1681-\u169a\u16a0-\u16ea\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19a9\u19c1-\u19c7\u1a00-\u1a16\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae-\u1baf\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u2094\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2c6f\u2c71-\u2c7d\u2c80-\u2ce4\u2d00-\u2d25\u2d30-\u2d65\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31b7\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fc3\ua000-\ua48c\ua500-\ua60c\ua610-\ua61f\ua62a-\ua62b\ua640-\ua65f\ua662-\ua66e\ua67f-\ua697\ua717-\ua71f\ua722-\ua788\ua78b-\ua78c\ua7fb-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua90a-\ua925\ua930-\ua946\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uac00-\ud7a3\uf900-\ufa2d\ufa30-\ufa6a\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]/.test(c); }"} },
			{ "static Char.IsLetterOrDigit(Char) as Boolean", new string[] {@"Char_isLetterOrDigit({0})", "Char_isLetterOrDigit", @"function(c) { return /\d|[0-9a-zA-Z\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376-\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0523\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0621-\u064a\u0660-\u0669\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07c0-\u07ea\u07f4-\u07f5\u07fa\u0904-\u0939\u093d\u0950\u0958-\u0961\u0966-\u096f\u0971-\u0972\u097b-\u097f\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09e6-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a66-\u0a6f\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0ae6-\u0aef\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b66-\u0b6f\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0be6-\u0bef\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58-\u0c59\u0c60-\u0c61\u0c66-\u0c6f\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0ce6-\u0cef\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d28\u0d2a-\u0d39\u0d3d\u0d60-\u0d61\u0d66-\u0d6f\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e50-\u0e59\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0ed0-\u0ed9\u0edc-\u0edd\u0f00\u0f20-\u0f29\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8b\u1000-\u102a\u103f-\u1049\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u1090-\u1099\u10a0-\u10c5\u10d0-\u10fa\u10fc\u1100-\u1159\u115f-\u11a2\u11a8-\u11f9\u1200-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u1676\u1681-\u169a\u16a0-\u16ea\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u17e0-\u17e9\u1810-\u1819\u1820-\u1877\u1880-\u18a8\u18aa\u1900-\u191c\u1946-\u196d\u1970-\u1974\u1980-\u19a9\u19c1-\u19c7\u19d0-\u19d9\u1a00-\u1a16\u1b05-\u1b33\u1b45-\u1b4b\u1b50-\u1b59\u1b83-\u1ba0\u1bae-\u1bb9\u1c00-\u1c23\u1c40-\u1c49\u1c4d-\u1c7d\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u2094\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2c6f\u2c71-\u2c7d\u2c80-\u2ce4\u2d00-\u2d25\u2d30-\u2d65\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31b7\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fc3\ua000-\ua48c\ua500-\ua60c\ua610-\ua62b\ua640-\ua65f\ua662-\ua66e\ua67f-\ua697\ua717-\ua71f\ua722-\ua788\ua78b-\ua78c\ua7fb-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8d0-\ua8d9\ua900-\ua925\ua930-\ua946\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa50-\uaa59\uac00-\ud7a3\uf900-\ufa2d\ufa30-\ufa6a\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]/.test(c); }"} },
			{ "static Char.IsLetterOrDigit(String, Number) as Boolean", new string[] {@"Char_isLetterOrDigit({0})", "Char_isLetterOrDigit", @"function(c) { return /\d|[0-9a-zA-Z\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376-\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0523\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0621-\u064a\u0660-\u0669\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07c0-\u07ea\u07f4-\u07f5\u07fa\u0904-\u0939\u093d\u0950\u0958-\u0961\u0966-\u096f\u0971-\u0972\u097b-\u097f\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09e6-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a66-\u0a6f\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0ae6-\u0aef\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b66-\u0b6f\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0be6-\u0bef\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58-\u0c59\u0c60-\u0c61\u0c66-\u0c6f\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0ce6-\u0cef\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d28\u0d2a-\u0d39\u0d3d\u0d60-\u0d61\u0d66-\u0d6f\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e50-\u0e59\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0ed0-\u0ed9\u0edc-\u0edd\u0f00\u0f20-\u0f29\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8b\u1000-\u102a\u103f-\u1049\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u1090-\u1099\u10a0-\u10c5\u10d0-\u10fa\u10fc\u1100-\u1159\u115f-\u11a2\u11a8-\u11f9\u1200-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u1676\u1681-\u169a\u16a0-\u16ea\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u17e0-\u17e9\u1810-\u1819\u1820-\u1877\u1880-\u18a8\u18aa\u1900-\u191c\u1946-\u196d\u1970-\u1974\u1980-\u19a9\u19c1-\u19c7\u19d0-\u19d9\u1a00-\u1a16\u1b05-\u1b33\u1b45-\u1b4b\u1b50-\u1b59\u1b83-\u1ba0\u1bae-\u1bb9\u1c00-\u1c23\u1c40-\u1c49\u1c4d-\u1c7d\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u2094\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2c6f\u2c71-\u2c7d\u2c80-\u2ce4\u2d00-\u2d25\u2d30-\u2d65\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31b7\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fc3\ua000-\ua48c\ua500-\ua60c\ua610-\ua62b\ua640-\ua65f\ua662-\ua66e\ua67f-\ua697\ua717-\ua71f\ua722-\ua788\ua78b-\ua78c\ua7fb-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8d0-\ua8d9\ua900-\ua925\ua930-\ua946\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa50-\uaa59\uac00-\ud7a3\uf900-\ufa2d\ufa30-\ufa6a\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]/.test(c); }"} },
			{ "static Char.IsLower(Char) as Boolean", new string[] {@"Char_isLower({0})", "Char_isLower", @"function(c) { return /[a-z\u03AC-\u03CE]/.test(c); }"} },
			{ "static Char.IsLower(String, Number) as Boolean", new string[] {@"Char_isLower({0})", "Char_isLower", @"function(c) { return /[a-z\u03AC-\u03CE]/.test(c); }"} },
			{ "static Char.IsNumber(Char) as Boolean", new string[] {@"Char_isNumber({0})", "Char_isNumber", @"function(c) {return /[\u0030-\u0039\u00b2-\u00b3\u00b9\u00bc-\u00be\u0660-\u0669\u06f0-\u06f9\u07c0-\u07c9\u0966-\u096f\u09e6-\u09ef\u09f4-\u09f9\u0a66-\u0a6f\u0ae6-\u0aef\u0b66-\u0b6f\u0be6-\u0bf2\u0c66-\u0c6f\u0c78-\u0c7e\u0ce6-\u0cef\u0d66-\u0d75\u0e50-\u0e59\u0ed0-\u0ed9\u0f20-\u0f33\u1040-\u1049\u1090-\u1099\u1369-\u137c\u16ee-\u16f0\u17e0-\u17e9\u17f0-\u17f9\u1810-\u1819\u1946-\u194f\u19d0-\u19d9\u1b50-\u1b59\u1bb0-\u1bb9\u1c40-\u1c49\u1c50-\u1c59\u2070\u2074-\u2079\u2080-\u2089\u2153-\u2182\u2185-\u2188\u2460-\u249b\u24ea-\u24ff\u2776-\u2793\u2cfd\u3007\u3021-\u3029\u3038-\u303a\u3192-\u3195\u3220-\u3229\u3251-\u325f\u3280-\u3289\u32b1-\u32bf\ua620-\ua629\ua8d0-\ua8d9\ua900-\ua909\uaa50-\uaa59\uff10-\uff19]/.test(c); }"} },
			{ "static Char.IsPunctuation(Char) as Boolean", new string[] {@"Char_isPuntuation({0})", "Char_isPuntuation", @"function(c) { return /[\u0021-\u0023\u060C\u060D\u1800-\u180A\u3014-\u301F\u0025-\u002A\u061B\u1944\u1945\u3030\u002C-\u002F\u061Eu061F\u19DE\u19DF\u303D\u003A\u003B\u066A-\u066D\u1A1E\u1A1F\u30A0\u003F\u0040\u06D4\u1B5A-\u1B60\u30FBu005B-\u005D\u0700-\u070D\u2010-\u2027\uA874-\uA877\u005F\u07F7-\u07F9\u2030-\u2043\uFD3E\uFD3Fu007B\u0964\u0965\u2045-\u2051\uFE10-\uFE19\u007D\u0970\u2053-\u205E\uFE30-\uFE52\u00A1\u0DF4\u207D\u207E\uFE54-\uFE61\u00AB\u0E4F-\u0E5B\u208D\u208E\uFE63\u00AD\u0F04-\u0F12\u2329\u232A\uFE68\u00B7\u0F3A-u0F3D\u2768-\u2775\uFE6A\uFE6B\u00BB\u0F85\u27C5-\u27C6\uFF01-\uFF03\u00BF\u0FD0\u0FD1\u27E6-\u27EB\uFF05-uFF0A\u037E\u104A-\u104F\u2983-\u2998\uFF0C-\uFF0F\u0387\u10FB\u29D8-\u29DB\uFF1A\uFF1B\u055A-\u055F\u1361-1368\u29FC\u29FD\uFF1F\uFF20\u0589\u058A\u166D\u166E\u2CF9-\u2CFC\uFF3B-\uFF3D\u05BE\u169B\u169C\u2CFE\u2CFFuFF3F\u05C0\u16EB-\u16ED\u2E00-\u2E17\uFF5B\u05C3\u1735\u1736\u2E1C\u2E1D\uFF5D\u05C6\u17D4-\u17D6\u3001\u3003\uFF5F-\uFF65\u05F3\u05F4\u17D8-\u17DA\u3008-\u3011]/.test(c); }"} },
			{ "static Char.IsPunctuation(String, Number) as Boolean", new string[] {@"Char_isPuntuation({0}.charAt({1}))", "Char_isPuntuation", @"function(c) { return /[\u0021-\u0023\u060C\u060D\u1800-\u180A\u3014-\u301F\u0025-\u002A\u061B\u1944\u1945\u3030\u002C-\u002F\u061Eu061F\u19DE\u19DF\u303D\u003A\u003B\u066A-\u066D\u1A1E\u1A1F\u30A0\u003F\u0040\u06D4\u1B5A-\u1B60\u30FBu005B-\u005D\u0700-\u070D\u2010-\u2027\uA874-\uA877\u005F\u07F7-\u07F9\u2030-\u2043\uFD3E\uFD3Fu007B\u0964\u0965\u2045-\u2051\uFE10-\uFE19\u007D\u0970\u2053-\u205E\uFE30-\uFE52\u00A1\u0DF4\u207D\u207E\uFE54-\uFE61\u00AB\u0E4F-\u0E5B\u208D\u208E\uFE63\u00AD\u0F04-\u0F12\u2329\u232A\uFE68\u00B7\u0F3A-u0F3D\u2768-\u2775\uFE6A\uFE6B\u00BB\u0F85\u27C5-\u27C6\uFF01-\uFF03\u00BF\u0FD0\u0FD1\u27E6-\u27EB\uFF05-uFF0A\u037E\u104A-\u104F\u2983-\u2998\uFF0C-\uFF0F\u0387\u10FB\u29D8-\u29DB\uFF1A\uFF1B\u055A-\u055F\u1361-1368\u29FC\u29FD\uFF1F\uFF20\u0589\u058A\u166D\u166E\u2CF9-\u2CFC\uFF3B-\uFF3D\u05BE\u169B\u169C\u2CFE\u2CFFuFF3F\u05C0\u16EB-\u16ED\u2E00-\u2E17\uFF5B\u05C3\u1735\u1736\u2E1C\u2E1D\uFF5D\u05C6\u17D4-\u17D6\u3001\u3003\uFF5F-\uFF65\u05F3\u05F4\u17D8-\u17DA\u3008-\u3011]/.test(c); }"} },
			{ "static Char.IsSeparator(Char) as Boolean", new string[] {@"Char_isSeparator({0})", "Char_isSeparator", @"function(c) { return /[\u0020\u00a0\u1680\u180e\u2000-\u200a\u2028-\u2029\u202f\u205f\u3000]/.test(c); }"} },
			{ "static Char.IsSymbol(Char) as Boolean", new string[] {@"Char_isSymbol({0})", "Char_isSymbol", @""} },
			{ "static Char.IsUpper(Char) as Boolean", new string[] {@"Char_isUpper({0})", "Char_isUpper", @""} },
			{ "static Char.IsWhiteSpace(Char) as Boolean", new string[] {@"Char_isWhiteSpace({0})", "Char_isWhiteSpace", @""} },
			{ "static Char.Parse(String) as Char", new string[] {@"{0}[0]", "", @""} },
			{ "static Char.ToLower(Char) as Char", new string[] {@"{0}.toLowerCase()", "", @""} },
			{ "static Char.ToUpper(Char) as Char", new string[] {@"{0}.toUpperCase()", "", @""} },
			{ "static Convert.ToNumber(Boolean) as Number", new string[] {@"Number({0})", "", @""} },
			{ "static Convert.ToNumber(Char) as Number", new string[] {@"Number({0})", "", @""} },
			{ "static Convert.ToNumber(Date) as Number", new string[] {@"Number({0})", "", @""} },
			{ "static Convert.ToNumber(String, Number) as Number", new string[] {@"parseInt({0}, {1})", "", @""} },
			{ "static Convert.ToString(Boolean) as String", new string[] {@"String({0})", "", @""} },
			{ "static Convert.ToString(Char) as String", new string[] {@"String({0})", "", @""} },
			{ "static Convert.ToString(Date) as String", new string[] {@"String({0})", "", @""} },
			{ "static Convert.ToString(Number) as String", new string[] {@"String({0})", "", @""} },
			{ "static Convert.ToString(Object) as String", new string[] {@"String({0})", "", @""} },
			{ "static Convert.ToString(String) as String", new string[] {@"String({0})", "", @""} },
			{ "Date(Number)", new string[] {@"new Date({0}/10000 + new Date().getTimezoneOffset()*60000 - 2208988800000)", "", @""} },
			{ "Date(Number, DateTimeKind)", new string[] {@"new Date({0}/10000 + ({1} === ""Utc"" ? 0 : new Date().getTimezoneOffset()*60000) - 2208988800000)", "", @""} },
			{ "Date(Number, Number, Number)", new string[] {@"new Date({0}, {1} - 1, {2})", "", @""} },
			{ "Date(Number, Number, Number, Number, Number, Number)", new string[] {@"new Date({0}, {1} - 1, {2}, {3}, {4}, {5}, {6})", "", @""} },
			{ "Date(Number, Number, Number, Number, Number, Number, DateTimeKind)", new string[] {@"new Date({0}, {1} - 1, {2}, {3}, {4}, {5}, {6} + ({7} === ""Utc"" ? 0 : new Date().getTimezoneOffset()*60000))", "", @""} },
			{ "Date(Number, Number, Number, Number, Number, Number, Number)", new string[] {@"new Date({0}, {1} - 1, {2}, {3}, {4}, {5})", "", @""} },
			{ "Date(Number, Number, Number, Number, Number, Number, Number, DateTimeKind)", new string[] {@"new Date({0}, {1} - 1, {2}, {3}, {4}, {5}, ({6} === ""Utc"" ? 0 : new Date().getTimezoneOffset()*60000))", "", @""} },
			{ "Date.Add(TimeSpan) as Date", new string[] {@"{0}.add({1})", "", @""} },
			{ "Date.AddDays(Number) as Date", new string[] {@"new Date({0}.getTime() + {1}*86400000)", "", @""} },
			{ "Date.AddHours(Number) as Date", new string[] {@"new Date({0}.getTime() + {1}*3600000)", "", @""} },
			{ "Date.AddMilliseconds(Number) as Date", new string[] {@"new Date({0}.getTime() + {1})", "", @""} },
			{ "Date.AddMinutes(Number) as Date", new string[] {@"new Date({0}.getTime() + {1}*60000)", "", @""} },
			{ "Date.AddMonths(Number) as Date", new string[] {@"Date_addMonths({0}, {1})", "Date_addMonths", @"function (d, m) { var r = new Date(d.getTime()); r.setMonth(r.getMonth() + m); return r; }"} },
			{ "Date.AddSeconds(Number) as Date", new string[] {@"new Date({0}.getTime() + {1}*1000)", "", @""} },
			{ "Date.AddTicks(Number) as Date", new string[] {@"new Date({0}.getTime() + {1}/10000)", "", @""} },
			{ "Date.AddYears(Number) as Date", new string[] {@"Date_addYears({0}, {1})", "Date_addYears", @"function (d, y) { var r = new Date(d.getTime()); r.setFullYear(r.getFullYear() + y); return r; }"} },
			{ "Date.CompareTo(Date) as Number", new string[] {@"{0}.getTime()=={1}.getTime() ? 0 : ({0}.getTime()>{1}.getTime() ? 1 : -1)", "", @""} },
			{ "Date.CompareTo(Object) as Number", new string[] {@"{0}.getTime()=={1}.getTime() ? 0 : ({0}.getTime()>{1}.getTime() ? 1 : -1)", "", @""} },
			{ "Date.Date as Date", new string[] {@"Date_date({0})", "Date_date", @"function Date_date(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }"} },
			{ "Date.Day as Number", new string[] {@"{0}.getDate()", "", @""} },
			{ "Date.DayOfWeek as DayOfWeek", new string[] {@"[""Sunday"", ""Monday"", ""Tuesday"", ""Wednesday"", ""Thursday"", ""Friday"", ""Saturday""][{0}.getDay()]", "", @""} },
			{ "Date.DayOfYear as Number", new string[] {@"Date_dayOfYear({0})", "Date_dayOfYear", @"function Date_dayOfYear(d) { return Math.round(((d - new Date(d.getFullYear(), 0, 1)) / 1000 / 60 / 60 / 24) + .5, 0); }"} },
			{ "Date.Equals(Date) as Boolean", new string[] {@"{0}.getTime() === {1}.getTime()", "", @""} },
			{ "Date.Equals(Object) as Boolean", new string[] {@"{0}.getTime() === {1}.getTime()", "", @""} },
			{ "Date.Hour as Number", new string[] {@"{0}.getHours()", "", @""} },
			{ "Date.Millisecond as Number", new string[] {@"{0}.getMilliseconds()", "", @""} },
			{ "Date.Minute as Number", new string[] {@"{0}.getMinutes()", "", @""} },
			{ "Date.Month as Number", new string[] {@"({0}.getMonth()+1)", "", @""} },
			{ "Date.Second as Number", new string[] {@"{0}.getSeconds()", "", @""} },
			{ "Date.Subtract(Date) as TimeSpan", new string[] {"new TimeSpan({0}.getTime() - {1}.getTime())", "", ""} },
			{ "Date.Ticks as Number", new string[] {@"Date_ticks({0})", "Date_ticks", @"function (d) { return ((d.getTime() - (d.getTimezoneOffset() * 60000)) * 10000) + 621355968000000000; }"} },
			{ "Date.ToString(String) as String", new string[] {@"{0}.localeFormat({1})", "", ""} },
			{ "Date.ToString() as String", new string[] {@"{0}.toString()", "", @""} },
			{ "Date.Year as Number", new string[] {@"{0}.getFullYear()", "", @""} },
			{ "static Date.Equals(Date, Date) as Boolean", new string[] {@"({0}.getTime() === {1}.getTime())", "", @""} },
			{ "static Date.IsLeapYear(Number) as Boolean", new string[] {@"(new Date({0}, 1, 29).getDate() == 29)", "", @""} },
			{ "static Date.Now as Date", new string[] {@"new Date()", "", @""} },
			{ "static Date.Parse(String) as Date", new string[] {@"new Date(Date.parseLocale({0}) || Date.parseLocale(""1/1/1970 ""+{0}))", "", @""} },
			{ "static Date.Today as Date", new string[] {@"new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())", "", @""} },
			{ "static Date.TryParse(String, Date&) as Boolean", new string[] {@"!isNaN(Date.parseLocale({0})) || !isNaN(Date.parseLocale(""1/1/1970 ""+{0}))", "", @""} },
			{ "static Date.UtcNow as Date", new string[] {@"Date_toUTC(new Date())", "Date_toUTC", @"function Date_toUTC(d) { return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()); }"} },
			{ "Guid.CompareTo(Guid) as Number", new string[] {@"Guid.compareTo({0}, {1})", "", @""} },
			{ "Guid.CompareTo(Object) as Number", new string[] {@"Guid.compareTo({0}, {1})", "", @""} },
			{ "Guid.Equals(Guid) as Boolean", new string[] {@"{0} === {1}", "", @""} },
			{ "Guid.Equals(Object) as Boolean", new string[] {@"{0} === {1}", "", @""} },
			{ "static Math.Abs(Number) as Number", new string[] {@"Math.abs({0})", "", @""} },
			{ "static Math.Acos(Number) as Number", new string[] {@"Math.acos({0})", "", @""} },
			{ "static Math.Asin(Number) as Number", new string[] {@"Math.asin({0})", "", @""} },
			{ "static Math.Atan(Number) as Number", new string[] {@"Math.atan({0})", "", @""} },
			{ "static Math.Atan2(Number, Number) as Number", new string[] {@"Math.atan2({0}, {1})", "", @""} },
			{ "static Math.Ceiling(Number) as Number", new string[] {@"Math.ceil({0})", "", @""} },
			{ "static Math.Cos(Number) as Number", new string[] {@"Math.cos({0})", "", @""} },
			{ "static Math.Cosh(Number) as Number", new string[] {@"Math_cosh({0})", "Math_cosh", @"function(n) { return (Math.exp(n) + Math.exp(-(n)))/2; }"} },
			{ "static Math.E as Number", new string[] {@"Math.E", "", @""} },
			{ "static Math.Exp(Number) as Number", new string[] {@"Math.exp({0})", "", @""} },
			{ "static Math.Floor(Number) as Number", new string[] {@"Math.floor({0})", "", @""} },
			{ "static Math.Log(Number) as Number", new string[] {@"Math.log({0})", "", @""} },
			{ "static Math.Log(Number, Number) as Number", new string[] {@"Math.log({0})/Math.log({1})", "", @""} },
			{ "static Math.Log10(Number) as Number", new string[] {@"Math.log({0})/Math.log(10)", "", @""} },
			{ "static Math.Max(Number, Number) as Number", new string[] {@"Math.max({0}, {1})", "", @""} },
			{ "static Math.Min(Number, Number) as Number", new string[] {@"Math.min({0}, {1})", "", @""} },
			{ "static Math.PI as Number", new string[] {@"Math.PI", "", @""} },
			{ "static Math.Pow(Number, Number) as Number", new string[] {@"Math.pow({0}, {1})", "", @""} },
			{ "static Math.Round(Number) as Number", new string[] {@"Math.round({0})", "", @""} },
			{ "static Math.Round(Number, Number) as Number", new string[] {@"Math.round({0}*Math.pow(10, {1}))/Math.pow(10, {1})", "", @""} },
			{ "static Math.Sign(Number) as Number", new string[] {@"Math_sign({0})", "Math_sign", @"function(n) { return n === 0 ? 0 : (n > 0 ? 1 : -1); }"} },
			{ "static Math.Sin(Number) as Number", new string[] {@"Math.sin({0})", "", @""} },
			{ "static Math.Sinh(Number) as Number", new string[] {@"Math_sinh({0})", "Math_sinh", @"function(n) { return (Math.exp(n) - Math.exp(-(n)))/2; }"} },
			{ "static Math.Sqrt(Number) as Number", new string[] {@"Math.sqrt({0})", "", @""} },
			{ "static Math.Tan(Number) as Number", new string[] {@"Math.tan({0})", "", @""} },
			{ "static Math.Tanh(Number) as Number", new string[] {@"Math_tanh({0})", "Math_tanh", @"function(n) { return (Math.exp(2*n)-1)/(Math.exp(2*n)+1); }"} },
			{ "static Math.Truncate(Number) as Number", new string[] {@"({0} > 0 ? Math.floor({0}) : Math.ceil({0}))", "", @""} },
			{ "Number.CompareTo(Number) as Number", new string[] {@"Number.compareTo({0}, {1})", "", @""} },
			{ "Number.CompareTo(Object) as Number", new string[] {@"Number.compareTo({0}, {1})", "", @""} },
			{ "Number.Equals(Number) as Boolean", new string[] {@"{0} === {1}", "", @""} },
			{ "Number.Equals(Object) as Boolean", new string[] {@"{0} === {1}", "", @""} },
			{ "Number.ToString() as String", new string[] {@"({0}).toString()", "", @""} },
			{ "Number.ToString(String) as String", new string[] {@"{0}.localeFormat({1})", "", ""} },
			{ "static Number.Equals(Number, Number) as Boolean", new string[] {@"{0} === {1}", "", @""} },
			{ "static Number.Parse(String) as Number", new string[] {@"Number.parseLocale({0})", "", @""} },
			{ "Object.Equals(Object) as Boolean", new string[] {@"{0} === {1}", "", @""} },
			{ "Object.ToString() as String", new string[] {@"({0}).toString()", "", @""} },
			{ "static Object.Equals(Object, Object) as Boolean", new string[] {@"{0} === {1}", "", @""} },
			{ "static String.Compare(String, Number, String, Number, Number) as Number", new string[] {@"String_compare({0}, {1}, {2}, {3}, {4}, false)", "String_compare", @"function (s1, i1, s2, i2, l, ic) { if (l == 0) return 0; if (l > 0) { s1 = s1.substr(i1, l); s2 = s2.substr(i2, l); } if (ic) { s1 = s1.toLowerCase(); s2 = s2.toLowerCase(); } return s1.localeCompare(s2); }"} },
			{ "static String.Compare(String, Number, String, Number, Number, Boolean) as Number", new string[] {@"String_compare({0}, {1}, {2}, {3}, {4}, {5})", "String_compare", @"function (s1, i1, s2, i2, l, ic) { if (l == 0) return 0; if (l > 0) { s1 = s1.substr(i1, l); s2 = s2.substr(i2, l); } if (ic) { s1 = s1.toLowerCase(); s2 = s2.toLowerCase(); } return s1.localeCompare(s2); }"} },
			{ "static String.Compare(String, Number, String, Number, Number, StringComparison) as Number", new string[] {@"String_compare({0}, {1}, {2}, {3}, {4}, /IgnoreCase$/.test({5}))", "String_compare", @"function (s1, i1, s2, i2, l, ic) { if (l == 0) return 0; if (l > 0) { s1 = s1.substr(i1, l); s2 = s2.substr(i2, l); } if (ic) { s1 = s1.toLowerCase(); s2 = s2.toLowerCase(); } return s1.localeCompare(s2); }"} },
			{ "static String.Compare(String, String) as Number", new string[] {@"{0}.localeCompare({1})", "", @""} },
			{ "static String.Compare(String, String, Boolean) as Number", new string[] {@"String_compare({0}, 0, {1}, 0, -1, {2})", "String_compare", @"function (s1, i1, s2, i2, l, ic) { if (l == 0) return 0; if (l > 0) { s1 = s1.substr(i1, l); s2 = s2.substr(i2, l); } if (ic) { s1 = s1.toLowerCase(); s2 = s2.toLowerCase(); } return s1.localeCompare(s2); }"} },
			{ "static String.Compare(String, String, StringComparison) as Number", new string[] {@"String_compare({0}, 0, {1}, 0, -1, /IgnoreCase$/.test({2}))", "String_compare", @"function (s1, i1, s2, i2, l, ic) { if (l == 0) return 0; if (l > 0) { s1 = s1.substr(i1, l); s2 = s2.substr(i2, l); } if (ic) { s1 = s1.toLowerCase(); s2 = s2.toLowerCase(); } return s1.localeCompare(s2); }"} },
			{ "static String.CompareOrdinal(String, Number, String, Number, Number) as Number", new string[] {@"String_compare({0}, {1}, {2}, {3}, {4}, false)", "String_compare", @"function (s1, i1, s2, i2, l, ic) { if (l == 0) return 0; if (l > 0) { s1 = s1.substr(i1, l); s2 = s2.substr(i2, l); } if (ic) { s1 = s1.toLowerCase(); s2 = s2.toLowerCase(); } return s1.localeCompare(s2); }"} },
			{ "static String.CompareOrdinal(String, String) as Number", new string[] {@"{0}.localeCompare({1})", "", @""} },
			{ "static String.Concat(Object) as String", new string[] {@"str({0})", "str", @"function (o) { if (o === undefined || o === null) return """"; return o.toString(); }"} },
			{ "static String.Concat(Object, Object) as String", new string[] {@"str({0}).concat(str({1}))", "str", @"function (o) { if (o === undefined || o === null) return """"; return o.toString(); }"} },
			{ "static String.Concat(Object, Object, Object) as String", new string[] {@"str({0}).concat(str({1}), str({2}))", "str", @"function (o) { if (o === undefined || o === null) return """"; return o.toString(); }"} },
			{ "static String.Concat(Object, Object, Object, Object) as String", new string[] {@"str({0}).concat(str({1}), str({2}), str({3}))", "str", @"function (o) { if (o === undefined || o === null) return """"; return o.toString(); }"} },
			{ "static String.Concat(Object[]) as String", new string[] {@"{0}.reduce(function (p, c) { return p.concat(str(c)); }, """")", "str", @"function (o) { if (o === undefined || o === null) return """"; return o.toString(); }"} },
			{ "static String.Concat(String, String) as String", new string[] {@"{0}.concat({1})", "", @""} },
			{ "static String.Concat(String, String, String) as String", new string[] {@"{0}.concat({1}, {2})", "", @""} },
			{ "static String.Concat(String, String, String, String) as String", new string[] {@"{0}.concat({1}, {2}, {3})", "", @""} },
			{ "static String.Concat(String[]) as String", new string[] {@"{0}.reduce(function (p, c) { return p.concat(c); }, """")", "", @""} },
			{ "static String.Copy(String) as String", new string[] {@"String({0})", "", @""} },
			{ "static String.Equals(String, String) as Boolean", new string[] {@"({0} === {1})", "", @""} },
			{ "static String.Equals(String, String, StringComparison) as Boolean", new string[] {@"(String_compare({0}, 0, {1}, 0, -1, /IgnoreCase$/.test({2})) === 0)", "", @""} },
			{ "static String.IsNullOrEmpty(String) as Boolean", new string[] {@"String_isNullOrEmpty({0})", "String_isNullOrEmpty", @"function(s) { return s === null || s === undefined || s === """"; }"} },
			{ "static String.IsNullOrWhiteSpace(String) as Boolean", new string[] {@"String_isNullOrWhiteSpace({0})", "String_isNullOrWhiteSpace", @"function(s) { return s === null || s === undefined || !!s.match(/^\s*$/); }"} },
			{ "static String.Join(String, Object[]) as String", new string[] {@"String_join({0}, {1})", "String_join", @"function (s, a) { if (a === undefined || a === null || a.length === 0 || a[0] === undefined || a[0] === null) return """"; return a.map(function(o) { if (o === undefined || o === null) return """"; return o.toString(); }).join(s); }"} },
			{ "static String.Join(String, String[]) as String", new string[] {@"{1}.join({0})", "", @""} },
			{ "static String.Join(String, String[], Number, Number) as String", new string[] {@"{1}.slice({2}, {2} + {3}).join({0})", "", @""} },
			{ "String(Char, Number)", new string[] {@"(function () { var c = {0}; var i = {1}; var s = """"; while (i-- > 0) s+= c; return s; })()", "", @""} },
			{ "String(Char[])", new string[] {@"{0}.join("""")", "", @""} },
			{ "String(Char[], Number, Number)", new string[] {@"{0}.join("""").substr({1}, {2})", "", @""} },
			{ "String.Chars[Number] as Char", new string[] {@"{0}[{1}]", "", @""} },
			{ "String.CompareTo(Object) as Number", new string[] {@"{0}.localeCompare({1})", "", @""} },
			{ "String.CompareTo(String) as Number", new string[] {@"{0}.localeCompare({1})", "", @""} },
			{ "String.Contains(String) as Boolean", new string[] {@"({0}.indexOf({1}) >= 0)", "", @""} },
			{ "String.Empty as String", new string[] {@"""""", "", @""} },
			{ "String.EndsWith(String) as Boolean", new string[] {@"String_endsWith({0}, {1})", "String_endsWith", @"function (s, e) { return s.substr(s.length - e.length) === e; }"} },
			{ "String.Equals(Object) as Boolean", new string[] {@"{0} === {1}", "", @""} },
			{ "String.Equals(String) as Boolean", new string[] {@"{0} === {1}", "", @""} },
			{ "String.IndexOf(Char) as Number", new string[] {@"{0}.indexOf({1})", "", @""} },
			{ "String.IndexOf(Char, Number) as Number", new string[] {@"{0}.indexOf({1}, {2})", "", @""} },
			{ "String.IndexOf(Char, Number, Number) as Number", new string[] {@"String_indexOf({0}, {1}, {2}, {3})", "String_indexOf", @"function (s, f, i, c) { var p = s.indexOf(f, i); return p < c ? p : -1; }"} },
			{ "String.IndexOf(String) as Number", new string[] {@"{0}.indexOf({1})", "", @""} },
			{ "String.IndexOf(String, Number) as Number", new string[] {@"{0}.indexOf({1}, {2})", "", @""} },
			{ "String.IndexOf(String, Number, Number) as Number", new string[] {@"String_indexOf({0}, {1}, {2}, {3})", "String_indexOf", @"function (s, f, i, c) { var p = s.indexOf(f, i); return p < c ? p : -1; }"} },
			{ "String.IndexOfAny(Char[]) as Number", new string[] {@"String_indexOfAny({0}, {1}, 0, -1, 1)", "String_indexOfAny", @"function (s, t, i, c, d) { if (i < 0) i = s.length - 1; if (c < 0) c = s.length; while (c != 0) { if (t.indexOf(s[i]) >= 0) return i; i += d; c -= d; } return -1; }"} },
			{ "String.IndexOfAny(Char[], Number) as Number", new string[] {@"String_indexOfAny({0}, {1}, {2}, -1, 1)", "String_indexOfAny", @"function (s, t, i, c, d) { if (i < 0) i = s.length - 1; if (c < 0) c = s.length; while (c != 0) { if (t.indexOf(s[i]) >= 0) return i; i += d; c -= d; } return -1; }"} },
			{ "String.IndexOfAny(Char[], Number, Number) as Number", new string[] {@"String_indexOfAny({0}, {1}, {2}, {3}, 1)", "String_indexOfAny", @"function (s, t, i, c, d) { if (i < 0) i = s.length - 1; if (c < 0) c = s.length; while (c != 0) { if (t.indexOf(s[i]) >= 0) return i; i += d; c -= d; } return -1; }"} },
			{ "String.Insert(Number, String) as String", new string[] {@"String_insert({0}, {1}, {2})", "String_insert", @"function (s, i, v) { return s.substr(0, i) + v + s.substr(i); }"} },
			{ "String.LastIndexOf(Char) as Number", new string[] {@"{0}.lastIndexOf({1})", "", @""} },
			{ "String.LastIndexOf(Char, Number) as Number", new string[] {@"{0}.lastIndexOf({1}, {2})", "", @""} },
			{ "String.LastIndexOf(Char, Number, Number) as Number", new string[] {@"String_lastIndexOf({0}, {1}, {2}, {3})", "String_lastIndexOf", @"function (s, f, i, c) { var p = s.lastIndexOf(f, i); return p > s.length - c ? p : -1; }"} },
			{ "String.LastIndexOf(String) as Number", new string[] {@"{0}.lastIndexOf({1})", "", @""} },
			{ "String.LastIndexOf(String, Number) as Number", new string[] {@"{0}.lastIndexOf({1}, {2})", "", @""} },
			{ "String.LastIndexOf(String, Number, Number) as Number", new string[] {@"String_lastIndexOf({0}, {1}, {2}, {3})", "String_lastIndexOf", @"function (s, f, i, c) { var p = s.lastIndexOf(f, i); return p > s.length - c ? p : -1; }"} },
			{ "String.LastIndexOfAny(Char[]) as Number", new string[] {@"String_indexOfAny({0}, {1}, -1, -1, -1)", "String_indexOfAny", @"function (s, t, i, c, d) { if (i < 0) i = s.length - 1; if (c < 0) c = s.length; while (c != 0) { if (t.indexOf(s[i]) >= 0) return i; i += d; c -= d; } return -1; }"} },
			{ "String.LastIndexOfAny(Char[], Number) as Number", new string[] {@"String_indexOfAny({0}, {1}, {2}, -1, -1)", "String_indexOfAny", @"function (s, t, i, c, d) { if (i < 0) i = s.length - 1; if (c < 0) c = s.length; while (c != 0) { if (t.indexOf(s[i]) >= 0) return i; i += d; c -= d; } return -1; }"} },
			{ "String.LastIndexOfAny(Char[], Number, Number) as Number", new string[] {@"String_indexOfAny({0}, {1}, {2}, {3}, -1)", "String_indexOfAny", @"function (s, t, i, c, d) { if (i < 0) i = s.length - 1; if (c < 0) c = s.length; while (c != 0) { if (t.indexOf(s[i]) >= 0) return i; i += d; c -= d; } return -1; }"} },
			{ "String.Length as Number", new string[] {@"{0}.length", "", @""} },
			{ "String.PadLeft(Number) as String", new string[] {@"String_padLeft({0}, "" "", {1})", "String_padLeft", @"function (s, p, l) { while (s.length < l) { s = p + s; } return s; }"} },
			{ "String.PadLeft(Number, Char) as String", new string[] {@"String_padLeft({0}, {2}, {1})", "String_padLeft", @"function (s, p, l) { while (s.length < l) { s = p + s; } return s; }"} },
			{ "String.PadRight(Number) as String", new string[] {@"String_padRight({0}, "" "", {1})", "String_padRight", @"function (s, p, l) { while (s.length < l) {s = s + p; } return s; }"} },
			{ "String.PadRight(Number, Char) as String", new string[] {@"String_padRight({0}, {2}, {1})", "String_padRight", @"function (s, p, l) { while (s.length < l) {s = s + p; } return s; }"} },
			{ "String.Remove(Number) as String", new string[] {@"{0}.slice(0, {1})", "", @""} },
			{ "String.Remove(Number, Number) as String", new string[] {@"String_remove({0}, {1}, {2})", "String_remove", @"function (s, i, c) { return s.substr(0, i) + s.substr(i+c); }"} },
			{ "String.Replace(Char, Char) as String", new string[] {@"{0}.replace(new RegExp(""\\"" + {1}, ""g""), {2})", "", @""} },
			{ "String.Replace(String, String) as String", new string[] {@"{0}.replace(new RegExp({1}.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, ""\\$&""), ""g""), {2})", "", @""} },
			{ "String.Split(Char[]) as String[]", new string[] {@"String_split({0}, {1}, -1, false)", "String_split", @"function (s, c, n, r) { var re = !c || c.length === 0 ? /\s/ : new RegExp(""("" + c.map(function (s) { return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, ""\\$&""); }).join(""|"") + "")""); var a = []; while (--n !== 0) { var p = s.search(re); if (p < 0) break; a = a.concat([s.substr(0, p)]); s = s.substr(p + 1); } a = a.concat([s]); if (r) a = a.filter(function (s) { return s.length > 0; }); return a; }"} },
			{ "String.Split(Char[], Number) as String[]", new string[] {@"String_split({0}, {1}, {2}, false)", "String_split", @"function (s, c, n, r) { var re = !c || c.length === 0 ? /\s/ : new RegExp(""("" + c.map(function (s) { return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, ""\\$&""); }).join(""|"") + "")""); var a = []; while (--n !== 0) { var p = s.search(re); if (p < 0) break; a = a.concat([s.substr(0, p)]); s = s.substr(p + 1); } a = a.concat([s]); if (r) a = a.filter(function (s) { return s.length > 0; }); return a; }"} },
			{ "String.Split(Char[], Number, StringSplitOptions) as String[]", new string[] {@"String_split({0}, {1}, {2}, {3} === ""RemoveEmptyEntries"")", "String_split", @"function (s, c, n, r) { var re = !c || c.length === 0 ? /\s/ : new RegExp(""("" + c.map(function (s) { return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, ""\\$&""); }).join(""|"") + "")""); var a = []; while (--n !== 0) { var p = s.search(re); if (p < 0) break; a = a.concat([s.substr(0, p)]); s = s.substr(p + 1); } a = a.concat([s]); if (r) a = a.filter(function (s) { return s.length > 0; }); return a; }"} },
			{ "String.Split(Char[], StringSplitOptions) as String[]", new string[] {@"String_split({0}, {1}, -1, {2} === ""RemoveEmptyEntries"")", "String_split", @"function (s, c, n, r) { var re = !c || c.length === 0 ? /\s/ : new RegExp(""("" + c.map(function (s) { return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, ""\\$&""); }).join(""|"") + "")""); var a = []; while (--n !== 0) { var p = s.search(re); if (p < 0) break; a = a.concat([s.substr(0, p)]); s = s.substr(p + 1); } a = a.concat([s]); if (r) a = a.filter(function (s) { return s.length > 0; }); return a; }"} },
			{ "String.Split(String[], Number, StringSplitOptions) as String[]", new string[] {@"String_split({0}, {1}, {2}, {3} === ""RemoveEmptyEntries"")", "String_split", @"function (s, c, n, r) { var re = !c || c.length === 0 ? /\s/ : new RegExp(""("" + c.map(function (s) { return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, ""\\$&""); }).join(""|"") + "")""); var a = []; while (--n !== 0) { var p = s.search(re); if (p < 0) break; a = a.concat([s.substr(0, p)]); s = s.substr(p + 1); } a = a.concat([s]); if (r) a = a.filter(function (s) { return s.length > 0; }); return a; }"} },
			{ "String.Split(String[], StringSplitOptions) as String[]", new string[] {@"String_split({0}, {1}, -1, {2} === ""RemoveEmptyEntries"")", "String_split", @"function (s, c, n, r) { var re = !c || c.length === 0 ? /\s/ : new RegExp(""("" + c.map(function (s) { return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, ""\\$&""); }).join(""|"") + "")""); var a = []; while (--n !== 0) { var p = s.search(re); if (p < 0) break; a = a.concat([s.substr(0, p)]); s = s.substr(p + 1); } a = a.concat([s]); if (r) a = a.filter(function (s) { return s.length > 0; }); return a; }"} },
			{ "String.StartsWith(String) as Boolean", new string[] {@"String_startsWith({0}, {1}, false)", "String_startsWith", @"function (s, p, i) { if (i) { s = s.toLowerCase(); p = p.toLowerCase(); } return s.substr(0, p.length) === p; }"} },
			{ "String.StartsWith(String, StringComparison) as Boolean", new string[] {@"String_startsWith({0}, {1}, /IgnoreCase$/.test({2}))", "String_startsWith", @"function (s, p, i) { if (i) { s = s.toLowerCase(); p = p.toLowerCase(); } return s.substr(0, p.length) === p; }"} },
			{ "String.Substring(Number) as String", new string[] {@"{0}.substr({1})", "", @""} },
			{ "String.Substring(Number, Number) as String", new string[] {@"{0}.substr({1}, {2})", "", @""} },
			{ "String.ToCharArray() as Char[]", new string[] {@"{0}.split("""")", "", @""} },
			{ "String.ToCharArray(Number, Number) as Char[]", new string[] {@"{0}.substr({1}, {2}).split("""")", "", @""} },
			{ "String.ToLower() as String", new string[] {@"{0}.toLowerCase()", "", @""} },
			{ "String.ToLowerInvariant() as String", new string[] {@"{0}.toLowerCase()", "", @""} },
			{ "String.ToString() as String", new string[] {@"{0}", "", @""} },
			{ "String.ToUpper() as String", new string[] {@"{0}.toUpperCase()", "", @""} },
			{ "String.ToUpperInvariant() as String", new string[] {@"{0}.toUpperCase()", "", @""} },
			{ "String.Trim() as String", new string[] {@"{0}.trim()", "", @""} },
			{ "String.Trim(Char[]) as String", new string[] {@"String_trim({0}, {1}, true, true)", "String_trim", @"function (s, c, l, r) { if (!c) { if (l && r) return s.trim(); if (l) return s.trimLeft(); else return s.trimRight(); } while (l & s.length > 0 && c.indexOf(s[0]) >= 0) s = s.substr(1); while (r & s.length > 0 && c.indexOf(s[s.length - 1]) >= 0) s = s.substr(0, s.length - 1); return s; }"} },
			{ "String.TrimEnd(Char[]) as String", new string[] {@"String_trim({0}, {1}, false, true)", "String_trim", @"function (s, c, l, r) { if (!c) { if (l && r) return s.trim(); if (l) return s.trimLeft(); else return s.trimRight(); } while (l & s.length > 0 && c.indexOf(s[0]) >= 0) s = s.substr(1); while (r & s.length > 0 && c.indexOf(s[s.length - 1]) >= 0) s = s.substr(0, s.length - 1); return s; }"} },
			{ "String.TrimStart(Char[]) as String", new string[] {@"String_trim({0}, {1}, true,false)", "String_trim", @"function (s, c, l, r) { if (!c) { if (l && r) return s.trim(); if (l) return s.trimLeft(); else return s.trimRight(); } while (l & s.length > 0 && c.indexOf(s[0]) >= 0) s = s.substr(1); while (r & s.length > 0 && c.indexOf(s[s.length - 1]) >= 0) s = s.substr(0, s.length - 1); return s; }"} },
			{ "static TimeSpan.Compare(TimeSpan, TimeSpan) as Number", new string[] {@"TimeSpan_compareTo({0}, {1})", "TimeSpan_compareTo", @"function (t1, t2) { if (t1 instanceof TimeSpan && t2 instanceof TimeSpan) { return t1.totalMilliseconds > t2.totalMilliseconds ? 1 : t1.totalMilliseconds < t2.totalMilliseconds ? -1 : 0; } else { return undefined; } }"} },
			{ "static TimeSpan.Equals(TimeSpan, TimeSpan) as Boolean", new string[] {@"(TimeSpan_compareTo({0}, {1}) === 0)", "TimeSpan_compareTo", @"function (t1, t2) { if (t1 instanceof TimeSpan && t2 instanceof TimeSpan) { return t1.totalMilliseconds > t2.totalMilliseconds ? 1 : t1.totalMilliseconds < t2.totalMilliseconds ? -1 : 0; } else { return undefined; } }"} },
			{ "static TimeSpan.FromDays(Number) as TimeSpan", new string[] {@"new TimeSpan({0}*86400000)", "", @""} },
			{ "static TimeSpan.FromHours(Number) as TimeSpan", new string[] {@"new TimeSpan({0}*3600000)", "", @""} },
			{ "static TimeSpan.FromMilliseconds(Number) as TimeSpan", new string[] {@"new TimeSpan({0})", "", @""} },
			{ "static TimeSpan.FromMinutes(Number) as TimeSpan", new string[] {@"new TimeSpan({0}*60000)", "", @""} },
			{ "static TimeSpan.FromSeconds(Number) as TimeSpan", new string[] {@"new TimeSpan({0}*1000)", "", @""} },
			{ "static TimeSpan.FromTicks(Number) as TimeSpan", new string[] {@"new TimeSpan({0}/10000)", "", @""} },
			{ "TimeSpan(Number)", new string[] {@"new TimeSpan({0}/10000)", "", @""} },
			{ "TimeSpan(Number, Number, Number)", new string[] {@"new TimeSpan((({0}*60 + {1})*60 + {2})*1000)", "", @""} },
			{ "TimeSpan(Number, Number, Number, Number)", new string[] {@"new TimeSpan(((({0}*24 + {1})*60 + {2})*60 + {3})*1000)", "", @""} },
			{ "TimeSpan(Number, Number, Number, Number, Number)", new string[] {@"new TimeSpan(((({0}*24 + {1})*60 + {2})*60 + {3})*1000 + {4})", "", @""} },
			{ "TimeSpan.Add(TimeSpan) as TimeSpan", new string[] {@"new TimeSpan({0}.totalMilliseconds + {1}.totalMilliseconds)", "", @""} },
			{ "TimeSpan.CompareTo(Object) as Number", new string[] {@"TimeSpan_compareTo({0}, {1})", "TimeSpan_compareTo", @"function (t1, t2) { if (t1 instanceof TimeSpan && t2 instanceof TimeSpan) { return t1.totalMilliseconds > t2.totalMilliseconds ? 1 : t1.totalMilliseconds < t2.totalMilliseconds ? -1 : 0; } else { return undefined; } }"} },
			{ "TimeSpan.CompareTo(TimeSpan) as Number", new string[] {@"TimeSpan_compareTo({0}, {1})", "TimeSpan_compareTo", @"function (t1, t2) { if (t1 instanceof TimeSpan && t2 instanceof TimeSpan) { return t1.totalMilliseconds > t2.totalMilliseconds ? 1 : t1.totalMilliseconds < t2.totalMilliseconds ? -1 : 0; } else { return undefined; } }"} },
			{ "TimeSpan.Days as Number", new string[] {@"{0}.days", "", @""} },
			{ "TimeSpan.Duration() as TimeSpan", new string[] {@"new TimeSpan(Math.abs({0}.totalMilliseconds))", "", @""} },
			{ "TimeSpan.Equals(Object) as Boolean", new string[] {@"(TimeSpan_compareTo({0}, {1}) === 0)", "TimeSpan_compareTo", @"function (t1, t2) { if (t1 instanceof TimeSpan && t2 instanceof TimeSpan) { return t1.totalMilliseconds > t2.totalMilliseconds ? 1 : t1.totalMilliseconds < t2.totalMilliseconds ? -1 : 0; } else { return undefined; } }"} },
			{ "TimeSpan.Equals(TimeSpan) as Boolean", new string[] {@"({0}.totalMilliseconds === {1}.totalMilliseconds)", "", @""} },
			{ "TimeSpan.Hours as Number", new string[] {@"{0}.hours", "", @""} },
			{ "TimeSpan.MaxValue as TimeSpan", new string[] {@"new TimeSpan(922337203685477.5807)", "", @""} },
			{ "TimeSpan.Milliseconds as Number", new string[] {@"{0}.milliseconds", "", @""} },
			{ "TimeSpan.Minutes as Number", new string[] {@"{0}.minutes", "", @""} },
			{ "TimeSpan.MinValue as TimeSpan", new string[] {@"new TimeSpan(-922337203685477.5808)", "", @""} },
			{ "TimeSpan.Negate() as TimeSpan", new string[] {@"new TimeSpan(-{0}.totalMilliseconds)", "", @""} },
			{ "TimeSpan.Seconds as Number", new string[] {@"{0}.seconds", "", @""} },
			{ "TimeSpan.Subtract(TimeSpan) as TimeSpan", new string[] {@"new TimeSpan({0}.totalMilliseconds - {1}.totalMilliseconds)", "", @""} },
			{ "TimeSpan.Ticks as Number", new string[] {@"({0}.totalMilliseconds*10000)", "", @""} },
			{ "TimeSpan.TicksPerDay as Number", new string[] {@"864000000000", "", @""} },
			{ "TimeSpan.TicksPerHour as Number", new string[] {@"36000000000", "", @""} },
			{ "TimeSpan.TicksPerMillisecond as Number", new string[] {@"10000", "", @""} },
			{ "TimeSpan.TicksPerMinute as Number", new string[] {@"600000000", "", @""} },
			{ "TimeSpan.TicksPerSecond as Number", new string[] {@"10000000", "", @""} },
			{ "TimeSpan.ToString() as String", new string[] {@"{0}.toString()", "", @""} },
			{ "TimeSpan.TotalDays as Number", new string[] {@"{0}.totalDays", "", @""} },
			{ "TimeSpan.TotalHours as Number", new string[] {@"{0}.totalHours", "", @""} },
			{ "TimeSpan.TotalMilliseconds as Number", new string[] {@"{0}.totalMilliseconds", "", @""} },
			{ "TimeSpan.TotalMinutes as Number", new string[] {@"{0}.totalMinutes", "", @""} },
			{ "TimeSpan.TotalSeconds as Number", new string[] {@"{0}.totalSeconds", "", @""} },
			{ "TimeSpan.Zero as TimeSpan", new string[] {@"new TimeSpan(0)", "", @""} },
			{ "Boolean?.Value as Boolean", new string[] {@"{0}", "", @""} },
			{ "Char?.Value as Char", new string[] {@"{0}", "", @""} },
			{ "Date?.Value as Date", new string[] {@"{0}", "", @""} },
			{ "Guid?.Value as Guid", new string[] {@"{0}", "", @""} },
			{ "Number?.Value as Number", new string[] {@"{0}", "", @""} },
			{ "TimeSpan?.Value as TimeSpan", new string[] {@"{0}", "", @""} },
		};

		#endregion

		static Regex numberRegex = new Regex("SByte|Byte|UInt16|Int16|UInt32|Int32|UInt64|Int64|Single|Double|Decimal", RegexOptions.Compiled);
		static Regex expressionRegex = new Regex(@"\{(?<index>\d+)\}", RegexOptions.Compiled);

		IList<Func<MemberInfo, MemberTranslation>> translators = new List<Func<MemberInfo, MemberTranslation>>();
		Dictionary<MemberInfo, MemberTranslation> translations = new Dictionary<MemberInfo, MemberTranslation>();

		#endregion

		#region Constructors

		public JavaScriptExpressionTranslator()
		{
			//if (isFirst)
			//{
			//    Char lastChar = Char.MinValue;
			//    bool sequence = false;
			//    for (var c = Char.MinValue; c < Char.MaxValue; c++)
			//    {
			//        if (Char.IsSeparator(c))
			//        {
			//            if (lastChar != (char)(c - 1))
			//                Console.Write("\\u" + ((uint)c).ToString("x4"));
			//            else
			//                sequence = true;
			//            lastChar = c;
			//        }
			//        else
			//        {
			//            if (sequence)
			//                Console.Write("-\\u" + ((uint)lastChar).ToString("x4"));
			//            sequence = false;
			//        }
			//    }
			//    var members = new HashSet<string>();
			//    foreach (var member in supportedTypes.Keys.SelectMany(t => t.GetMembers()))
			//    {
			//        var signature = GetSignature(member);
			//        if (!String.IsNullOrEmpty(signature))
			//            members.Add(signature);
			//    }
			//    foreach (var member in members.OrderBy(s => s))
			//        Console.WriteLine(member);
			//    isFirst = false;
			//}



			AddMemberTranslator(m =>
			{
				// First see if the member is explicitly supported
				if (supportedTypes.ContainsKey(m.DeclaringType))
				{
					var signature = GetSignature(m);
					if (signature != null)
					{
						string[] implementation;
						if (supportedMembers.TryGetValue(signature, out implementation))
						{
							// Create and return the translation if the member is explicitly supported
							MemberTranslation translation =
								m is FieldInfo ? new FieldTranslation((FieldInfo)m, implementation[0], null) :
								m is PropertyInfo ? new PropertyTranslation((PropertyInfo)m, implementation[0], null) :
								m is ConstructorInfo ? new ConstructorTranslation((ConstructorInfo)m, implementation[0]) :
										(MemberTranslation)new MethodTranslation((MethodInfo)m, implementation[0]);
							if (!String.IsNullOrEmpty(implementation[1]))
								translation.AddExport(implementation[1], implementation[2]);
							return translation;
						}
					}
				}

				// Constructors
				if (m is ConstructorInfo)
				{
					var constructor = m as ConstructorInfo;

					// See if the type being constructed is a model type using the default constructor
					ModelType type;
					if (constructor.GetParameters().Length == 0 && (type = ModelContext.Current.GetModelType(constructor.DeclaringType)) != null)
						return new ConstructorTranslation(constructor, "new " + type.Name + "()");
				}

				// Properties
				if (m is PropertyInfo)
				{
					// See if the property is a model property
					ModelType type;
					if ((type = ModelContext.Current.GetModelType(m.DeclaringType)) != null && type.Properties.Contains(m.Name))
					{
						// Get the model property
						var mp = type.Properties[m.Name];

						// Return the appropriate translation
						return mp.IsStatic ?

							// Static
							new PropertyTranslation((PropertyInfo)m, mp.DeclaringType.Name + ".get_" + m.Name + "()", mp.DeclaringType.Name + ".set_" + m.Name + "({0})") :

							// Instance
							new PropertyTranslation((PropertyInfo)m, "{0}.get_" + m.Name + "()", "{0}.set_" + m.Name + "({1})");
					}

					// See if the property represents the Count or Length property of an array or list
					if (((m.DeclaringType.IsArray || m.DeclaringType == typeof(Array)) && m.Name == "Length") || (m.DeclaringType.GetInterfaces().Any(i => i == typeof(IEnumerable)) && m.Name == "Count"))
						return new PropertyTranslation((PropertyInfo)m, "{0}.length", null);
				}

				// Methods
				if (m is MethodInfo)
				{
					var method = m as MethodInfo;

					// See if the method is from ModelInstance
					if (method.DeclaringType == typeof(ModelInstance))
					{
						if (method.Name == "get_Item")
							return new MethodTranslation(method, "{0}.get({1})");
						if (method.Name == "GetModelInstance")
							return new MethodTranslation(method, "{0}");
						if (method.Name == "ToString" && method.GetParameters().Length == 1)
							return new MethodTranslation(method, "{0}.toString({1})");
						return null;
					}

					// See if the method represents a linq enumeration expression, such as Sum() or Where()
					var parameters = method.GetParameters();

					// OfType<>
					if (parameters.Length == 1 && method.DeclaringType == typeof(System.Linq.Enumerable) && method.Name == "OfType")
					{
						var filterType = ModelContext.Current.GetModelType(method.GetGenericArguments()[0]);
						if (filterType != null)
							return new MethodTranslation(method, "{0}.filter(function(i) { return i instanceof " + filterType.Name + "; }, this)");
						else
							return null;
					}
					// ToArray()
					if (parameters.Length == 1 && method.DeclaringType == typeof(System.Linq.Enumerable) && method.Name == "ToArray")
					{
						return new MethodTranslation(method, "{0}");
					}
					// Cast<Object>()
					if (parameters.Length == 1 && method.DeclaringType == typeof(System.Linq.Enumerable) && method.Name == "Cast")
					{
						return new MethodTranslation(method, "{0}");
					}

					var target = method.IsStatic ? (parameters.Length > 0 ? parameters[0].ParameterType : null) : m.DeclaringType;
					var listType = target == null ? null : (target.IsGenericType && target.GetGenericTypeDefinition() == typeof(IEnumerable<>) ? target :
						target.GetInterfaces().Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEnumerable<>)).FirstOrDefault());
					if (listType == null)
						return null;
					if (method.IsStatic)
						parameters = parameters.Skip(1).ToArray();

					// Check for supported enumeration methods that take no arguments
					if (parameters.Length == 0 && typeof(IEnumerableSignatures).GetMethods()
						.Any(em => em.GetParameters().Length == 0 && em.Name.Equals(method.Name, StringComparison.OrdinalIgnoreCase)))
					{
						switch (method.Name.ToLower())
						{
							case "any": return new MethodTranslation(method, "{0}.length > 0");
							case "count": return new MethodTranslation(method, "{0}.length");
							case "first": return new MethodTranslation(method, "{0}[0]");
							case "firstordefault": return new MethodTranslation(method, "({0}[0] || null)");
							case "last": return new MethodTranslation(method, "Array_last({0})").AddExport("Array_last", "function (a) { if (a.length > 0) return a[a.length - 1]; }");
							case "lastordefault": return new MethodTranslation(method, "(Array_last({0}) || null)").AddExport("Array_last", "function (a) { if (a.length > 0) return a[a.length - 1]; }");
						}
					}

					// Check for supported IEnumerable<T> methods that take a single Func<T,X> delegate selector
					else if (parameters.Length == 1 &&
						parameters[0].ParameterType.IsGenericType &&
						parameters[0].ParameterType.GetGenericTypeDefinition() == typeof(Func<,>) &&
						parameters[0].ParameterType.GetGenericArguments()[0].IsAssignableFrom(listType.GetGenericArguments()[0]) &&
						typeof(IEnumerableSignatures).GetMethods().Any(em =>
							em.GetParameters().Length == 1 && em.Name.Equals(method.Name, StringComparison.OrdinalIgnoreCase) &&
							em.GetParameters()[0].ParameterType.IsAssignableFrom(parameters[0].ParameterType.GetGenericArguments()[1])))
					{
						switch (m.Name.ToLower())
						{
							case "where": return new MethodTranslation(method, "{0}.filter({1}, this)");
							case "any": return new MethodTranslation(method, "{0}.some({1}, this)");
							case "all": return new MethodTranslation(method, "{0}.every({1}, this)");
							case "count": return new MethodTranslation(method, "{0}.filter({1}, this).length");
							case "min": return new MethodTranslation(method, "{0}.map({1}, this).reduce(function (p,c,i) { return i > 0 && p < c ? p : c; })");
							case "max": return new MethodTranslation(method, "{0}.map({1}, this).reduce(function (p,c,i) { return i > 0 && p > c ? p : c; })");
							case "sum": return new MethodTranslation(method, "{0}.map({1}, this).reduce(function (p,c) { return p + c; }, 0)");
							case "average": return new MethodTranslation(method, "{0}.map({1}, this).reduce(function (p,c,i,a) { return p + c/a.length; }, 0)");
							case "select": return new MethodTranslation(method, "{0}.map({1}, this)");
							case "first": return new MethodTranslation(method, "({0}.filter({1}, this)[0] || null)");
							case "firstordefault": return new MethodTranslation(method, "({0}.filter({1}, this)[0] || null)");
							case "last": return new MethodTranslation(method, "Array_last({0}.filter({1}, this))").AddExport("Array_last", "function (a) { if (a.length > 0) return a[a.length - 1]; }");
							case "lastordefault": return new MethodTranslation(method, "(Array_last({0}.filter({1}, this)) || null)").AddExport("Array_last", "function (a) { if (a.length > 0) return a[a.length - 1]; }");
							case "orderby": return new MethodTranslation(method, "{0}.map(function (i) { return { key: {1}(i), value: i }; }).sort(function (a, b) { return a.key == b.key ? 0 : a.key < b.key ? -1 : 1; }).map(function (i) { return i.value; })");
							case "orderbydescending": return new MethodTranslation(method, "{0}.map(function (i) { return { key: {1}(i), value: i }; }).sort(function (a, b) { return a.key == b.key ? 0 : a.key < b.key ? 1 : -1; }).map(function (i) { return i.value; })");
						}
					}

					// Check for supported enumeration methods that take a single literal argument
					else if (parameters.Length == 1 && typeof(IEnumerableSignatures).GetMethods()
						.Any(em => em.GetParameters().Length == 1 && em.Name.Equals(method.Name, StringComparison.OrdinalIgnoreCase)))
					{
						switch (method.Name.ToLower())
						{
							case "contains": return new MethodTranslation(method, "{0}.indexOf({1}) >= 0");
						}
					}
				}

				return null;
			});
		}

		#endregion

		#region Methods

		/// <summary>
		/// Gets a unique string signature of a supported member.
		/// </summary>
		public static string GetSignature(MemberInfo member)
		{
			// Field
			if (member is FieldInfo)
			{
				var field = member as FieldInfo;
				if (IsSupported(field.FieldType))
					return (field.IsStatic ? "static " : "") + GetTypeName(field.DeclaringType) + "." + field.Name + " as " + GetTypeName(field.FieldType);
			}

			// Property
			else if (member is PropertyInfo)
			{
				var property = member as PropertyInfo;
				var parameters = property.GetIndexParameters();
				if (IsSupported(property.PropertyType) && parameters.All(p => IsSupported(p.ParameterType)))
				{
					var signature = property.GetGetMethod().IsStatic ? "static " : "";
					signature += GetTypeName(property.DeclaringType) + "." + numberRegex.Replace(property.Name, "Number");
					if (parameters.Length > 0)
						signature += "[" + String.Join(", ", parameters.Select(p => GetTypeName(p.ParameterType)).ToArray()) + "]";
					signature += " as " + GetTypeName(property.PropertyType);
					return signature;
				}
			}

			// Method
			else if (member is MethodInfo)
			{
				var method = member as MethodInfo;
				var parameters = method.GetParameters();
				if (IsSupported(method.ReturnType) && parameters.All(p => IsSupported(p.ParameterType)) && !method.IsSpecialName)
				{
					var signature = method.IsStatic ? "static " : "";
					signature += GetTypeName(method.DeclaringType) + "." + numberRegex.Replace(method.Name, "Number");
					signature += "(" + String.Join(", ", parameters.Select(p => GetTypeName(p.ParameterType)).ToArray()) + ")";
					signature += " as " + GetTypeName(method.ReturnType);
					return signature;
				}
			}

			// Constructor
			else if (member is ConstructorInfo)
			{
				var constructor = member as ConstructorInfo;
				var parameters = constructor.GetParameters();
				if (parameters.All(p => IsSupported(p.ParameterType)))
					return GetTypeName(constructor.DeclaringType) + "(" + String.Join(", ", parameters.Select(p => GetTypeName(p.ParameterType)).ToArray()) + ")";

			}

			return null;
		}

		/// <summary>
		/// Gets the short name of the supported <see cref="Type"/>.
		/// </summary>
		/// <param name="type"></param>
		/// <returns></returns>
		static string GetTypeName(Type type)
		{
			string typeName;
			return
				type.IsEnum ? type.Name :
				type.IsArray ? GetTypeName(type.GetElementType()) + "[]" :
				supportedTypes.TryGetValue(type, out typeName) ? typeName :
				type.FullName;
		}

		/// <summary>
		/// Determines if the specified <see cref="Type"/> is supported for default translation to javascript.
		/// </summary>
		/// <param name="type"></param>
		/// <returns></returns>
		static bool IsSupported(Type type)
		{
			return supportedTypes.ContainsKey(type) || type.IsEnum ||
				(type.IsArray && type.GetArrayRank() == 1 && IsSupported(type.GetElementType()));
		}

		/// <summary>
		/// Determines if the specified <see cref="Type"/> is supported for default translation to javascript.
		/// </summary>
		/// <param name="type"></param>
		/// <returns></returns>
		public bool CanTranslate(MemberInfo member)
		{
			return GetTranslation(member) != null;
		}

		/// <summary>
		/// Adds a translator delegate to the current builder responsible for creating
		/// <see cref="MemberTranslation"/> instances for supported <see cref="MethodInfo"/> instances.
		/// </summary>
		/// <param name="translator"></param>
		/// <remarks>Translators should return null if they do not support translation of requested method</remarks>
		public void AddMemberTranslator(Func<MemberInfo, MemberTranslation> translator)
		{
			translators.Add(translator);
		}

		/// <summary>
		/// Gets the first translation from the current set of member translators
		/// for the specified <see cref="MemberInfo"/>.
		/// </summary>
		/// <param name="member"></param>
		/// <returns>The best translation to use, or null if no translation exists.</returns>
		MemberTranslation GetTranslation(MemberInfo member)
		{
			MemberTranslation translation;
			if (!translations.TryGetValue(member, out translation))
			{
				foreach (var translator in translators.Reverse())
				{
					translation = translator(member);
					if (translation != null)
					{
						translations[member] = translation;
						return translation;
					}
				}
			}
			return translation;
		}

		/// <summary>
		/// Attempts to translate the specified expression to javascript.  
		/// </summary>
		/// <param name="expression"></param>
		/// <param name="js"></param>
		/// <param name="exports"></param>
		/// <param name="exceptions"></param>
		/// <returns></returns>
		public LambdaTranslation Translate(LambdaExpression expression)
		{
			return new ExpressionBuilder(this, expression).Translation;
		}

		#endregion

		#region ExpressionBuilder

		/// <summary>
		/// Visits a single <see cref="LambdaExpression"/> to produce a corresonding javascript expression.
		/// </summary>
		class ExpressionBuilder : ModelExpression.ExpressionVisitor
		{
			JavaScriptExpressionTranslator translator;
			Dictionary<ParameterExpression, int> ids = new Dictionary<ParameterExpression, int>();
			HashSet<ParameterExpression> thisParams = new HashSet<ParameterExpression>();
			StringBuilder builder = new StringBuilder();

			internal ExpressionBuilder(JavaScriptExpressionTranslator translator, LambdaExpression expression)
			{
				this.translator = translator;
				this.Translation = new LambdaTranslation();
				VisitLambda(expression, this.Translation);
			}

			/// <summary>
			/// Gets the set of translation exceptions that occurred, if any, while translating the expression to javascript.
			/// </summary>
			internal LambdaTranslation Translation { get; private set; }

			protected override Expression VisitTypeIs(TypeBinaryExpression node)
			{
				builder.Append("(");
				Visit(node.Expression);
				builder.Append(" instanceof ");
				builder.Append(ModelContext.Current.GetModelType(node.TypeOperand).Name);
				builder.Append(")");

				return node;
			}

			protected override Expression VisitBinary(BinaryExpression node)
			{
				builder.Append("(");


				// Create TimeSpan if subtracting two DateTime instances
				if (node.Left.Type == typeof(DateTime) && node.Right.Type == typeof(DateTime) && node.Type == typeof(TimeSpan))
					builder.Append("new TimeSpan(");

				// Handle concatenation of strings to ensure correct implicit conversion
				if (node.NodeType == ExpressionType.Add && node.Left.Type == typeof(string) && node.Left.GetType() != typeof(ConstantExpression) && !typeof(BinaryExpression).IsAssignableFrom(node.Left.GetType()))
				{
					Translation.Exports["str"] = @"function (o) { if (o === undefined || o === null) return """"; return o.toString(); }";
					builder.Append("str(");
					Visit(node.Left);
					builder.Append(")");
				}
				else if ((node.Left.Type == typeof(DateTime) || node.Left.Type == typeof(DateTime?)) && (node.NodeType == ExpressionType.Equal || node.NodeType == ExpressionType.NotEqual))
				{
					builder.Append("(");
					Visit(node.Left);
					builder.Append(" ? ");
					Visit(node.Left);
					builder.Append(".getTime() : null)");
				}
				else
					Visit(node.Left);

				builder.Append(GetOperator(node.NodeType));

				// Handle concatenation of strings to ensure correct implicit conversion
				if (node.NodeType == ExpressionType.Add && node.Right.Type == typeof(string) && node.Right.GetType() != typeof(ConstantExpression) && !typeof(BinaryExpression).IsAssignableFrom(node.Right.GetType()))
				{
					Translation.Exports["str"] = @"function (o) { if (o === undefined || o === null) return """"; return o.toString(); }";
					builder.Append("str(");
					Visit(node.Right);
					builder.Append(")");
				}
				else if ((node.Left.Type == typeof(DateTime) || node.Left.Type == typeof(DateTime?)) && (node.NodeType == ExpressionType.Equal || node.NodeType == ExpressionType.NotEqual))
				{
					builder.Append("(");
					Visit(node.Right);
					builder.Append(" ? ");
					Visit(node.Right);
					builder.Append(".getTime() : null)");
				}
				else
					Visit(node.Right);

				// Create TimeSpan if subtracting two DateTime instances
				if (node.Left.Type == typeof(DateTime) && node.Right.Type == typeof(DateTime) && node.Type == typeof(TimeSpan))
					builder.Append(")");

				builder.Append(")");

				return node;
			}

			protected override Expression VisitNewArray(NewArrayExpression na)
			{
				builder.Append("[");
				base.VisitNewArray(na);
				builder.Append("]");
				return na;
			}

			protected override ElementInit VisitElementInitializer(ElementInit initializer)
			{
				return base.VisitElementInitializer(initializer);
			}

			/// <summary>
			/// Outputs a tiernary expression as (condition ? true : false).
			/// </summary>
			/// <param name="c"></param>
			/// <returns></returns>
			protected override Expression VisitConditional(ConditionalExpression c)
			{
				builder.Append("(");
				Visit(c.Test);
				builder.Append(" ? ");
				Visit(c.IfTrue);
				builder.Append(" : ");
				Visit(c.IfFalse);
				builder.Append(")");
				return c;
			}

			/// <summary>
			/// Outputs all expression lists as expressions separated by commas.
			/// </summary>
			/// <param name="expressions"></param>
			/// <returns></returns>
			protected override System.Collections.ObjectModel.ReadOnlyCollection<T> VisitExpressionList<T>(System.Collections.ObjectModel.ReadOnlyCollection<T> expressions)
			{
				bool isFirst = true;
				foreach (var exp in expressions)
				{
					if (isFirst)
						isFirst = false;
					else
						builder.Append(", ");
					Visit(exp);
				}
				return expressions;
			}

			/// <summary>
			/// Outputs constant values as javascript literals.
			/// </summary>
			/// <param name="c"></param>
			/// <returns></returns>
			protected override Expression VisitConstant(ConstantExpression c)
			{
				if (c.Value == null)
					builder.Append("null");
				else if (c.Type == typeof(string))
					builder.Append("\"").Append(System.Web.HttpUtility.JavaScriptStringEncode((string)c.Value)).Append("\"");
				else if (c.Type == typeof(char) || c.Type.IsEnum)
					builder.Append("\"").Append(c.Value).Append("\"");
				else if (c.Type == typeof(DateTime) || c.Type == typeof(DateTime?))
				{
					var dateValue = (DateTime)c.Value;
					long milliseconds = (long)dateValue.Subtract(new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
					// Local time, account for time zone and daylight savings
					if (dateValue.Kind == DateTimeKind.Local)
						builder.Append("new Date(").Append(milliseconds).Append(" + new Date(").Append(milliseconds).Append(").getTimezoneOffset()*60000)");
					else
						builder.Append("new Date(").Append(milliseconds).Append(")");
				}
				else if (c.Type == typeof(bool))
					builder.Append(((bool)c.Value).ToString().ToLower());
				else if (c.Type == typeof(decimal) || c.Type == typeof(double) || c.Type == typeof(float) || c.Type == typeof(decimal?) || c.Type == typeof(double?) || c.Type == typeof(float?))
					builder.AppendFormat(CultureInfo.InvariantCulture, "{0}", c.Value);
				else
					builder.Append(c.Value);
				return c;
			}

			/// <summary>
			/// Outputs property access as .get_PropertyName() function calls.
			/// </summary>
			/// <param name="m"></param>
			/// <returns></returns>
			protected override Expression VisitMemberAccess(MemberExpression m)
			{
				if (m.Member is FieldInfo)
					TranslateMember((FieldInfo)m.Member, (FieldTranslation t) => t.GetExpression, () => new Expression[] { m.Expression });
				else
					TranslateMember((PropertyInfo)m.Member, (PropertyTranslation t) => t.GetExpression, () => new Expression[] { m.Expression });

				return m;
			}

			protected override Expression VisitInvocation(InvocationExpression iv)
			{
				return base.VisitInvocation(iv);
			}

			protected override Expression Visit(Expression exp)
			{
				return base.Visit(exp);
			}

			protected override Expression VisitUnary(UnaryExpression u)
			{
				if (u.NodeType == ExpressionType.Not)
					builder.Append("(!(");
				else if (u.NodeType == ExpressionType.Negate)
					builder.Append("(-(");
				var expr = base.VisitUnary(u);
				if (u.NodeType == ExpressionType.Not || u.NodeType == ExpressionType.Negate)
					builder.Append("))");
				return expr;
			}

			protected override Expression VisitLambda(LambdaExpression lambda)
			{
				builder.Append("function(");
				for (int i = 0; i < lambda.Parameters.Count; i++)
				{
					if (i > 0)
						builder.Append(", ");
					VisitParameter(lambda.Parameters[i]);
				}
				builder.Append(") {");
				if (lambda.Body.Type != typeof(void))
				{
					builder.Append("return ");
				}
				base.Visit(lambda.Body);
				builder.Append("; }");
				return lambda;
			}

			protected Expression VisitLambda(LambdaExpression lambda, LambdaTranslation translation)
			{
				// First translate the lambda body
				if (lambda.Parameters.Any())
					thisParams.Add(lambda.Parameters[0]);

				// Ensure converted numeric equations do not result in Infinity or NaN
				if (IsNumericType(lambda.Body.Type))
				{
					builder.Append("function(){");
					builder.Append("var result = ");
					base.Visit(lambda.Body);
					builder.Append(";");
					builder.Append("return isFinite(result) ? result : null; }.call(this)");
				}
				else
					base.Visit(lambda.Body);


				translation.Body = builder.ToString();

				// Then wrap the expression in a function
				if (lambda.Body.Type != typeof(void))
					builder.Insert(0, "return ");

				builder.Insert(0, ") {");
				for (int i = lambda.Parameters.Count - 1; i > 0; i--)
				{
					var parameter = lambda.Parameters[i];
					builder.Insert(0, String.IsNullOrEmpty(parameter.Name) ? "p" + GetParamId(parameter) : parameter.Name);
					if (i > 1)
						builder.Append(", ");
				}
				builder.Insert(0, "function(");
				builder.Append("; }");
				translation.Function = builder.ToString();
				return lambda;
			}

			static bool IsNumericType(Type type)
			{
				type = type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Nullable<>) ? type.GetGenericArguments()[0] : type;
				if (type.IsEnum) return false;

				switch (Type.GetTypeCode(type))
				{
					case TypeCode.Single:
					case TypeCode.Double:
					case TypeCode.Decimal:
					case TypeCode.SByte:
					case TypeCode.Int16:
					case TypeCode.Int32:
					case TypeCode.Int64:
					case TypeCode.Byte:
					case TypeCode.UInt16:
					case TypeCode.UInt32:
					case TypeCode.UInt64:
						return true;
					default:
						return false;
				}
			}

			protected override IEnumerable<MemberBinding> VisitBindingList(System.Collections.ObjectModel.ReadOnlyCollection<MemberBinding> original)
			{
				return base.VisitBindingList(original);
			}
			/// <summary>
			/// Translates calls to constructors.
			/// </summary>
			/// <param name="nex"></param>
			/// <returns></returns>
			protected override NewExpression VisitNew(NewExpression nex)
			{
				TranslateMember(nex.Constructor, (ConstructorTranslation t) => t.Expression, () => nex.Arguments);
				return nex;
			}

			/// <summary>
			/// Translates calls to methods.
			/// </summary>
			/// <param name="m"></param>
			/// <returns></returns>
			protected override Expression VisitMethodCall(MethodCallExpression m)
			{
				// Determine if ToString is being called on a model reference property
				var propertyExpression = m.Object as ModelExpression.ModelMemberExpression;
				//if (propertyExpression != null && m.Method == objectToString && propertyExpression.Property is ModelReferenceProperty)
				//{
				//	ModelStep step;
				//	if (steps.TryGetValue(m.Object, out step))
				//	{
				//		var referenceProperty = (ModelReferenceProperty)propertyExpression.Property;
				//		referenceProperty.PropertyType.AddFormatSteps(step, referenceProperty.Format);
				//	}
				//}

				TranslateMember(m.Method, (MethodTranslation t) => t.Expression, () => m.Object == null ? m.Arguments : new Expression[] { m.Object }.Concat(m.Arguments));
				return m;
			}

			/// <summary>
			/// Attempts to translate a member (field, constructor, property, or method) into javascript.
			/// </summary>
			/// <typeparam name="TMember"></typeparam>
			/// <typeparam name="TTranslation"></typeparam>
			/// <param name="member"></param>
			/// <param name="expression"></param>
			/// <param name="arguments"></param>
			void TranslateMember<TMember, TTranslation>(TMember member, Func<TTranslation, string> expression, Func<IEnumerable<Expression>> arguments)
				where TMember : MemberInfo
				where TTranslation : MemberTranslation
			{
				// Get the translation for the specified member
				var translation = translator.GetTranslation(member);
				if (translation == null)
					Translation.Exceptions.Add(new TranslationException(member.ToString() + " for " + member.DeclaringType.FullName + " cannot be translated to javascript.", member, Translation.Exceptions.LastOrDefault()));
				else
				{
					// Track export dependencies
					foreach (var export in translation.Exports)
						Translation.Exports[export.Key] = export.Value;

					// Output the translation
					var index = 0;
					string exp = expression((TTranslation)translation);
					var args = arguments().ToArray();

					// Process each argument substitution
					foreach (Match arg in expressionRegex.Matches(exp))
					{
						// Output any literal content before the current argument substitution
						if (arg.Index > index)
							builder.Append(exp.Substring(index, arg.Index - index));

						// Determine the index of the current argument
						var argIndex = Int32.Parse(arg.Groups["index"].Value);

						// Make sure the argument index is valid
						if (argIndex < 0 || argIndex >= args.Length)
						{
							Translation.Exceptions.Add(new TranslationException(
								"The expression '" + exp + "' references argument " + arg.Groups["index"].Value + " which does not exist in " + translation, member, Translation.Exceptions.LastOrDefault()));
							return;
						}

						// Visit the argument
						Visit(args[argIndex]);
						index = arg.Index + arg.Length;
					}

					// Output any literal content following the last argument substitution
					if (index < exp.Length)
						builder.Append(exp.Substring(index));
				}
			}

			protected override Expression VisitParameter(ParameterExpression node)
			{
				if (thisParams.Contains(node))
					builder.Append("this");
				else
					builder.Append(String.IsNullOrEmpty(node.Name) ? "p" + GetParamId(node) : node.Name);
				base.VisitParameter(node);
				return node;
			}

			static string GetOperator(ExpressionType nodeType)
			{
				switch (nodeType)
				{
					case ExpressionType.Add:
						return " + ";
					case ExpressionType.Multiply:
						return " * ";
					case ExpressionType.Subtract:
						return " - ";
					case ExpressionType.Divide:
						return " / ";
					case ExpressionType.MemberInit:
						return " = ";
					case ExpressionType.Equal:
						return " === ";
					case ExpressionType.NotEqual:
						return " !== ";
					case ExpressionType.AndAlso:
						return " && ";
					case ExpressionType.OrElse:
						return " || ";
					case ExpressionType.LessThan:
						return " < ";
					case ExpressionType.LessThanOrEqual:
						return " <= ";
					case ExpressionType.GreaterThan:
						return " > ";
					case ExpressionType.GreaterThanOrEqual:
						return " >= ";
					case ExpressionType.Coalesce:
						return " || ";
				}
				throw new NotImplementedException("Operator not implemented");
			}

			int GetParamId(ParameterExpression p)
			{
				if (ids == null)
					ids = new Dictionary<ParameterExpression, int>();

				int count;
				if (!this.ids.TryGetValue(p, out count))
				{
					count = this.ids.Count;
					ids.Add(p, count);
				}
				return count;
			}
		}

		#endregion

		#region LambdaTranslation

		/// <summary>
		/// Represents the translation of a <see cref="LambdaExpression"/> to an anonymous javascript function.
		/// </summary>
		public class LambdaTranslation
		{
			internal LambdaTranslation()
			{
				Exports = new Dictionary<string, string>();
				Exceptions = new List<TranslationException>();
			}

			public LambdaExpression Expression { get; internal set; }

			public string Function { get; internal set; }

			public string Body { get; internal set; }

			public IDictionary<string, string> Exports { get; private set; }

			public IList<TranslationException> Exceptions { get; private set; }
		}

		#endregion

		#region MemberTranslation

		/// <summary>
		/// Describes how to translate a type member (field, property, method, or constructor) into javascript.
		/// </summary>
		public abstract class MemberTranslation
		{
			protected MemberTranslation()
			{
				this.Exports = new Dictionary<string, string>();
			}

			/// <summary>
			/// Gets the names and implementation for functions that will be used by the 
			/// member expressions to implement the method translation.
			/// </summary>
			public Dictionary<string, string> Exports { get; private set; }

			/// <summary>
			/// Gets the set of members the current member translation depends on, thus ensuring
			/// that export dependencies are included when this member is translated.
			/// </summary>
			public List<MemberInfo> DependsOn { get; private set; }

			/// <summary>
			/// Adds an exported javascript function to the current translation and returns the translation
			/// to support chaining.
			/// </summary>
			/// <param name="name"></param>
			/// <param name="implementation"></param>
			/// <returns></returns>
			public MemberTranslation AddExport(string name, string implementation)
			{
				Exports[name] = implementation;
				return this;
			}
		}

		/// <summary>
		/// Describes how to translate a type member (field, property, method, or constructor) into javascript.
		/// </summary>
		public abstract class MemberTranslation<T> : MemberTranslation
			where T : MemberInfo
		{
			/// <summary>
			/// Constructs a new <see cref="MemberTranslation"/> for the specified <see cref="MemberInfo"/>.
			/// </summary>
			/// <param name="member"></param>
			/// <param name="expression"></param>
			protected MemberTranslation(T member)
			{
				this.Member = member;
			}

			/// <summary>
			/// Gets the member being translated.
			/// </summary>
			public T Member { get; private set; }

			/// <summary>
			/// Gets the string representation of the member being translated.
			/// </summary>
			/// <returns></returns>
			public override string ToString()
			{
				return Member.ToString() + " for " + Member.DeclaringType.FullName;
			}
		}

		#endregion

		#region FieldTranslation

		/// <summary>
		/// Describes how to translate a field into javascript.
		/// </summary>
		public class FieldTranslation : MemberTranslation<FieldInfo>
		{
			/// <summary>
			/// Constructs a new <see cref="FieldTranslation"/> that only requires 
			/// an explicit expression implementation.
			/// </summary>
			/// <param name="field"></param>
			/// <param name="expression"></param>
			public FieldTranslation(FieldInfo field, string getExpression, string setExpression)
				: base(field)
			{
				this.GetExpression = getExpression;
				this.SetExpression = setExpression;
			}

			/// <summary>
			/// Gets or sets the equivalent javascript expression for getting the value of the field.
			/// </summary>
			/// <remarks>
			/// <para>
			/// The expression should contain a placeholder of {0} representing the instance the field is on.
			/// </para>
			/// </remarks>
			public string GetExpression { get; private set; }

			/// <summary>
			/// Gets or sets the equivalent javascript expression for setting the value of the field.
			/// </summary>
			/// <remarks>
			/// <para>
			/// The expression should contain a placeholder of {0} representing the instance the field is on
			/// and {1} for the value being assigned to the field.
			/// </para>
			/// </remarks>
			public string SetExpression { get; private set; }
		}

		#endregion

		#region ConstructorTranslation

		/// <summary>
		/// Describes how to translate a constructor into javascript.
		/// </summary>
		public class ConstructorTranslation : MemberTranslation<ConstructorInfo>
		{
			/// <summary>
			/// Constructs a new <see cref="ConstructorTranslation"/> that only requires 
			/// an explicit expression implementation.
			/// </summary>
			/// <param name="constructor"></param>
			/// <param name="expression"></param>
			public ConstructorTranslation(ConstructorInfo constructor, string expression)
				: base(constructor)
			{
				this.Expression = expression;
			}

			/// <summary>
			/// Gets or sets the equivalent javascript expression.
			/// </summary>
			/// <remarks>
			/// <para>
			/// The expression should contain placeholders for each constructor argument such as 
			/// {0}, {1}, etc.
			/// </para>
			/// <para>
			/// For example, the DateTime constructor might have an expression of <example>new Date({0}, {1}, {2})</example>.
			/// </para>
			/// </remarks>
			public string Expression { get; private set; }
		}

		#endregion

		#region PropertyTranslation

		/// <summary>
		/// Describes how to translate a property into javascript.
		/// </summary>
		public class PropertyTranslation : MemberTranslation<PropertyInfo>
		{
			/// <summary>
			/// Constructs a new <see cref="PropertyTranslation"/> that only requires 
			/// an explicit expression implementation.
			/// </summary>
			/// <param name="property"></param>
			/// <param name="expression"></param>
			public PropertyTranslation(PropertyInfo property, string getExpression, string setExpression)
				: base(property)
			{
				this.GetExpression = getExpression;
				this.SetExpression = setExpression;
			}

			/// <summary>
			/// Gets or sets the equivalent javascript expression for getting the value of the property.
			/// </summary>
			/// <remarks>
			/// <para>
			/// The expression should contain a placeholder of {0} representing the instance the property is on.
			/// </para>
			/// </remarks>
			public string GetExpression { get; private set; }

			/// <summary>
			/// Gets or sets the equivalent javascript expression for setting the value of the property.
			/// </summary>
			/// <remarks>
			/// <para>
			/// The expression should contain a placeholder of {0} representing the instance the property is on
			/// and {1} for the value being assigned to the property.
			/// </para>
			/// </remarks>
			public string SetExpression { get; private set; }
		}

		#endregion

		#region MethodTranslation

		/// <summary>
		/// Describes how to translate a method into javascript.
		/// </summary>
		public class MethodTranslation : MemberTranslation<MethodInfo>
		{
			/// <summary>
			/// Constructs a new <see cref="MethodTranslation"/> that only requires 
			/// an explicit expression implementation.
			/// </summary>
			/// <param name="method"></param>
			/// <param name="expression"></param>
			public MethodTranslation(MethodInfo method, string expression)
				: base(method)
			{
				this.Expression = expression;

				this.IsExtension = method.IsStatic &&
					method.DeclaringType.GetCustomAttributes(typeof(ExtensionAttribute), false).Count() > 0 &&
					method.GetCustomAttributes(typeof(ExtensionAttribute), false).Count() > 0;
			}

			/// <summary>
			/// Gets or sets the equivalent javascript expression.
			/// </summary>
			/// <remarks>
			/// <para>
			/// The expression should contain placeholders for each method argument such as 
			/// {0}, {1}, etc.  For instance methods, the instance will be passed as {0}.
			/// </para>
			/// <para>
			/// For example, the DateTime.AddDays(decimal) method might have an expression of
			/// DateTime_addDays({0}, {1}), where the date instance is passed as the first argument
			/// and the number of days is passed as the second argument.  If addDays exists as a 
			/// method on the Date prototype, this expression could instead be {0}.addDays({1}).
			/// </para>
			/// </remarks>
			public string Expression { get; private set; }

			/// <summary>
			/// Indicates whether the method represents a static extension method that should be
			/// treated like an instance method when translated to javascript.
			/// </summary>
			public bool IsExtension { get; private set; }
		}

		#endregion

		#region TranslationException

		/// <summary>
		/// Indicates that a failure occurred while attempting to translate a method into javascript.
		/// </summary>
		public class TranslationException : Exception
		{
			internal TranslationException(string message, MemberInfo member, TranslationException lastException)
				: base(message)
			{
				this.Member = member;
				if (lastException != null)
					lastException.NextException = this;
			}

			/// <summary>
			/// Gets the member that could not be translated.
			/// </summary>
			public MemberInfo Member { get; private set; }

			/// <summary>
			/// Gets the next translation exception, if any.
			/// </summary>
			public TranslationException NextException { get; private set; }
		}

		#endregion

		#region IEnumerableSignatures

		interface IEnumerableSignatures
		{
			void First(bool predicate);
			void FirstOrDefault(bool predicate);
			void First();
			void FirstOrDefault();
			void Last(bool predicate);
			void LastOrDefault(bool predicate);
			void Last();
			void LastOrDefault();
			void Where(bool predicate);
			void Any();
			void Any(bool predicate);
			void All(bool predicate);
			void Contains(object value);
			void Count();
			void Count(bool predicate);
			void Min(object selector);
			void Max(object selector);
			void Select(object selector);
			void Sum(int selector);
			void Sum(int? selector);
			void Sum(long selector);
			void Sum(long? selector);
			void Sum(float selector);
			void Sum(float? selector);
			void Sum(double selector);
			void Sum(double? selector);
			void Sum(decimal selector);
			void Sum(decimal? selector);
			void Average(int selector);
			void Average(int? selector);
			void Average(long selector);
			void Average(long? selector);
			void Average(float selector);
			void Average(float? selector);
			void Average(double selector);
			void Average(double? selector);
			void Average(decimal selector);
			void Average(decimal? selector);
			void OrderBy(object selector);
			void OrderByDescending(object selector);
		}

		#endregion
	}
}
