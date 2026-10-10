// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     WebAppFixture.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.E2E
// =============================================

using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;

using Domain.Constants;

namespace UI.Tests.E2E.Fixtures;

/// <summary>
///     Starts the AppHost and a headless Chromium instance once for every E2E test, and hands each test a page
///     against <see cref="ApplicationConstants.Website" />.
/// </summary>
public sealed class WebAppFixture : IAsyncLifetime
{
	private static readonly TimeSpan s_startupTimeout = TimeSpan.FromMinutes(2);

	// ci.yml uploads bin/<Configuration>/**/TestResults/playwright-artifacts/ from E2E jobs.
	private static readonly string s_artifactsDirectory =
		Path.Combine(AppContext.BaseDirectory, "TestResults", "playwright-artifacts");

	private readonly bool _captureTraces =
		string.Equals(Environment.GetEnvironmentVariable("PLAYWRIGHT_ARTIFACTS"), "true", StringComparison.OrdinalIgnoreCase);

	private readonly List<(IBrowserContext Context, string TraceName)> _contexts = [];

	private DistributedApplication? _application;
	private IPlaywright? _playwright;
	private IBrowser? _browser;
	private Uri? _baseAddress;

	/// <summary>
	///     The base address of the running <c>WebApp</c> resource.
	/// </summary>
	public Uri BaseAddress => _baseAddress ?? throw new InvalidOperationException("The AppHost has not started yet.");

	/// <summary>
	///     Opens a new, isolated browser page against <see cref="BaseAddress" />.
	/// </summary>
	/// <param name="cancellationToken">A token that cancels opening the page.</param>
	public async Task<IPage> CreatePageAsync(CancellationToken cancellationToken)
	{
		IBrowser browser = _browser ?? throw new InvalidOperationException("Chromium has not started yet.");
		cancellationToken.ThrowIfCancellationRequested();

		// A context per page keeps cookies and storage from leaking between tests. The fixture closes it, rather than
		// the test, so it can save the context's trace first.
		IBrowserContext context = await browser.NewContextAsync(new() { BaseURL = BaseAddress.ToString() });
		_contexts.Add((context, TraceName()));

		if (_captureTraces)
		{
			await context.Tracing.StartAsync(new() { Screenshots = true, Snapshots = true });
		}

		cancellationToken.ThrowIfCancellationRequested();

		return await context.NewPageAsync();
	}

	/// <summary>
	///     Installs Chromium, starts the AppHost, waits for <c>WebApp</c> to become healthy, and launches headless
	///     Chromium.
	/// </summary>
	public async ValueTask InitializeAsync()
	{
		// Installing is a no-op when Chromium is already there, so CI, the sandbox and a fresh clone all run the same way.
		int exitCode = Microsoft.Playwright.Program.Main(["install", "chromium"]);
		if (exitCode != 0)
		{
			throw new InvalidOperationException($"Installing Chromium for Playwright failed with exit code {exitCode}.");
		}

		using CancellationTokenSource startupTimeout =
			CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
		startupTimeout.CancelAfter(s_startupTimeout);

		IDistributedApplicationTestingBuilder builder = await DistributedApplicationTestingBuilder
			.CreateAsync<global::Projects.AppHost>(startupTimeout.Token);

		_application = await builder.BuildAsync(startupTimeout.Token);
		await _application.StartAsync(startupTimeout.Token);
		await _application.ResourceNotifications.WaitForResourceHealthyAsync(
			ApplicationConstants.Website, WaitBehavior.StopOnResourceUnavailable, startupTimeout.Token);

		_baseAddress = _application.GetEndpoint(ApplicationConstants.Website, "http");

		_playwright = await Playwright.CreateAsync();
		_browser = await _playwright.Chromium.LaunchAsync(new() { Headless = true });
	}

	/// <summary>
	///     Closes Chromium and the AppHost.
	/// </summary>
	public async ValueTask DisposeAsync()
	{
		foreach ((IBrowserContext context, string traceName) in _contexts)
		{
			if (_captureTraces)
			{
				await context.Tracing.StopAsync(new() { Path = Path.Combine(s_artifactsDirectory, $"{traceName}.zip") });
			}

			await context.CloseAsync();
		}

		if (_browser is not null)
		{
			await _browser.DisposeAsync();
		}

		_playwright?.Dispose();

		if (_application is not null)
		{
			await _application.DisposeAsync();
		}
	}

	private string TraceName()
	{
		string testName = TestContext.Current.Test?.TestDisplayName ?? "unknown-test";
		char[] invalidCharacters = Path.GetInvalidFileNameChars();
		string safeName = string.Concat(testName.Select(character => invalidCharacters.Contains(character) ? '_' : character));

		// The index keeps two pages from the same test from overwriting each other's trace.
		return $"{_contexts.Count:D3}-{safeName}";
	}
}
