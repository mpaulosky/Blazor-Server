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

using Microsoft.AspNetCore.Mvc.Testing;

namespace UI.Tests.Integration;

public partial class AppTests : IClassFixture<WebApplicationFactory<Program>>
{
	private readonly HttpClient _client;

	public AppTests(WebApplicationFactory<Program> factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_client = factory.CreateClient();
	}

	[GeneratedRegex("href=\"(css/app(\\.[a-z0-9]+)?\\.css)\"")]
	private static partial Regex StylesheetHrefPattern();

	[Fact]
	public async Task GetHome_ReturnsOkWithStylesheetLink()
	{
		// Arrange

		// Act
		HttpResponseMessage response = await _client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		StylesheetHrefPattern().IsMatch(html).Should().BeTrue();
	}

	[Fact]
	public async Task GetStylesheet_ReturnsCssContainingHomeOnlyUtility()
	{
		// Arrange
		HttpResponseMessage homeResponse = await _client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await homeResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
		Match match = StylesheetHrefPattern().Match(html);
		match.Success.Should().BeTrue();
		Uri requestUri = new("/" + match.Groups[1].Value.TrimStart('/'), UriKind.Relative);

		// Act
		HttpResponseMessage response = await _client.GetAsync(requestUri, TestContext.Current.CancellationToken);
		string css = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.OK);
		response.Content.Headers.ContentType?.MediaType.Should().Be("text/css");
		css.Should().Contain(".text-balance");
	}

	[Fact]
	public async Task GetUnknownRoute_ReturnsNotFoundWithNotFoundPageText()
	{
		// Arrange

		// Act
		HttpResponseMessage response = await _client.GetAsync(new Uri("/this-page-does-not-exist", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

		// Assert
		response.StatusCode.Should().Be(HttpStatusCode.NotFound);
		html.Should().Contain("Page not found");
	}
}
