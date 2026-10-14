// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SharedDependencyRuleTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using System.Reflection;

using Architecture.Tests.Fixtures.Shared;

namespace Architecture.Tests.Rules;

public class SharedDependencyRuleTests
{
	private const string FixturesSharedNamespace = "Architecture.Tests.Fixtures.Shared";
	private const string FixturesFeaturesNamespace = "Architecture.Tests.Fixtures.Features";

	[Fact]
	public void FindFeatureDependencies_SharedWidgetReferencesAlpha_ReturnsOnlySharedWidget()
	{
		// Arrange
		Assembly fixturesAssembly = typeof(SharedWidget).Assembly;

		// Act
		IReadOnlyList<string> failingTypeNames = SharedDependencyRule.FindFeatureDependencies(
			fixturesAssembly,
			FixturesSharedNamespace,
			FixturesFeaturesNamespace);

		// Assert
		failingTypeNames.Should().Equal([typeof(SharedWidget).FullName],
			"SharedWidget's dependency on a Features fixture must be caught, proving the rule the UI assembly " +
			"test relies on actually fails on a violation");
	}
}
