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
		string blueBackgroundColor = await body.EvaluateAsync<string>("el => getComputedStyle(el).backgroundColor");

		// Act
		await page.Locator("nav details summary").ClickAsync();
		await page.GetByRole(AriaRole.Button, new() { Name = "Rose" }).ClickAsync();

		// Assert
		await Expect(body).Not.ToHaveCSSAsync("background-color", blueBackgroundColor);
	}
}
