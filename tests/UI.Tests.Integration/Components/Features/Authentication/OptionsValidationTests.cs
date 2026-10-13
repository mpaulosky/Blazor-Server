// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     OptionsValidationTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

using UI.Components.Features.Authentication;
using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Authentication;

// These run the startup validation the host runs for ValidateOnStart (IStartupValidator) on the feature's own
// registration, rather than starting the app through WebApplicationFactory. A start that fails there races: the app's
// entry point throws and disposes its host while the factory's deferred host still reads that host's services, so the
// test sometimes saw an ObjectDisposedException in place of the validation error.
public class OptionsValidationTests
{
	[Theory]
	[InlineData("Auth0:Domain")]
	[InlineData("Auth0:ClientId")]
	[InlineData("Auth0:ClientSecret")]
	public void ValidateOnStart_MissingRequiredAuth0Setting_ThrowsOptionsValidationExceptionNamingTheSetting(string key)
	{
		// Arrange
		using ServiceProvider provider = ServicesWith(key, string.Empty);
		IStartupValidator validator = provider.GetRequiredService<IStartupValidator>();

		// Act
		Action act = validator.Validate;

		// Assert
		act.Should().Throw<OptionsValidationException>().WithMessage($"*{key}*");
	}

	[Fact]
	public void ValidateOnStart_WhitespaceClientSecret_ThrowsOptionsValidationExceptionNamingTheSetting()
	{
		// Arrange
		using ServiceProvider provider = ServicesWith("Auth0:ClientSecret", "   ");
		IStartupValidator validator = provider.GetRequiredService<IStartupValidator>();

		// Act
		Action act = validator.Validate;

		// Assert
		act.Should().Throw<OptionsValidationException>().WithMessage("*Auth0:ClientSecret*");
	}

	[Theory]
	[InlineData("https://my-tenant.us.auth0.com")]
	[InlineData("my-tenant.us.auth0.com/")]
	[InlineData("my-tenant")]
	public void ValidateOnStart_Auth0DomainThatIsNotAHost_ThrowsOptionsValidationExceptionNamingTheSetting(string domain)
	{
		// Arrange
		using ServiceProvider provider = ServicesWith("Auth0:Domain", domain);
		IStartupValidator validator = provider.GetRequiredService<IStartupValidator>();

		// Act
		Action act = validator.Validate;

		// Assert
		act.Should().Throw<OptionsValidationException>().WithMessage("*Auth0:Domain*");
	}

	[Fact]
	public void ValidateOnStart_EveryAuth0SettingValid_DoesNotThrow()
	{
		// Arrange
		using ServiceProvider provider = ServicesWith("Auth0:Domain", UiWebApplicationFactory.PlaceholderDomain);
		IStartupValidator validator = provider.GetRequiredService<IStartupValidator>();

		// Act
		Action act = validator.Validate;

		// Assert
		act.Should().NotThrow();
	}

	// The feature registered over the factory's placeholder Auth0 settings, with one of them replaced.
	private static ServiceProvider ServicesWith(string key, string value)
	{
		Dictionary<string, string?> settings = new()
		{
			["Auth0:Domain"] = UiWebApplicationFactory.PlaceholderDomain,
			["Auth0:ClientId"] = UiWebApplicationFactory.PlaceholderClientId,
			["Auth0:ClientSecret"] = UiWebApplicationFactory.PlaceholderClientSecret,
			[key] = value,
		};
		IConfiguration configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
		ServiceCollection services = new();
		services.AddSingleton(configuration);
		services.AddAuthenticationFeature(configuration);

		return services.BuildServiceProvider();
	}
}
