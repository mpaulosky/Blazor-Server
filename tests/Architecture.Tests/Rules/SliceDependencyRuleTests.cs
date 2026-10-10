// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SliceDependencyRuleTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using System.Reflection;

using Architecture.Tests.Fixtures.Features.Beta;

namespace Architecture.Tests.Rules;

public class SliceDependencyRuleTests
{
	private const string FixturesFeaturesNamespace = "Architecture.Tests.Fixtures.Features";

	[Fact]
	public void FindSliceNames_FixtureAssembly_ReturnsAlphaAndBeta()
	{
		// Arrange
		Assembly fixturesAssembly = typeof(BetaComponent).Assembly;

		// Act
		IReadOnlyList<string> slices = SliceDependencyRule.FindSliceNames(fixturesAssembly, FixturesFeaturesNamespace);

		// Assert
		slices.Should().Contain(["Alpha", "Beta"]);
	}

	[Fact]
	public void FindCrossSliceDependencies_BetaReferencesAlpha_ReturnsBetaComponent()
	{
		// Arrange
		Assembly fixturesAssembly = typeof(BetaComponent).Assembly;

		// Act
		IReadOnlyList<string> failingTypeNames = SliceDependencyRule.FindCrossSliceDependencies(fixturesAssembly, FixturesFeaturesNamespace);

		// Assert
		failingTypeNames.Should().Contain(typeof(BetaComponent).FullName);
	}
}
