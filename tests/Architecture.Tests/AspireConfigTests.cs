// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AspireConfigTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using Architecture.Tests.Rules;

namespace Architecture.Tests;

public class AspireConfigTests
{
	[Fact]
	public void AspireConfigJson_RepositoryRoot_Exists()
	{
		// Arrange
		string repositoryRoot = ProjectReferenceRule.FindRepositoryRoot();
		string rootConfigPath = Path.Combine(repositoryRoot, "aspire.config.json");

		// Act
		bool exists = File.Exists(rootConfigPath);

		// Assert
		exists.Should().BeTrue("the Aspire CLI's shared settings are committed once at the repository root, pointing at src/AppHost/AppHost.csproj");
	}

	[Fact]
	public void AspireConfigJson_AppHostFolder_DoesNotExist()
	{
		// Arrange
		string repositoryRoot = ProjectReferenceRule.FindRepositoryRoot();
		string appHostConfigPath = Path.Combine(repositoryRoot, "src", "AppHost", "aspire.config.json");

		// Act
		bool exists = File.Exists(appHostConfigPath);

		// Assert
		exists.Should().BeFalse("a per-machine copy the Aspire CLI writes next to the AppHost is noise once the repository-root copy is committed");
	}
}
