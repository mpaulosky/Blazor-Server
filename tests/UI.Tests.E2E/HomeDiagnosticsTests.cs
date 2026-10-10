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
		// NetworkIdle waits past the `load` event until the SignalR circuit's websocket upgrade settles, so errors
		// from a failed circuit start or interop call have reached the page before the assertions below run.
		await page.GotoAsync(fixture.BaseAddress.ToString(), new() { WaitUntil = WaitUntilState.NetworkIdle });
		IReadOnlyList<IConsoleMessage> consoleMessages = await page.ConsoleMessagesAsync();
		IReadOnlyList<string> pageErrors = await page.PageErrorsAsync();

		// Assert
		consoleMessages.Where(message => message.Type == "error").Should().BeEmpty();
		pageErrors.Should().BeEmpty();
	}

	[Fact]
	public async Task Home_Loaded_HidesReconnectModal()
	{
		// Arrange
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		await using IPage page = await fixture.CreatePageAsync(cancellationToken);
		await page.GotoAsync(fixture.BaseAddress.ToString(), new() { WaitUntil = WaitUntilState.NetworkIdle });
		ILocator reconnectModal = page.Locator("#components-reconnect-modal");

		// Act
		// Assert
		await Expect(reconnectModal).ToBeAttachedAsync();
		await Expect(reconnectModal).ToBeHiddenAsync();
	}
}
