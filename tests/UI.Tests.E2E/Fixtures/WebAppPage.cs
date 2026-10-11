// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     WebAppPage.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.E2E
// =============================================

namespace UI.Tests.E2E.Fixtures;

/// <summary>
///     A page opened by <see cref="WebAppFixture.CreatePageAsync" />, scoped to its own browser context. Disposing
///     it, normally with <c>await using</c> in the test, saves the context's trace (when captured) and closes the
///     context, rather than waiting for the whole test run to end.
/// </summary>
public sealed class WebAppPage : IAsyncDisposable
{
	private readonly Func<ValueTask> _closeContextAsync;

	internal WebAppPage(IPage page, Func<ValueTask> closeContextAsync)
	{
		Page = page;
		_closeContextAsync = closeContextAsync;
	}

	/// <summary>
	///     The underlying Playwright page.
	/// </summary>
	public IPage Page { get; }

	/// <summary>
	///     Saves the page's browser context's trace (when captured) and closes the context.
	/// </summary>
	public ValueTask DisposeAsync()
	{
		return _closeContextAsync();
	}
}
