// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AccessDeniedEndpointTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using System.Net;

using UI.Components.Features.Authentication;
using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Authentication;

public class AccessDeniedEndpointTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly HttpClient _client;

	public AccessDeniedEndpointTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_client = factory.CreateClient();
	}

	[Fact]
	public async Task GetAccessDenied_ReturnsForbiddenWithAccessDeniedText()
	{
		// Arrange

		// Act
		HttpResponseMessage response = await _client.GetAsync(
			new Uri(AuthenticationEndpoints.AccessDeniedPath, UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
		html.Should().Contain("Access denied");
	}
}
