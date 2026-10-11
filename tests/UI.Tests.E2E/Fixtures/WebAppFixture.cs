// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     WebAppFixture.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.E2E
// =============================================

using System.Text.RegularExpressions;

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
	// A few hundred MB of Chromium, chromium-headless-shell and ffmpeg can take several minutes on a slow link, and
	// must not race the AppHost's own startup budget below.
	private static readonly TimeSpan s_installTimeout = TimeSpan.FromMinutes(10);
	private static readonly TimeSpan s_startupTimeout = TimeSpan.FromMinutes(2);

	// Caps a trace file's name well under the 255-byte path-segment limit that both the local file system and CI's
	// artifact upload enforce, leaving room for the directory and extension.
	private const int MaxTraceNameLength = 100;

	private static readonly Regex s_unsafeTraceNameCharacters = new("[^A-Za-z0-9._-]", RegexOptions.Compiled);

	// ci.yml uploads bin/<Configuration>/**/TestResults/playwright-artifacts/ from E2E jobs.
	private static readonly string s_artifactsDirectory =
		Path.Combine(AppContext.BaseDirectory, "TestResults", "playwright-artifacts");

	private readonly bool _captureTraces =
		string.Equals(Environment.GetEnvironmentVariable("PLAYWRIGHT_ARTIFACTS"), "true", StringComparison.OrdinalIgnoreCase);

	private readonly object _pendingContextsLock = new();
	private readonly List<PendingContext> _pendingContexts = [];

	private int _pageSequence;

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
	public async Task<WebAppPage> CreatePageAsync(CancellationToken cancellationToken)
	{
		IBrowser browser = _browser ?? throw new InvalidOperationException("Chromium has not started yet.");
		cancellationToken.ThrowIfCancellationRequested();

		// A context per page keeps cookies and storage from leaking between tests. The returned WebAppPage closes
		// it, rather than the fixture, so the trace is saved and the context freed as soon as each test finishes.
		IBrowserContext context = await browser.NewContextAsync(new() { BaseURL = BaseAddress.ToString() });
		PendingContext pending = new(context, TraceName());

		lock (_pendingContextsLock)
		{
			_pendingContexts.Add(pending);
		}

		if (_captureTraces)
		{
			await context.Tracing.StartAsync(new() { Screenshots = true, Snapshots = true });
		}

		cancellationToken.ThrowIfCancellationRequested();

		IPage page = await context.NewPageAsync();

		return new WebAppPage(page, () => ClosePendingContextAsync(pending));
	}

	/// <summary>
	///     Installs Chromium, launches it headless, then starts the AppHost and waits for <c>WebApp</c> to become
	///     healthy. Launching Chromium first means a broken browser (for example a missing shared library) fails
	///     fast, before paying the AppHost's own startup budget.
	/// </summary>
	public async ValueTask InitializeAsync()
	{
		await InstallChromiumAsync();

		try
		{
			_playwright = await Playwright.CreateAsync();
			_browser = await _playwright.Chromium.LaunchAsync(new() { Headless = true });

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
		}
		catch
		{
			// Nothing that started above is cached by xUnit v3 on a failed InitializeAsync, so DisposeAsync would
			// never otherwise run: dispose everything that did start before rethrowing.
			await DisposeAsync();

			throw;
		}
	}

	/// <summary>
	///     Closes Chromium and the AppHost, and closes any browser context a test didn't already dispose.
	/// </summary>
	// Suppress CA1031: this teardown is the top-level boundary for cleanup. Every disposal below must run even when
	// an earlier one throws, or a crashed context, browser or Playwright instance leaves the AppHost's WebApp
	// process and its port running after the test run; the collected failures surface below instead of being lost.
#pragma warning disable CA1031 // Do not catch general exception types
	public async ValueTask DisposeAsync()
	{
		List<Exception> failures = [];

		List<PendingContext> remaining;

		lock (_pendingContextsLock)
		{
			remaining = [.. _pendingContexts];
		}

		// Normally empty: each WebAppPage closes its own context when the test disposes it. This is only a
		// fallback for a context a crashed or cancelled test left open.
		foreach (PendingContext pending in remaining)
		{
			try
			{
				await ClosePendingContextAsync(pending);
			}
			catch (Exception exception)
			{
				failures.Add(exception);
			}
		}

		try
		{
			if (_browser is not null)
			{
				await _browser.DisposeAsync();
			}
		}
		catch (Exception exception)
		{
			failures.Add(exception);
		}

		try
		{
			_playwright?.Dispose();
		}
		catch (Exception exception)
		{
			failures.Add(exception);
		}

		try
		{
			if (_application is not null)
			{
				await _application.DisposeAsync();
			}
		}
		catch (Exception exception)
		{
			failures.Add(exception);
		}

		if (failures.Count > 0)
		{
			throw new AggregateException("Disposing WebAppFixture failed.", failures);
		}
	}
#pragma warning restore CA1031 // Do not catch general exception types

	private static async Task InstallChromiumAsync()
	{
		using CancellationTokenSource installTimeout =
			CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
		installTimeout.CancelAfter(s_installTimeout);

		int exitCode;

		try
		{
			// Installing is a no-op when Chromium is already there, so CI, the sandbox and a fresh clone all run
			// the same way. Program.Main blocks synchronously and ignores cancellation, so run it on a pool thread
			// and bound the wait by the install timeout rather than letting a stalled download hang the whole run.
			exitCode = await Task
				.Run(() => Microsoft.Playwright.Program.Main(["install", "chromium"]), installTimeout.Token)
				.WaitAsync(installTimeout.Token);
		}
		catch (OperationCanceledException exception)
			when (!TestContext.Current.CancellationToken.IsCancellationRequested)
		{
			throw new InvalidOperationException(
				$"Installing Chromium did not finish within {s_installTimeout.TotalMinutes} minutes. Run " +
				"'playwright install chromium' manually, then re-run the tests.", exception);
		}

		if (exitCode != 0)
		{
			throw new InvalidOperationException($"Installing Chromium for Playwright failed with exit code {exitCode}.");
		}
	}

	private async ValueTask ClosePendingContextAsync(PendingContext pending)
	{
		bool stillPending;

		lock (_pendingContextsLock)
		{
			stillPending = _pendingContexts.Remove(pending);
		}

		if (!stillPending)
		{
			// Already closed, either by the test's own WebAppPage.DisposeAsync or by this fixture's fallback loop.
			return;
		}

		// Suppress CA1031: a failed trace save must never replace the test's own failure, which this runs
		// alongside as part of WebAppPage.DisposeAsync's finally. The context close below must still happen even
		// when saving the trace throws (an unwritable disk, or a context that already crashed).
#pragma warning disable CA1031 // Do not catch general exception types
		try
		{
			if (_captureTraces)
			{
				await pending.Context.Tracing.StopAsync(
					new() { Path = Path.Combine(s_artifactsDirectory, $"{pending.TraceName}.zip") });
			}
		}
		catch (Exception exception)
		{
			TestContext.Current.SendDiagnosticMessage(
				$"Saving the Playwright trace for '{pending.TraceName}' failed: {exception}");
		}
		finally
		{
			await pending.Context.CloseAsync();
		}
#pragma warning restore CA1031 // Do not catch general exception types
	}

	private string TraceName()
	{
		string testName = TestContext.Current.Test?.TestDisplayName ?? "unknown-test";

		// actions/upload-artifact rejects more characters than the local file system does (": < > | * ? " and
		// control characters), so names are whitelisted rather than built from Path.GetInvalidFileNameChars().
		string safeName = s_unsafeTraceNameCharacters.Replace(testName, "_");
		string prefix = $"{Interlocked.Increment(ref _pageSequence) - 1:D3}-";
		int maxSafeNameLength = Math.Max(0, MaxTraceNameLength - prefix.Length);

		if (safeName.Length > maxSafeNameLength)
		{
			safeName = safeName[..maxSafeNameLength];
		}

		return prefix + safeName;
	}

	private sealed record PendingContext(IBrowserContext Context, string TraceName);
}
