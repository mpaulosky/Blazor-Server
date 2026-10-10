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

		IDistributedApplicationTestingBuilder builder = await DistributedApplicationTestingBuilder
			.CreateAsync<global::Projects.AppHost>(startupTimeout.Token);

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
		DistributedApplication application = _application ?? throw new InvalidOperationException("The AppHost has not started yet.");
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await application.ResourceNotifications.WaitForResourceHealthyAsync(ApplicationConstants.Website, cancellationToken);
		using HttpClient client = application.CreateHttpClient(ApplicationConstants.Website);

		// Act
		using HttpResponseMessage response = await client.GetAsync(new Uri("/", UriKind.Relative), cancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
	}
}
