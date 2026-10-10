// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     WebAppFixture.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.E2E
// =============================================

namespace UI.Tests.E2E.Fixtures;

/// <summary>
///     Starts the AppHost and a headless Chromium instance once for every E2E test, and hands each test a page
///     against <see cref="Domain.Constants.ApplicationConstants.Website" />.
/// </summary>
public sealed class WebAppFixture : IAsyncLifetime
{
	private readonly Uri _baseAddress = new("http://localhost");

	/// <summary>
	///     The base address of the running <c>WebApp</c> resource.
	/// </summary>
	public Uri BaseAddress => _baseAddress;

	/// <summary>
	///     Opens a new, isolated browser page against <see cref="BaseAddress" />.
	/// </summary>
	/// <param name="cancellationToken">A token that cancels opening the page.</param>
	public Task<IPage> CreatePageAsync(CancellationToken cancellationToken)
	{
		throw new NotImplementedException();
	}

	/// <summary>
	///     Installs Chromium, starts the AppHost, waits for <c>WebApp</c> to become healthy, and launches headless
	///     Chromium.
	/// </summary>
	public ValueTask InitializeAsync()
	{
		throw new NotImplementedException();
	}

	/// <summary>
	///     Closes Chromium and the AppHost.
	/// </summary>
	public ValueTask DisposeAsync()
	{
		throw new NotImplementedException();
	}
}
