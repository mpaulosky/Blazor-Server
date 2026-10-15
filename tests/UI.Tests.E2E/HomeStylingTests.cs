// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     HomeStylingTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.E2E
// =============================================

using Domain.Constants;

using UI.Tests.E2E.Fixtures;

namespace UI.Tests.E2E;

[Collection(WebAppCollectionDefinition.Name)]
public class HomeStylingTests(WebAppFixture fixture)
{
	[Fact]
	public async Task Home_HeroHeading_ComputesLargeFontSize()
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using WebAppPage webAppPage = await fixture.CreatePageAsync(cancellationToken);
		IPage page = webAppPage.Page;
		await page.GotoAsync(fixture.BaseAddress.ToString());
		ILocator heading = page.GetByRole(AriaRole.Heading, new() { Name = ApplicationConstants.AppName });

		// Act
		// Assert
		// The fixture's page keeps Playwright's 1280px default viewport, at or above Tailwind's sm breakpoint
		// (640px), so PageHeader's sm:text-5xl (48px) wins over its text-4xl (36px). Chromium's default h1
		// font-size is 32px (2em), so this still fails without Tailwind applied.
		await Expect(heading).ToHaveCSSAsync("font-size", "48px");
	}

	[Theory]
	[InlineData(ColorScheme.Light, "text-accent-800!")]
	[InlineData(ColorScheme.Dark, "dark:text-accent-200!")]
	public async Task NavMenu_ActiveHomeLink_ComputesTheAccentTextColour(ColorScheme colorScheme, string expectedClass)
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using WebAppPage webAppPage = await fixture.CreatePageAsync(cancellationToken);
		IPage page = webAppPage.Page;
		await page.EmulateMediaAsync(new() { ColorScheme = colorScheme });
		await page.GotoAsync(fixture.BaseAddress.ToString());
		ILocator homeLink = page.Locator("header nav").GetByRole(AriaRole.Link, new() { Name = "Home" });
		await Expect(homeLink).ToBeVisibleAsync();

		// Act
		// NavLink adds ActiveClass on top of the link's resting text-slate-* classes, and Tailwind orders those after
		// text-accent-*, so only the active colour's own rule shows whether it wins the cascade.
		string expectedColor = await page.EvaluateAsync<string>(
			"cls => { const probe = document.createElement('span'); probe.className = cls; document.body.append(probe); " +
			"const color = getComputedStyle(probe).color; probe.remove(); return color; }",
			expectedClass);

		// Assert
		await Expect(homeLink).ToHaveCSSAsync("color", expectedColor);
	}
}
