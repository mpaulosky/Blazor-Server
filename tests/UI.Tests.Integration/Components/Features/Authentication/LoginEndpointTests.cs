// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     LoginEndpointTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using System.Net;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Primitives;

using UI.Components.Features.Authentication;
using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Authentication;

public class LoginEndpointTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;
	private readonly HttpClient _client;

	public LoginEndpointTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
		_client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
	}

	[Fact]
	public async Task GetLogin_ChallengesAuth0WithConfiguredClientId()
	{
		// Arrange

		// Act
		HttpResponseMessage response = await _client.GetAsync(
			new Uri($"{AuthenticationEndpoints.LoginPath}?returnUrl=%2Fprofile", UriKind.Relative),
			TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		Uri? location = response.Headers.Location;
		location.Should().NotBeNull();
		location!.ToString().Should()
			.StartWith($"https://{UiWebApplicationFactory.PlaceholderDomain}/authorize");
		Dictionary<string, StringValues> query = QueryHelpers.ParseQuery(location.Query);
		query["client_id"].ToString().Should().Be(UiWebApplicationFactory.PlaceholderClientId);
	}

	[Theory]
	[InlineData("/")]
	[InlineData("/profile?x=1")]
	public async Task GetLogin_LocalReturnUrl_IsPreservedInTheAuthorizeRedirect(string returnUrl)
	{
		// Arrange

		// Act
		HttpResponseMessage response = await _client.GetAsync(
			new Uri($"{AuthenticationEndpoints.LoginPath}?returnUrl={Uri.EscapeDataString(returnUrl)}",
				UriKind.Relative),
			TestContext.Current.CancellationToken);

		// Assert
		string redirectUri = await UnprotectRedirectUriAsync(response);
		redirectUri.Should().Be(returnUrl);
	}

	[Theory]
	[InlineData("https://evil.example")]
	[InlineData("//evil.example")]
	[InlineData("/\\evil.example")]
	public async Task GetLogin_NonLocalReturnUrl_IsReplacedWithRootInTheAuthorizeRedirect(string returnUrl)
	{
		// Arrange

		// Act
		HttpResponseMessage response = await _client.GetAsync(
			new Uri($"{AuthenticationEndpoints.LoginPath}?returnUrl={Uri.EscapeDataString(returnUrl)}",
				UriKind.Relative),
			TestContext.Current.CancellationToken);

		// Assert
		string redirectUri = await UnprotectRedirectUriAsync(response);
		redirectUri.Should().Be("/");
	}

	private async Task<string> UnprotectRedirectUriAsync(HttpResponseMessage response)
	{
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		Uri? location = response.Headers.Location;
		location.Should().NotBeNull();
		string state = QueryHelpers.ParseQuery(location!.Query)["state"].ToString();
		state.Should().NotBeNullOrEmpty();

		await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
		OpenIdConnectOptions options =
			scope.ServiceProvider.GetRequiredService<IOptionsMonitor<OpenIdConnectOptions>>().Get("Auth0");
		AuthenticationProperties? properties = options.StateDataFormat.Unprotect(state);
		properties.Should().NotBeNull();

		return properties!.RedirectUri ?? string.Empty;
	}
}
