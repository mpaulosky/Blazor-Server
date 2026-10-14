// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SharedComponentBoundaryTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using System.Reflection;

using Architecture.Tests.Fixtures.Shared;

namespace Architecture.Tests;

public class SharedComponentBoundaryTests
{
	private const string FixturesSharedNamespace = "Architecture.Tests.Fixtures.Shared";
	private const string FixturesFeaturesNamespace = "Architecture.Tests.Fixtures.Features";

	[Fact]
	public void SharedTypeReferencingAFeature_ArchitectureRule_FlagsTheViolation()
	{
		// Arrange
		Assembly fixturesAssembly = typeof(SharedWidget).Assembly;

		// Act
		NetArchTest.Rules.TestResult result = Types.InAssembly(fixturesAssembly)
			.That()
			.ResideInNamespace(FixturesSharedNamespace)
			.ShouldNot()
			.HaveDependencyOn(FixturesFeaturesNamespace)
			.GetResult();

		// Assert
		(result.FailingTypeNames ?? []).Should().Contain(typeof(SharedWidget).FullName,
			"SharedWidget's fixture dependency on a Features fixture must be caught, proving the rule the UI assembly " +
			"test relies on actually fails on a violation");
	}
}
