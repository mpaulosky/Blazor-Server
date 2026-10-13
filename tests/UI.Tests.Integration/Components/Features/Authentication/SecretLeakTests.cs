// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SecretLeakTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

using UI.Components.Features.Authentication;
using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Authentication;

public class SecretLeakTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;

	public SecretLeakTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
	}

	[Fact]
	public async Task VisitorAndUserJourneys_NeverExposeTheClientSecret()
	{
		// Arrange
		CapturingLoggerProvider capturingLoggerProvider = new();
		await using WebApplicationFactory<Program> factory = _factory.WithWebHostBuilder(builder =>
			builder.ConfigureTestServices(services =>
				services.AddSingleton<ILoggerProvider>(capturingLoggerProvider)));
		using HttpClient client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
		CancellationToken cancellationToken = TestContext.Current.CancellationToken;
		List<string> responseBodies = [];

		// Act
		responseBodies.Add(await (await client.GetAsync(new Uri("/", UriKind.Relative), cancellationToken))
			.Content.ReadAsStringAsync(cancellationToken));
		client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeaderName, "a-user");
		responseBodies.Add(await (await client.GetAsync(new Uri("/", UriKind.Relative), cancellationToken))
			.Content.ReadAsStringAsync(cancellationToken));
		responseBodies.Add(await (await client.GetAsync(
			new Uri($"{AuthenticationEndpoints.LoginPath}?returnUrl=%2F", UriKind.Relative), cancellationToken))
			.Content.ReadAsStringAsync(cancellationToken));

		// Assert
		responseBodies.Should()
			.NotContain(body => body.Contains(UiWebApplicationFactory.PlaceholderClientSecret, StringComparison.Ordinal));
		capturingLoggerProvider.Messages.Should()
			.NotContain(message =>
				message.Contains(UiWebApplicationFactory.PlaceholderClientSecret, StringComparison.Ordinal));
	}

	private sealed class CapturingLoggerProvider : ILoggerProvider
	{
		public List<string> Messages { get; } = [];

		public ILogger CreateLogger(string categoryName) => new CapturingLogger(Messages);

		public void Dispose()
		{
		}

		private sealed class CapturingLogger(List<string> messages) : ILogger
		{
			public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

			public bool IsEnabled(LogLevel logLevel) => true;

			public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
				Func<TState, Exception?, string> formatter)
			{
				lock (messages)
				{
					messages.Add(formatter(state, exception));
				}
			}
		}
	}
}
