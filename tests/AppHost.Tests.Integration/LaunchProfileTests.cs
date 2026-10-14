// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     LaunchProfileTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  AppHost.Tests.Integration
// =============================================

using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;

using Domain.Constants;

namespace AppHost.Tests.Integration;

public class LaunchProfileTests
{
	[Theory]
	[InlineData("http", new[] { "http" })]
	[InlineData("https", new[] { "https", "http" })]
	public async Task WebApp_AppHostLaunchProfile_UsesTheUIProfileOfTheSameName(string launchProfile,
		string[] expectedSchemes)
	{
		// Arrange
		await using IDistributedApplicationTestingBuilder builder = await DistributedApplicationTestingBuilder
			.CreateAsync<global::Projects.AppHost>([$"--DOTNET_LAUNCH_PROFILE={launchProfile}"],
				TestContext.Current.CancellationToken);

		// Act
		IEnumerable<string> schemes = builder.Resources
			.OfType<ProjectResource>()
			.Single(resource => resource.Name == ApplicationConstants.Website)
			.Annotations.OfType<EndpointAnnotation>()
			.Select(endpoint => endpoint.UriScheme);

		// Assert
		schemes.Should().BeEquivalentTo(expectedSchemes);
	}
}
