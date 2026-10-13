// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     SecretLeakTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using System.Text.RegularExpressions;

using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

using UI.Components.Features.Authentication;
using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Authentication;

public partial class SecretLeakTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;

	public SecretLeakTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
	}

	[GeneratedRegex("<input[^>]*name=\"__RequestVerificationToken\"[^>]*value=\"([^\"]*)\"")]
	private static partial Regex AntiforgeryTokenPattern();

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
		List<HttpResponseMessage> responses = [];

		// Act
		responses.Add(await client.GetAsync(new Uri("/", UriKind.Relative), cancellationToken));
		client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeaderName, "a-user");
		HttpResponseMessage userHome = await client.GetAsync(new Uri("/", UriKind.Relative), cancellationToken);
		responses.Add(userHome);
		responses.Add(await client.GetAsync(
			new Uri($"{AuthenticationEndpoints.LoginPath}?returnUrl=%2F", UriKind.Relative), cancellationToken));
		Match antiforgeryToken =
			AntiforgeryTokenPattern().Match(await userHome.Content.ReadAsStringAsync(cancellationToken));
		using FormUrlEncodedContent logoutForm = new([
			new KeyValuePair<string?, string?>("__RequestVerificationToken", antiforgeryToken.Groups[1].Value),
		]);
		HttpResponseMessage logout = await client.PostAsync(
			new Uri(AuthenticationEndpoints.LogoutPath, UriKind.Relative), logoutForm, cancellationToken);
		responses.Add(logout);
		List<string> exposedText = [];
		foreach (HttpResponseMessage response in responses)
		{
			exposedText.Add(await response.Content.ReadAsStringAsync(cancellationToken));
			exposedText.Add(response.Headers.Location?.ToString() ?? string.Empty);
		}

		// Assert
		antiforgeryToken.Success.Should().BeTrue("the Log out form must render an antiforgery token for a signed-in User");
		logout.Headers.Location.Should().NotBeNull("a valid logout redirects to Auth0's logout endpoint");
		exposedText.Should()
			.NotContain(text => text.Contains(UiWebApplicationFactory.PlaceholderClientSecret, StringComparison.Ordinal));
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
