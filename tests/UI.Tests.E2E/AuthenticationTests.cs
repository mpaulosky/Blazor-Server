// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AuthenticationTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.E2E
// =============================================

using UI.Tests.E2E.Fixtures;

namespace UI.Tests.E2E;

[Collection(WebAppCollectionDefinition.Name)]
public class AuthenticationTests(WebAppFixture fixture)
{
	[Fact]
	public async Task Home_Loaded_ShowsLogInLinkToVisitor()
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using WebAppPage webAppPage = await fixture.CreatePageAsync(cancellationToken);
		IPage page = webAppPage.Page;

		// Act
		await page.GotoAsync(fixture.BaseAddress.ToString());

		// Assert
		// Home's hero also shows a "Log in" link (see HomePageTests), so this scopes to the nav's, which is what
		// the rest of this class clicks.
		await Expect(NavLogInLink(page)).ToBeVisibleAsync();
	}

	[Fact]
	public async Task LogIn_Clicked_RequestsLoginEndpointWithReturnUrl()
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using WebAppPage webAppPage = await fixture.CreatePageAsync(cancellationToken);
		IPage page = webAppPage.Page;
		await page.GotoAsync(fixture.BaseAddress.ToString());

		// Act
		IRequest request = await page.RunAndWaitForRequestAsync(
			() => NavLogInLink(page).ClickAsync(),
			request => request.Url.Contains("/authentication/login?returnUrl=%2F", StringComparison.Ordinal));

		// Assert
		request.Url.Should().Contain("/authentication/login?returnUrl=%2F");
	}

	[Fact]
	public async Task LogIn_Clicked_NavigatesTowardTheConfiguredAuth0Domain()
	{
		// Arrange
		Assert.SkipWhen(fixture.UsesPlaceholderAuth0,
			"Reaching Auth0's /authorize endpoint needs a reachable Auth0 tenant; the login endpoint's own " +
			"redirect is covered deterministically by the integration tests instead.");
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using WebAppPage webAppPage = await fixture.CreatePageAsync(cancellationToken);
		IPage page = webAppPage.Page;
		await page.GotoAsync(fixture.BaseAddress.ToString());
		await page.Context.RouteAsync($"https://{fixture.Auth0Domain}/**", route => route.AbortAsync());

		// Act
		IRequest request = await page.RunAndWaitForRequestAsync(
			() => NavLogInLink(page).ClickAsync(),
			request => request.Url.StartsWith($"https://{fixture.Auth0Domain}/authorize", StringComparison.Ordinal));

		// Assert
		request.Url.Should().StartWith($"https://{fixture.Auth0Domain}/authorize");
	}

	private static ILocator NavLogInLink(IPage page) =>
		page.Locator("nav").GetByRole(AriaRole.Link, new() { Name = "Log in" });
}
