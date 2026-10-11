// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     NotFoundTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.E2E
// =============================================

using UI.Tests.E2E.Fixtures;

namespace UI.Tests.E2E;

[Collection(WebAppCollectionDefinition.Name)]
public class NotFoundTests(WebAppFixture fixture)
{
	[Fact]
	public async Task UnknownRoute_Navigated_ShowsNotFoundContent()
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using WebAppPage webAppPage = await fixture.CreatePageAsync(cancellationToken);
		IPage page = webAppPage.Page;

		// Act
		await page.GotoAsync(new Uri(fixture.BaseAddress, "/unknown-route").ToString());

		// Assert
		await Expect(page.GetByRole(AriaRole.Heading, new() { Name = "Page not found" })).ToBeVisibleAsync();
	}
}
