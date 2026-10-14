// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ReleaseDomainTermTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using Architecture.Tests.Rules;

namespace Architecture.Tests;

public class ReleaseDomainTermTests
{
	// Refs #348: CONTEXT.md must define "Release" alongside the repo's other domain terms (Theme, Palette, ...).
	[Fact]
	public void ContextMarkdown_ReleaseTerm_IsDefined()
	{
		// Arrange
		string path = Path.Combine(ProjectReferenceRule.FindRepositoryRoot(), "CONTEXT.md");

		string expectedEntry = string.Join('\n',
			"**Release**:",
			"A published, versioned snapshot of the Generated App (`vX.Y.Z`), cut each time a change merges to `main`.",
			"The footer shows the Release the running build is, or the nearest Release before it.",
			"_Avoid_: Version, build, deploy");

		// Act
		string markdown = File.ReadAllText(path);

		// Assert
		markdown.Should().Contain(expectedEntry);
	}
}
