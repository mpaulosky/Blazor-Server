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
	public async Task Home_FontBoldHeading_ComputesBoldFontWeight()
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using IPage page = await fixture.CreatePageAsync(cancellationToken);
		await page.GotoAsync(fixture.BaseAddress.ToString());
		ILocator heading = page.GetByRole(AriaRole.Heading, new() { Name = "Hello, world!" });

		// Act
		// Assert
		await Expect(heading).ToHaveCSSAsync("font-weight", "700");
	}
}
