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
		HttpResponseMessage homeResponse =
			await _client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await homeResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
		Match match = StylesheetHrefPattern().Match(html);
		match.Success.Should().BeTrue();
		Uri requestUri = new("/" + match.Groups[1].Value, UriKind.Relative);

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
		HttpResponseMessage homeResponse =
			await _client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await homeResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
		Match match = StylesheetHrefPattern().Match(html);
		match.Success.Should().BeTrue();
		Uri requestUri = new("/" + match.Groups[1].Value, UriKind.Relative);

		// Act
		HttpResponseMessage response = await _client.GetAsync(requestUri, TestContext.Current.CancellationToken);
		string css = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		css.Should().Contain(".dark\\:bg-slate-950:where([data-theme=dark]");
		css.Replace(" ", string.Empty, StringComparison.Ordinal).Should().Contain("@media(prefers-color-scheme:dark)");
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
}
