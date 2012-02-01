using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Collections;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Server
{
	public class AssertLists
	{
		/// <summary>
		/// Verifies that each item in the expect lists equals the item in the same position in the actual list
		/// </summary>
		public static void AreSame(IEnumerable expected, IEnumerable actual, string message)
		{
			AreSame(expected, actual, message, new object[0]);
		}

		/// <summary>
		/// Verifies that each item in the expect lists equals the item in the same position in the actual list
		/// </summary>
		public static void AreSame(IEnumerable expected, IEnumerable actual, string message, params object[] args)
		{
			IEnumerator exp = expected.GetEnumerator();
			IEnumerator act = actual.GetEnumerator();

			while (exp.MoveNext())
			{
				Assert.IsTrue(act.MoveNext(), "Actual has fewer items that expected.  " + string.Format(message, args));
				Assert.AreEqual(exp.Current, act.Current, "Actual and expected list items are different.  This assert assumes the lists are in the same order.  " + string.Format(message, args));
			}

			Assert.IsFalse(act.MoveNext(), "Actual has more items that expected.  " + string.Format(message, args));
		}

		public delegate void CompareAssertion<T>(T expected, T actual);

		/// <summary>
		/// Verifies that each item in the expect lists equals the item in the same position in the actual list
		/// </summary>
		public static void Are<TItem>(IEnumerable expected, IEnumerable actual, CompareAssertion<TItem> assertion)
		{
			Are<TItem>(expected, actual, assertion, delegate(TItem item) { return item.ToString(); });
		}

		/// <summary>
		/// Verifies that each item in the expect lists equals the item in the same position in the actual list
		/// </summary>
		public static void Are<TItem>(IEnumerable expected, IEnumerable actual, CompareAssertion<TItem> assertion, Converter<TItem, string> itemToStringForErrors)
		{
			IEnumerator exp = expected.GetEnumerator();
			IEnumerator act = actual.GetEnumerator();

			int pos = 0;

			while (exp.MoveNext())
			{
				if (!act.MoveNext())
					Assert.Fail("Actual has fewer items than expected. Index: {1}, Missing item: {0}", itemToStringForErrors((TItem)exp.Current), pos);

				assertion((TItem)exp.Current, (TItem)act.Current);

				++pos;
			}

			if (act.MoveNext())
				Assert.Fail("Actual has more items than expected. Index: {1}, Extra item: {0}", itemToStringForErrors((TItem)act.Current), pos + 1);
		}

		public static void ContainsInOrder<T>(IEnumerable<T> list, params Predicate<T>[] conditions)
		{
			IEnumerator<Predicate<T>> condition = ((IEnumerable<Predicate<T>>)conditions).GetEnumerator();

			int numMet = 0;

			if (!condition.MoveNext())
				return;

			foreach (var item in list)
			{
				if (condition.Current(item))
				{
					++numMet;

					// have all conditions been met?
					if (!condition.MoveNext())
						return;
				}
			}

			Assert.AreEqual(conditions.Length, numMet, "Items in the list did not match the conditions");
		}
	}
}
