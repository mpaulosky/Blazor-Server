// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     OptionsValidationTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Options;

using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Authentication;

public class OptionsValidationTests
{
	[Theory]
	[InlineData("Auth0:Domain")]
	[InlineData("Auth0:ClientId")]
	[InlineData("Auth0:ClientSecret")]
	public void CreateClient_MissingRequiredAuth0Setting_ThrowsOptionsValidationExceptionNamingTheSetting(string key)
	{
		// Arrange
		using WebApplicationFactory<Program> factory = new UiWebApplicationFactory()
			.WithWebHostBuilder(builder => builder.UseSetting(key, string.Empty));

		// Act
		Action act = () => factory.CreateClient();

		// Assert
		act.Should().Throw<Exception>()
			.Where(exception => ContainsOptionsValidationExceptionNaming(exception, key));
	}

	[Fact]
	public void CreateClient_WhitespaceClientSecret_ThrowsOptionsValidationExceptionNamingTheSetting()
	{
		// Arrange
		using WebApplicationFactory<Program> factory = new UiWebApplicationFactory()
			.WithWebHostBuilder(builder => builder.UseSetting("Auth0:ClientSecret", "   "));

		// Act
		Action act = () => factory.CreateClient();

		// Assert
		act.Should().Throw<Exception>()
			.Where(exception => ContainsOptionsValidationExceptionNaming(exception, "Auth0:ClientSecret"));
	}

	[Theory]
	[InlineData("https://my-tenant.us.auth0.com")]
	[InlineData("my-tenant.us.auth0.com/")]
	[InlineData("my-tenant")]
	public void CreateClient_Auth0DomainThatIsNotAHost_ThrowsOptionsValidationExceptionNamingTheSetting(string domain)
	{
		// Arrange
		using WebApplicationFactory<Program> factory = new UiWebApplicationFactory()
			.WithWebHostBuilder(builder => builder.UseSetting("Auth0:Domain", domain));

		// Act
		Action act = () => factory.CreateClient();

		// Assert
		act.Should().Throw<Exception>()
			.Where(exception => ContainsOptionsValidationExceptionNaming(exception, "Auth0:Domain"));
	}

	private static bool ContainsOptionsValidationExceptionNaming(Exception? exception, string key)
	{
		for (Exception? current = exception; current is not null; current = current.InnerException)
		{
			if (current is OptionsValidationException validationException &&
				validationException.Message.Contains(key, StringComparison.Ordinal))
			{
				return true;
			}
		}

		return false;
	}
}
