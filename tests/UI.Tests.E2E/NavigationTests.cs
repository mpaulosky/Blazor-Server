// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     NavigationTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.E2E
// =============================================

using UI.Tests.E2E.Fixtures;

namespace UI.Tests.E2E;

[Collection(WebAppCollectionDefinition.Name)]
public class NavigationTests(WebAppFixture fixture)
{
	[Fact]
	public async Task HomeNavLink_ClickedFromAnotherPage_NavigatesToHomeContent()
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using IPage page = await fixture.CreatePageAsync(cancellationToken);
		await page.GotoAsync(new Uri(fixture.BaseAddress, "/unknown-route").ToString());

		// Act
		await page.GetByRole(AriaRole.Link, new() { Name = "Home" }).ClickAsync();

		// Assert
		await Expect(page).ToHaveURLAsync(new Uri(fixture.BaseAddress, "/").ToString());
		await Expect(page.GetByRole(AriaRole.Heading, new() { Name = "Hello, world!" })).ToBeVisibleAsync();
	}
}
