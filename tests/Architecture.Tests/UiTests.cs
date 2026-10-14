// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     UiTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using System.Reflection;

using Architecture.Tests.Rules;

using UI.Components;

namespace Architecture.Tests;

public class UiTests
{
	[Fact]
	public void UiAssembly_ReferencedAssemblies_HasNoProjectReferenceOtherThanDomainAndServiceDefaults()
	{
		// Arrange
		Assembly uiAssembly = typeof(App).Assembly;
		HashSet<string> allowed = new(StringComparer.Ordinal) { "Domain", "ServiceDefaults" };

		// Act
		IReadOnlyList<string> forbiddenReferences =
			ProjectReferenceRule.FindForbiddenProjectReferences(uiAssembly, allowed);

		// Assert
		forbiddenReferences.Should().BeEmpty(
			"UI references only the Shared Kernel (see ADR-0005) and ServiceDefaults (see ADR-0005's amendment, ADR-0006, and issue #246); any other project reference must be allowed deliberately");
	}

	[Fact]
	public void UiAssembly_FeatureSlices_IncludeHomeWithNoCrossSliceDependencies()
	{
		// Arrange
		Assembly uiAssembly = typeof(App).Assembly;
		const string featuresNamespace = "UI.Components.Features";

		// Act
		IReadOnlyList<string> slices = SliceDependencyRule.FindSliceNames(uiAssembly, featuresNamespace);
		IReadOnlyList<string> crossSliceDependencies =
			SliceDependencyRule.FindCrossSliceDependencies(uiAssembly, featuresNamespace);

		// Assert
		slices.Should().Contain("Home").And.Contain("Authentication");
		crossSliceDependencies.Should()
			.BeEmpty("each feature slice holds everything its use case needs, and depends on no other slice (ADR-0005)");
	}

	[Fact]
	public void UiAssembly_Auth0Sdk_IsOnlyDependedOnByTheAuthenticationSlice()
	{
		// Arrange
		Assembly uiAssembly = typeof(App).Assembly;
		const string authenticationNamespace = "UI.Components.Features.Authentication";
		const string auth0Sdk = "Auth0.AspNetCore.Authentication";

		// Act
		NetArchTest.Rules.TestResult outsideSliceResult = Types.InAssembly(uiAssembly)
			.That()
			.DoNotResideInNamespace(authenticationNamespace)
			.ShouldNot()
			.HaveDependencyOn(auth0Sdk)
			.GetResult();
		IEnumerable<Type> typesInsideSliceUsingAuth0Sdk = Types.InAssembly(uiAssembly)
			.That()
			.ResideInNamespace(authenticationNamespace)
			.And()
			.HaveDependencyOn(auth0Sdk)
			.GetTypes();

		// Assert
		(outsideSliceResult.FailingTypeNames ?? []).Should()
			.BeEmpty("only the Authentication slice may depend on the Auth0 SDK");
		typesInsideSliceUsingAuth0Sdk.Should().NotBeEmpty(
			"the Authentication slice is expected to call into the Auth0 SDK; an empty result would let a typo in " +
			"the namespace above pass that rule vacuously");
	}

	[Fact]
	public void UiAssembly_SharedComponents_DependOnNoFeatureSlice()
	{
		// Arrange
		Assembly uiAssembly = typeof(App).Assembly;
		const string sharedNamespace = "UI.Components.Shared";
		const string featuresNamespace = "UI.Components.Features";

		// Act
		IReadOnlyList<string> featureDependencies =
			SharedDependencyRule.FindFeatureDependencies(uiAssembly, sharedNamespace, featuresNamespace);
		IEnumerable<Type> sharedTypes = Types.InAssembly(uiAssembly)
			.That()
			.ResideInNamespace(sharedNamespace)
			.GetTypes();

		// Assert
		featureDependencies.Should().BeEmpty(
			"UI.Components.Shared holds UI building blocks only, and never depends on a feature slice " +
			"(docs/plans/ui-restyle.md)");
		sharedTypes.Should().NotBeEmpty(
			"Card, PageHeader, StatTile, Badge and Button are expected in UI.Components.Shared; an empty result " +
			"would let a typo in the namespace above pass this rule vacuously");
	}
}
