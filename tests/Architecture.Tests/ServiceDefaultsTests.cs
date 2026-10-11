// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ServiceDefaultsTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using System.Reflection;

using Architecture.Tests.Rules;

using ServiceDefaults;

namespace Architecture.Tests;

public class ServiceDefaultsTests
{
	[Fact]
	public void ServiceDefaultsAssembly_ReferencedAssemblies_HasNoProjectReference()
	{
		// Arrange
		Assembly serviceDefaultsAssembly = typeof(ServiceDefaultsExtensions).Assembly;
		HashSet<string> allowed = new(StringComparer.Ordinal);

		// Act
		IReadOnlyList<string> forbiddenReferences = ProjectReferenceRule.FindForbiddenProjectReferences(serviceDefaultsAssembly, allowed);

		// Assert
		forbiddenReferences.Should().BeEmpty(
			"ServiceDefaults is cross-cutting Aspire wiring that depends on no project in src/ (see issue #246)");
	}
}
