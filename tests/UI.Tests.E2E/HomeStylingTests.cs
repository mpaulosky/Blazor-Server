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
}
