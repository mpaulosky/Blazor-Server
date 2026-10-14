// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ThemeEndpointTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;

using Domain.Constants;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;

using UI.Components.Features.Themes;
using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Themes;

public partial class ThemeEndpointTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;

	public ThemeEndpointTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
	}

	[GeneratedRegex("<input[^>]*name=\"__RequestVerificationToken\"[^>]*>")]
	private static partial Regex AntiforgeryInputPattern();

	[GeneratedRegex("value=\"([^\"]*)\"")]
	private static partial Regex ValueAttributePattern();

	[Fact]
	public async Task GetTheme_ReturnsMethodNotAllowedWithAllowPost()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient();

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri(ThemeEndpoints.Path, UriKind.Relative), TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.MethodNotAllowed);
		response.Content.Headers.Allow.Should().ContainSingle().Which.Should().Be(HttpMethods.Post);
	}

	[Theory]
	[InlineData("dark")]
	[InlineData("light")]
	public async Task PostTheme_ValidTokenKnownValue_SetsCookieWithExpectedAttributesAndRedirectsToReturnUrl(
		string theme)
	{
		// Arrange
		using HttpClient client = CreateNonRedirectingClient();
		string token = await ScrapeAntiforgeryTokenAsync(client);

		// Act
		HttpResponseMessage response = await PostThemeAsync(client, token, theme, "/profile");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		response.Headers.Location.Should().Be(new Uri("/profile", UriKind.Relative));
		string setCookie = response.Headers.GetValues("Set-Cookie")
			.Should().ContainSingle(cookie =>
				cookie.StartsWith($"{ApplicationConstants.ThemeCookie}={theme};", StringComparison.Ordinal))
			.Which;
		setCookie.Should().ContainEquivalentOf("max-age=31536000");
		setCookie.Should().ContainEquivalentOf("samesite=lax");
		setCookie.Should().ContainEquivalentOf("secure");
		setCookie.Should().ContainEquivalentOf("httponly");
		setCookie.Should().ContainEquivalentOf("path=/");
	}

	[Fact]
	public async Task PostTheme_System_DeletesCookieAndRedirectsToReturnUrl()
	{
		// Arrange
		using HttpClient client = CreateNonRedirectingClient();
		string token = await ScrapeAntiforgeryTokenAsync(client);

		// Act
		HttpResponseMessage response = await PostThemeAsync(client, token, "system", "/profile");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		response.Headers.Location.Should().Be(new Uri("/profile", UriKind.Relative));
		response.Headers.GetValues("Set-Cookie").Should().Contain(cookie =>
			cookie.StartsWith($"{ApplicationConstants.ThemeCookie}=;", StringComparison.Ordinal) &&
			cookie.Contains("expires=Thu, 01 Jan 1970", StringComparison.OrdinalIgnoreCase));
	}

	[Fact]
	public async Task PostTheme_UnknownValue_ReturnsProblemDetailsWithThemeUnknownCodeAndSetsNoCookie()
	{
		// Arrange
		using HttpClient client = CreateNonRedirectingClient();
		string token = await ScrapeAntiforgeryTokenAsync(client);

		// Act
		HttpResponseMessage response = await PostThemeAsync(client, token, "unknown-value", "/profile");
		string body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
		(response.Content.Headers.ContentType?.MediaType).Should().Be("application/problem+json");
		using JsonDocument document = JsonDocument.Parse(body);
		document.RootElement.GetProperty("code").GetString().Should().Be("Theme.Unknown");
		response.Headers.Contains("Set-Cookie").Should().BeFalse();
	}

	[Fact]
	public async Task PostTheme_MissingAntiforgeryToken_RedirectsToReturnUrlWithoutSettingCookie()
	{
		// Arrange
		using HttpClient client = CreateNonRedirectingClient();

		// Act
		HttpResponseMessage response = await PostThemeAsync(client, token: null, "dark", "/profile");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		response.Headers.Location.Should().Be(new Uri("/profile", UriKind.Relative));
		response.Headers.Contains("Set-Cookie").Should().BeFalse();
	}

	[Fact]
	public async Task PostTheme_InvalidAntiforgeryToken_RedirectsToReturnUrlWithoutSettingCookie()
	{
		// Arrange
		// Scraping first gives the client the antiforgery cookie, so the post fails on the token itself rather than on
		// a missing cookie, which PostTheme_MissingAntiforgeryToken already covers.
		using HttpClient client = CreateNonRedirectingClient();
		_ = await ScrapeAntiforgeryTokenAsync(client);

		// Act
		HttpResponseMessage response = await PostThemeAsync(client, "not-a-valid-token", "dark", "/profile");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		response.Headers.Location.Should().Be(new Uri("/profile", UriKind.Relative));
		response.Headers.Contains("Set-Cookie").Should().BeFalse();
	}

	[Theory]
	[InlineData(null)]
	[InlineData("application/json")]
	public async Task PostTheme_NoFormContent_RedirectsToRootWithoutSettingCookie(string? mediaType)
	{
		// Arrange
		using HttpClient client = CreateNonRedirectingClient();
		using HttpContent? content = mediaType is null ? null : new StringContent("{}", null, mediaType);

		// Act
		HttpResponseMessage response = await client.PostAsync(new Uri(ThemeEndpoints.Path, UriKind.Relative), content,
			TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		response.Headers.Location.Should().Be(new Uri("/", UriKind.Relative));
		response.Headers.Contains("Set-Cookie").Should().BeFalse();
	}

	[Fact]
	public async Task PostTheme_NonLocalReturnUrl_RedirectsToRoot()
	{
		// Arrange
		using HttpClient client = CreateNonRedirectingClient();
		string token = await ScrapeAntiforgeryTokenAsync(client);

		// Act
		HttpResponseMessage response = await PostThemeAsync(client, token, "dark", "https://evil.example");

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		response.Headers.Location.Should().Be(new Uri("/", UriKind.Relative));
	}

	private HttpClient CreateNonRedirectingClient()
	{
		HttpClient client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
		client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeaderName, "a-user");

		return client;
	}

	private static async Task<HttpResponseMessage> PostThemeAsync(HttpClient client, string? token, string theme,
		string returnUrl)
	{
		List<KeyValuePair<string?, string?>> fields =
		[
			new("theme", theme),
			new("returnUrl", returnUrl),
		];

		if (token is not null)
		{
			fields.Add(new KeyValuePair<string?, string?>("__RequestVerificationToken", token));
		}

		using FormUrlEncodedContent content = new(fields);

		return await client.PostAsync(new Uri(ThemeEndpoints.Path, UriKind.Relative), content,
			TestContext.Current.CancellationToken);
	}

	// The Theme control isn't built until the next issue, so there's no form to read a token from except the
	// signed-in Log out form that LoginDisplay already renders on every page.
	private static async Task<string> ScrapeAntiforgeryTokenAsync(HttpClient client)
	{
		HttpResponseMessage homeResponse =
			await client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await homeResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
		Match inputTag = AntiforgeryInputPattern().Match(html);
		inputTag.Success.Should().BeTrue("a signed-in Log out form must render an antiforgery token to scrape");

		return ValueAttributePattern().Match(inputTag.Value).Groups[1].Value;
	}
}
