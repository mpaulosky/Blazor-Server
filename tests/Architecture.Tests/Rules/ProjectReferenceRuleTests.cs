// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ProjectReferenceRuleTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using System.Reflection;

using UI.Components;

namespace Architecture.Tests.Rules;

public class ProjectReferenceRuleTests
{
	[Fact]
	public void FindForbiddenProjectReferences_AssemblyReferencesDisallowedProject_ReturnsItsName()
	{
		// Arrange
		Assembly architectureTestsAssembly = typeof(ProjectReferenceRuleTests).Assembly;
		HashSet<string> allowed = new(StringComparer.Ordinal) { "Domain", "ServiceDefaults" };

		// Touch a UI type so the compiler keeps the reference to its assembly.
		_ = typeof(App);

		// Act
		IReadOnlyList<string> result = ProjectReferenceRule.FindForbiddenProjectReferences(architectureTestsAssembly, allowed);

		// Assert
		result.Should().BeEquivalentTo(["UI"]);
	}

	[Fact]
	public void FindForbiddenProjectReferences_AssemblyHasNoDisallowedReferences_ReturnsEmpty()
	{
		// Arrange
		Assembly domainAssembly = typeof(Domain.AssemblyMarker).Assembly;
		HashSet<string> allowed = new(StringComparer.Ordinal);

		// Act
		IReadOnlyList<string> result = ProjectReferenceRule.FindForbiddenProjectReferences(domainAssembly, allowed);

		// Assert
		result.Should().BeEmpty();
	}
}
