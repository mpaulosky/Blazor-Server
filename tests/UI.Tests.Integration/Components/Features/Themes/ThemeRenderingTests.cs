// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ThemeRenderingTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using System.Text.RegularExpressions;

using Domain.Constants;

using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Themes;

public partial class ThemeRenderingTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;

	public ThemeRenderingTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
	}

	[GeneratedRegex("<html([^>]*)>")]
	private static partial Regex HtmlTagPattern();

	[Theory]
	[InlineData("dark", "data-theme=\"dark\"")]
	[InlineData("light", "data-theme=\"light\"")]
	public async Task GetHome_ThemeCookieLightOrDark_RendersMatchingDataThemeAttribute(string cookieValue,
		string expectedAttribute)
	{
		// Arrange
		using HttpClient client = _factory.CreateClient();
		client.DefaultRequestHeaders.Add("Cookie", $"{ApplicationConstants.ThemeCookie}={cookieValue}");

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
		Match match = HtmlTagPattern().Match(html);

		// Assert
		match.Success.Should().BeTrue();
		match.Value.Should().Contain(expectedAttribute);
	}

	[Theory]
	[InlineData("system")]
	[InlineData("unknown-value")]
	public async Task GetHome_ThemeCookieSystemOrUnknown_RendersNoDataThemeAttribute(string cookieValue)
	{
		// Arrange
		using HttpClient client = _factory.CreateClient();
		client.DefaultRequestHeaders.Add("Cookie", $"{ApplicationConstants.ThemeCookie}={cookieValue}");

		// Act
		HttpResponseMessage response =
			await client.GetAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
		string html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
		Match match = HtmlTagPattern().Match(html);

		// Assert
		match.Success.Should().BeTrue();
		match.Value.Should().NotContain("data-theme");
	}
}
