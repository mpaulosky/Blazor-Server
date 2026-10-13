// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     CookieRedirectTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

using UI.Components.Features.Authentication;
using UI.Tests.Integration.Fixtures;

namespace UI.Tests.Integration.Components.Features.Authentication;

public class CookieRedirectTests : IClassFixture<UiWebApplicationFactory>
{
	private readonly UiWebApplicationFactory _factory;

	public CookieRedirectTests(UiWebApplicationFactory factory)
	{
		ArgumentNullException.ThrowIfNull(factory);

		_factory = factory;
	}

	public static TheoryData<string, string> RedirectEvents => new()
	{
		{ nameof(CookieAuthenticationEvents.RedirectToLogin), "" },
		{ nameof(CookieAuthenticationEvents.RedirectToLogin), "/app" },
		{ nameof(CookieAuthenticationEvents.RedirectToAccessDenied), "" },
		{ nameof(CookieAuthenticationEvents.RedirectToAccessDenied), "/app" },
	};

	[Theory]
	[MemberData(nameof(RedirectEvents))]
	public async Task CookieRedirect_AbsoluteRedirectUri_SendsRelativeLocation(string redirectEvent, string pathBase)
	{
		// Arrange
		CookieAuthenticationOptions options = _factory.Services
			.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>()
			.Get(CookieAuthenticationDefaults.AuthenticationScheme);
		DefaultHttpContext httpContext = new();
		httpContext.Request.Scheme = "https";
		httpContext.Request.Host = new HostString("app.example:8443");
		httpContext.Request.PathBase = pathBase;
		string relativeUri = $"{pathBase}{AuthenticationEndpoints.LoginPath}?returnUrl=%2Fprofile%3Fx%3D1";
		RedirectContext<CookieAuthenticationOptions> context = new(httpContext,
			new AuthenticationScheme(CookieAuthenticationDefaults.AuthenticationScheme, null,
				typeof(CookieAuthenticationHandler)),
			options, new AuthenticationProperties(), $"https://app.example:8443{relativeUri}");

		// Act
		await (redirectEvent == nameof(CookieAuthenticationEvents.RedirectToLogin)
			? options.Events.RedirectToLogin(context)
			: options.Events.RedirectToAccessDenied(context));

		// Assert
		httpContext.Response.StatusCode.Should().Be(StatusCodes.Status302Found);
		httpContext.Response.Headers.Location.ToString().Should().Be(relativeUri);
	}
}
