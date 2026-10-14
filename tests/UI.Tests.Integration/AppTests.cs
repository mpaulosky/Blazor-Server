// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AppTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using System.Net;
using System.Text.RegularExpressions;

using Domain.Constants;

using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration;

public partial class AppTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly HttpClient _client;

	public AppTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_client = factory.CreateClient();
	}

	[GeneratedRegex("href=\"(css/app(\\.[a-z0-9]+)?\\.css)\"")]
	private static partial Regex StylesheetHrefPattern();

	[GeneratedRegex("<html([^>]*)>")]
	private static partial Regex HtmlTagPattern();

	[GeneratedRegex("<body([^>]*)>")]
	private static partial Regex BodyTagPattern();

	[GeneratedRegex(@"\s+")]
	private static partial Regex WhitespacePattern();

	private async Task<Uri> GetStylesheetUriAsync()
	{
		HttpResponseMessage homeResponse =
			await _client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await homeResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
		Match match = StylesheetHrefPattern().Match(html);
		match.Success.Should().BeTrue();

		return new Uri("/" + match.Groups[1].Value, UriKind.Relative);
	}

	[Fact]
	public async Task GetHome_ReturnsOkWithStylesheetLink()
	{
		// Arrange

		// Act
		HttpResponseMessage response =
			await _client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		StylesheetHrefPattern().IsMatch(html).Should().BeTrue();
	}

	[Fact]
	public async Task GetHome_ReturnsHtmlElementWithSchemeClassesAndNoDataThemeAttribute()
	{
		// Arrange

		// Act
		HttpResponseMessage response =
			await _client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
		Match match = HtmlTagPattern().Match(html);

		// Assert
		match.Success.Should().BeTrue();
		match.Value.Should().Contain("class=\"scheme-light dark:scheme-dark\"");
		match.Value.Should().NotContain("data-theme");
	}

	private async Task<string> GetHomeHtmlWithPaletteCookieAsync(string? cookieValue)
	{
		using HttpRequestMessage request = new(HttpMethod.Get, new Uri("/", UriKind.Relative));
		if (cookieValue is not null)
		{
			request.Headers.Add("Cookie", $"{ApplicationConstants.PaletteCookie}={cookieValue}");
		}

		HttpResponseMessage response = await _client.SendAsync(request, TestContext.Current.CancellationToken);

		return await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
	}

	[Fact]
	public async Task GetHome_PaletteCookieSetToRose_RendersDataPaletteRoseAttribute()
	{
		// Arrange

		// Act
		string html = await GetHomeHtmlWithPaletteCookieAsync("rose");
		Match match = HtmlTagPattern().Match(html);

		// Assert
		match.Success.Should().BeTrue();
		match.Value.Should().Contain("data-palette=\"rose\"");
	}

	[Theory]
	[InlineData(null)]
	[InlineData("blue")]
	[InlineData("not-a-hue")]
	public async Task GetHome_NoCookieBlueOrUnknownPaletteValue_RendersNoDataPaletteAttribute(string? cookieValue)
	{
		// Arrange

		// Act
		string html = await GetHomeHtmlWithPaletteCookieAsync(cookieValue);
		Match match = HtmlTagPattern().Match(html);

		// Assert
		match.Success.Should().BeTrue();
		match.Value.Should().NotContain("data-palette");
	}

	[Fact]
	public async Task GetHome_ReturnsBodyElementWithSlateBackgroundClasses()
	{
		// Arrange

		// Act
		HttpResponseMessage response =
			await _client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
		Match match = BodyTagPattern().Match(html);

		// Assert
		match.Success.Should().BeTrue();
		match.Value.Should().Contain("class=\"bg-slate-50 dark:bg-slate-950\"");
	}

	[Fact]
	public async Task GetStylesheet_ReturnsCssContainingHomeOnlyUtility()
	{
		// Arrange
		Uri requestUri = await GetStylesheetUriAsync();

		// Act
		HttpResponseMessage response = await _client.GetAsync(requestUri, TestContext.Current.CancellationToken);
		string css = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		response.Content.Headers.ContentType?.MediaType.Should().Be("text/css");
		css.Should().Contain(".text-balance");
	}

	[Fact]
	public async Task GetStylesheet_CompilesDarkUtilityUnderDataThemeAttributeAndPrefersColorScheme()
	{
		// Arrange
		Uri requestUri = await GetStylesheetUriAsync();

		// Act
		HttpResponseMessage response = await _client.GetAsync(requestUri, TestContext.Current.CancellationToken);
		string css = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		// Only Release builds pass --minify, so whitespace is stripped before matching. Both rules are matched whole:
		// an explicit data-theme=dark turns dark on, and the OS preference applies only without data-theme=light.
		string compactCss = WhitespacePattern().Replace(css, string.Empty);
		compactCss.Should().Contain(".dark\\:bg-slate-950:where([data-theme=dark],[data-theme=dark]*)");
		compactCss.Should().Contain(
			"@media(prefers-color-scheme:dark){.dark\\:bg-slate-950:where(:not([data-theme=light],[data-theme=light]*))");
	}

	[Fact]
	public async Task GetUnknownRoute_ReturnsNotFoundWithNotFoundPageText()
	{
		// Arrange

		// Act
		HttpResponseMessage response = await _client.GetAsync(new Uri("/this-page-does-not-exist", UriKind.Relative),
			TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.NotFound);
		html.Should().Contain("Page not found");
	}

	[Fact]
	public async Task PostUnknownRoute_KeepsStatusWithoutRenderingNotFoundPage()
	{
		// Arrange

		// Act
		HttpResponseMessage response = await _client.PostAsync(new Uri("/this-page-does-not-exist", UriKind.Relative),
			content: null, TestContext.Current.CancellationToken);
		string body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		// No route takes a POST here, so routing answers 405; what matters is that it isn't the NotFound page's 400.
		response.StatusCode.Should().Be(HttpStatusCode.MethodNotAllowed);
		body.Should().BeEmpty();
	}
}
