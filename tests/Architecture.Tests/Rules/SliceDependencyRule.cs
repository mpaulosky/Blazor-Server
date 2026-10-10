// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SliceDependencyRule.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using System.Reflection;

namespace Architecture.Tests.Rules;

internal static class SliceDependencyRule
{
	public static IReadOnlyList<string> FindSliceNames(Assembly assembly, string featuresNamespace)
	{
		string prefix = featuresNamespace + ".";

		return assembly.GetTypes()
			.Select(type => type.Namespace)
			.OfType<string>()
			.Where(ns => ns.StartsWith(prefix, StringComparison.Ordinal))
			.Select(ns => ns[prefix.Length..].Split('.')[0])
			.Distinct(StringComparer.Ordinal)
			.ToArray();
	}

	public static IReadOnlyList<string> FindCrossSliceDependencies(Assembly assembly, string featuresNamespace)
	{
		IReadOnlyList<string> slices = FindSliceNames(assembly, featuresNamespace);

		List<string> failingTypeNames = [];

		foreach (string slice in slices)
		{
			string[] otherSliceNamespaces = slices
				.Where(other => other != slice)
				.Select(other => $"{featuresNamespace}.{other}")
				.ToArray();

			if (otherSliceNamespaces.Length == 0)
			{
				continue;
			}

			// ResideInNamespace matches by string prefix, so the trailing dot keeps "Home" from selecting "HomeOffice".
			// HaveDependencyOnAny matches whole namespace segments and matches nothing when given a trailing dot.
			NetArchTest.Rules.TestResult result = Types.InAssembly(assembly)
				.That()
				.ResideInNamespace($"{featuresNamespace}.{slice}.")
				.ShouldNot()
				.HaveDependencyOnAny(otherSliceNamespaces)
				.GetResult();

			failingTypeNames.AddRange(result.FailingTypeNames ?? []);
		}

		return failingTypeNames;
	}
}
