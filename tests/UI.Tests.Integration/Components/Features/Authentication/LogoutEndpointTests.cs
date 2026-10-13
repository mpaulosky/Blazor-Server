// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     LogoutEndpointTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using System.Net;
using System.Text.RegularExpressions;

using Microsoft.AspNetCore.Mvc.Testing;

using UI.Components.Features.Authentication;
using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Authentication;

public partial class LogoutEndpointTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;

	public LogoutEndpointTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
	}

	[GeneratedRegex("<input[^>]*name=\"__RequestVerificationToken\"[^>]*>")]
	private static partial Regex AntiforgeryInputPattern();

	[GeneratedRegex("value=\"([^\"]*)\"")]
	private static partial Regex ValueAttributePattern();

	[Fact]
	public async Task GetLogout_ReturnsMethodNotAllowed()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient();

		// Act
		HttpResponseMessage response = await client.GetAsync(new Uri(AuthenticationEndpoints.LogoutPath, UriKind.Relative),
			TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.MethodNotAllowed);
	}

	[Fact]
	public async Task PostLogout_WithoutAntiforgeryToken_ReturnsBadRequest()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient();

		// Act
		HttpResponseMessage response = await client.PostAsync(new Uri(AuthenticationEndpoints.LogoutPath, UriKind.Relative),
			content: null, TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
	}

	[Fact]
	public async Task PostLogout_WithValidAntiforgeryToken_SignsOutAndRedirectsToRoot()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
		client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeaderName, "a-user");
		HttpResponseMessage homeResponse =
			await client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await homeResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
		Match inputTag = AntiforgeryInputPattern().Match(html);
		inputTag.Success.Should().BeTrue("the Log out form must render an antiforgery token for a signed-in User");
		string token = ValueAttributePattern().Match(inputTag.Value).Groups[1].Value;

		using FormUrlEncodedContent content =
			new([new KeyValuePair<string?, string?>("__RequestVerificationToken", token)]);

		// Act
		HttpResponseMessage response = await client.PostAsync(
			new Uri(AuthenticationEndpoints.LogoutPath, UriKind.Relative), content,
			TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		response.Headers.Location.Should().Be(new Uri("/", UriKind.Relative));
	}

	[Fact]
	public async Task PostLogout_WithValidAntiforgeryToken_EndsTheAuth0SessionReturningToRoot()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
		client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeaderName, "a-user");
		using FormUrlEncodedContent content = new([
			new KeyValuePair<string?, string?>("__RequestVerificationToken", await ScrapeLogoutTokenAsync(client)),
		]);

		// Act
		HttpResponseMessage response = await client.PostAsync(
			new Uri(AuthenticationEndpoints.LogoutPath, UriKind.Relative), content,
			TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		response.Headers.Location.Should().Be(new Uri(
			$"https://{UiWebApplicationFactory.PlaceholderDomain}/v2/logout" +
			$"?client_id={UiWebApplicationFactory.PlaceholderClientId}&returnTo=http%3A%2F%2Flocalhost%2F"));
		response.Headers.GetValues("Set-Cookie").Should()
			.Contain(cookie => cookie.StartsWith(".AspNetCore.Cookies=;", StringComparison.Ordinal) &&
				cookie.Contains("expires=Thu, 01 Jan 1970", StringComparison.OrdinalIgnoreCase));
	}

	private static async Task<string> ScrapeLogoutTokenAsync(HttpClient client)
	{
		HttpResponseMessage homeResponse =
			await client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await homeResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
		Match inputTag = AntiforgeryInputPattern().Match(html);
		inputTag.Success.Should().BeTrue("the Log out form must render an antiforgery token for a signed-in User");

		return ValueAttributePattern().Match(inputTag.Value).Groups[1].Value;
	}
}
