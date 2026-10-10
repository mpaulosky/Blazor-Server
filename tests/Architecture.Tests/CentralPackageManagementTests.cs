// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     CentralPackageManagementTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using System.Text.RegularExpressions;

using Architecture.Tests.Rules;

namespace Architecture.Tests;

public partial class CentralPackageManagementTests
{
	[GeneratedRegex("<PackageReference[^>]*\\sVersion\\s*=")]
	private static partial Regex VersionedPackageReferencePattern();

	[Fact]
	public void SourceProjectFiles_PackageReferences_HaveNoVersionAttribute()
	{
		// Arrange
		string sourceDirectory = Path.Combine(ProjectReferenceRule.FindRepositoryRoot(), "src");
		string[] projectFiles = Directory.GetFiles(sourceDirectory, "*.csproj", SearchOption.AllDirectories);

		// Act
		string[] projectFilesWithVersionedReferences = projectFiles
			.Where(path => VersionedPackageReferencePattern().IsMatch(File.ReadAllText(path)))
			.ToArray();

		// Assert
		projectFilesWithVersionedReferences.Should().BeEmpty(
			"Central Package Management keeps every package version in Directory.Packages.props; a Version attribute on a PackageReference fails restore with NU1008");
	}

	[Fact]
	public void DirectoryPackagesProps_PackageVersions_ExcludeResilienceAndServiceDiscovery()
	{
		// Arrange
		string packagesPropsPath = Path.Combine(ProjectReferenceRule.FindRepositoryRoot(), "Directory.Packages.props");
		string content = File.ReadAllText(packagesPropsPath);

		// Act
		bool referencesResilienceOrServiceDiscovery = content.Contains("Resilience", StringComparison.OrdinalIgnoreCase)
			|| content.Contains("ServiceDiscovery", StringComparison.OrdinalIgnoreCase);

		// Assert
		referencesResilienceOrServiceDiscovery.Should().BeFalse(
			"no service in this template calls another service yet, so HTTP resilience and service discovery packages stay out (issue #246)");
	}
}
