// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     RoleClaimTypeForwardingTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  AppHost.Tests.Integration
// =============================================

using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;

using Domain.Constants;

using Microsoft.Extensions.DependencyInjection;

namespace AppHost.Tests.Integration;

public class RoleClaimTypeForwardingTests
{
	[Fact]
	public async Task WebApp_RoleClaimTypeConfigured_ReceivesIt()
	{
		// Arrange
		await using IDistributedApplicationTestingBuilder builder = await DistributedApplicationTestingBuilder
			.CreateAsync<global::Projects.AppHost>(["--Auth0:RoleClaimType=https://custom/roles"],
				TestContext.Current.CancellationToken);

		// Act
		Dictionary<string, string> environment = await GetWebAppEnvironmentAsync(builder);

		// Assert
		environment.Should().Contain("Auth0__RoleClaimType", "https://custom/roles");
	}

	[Fact]
	public async Task WebApp_RoleClaimTypeNotConfigured_KeepsItsOwnDefault()
	{
		// Arrange
		await using IDistributedApplicationTestingBuilder builder = await DistributedApplicationTestingBuilder
			.CreateAsync<global::Projects.AppHost>(["--Auth0:RoleClaimType="], TestContext.Current.CancellationToken);

		// Act
		Dictionary<string, string> environment = await GetWebAppEnvironmentAsync(builder);

		// Assert
		environment.Should().NotContainKey("Auth0__RoleClaimType");
	}

	private static async Task<Dictionary<string, string>> GetWebAppEnvironmentAsync(
		IDistributedApplicationTestingBuilder builder)
	{
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		builder.Configuration["Auth0:Domain"] = "auth0.placeholder.invalid";
		builder.Configuration["Auth0:ClientId"] = "placeholder-client-id";
		builder.Configuration["Auth0:ClientSecret"] = "placeholder-client-secret";

		// Building, without starting, gives the execution context the configuration builder resolves values with.
		await using DistributedApplication application = await builder.BuildAsync(cancellationToken);
		ProjectResource webApp = application.Services.GetRequiredService<DistributedApplicationModel>().Resources
			.OfType<ProjectResource>()
			.Single(resource => resource.Name == ApplicationConstants.Website);
		IExecutionConfigurationResult configuration = await ExecutionConfigurationBuilder.Create(webApp)
			.WithEnvironmentVariablesConfig()
			.BuildAsync(application.Services.GetRequiredService<DistributedApplicationExecutionContext>(),
				cancellationToken: cancellationToken);

		return configuration.EnvironmentVariables.ToDictionary(variable => variable.Key, variable => variable.Value);
	}
}
