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
	public void UiAssembly_ReferencedAssemblies_HasNoProjectReferenceOtherThanDomain()
	{
		// Arrange
		Assembly uiAssembly = typeof(App).Assembly;
		HashSet<string> allowed = new(StringComparer.Ordinal) { "Domain" };

		// Act
		IReadOnlyList<string> forbiddenReferences = ProjectReferenceRule.FindForbiddenProjectReferences(uiAssembly, allowed);

		// Assert
		forbiddenReferences.Should().BeEmpty(
			"UI references only the Shared Kernel (see ADR-0001); any other project reference is a slice boundary violation");
	}

	[Fact]
	public void UiAssembly_FeatureSlices_IncludeHomeWithNoCrossSliceDependencies()
	{
		// Arrange
		Assembly uiAssembly = typeof(App).Assembly;
		const string featuresNamespace = "UI.Components.Features";

		// Act
		IReadOnlyList<string> slices = SliceDependencyRule.FindSliceNames(uiAssembly, featuresNamespace);
		IReadOnlyList<string> crossSliceDependencies = SliceDependencyRule.FindCrossSliceDependencies(uiAssembly, featuresNamespace);

		// Assert
		slices.Should().Contain("Home");
		crossSliceDependencies.Should().BeEmpty("each feature slice holds everything its use case needs, and depends on no other slice (ADR-0005)");
	}
}
