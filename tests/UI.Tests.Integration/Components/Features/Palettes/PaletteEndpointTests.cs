// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     PaletteEndpointTests.cs
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

using UI.Components.Features.Palettes;
using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Palettes;

public partial class PaletteEndpointTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;

	public PaletteEndpointTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
	}

	[GeneratedRegex("<input[^>]*name=\"__RequestVerificationToken\"[^>]*>")]
	private static partial Regex AntiforgeryInputPattern();

	[GeneratedRegex("value=\"([^\"]*)\"")]
	private static partial Regex ValueAttributePattern();

	[Fact]
	public async Task GetPalette_ReturnsMethodNotAllowed()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient();

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri(PaletteEndpoints.Path, UriKind.Relative), TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.MethodNotAllowed);
		response.Content.Headers.Allow.Should().Contain(HttpMethods.Post);
	}

	[Fact]
	public async Task PostPalette_ValidTokenAndRose_SetsRoseCookieWithSpecAttributesAndRedirectsToReturnUrl()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
		client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeaderName, "a-user");
		using FormUrlEncodedContent content = new([
			new KeyValuePair<string?, string?>("__RequestVerificationToken", await ScrapeAntiforgeryTokenAsync(client)),
			new KeyValuePair<string?, string?>("palette", "rose"),
			new KeyValuePair<string?, string?>("returnUrl", "/profile"),
		]);

		// Act
		HttpResponseMessage response =
			await client.PostAsync(new Uri(PaletteEndpoints.Path, UriKind.Relative), content, TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		response.Headers.Location.Should().Be(new Uri("/profile", UriKind.Relative));
		ShouldSetPaletteCookieMatchingSpec(response, "rose");
	}

	[Fact]
	public async Task PostPalette_ValidTokenAndBlue_SetsBlueCookie()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
		client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeaderName, "a-user");
		using FormUrlEncodedContent content = new([
			new KeyValuePair<string?, string?>("__RequestVerificationToken", await ScrapeAntiforgeryTokenAsync(client)),
			new KeyValuePair<string?, string?>("palette", "blue"),
		]);

		// Act
		HttpResponseMessage response =
			await client.PostAsync(new Uri(PaletteEndpoints.Path, UriKind.Relative), content, TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		ShouldSetPaletteCookieMatchingSpec(response, "blue");
	}

	[Fact]
	public async Task PostPalette_ValidTokenAndNonLocalReturnUrl_RedirectsToRoot()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
		client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeaderName, "a-user");
		using FormUrlEncodedContent content = new([
			new KeyValuePair<string?, string?>("__RequestVerificationToken", await ScrapeAntiforgeryTokenAsync(client)),
			new KeyValuePair<string?, string?>("palette", "rose"),
			new KeyValuePair<string?, string?>("returnUrl", "https://evil.example/"),
		]);

		// Act
		HttpResponseMessage response =
			await client.PostAsync(new Uri(PaletteEndpoints.Path, UriKind.Relative), content, TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		response.Headers.Location.Should().Be(new Uri("/", UriKind.Relative));
	}

	[Fact]
	public async Task PostPalette_UnknownValue_ReturnsProblemDetailsWithPaletteUnknownCode()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
		client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeaderName, "a-user");
		using FormUrlEncodedContent content = new([
			new KeyValuePair<string?, string?>("__RequestVerificationToken", await ScrapeAntiforgeryTokenAsync(client)),
			new KeyValuePair<string?, string?>("palette", "not-a-hue"),
		]);

		// Act
		HttpResponseMessage response =
			await client.PostAsync(new Uri(PaletteEndpoints.Path, UriKind.Relative), content, TestContext.Current.CancellationToken);
		string body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
		response.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
		using JsonDocument problem = JsonDocument.Parse(body);
		problem.RootElement.GetProperty("code").GetString().Should().Be("Palette.Unknown");
	}

	[Fact]
	public async Task PostPalette_WithoutValidAntiforgeryToken_RedirectsToRootWithoutSettingCookie()
	{
		// Arrange
		using HttpClient client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
		using FormUrlEncodedContent content = new([
			new KeyValuePair<string?, string?>("palette", "rose"),
		]);

		// Act
		HttpResponseMessage response =
			await client.PostAsync(new Uri(PaletteEndpoints.Path, UriKind.Relative), content, TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.Found);
		response.Headers.Location.Should().Be(new Uri("/", UriKind.Relative));
		response.Headers.Contains("Set-Cookie").Should().BeFalse();
	}

	private static void ShouldSetPaletteCookieMatchingSpec(HttpResponseMessage response, string expectedValue)
	{
		response.Headers.GetValues("Set-Cookie").Should().Contain(cookie =>
			cookie.StartsWith($"{ApplicationConstants.PaletteCookie}={expectedValue};", StringComparison.Ordinal) &&
			cookie.Contains("max-age=31536000", StringComparison.OrdinalIgnoreCase) &&
			cookie.Contains("path=/", StringComparison.OrdinalIgnoreCase) &&
			cookie.Contains("secure", StringComparison.OrdinalIgnoreCase) &&
			cookie.Contains("httponly", StringComparison.OrdinalIgnoreCase) &&
			cookie.Contains("samesite=lax", StringComparison.OrdinalIgnoreCase));
	}

	// The Palette endpoint has no form of its own yet (the Palette menu is the next issue), so this borrows the
	// Log out form's antiforgery token: the token is bound to the signed-in caller, not to the endpoint path.
	private static async Task<string> ScrapeAntiforgeryTokenAsync(HttpClient client)
	{
		HttpResponseMessage homeResponse =
			await client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await homeResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
		Match inputTag = AntiforgeryInputPattern().Match(html);
		inputTag.Success.Should().BeTrue("the Log out form must render an antiforgery token for a signed-in User");

		return ValueAttributePattern().Match(inputTag.Value).Groups[1].Value;
	}
}
