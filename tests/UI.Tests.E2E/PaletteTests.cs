// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     PaletteTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.E2E
// =============================================

using UI.Tests.E2E.Fixtures;

namespace UI.Tests.E2E;

[Collection(WebAppCollectionDefinition.Name)]
public class PaletteTests(WebAppFixture fixture)
{
	[Fact]
	public async Task PaletteMenu_RoseChosen_SetsDataPaletteRoseAndSurvivesReload()
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using WebAppPage webAppPage = await fixture.CreatePageAsync(cancellationToken);
		IPage page = webAppPage.Page;
		await page.GotoAsync(fixture.BaseAddress.ToString());

		// Act
		await page.Locator("nav details summary").ClickAsync();
		await page.GetByRole(AriaRole.Button, new() { Name = "Rose" }).ClickAsync();

		// Assert
		await Expect(page.Locator("html")).ToHaveAttributeAsync("data-palette", "rose");
		await page.ReloadAsync();
		await Expect(page.Locator("html")).ToHaveAttributeAsync("data-palette", "rose");
	}

	[Fact]
	public async Task PaletteMenu_RoseChosen_ChangesBodyComputedBackgroundColorFromBlues()
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using WebAppPage webAppPage = await fixture.CreatePageAsync(cancellationToken);
		IPage page = webAppPage.Page;
		await page.GotoAsync(fixture.BaseAddress.ToString());
		ILocator body = page.Locator("body");
		await Expect(body).Not.ToHaveCSSAsync("background-color", "rgba(0, 0, 0, 0)");
		string blueBackgroundColor = await body.EvaluateAsync<string>("el => getComputedStyle(el).backgroundColor");

		// Act
		await page.Locator("nav details summary").ClickAsync();
		await page.GetByRole(AriaRole.Button, new() { Name = "Rose" }).ClickAsync();

		// Assert
		// Wait for the Rose page itself, so a body still waiting on its stylesheet (transparent) can't pass as "not blue".
		await Expect(page.Locator("html")).ToHaveAttributeAsync("data-palette", "rose");
		await Expect(body).Not.ToHaveCSSAsync("background-color", "rgba(0, 0, 0, 0)");
		await Expect(body).Not.ToHaveCSSAsync("background-color", blueBackgroundColor);
	}

	[Fact]
	public async Task PaletteMenu_RoseChosenInDark_ChangesBodyComputedBackgroundColorFromBlues()
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using WebAppPage lightWebAppPage = await fixture.CreatePageAsync(cancellationToken);
		IPage lightPage = lightWebAppPage.Page;
		await lightPage.GotoAsync(fixture.BaseAddress.ToString());
		ILocator lightBody = lightPage.Locator("body");
		await Expect(lightBody).Not.ToHaveCSSAsync("background-color", "rgba(0, 0, 0, 0)");
		string lightBlueBackgroundColor =
			await lightBody.EvaluateAsync<string>("el => getComputedStyle(el).backgroundColor");

		await using WebAppPage webAppPage = await fixture.CreatePageAsync(cancellationToken);
		IPage page = webAppPage.Page;
		// System follows the OS, so a Dark colour scheme renders the Dark surfaces (accent-950 on <body>).
		await page.EmulateMediaAsync(new() { ColorScheme = ColorScheme.Dark });
		await page.GotoAsync(fixture.BaseAddress.ToString());
		ILocator body = page.Locator("body");
		await Expect(body).Not.ToHaveCSSAsync("background-color", "rgba(0, 0, 0, 0)");
		string blueBackgroundColor = await body.EvaluateAsync<string>("el => getComputedStyle(el).backgroundColor");

		// A Dark accent-950 body renders a different colour than the Light accent-100 body; equal colours mean the
		// Dark colour scheme never reached <body>, and the assertions below would compare Light against Light.
		blueBackgroundColor.Should().NotBe(lightBlueBackgroundColor,
			"the emulated Dark colour scheme should render the Dark body surface, not the Light one");

		// Act
		await page.Locator("nav details summary").ClickAsync();
		await page.GetByRole(AriaRole.Button, new() { Name = "Rose" }).ClickAsync();

		// Assert
		// Wait for the Rose page itself, so a body still waiting on its stylesheet (transparent) can't pass as "not blue".
		await Expect(page.Locator("html")).ToHaveAttributeAsync("data-palette", "rose");
		await Expect(body).Not.ToHaveCSSAsync("background-color", "rgba(0, 0, 0, 0)");
		await Expect(body).Not.ToHaveCSSAsync("background-color", blueBackgroundColor);
	}
}
