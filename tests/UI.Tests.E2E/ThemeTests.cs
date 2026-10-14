// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ThemeTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.E2E
// =============================================

using UI.Tests.E2E.Fixtures;

namespace UI.Tests.E2E;

[Collection(WebAppCollectionDefinition.Name)]
public class ThemeTests(WebAppFixture fixture)
{
	[Fact]
	public async Task ThemeControl_DarkChosen_SetsDataThemeDarkAndSurvivesReload()
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using WebAppPage webAppPage = await fixture.CreatePageAsync(cancellationToken);
		IPage page = webAppPage.Page;
		await page.GotoAsync(fixture.BaseAddress.ToString());

		// Act
		await ThemeGroup(page).GetByRole(AriaRole.Button, new() { Name = "Dark" }).ClickAsync();

		// Assert
		await Expect(page.Locator("html")).ToHaveAttributeAsync("data-theme", "dark");
		await page.ReloadAsync();
		await Expect(page.Locator("html")).ToHaveAttributeAsync("data-theme", "dark");
	}

	[Fact]
	public async Task ThemeControl_SystemChosenAfterDark_RemovesDataThemeAttribute()
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using WebAppPage webAppPage = await fixture.CreatePageAsync(cancellationToken);
		IPage page = webAppPage.Page;
		await page.GotoAsync(fixture.BaseAddress.ToString());
		await ThemeGroup(page).GetByRole(AriaRole.Button, new() { Name = "Dark" }).ClickAsync();
		await Expect(page.Locator("html")).ToHaveAttributeAsync("data-theme", "dark");

		// Act
		await ThemeGroup(page).GetByRole(AriaRole.Button, new() { Name = "System" }).ClickAsync();

		// Assert
		await Expect(page.Locator("html")).Not.ToHaveAttributeAsync("data-theme", "dark");
		string? dataTheme = await page.Locator("html").GetAttributeAsync("data-theme");
		dataTheme.Should().BeNull();
	}

	private static ILocator ThemeGroup(IPage page) =>
		page.Locator("nav").GetByRole(AriaRole.Group, new() { Name = "Theme" });
}
