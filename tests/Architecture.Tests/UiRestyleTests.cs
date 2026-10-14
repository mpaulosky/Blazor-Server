// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     UiRestyleTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using Architecture.Tests.Rules;

namespace Architecture.Tests;

public class UiRestyleTests
{
	[Theory]
	[InlineData("src/UI/Components/Layout/MainLayout.razor")]
	[InlineData("src/UI/Components/Layout/NavMenu.razor")]
	[InlineData("src/UI/Components/Layout/Footer.razor")]
	[InlineData("src/UI/Components/Features/Authentication/LoginDisplay.razor")]
	public void RestyledFile_Markup_DoesNotUseGrayOrBlueUtilityClasses(string repositoryRelativePath)
	{
		// Arrange
		string path = Path.Combine(ProjectReferenceRule.FindRepositoryRoot(), repositoryRelativePath);

		// Act
		string markup = File.ReadAllText(path);

		// Assert
		markup.Should()
			.NotContain("gray-", $"{repositoryRelativePath} should use the slate surfaces, not a raw gray-* class");
		markup.Should()
			.NotContain("blue-", $"{repositoryRelativePath} should use accent-*, not a raw blue-* class");
	}
}
