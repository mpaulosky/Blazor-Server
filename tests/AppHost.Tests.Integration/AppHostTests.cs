// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AppHostTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  AppHost.Tests.Integration
// =============================================

using System.Net;

using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;

using Domain.Constants;

namespace AppHost.Tests.Integration;

public class AppHostTests : IAsyncLifetime
{
	private static readonly TimeSpan s_startupTimeout = TimeSpan.FromMinutes(2);

	private DistributedApplication? _application;

	public async ValueTask InitializeAsync()
	{
		using CancellationTokenSource startupTimeout = new(s_startupTimeout);

		// The testing builder applies the AppHost's first launch profile, https, and WebApp follows it to the UI's https
		// profile. http needs no developer certificate, so the tests also run in CI and the Sandcastle sandbox.
		IDistributedApplicationTestingBuilder builder = await DistributedApplicationTestingBuilder
			.CreateAsync<global::Projects.AppHost>(["--DOTNET_LAUNCH_PROFILE=http"], startupTimeout.Token);

		// Aspire parameters resolve lazily, so placeholders set here, only when no user secret or environment
		// variable already provides a value, still reach the Auth0__* variables the AppHost passes to WebApp.
		builder.Configuration["Auth0:Domain"] ??= "auth0.placeholder.invalid";
		builder.Configuration["Auth0:ClientId"] ??= "placeholder-client-id";
		builder.Configuration["Auth0:ClientSecret"] ??= "placeholder-client-secret";

		_application = await builder.BuildAsync(startupTimeout.Token);

		await _application.StartAsync(startupTimeout.Token);
	}

	public async ValueTask DisposeAsync()
	{
		if (_application is not null)
		{
			await _application.DisposeAsync();
		}

		GC.SuppressFinalize(this);
	}

	[Fact]
	public async Task GetRoot_WebAppResource_ReturnsOk()
	{
		// Arrange
		DistributedApplication application =
			_application ?? throw new InvalidOperationException("The AppHost has not started yet.");
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		using CancellationTokenSource healthyTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
		healthyTimeout.CancelAfter(s_startupTimeout);
		await application.ResourceNotifications.WaitForResourceHealthyAsync(
			ApplicationConstants.Website, WaitBehavior.StopOnResourceUnavailable, healthyTimeout.Token);
		using HttpClient client = application.CreateHttpClient(ApplicationConstants.Website);

		// Act
		using HttpResponseMessage response = await client.GetAsync(new Uri("/", UriKind.Relative), cancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
	}
}
