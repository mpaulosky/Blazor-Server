// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     HomeDiagnosticsTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.E2E
// =============================================

using UI.Tests.E2E.Fixtures;

namespace UI.Tests.E2E;

[Collection(WebAppCollectionDefinition.Name)]
public class HomeDiagnosticsTests(WebAppFixture fixture)
{
	[Fact]
	public async Task Home_Loaded_HasNoConsoleErrors()
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using IPage page = await fixture.CreatePageAsync(cancellationToken);

		// Act
		await page.GotoAsync(fixture.BaseAddress.ToString());
		IReadOnlyList<IConsoleMessage> consoleMessages = await page.ConsoleMessagesAsync();

		// Assert
		consoleMessages.Where(message => message.Type == "error").Should().BeEmpty();
	}

	[Fact]
	public async Task Home_Loaded_HidesReconnectModal()
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using IPage page = await fixture.CreatePageAsync(cancellationToken);
		await page.GotoAsync(fixture.BaseAddress.ToString());

		// Act
		// Assert
		await Expect(page.Locator("#components-reconnect-modal")).ToBeHiddenAsync();
	}
}
