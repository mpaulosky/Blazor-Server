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

	[GeneratedRegex("Project\\s+Sdk\\s*=\\s*\"Aspire\\.AppHost\\.Sdk/([^\"]+)\"")]
	private static partial Regex AppHostSdkVersionPattern();

	[GeneratedRegex("<PackageVersion\\s+Include\\s*=\\s*\"Aspire\\.Hosting\\.AppHost\"\\s+Version\\s*=\\s*\"([^\"]+)\"")]
	private static partial Regex AspireHostingAppHostVersionPattern();

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

	[Fact]
	public void AppHostCsproj_SdkVersion_MatchesAspireHostingAppHostPackageVersion()
	{
		// Arrange
		string repositoryRoot = ProjectReferenceRule.FindRepositoryRoot();
		string appHostCsprojPath = Path.Combine(repositoryRoot, "src", "AppHost", "AppHost.csproj");
		string packagesPropsPath = Path.Combine(repositoryRoot, "Directory.Packages.props");
		Match sdkMatch = AppHostSdkVersionPattern().Match(File.ReadAllText(appHostCsprojPath));
		Match packageMatch = AspireHostingAppHostVersionPattern().Match(File.ReadAllText(packagesPropsPath));

		// Act
		string sdkVersion = sdkMatch.Groups[1].Value;
		string packageVersion = packageMatch.Groups[1].Value;

		// Assert
		sdkMatch.Success.Should().BeTrue("AppHost.csproj pins the Aspire.AppHost.Sdk version in its Sdk attribute");
		packageMatch.Success.Should().BeTrue("Directory.Packages.props pins the Aspire.Hosting.AppHost package version");
		sdkVersion.Should().Be(packageVersion,
			"the AppHost SDK restores the dashboard and DCP packages that must match Aspire.Hosting.AppHost; a drift between the two is hard to trace as a build warning or a runtime orchestration failure");
	}
}
