// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SharedDependencyRule.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using System.Reflection;

namespace Architecture.Tests.Rules;

internal static class SharedDependencyRule
{
	public static IReadOnlyList<string> FindFeatureDependencies(
		Assembly assembly,
		string sharedNamespace,
		string featuresNamespace)
	{
		NetArchTest.Rules.TestResult result = Types.InAssembly(assembly)
			.That()
			.ResideInNamespace(sharedNamespace)
			.ShouldNot()
			.HaveDependencyOn(featuresNamespace)
			.GetResult();

		return [.. result.FailingTypeNames ?? []];
	}
}
