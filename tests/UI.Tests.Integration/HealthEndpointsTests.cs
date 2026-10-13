// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     HealthEndpointsTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using System.Net;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration;

public class HealthEndpointsTests
{
	[Theory]
	[InlineData("/health")]
	[InlineData("/alive")]
	public async Task GetHealthEndpoint_DevelopmentEnvironment_ReturnsOk(string path)
	{
		// Arrange
		using WebApplicationFactory<Program> factory = new UiWebApplicationFactory()
			.WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
		using HttpClient client = factory.CreateClient();

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
	}

	[Theory]
	[InlineData("/health")]
	[InlineData("/alive")]
	public async Task GetHealthEndpoint_ProductionEnvironment_ReturnsNotFound(string path)
	{
		// Arrange
		using WebApplicationFactory<Program> factory = new UiWebApplicationFactory()
			.WithWebHostBuilder(builder => builder.UseEnvironment("Production"));
		using HttpClient client = factory.CreateClient();

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.NotFound);
	}
}
