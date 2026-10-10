// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     HomeStylingTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.E2E
// =============================================

using UI.Tests.E2E.Fixtures;

namespace UI.Tests.E2E;

[Collection(WebAppCollectionDefinition.Name)]
public class HomeStylingTests(WebAppFixture fixture)
{
	[Fact]
	public async Task Home_TextFourXlHeading_ComputesLargeFontSize()
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using IPage page = await fixture.CreatePageAsync(cancellationToken);
		await page.GotoAsync(fixture.BaseAddress.ToString());
		ILocator heading = page.GetByRole(AriaRole.Heading, new() { Name = "Hello, world!" });

		// Act
		// Assert
		// text-4xl computes to 36px. Chromium's default h1 font-size is 32px (2em), so this fails without
		// Tailwind applied, unlike font-weight, where the browser default and font-bold both compute to 700.
		await Expect(heading).ToHaveCSSAsync("font-size", "36px");
	}
}
