// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     UiWebApplicationFactory.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Integration
// =============================================

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace UI.Tests.Integration.Fixtures;

/// <summary>
///   A <see cref="WebApplicationFactory{TEntryPoint}" /> for <c>Program</c> configured with placeholder Auth0
///   settings and <see cref="TestAuthHandler" />, so the app's authentication pipeline can be exercised without a
///   real Auth0 tenant.
/// </summary>
public class UiWebApplicationFactory : WebApplicationFactory<Program>
{
	/// <summary>
	///   The placeholder Auth0 domain. The <c>.invalid</c> TLD never resolves, so no test can reach a real tenant
	///   by accident.
	/// </summary>
	public const string PlaceholderDomain = "auth0.placeholder.invalid";

	/// <summary>
	///   The placeholder Auth0 client ID.
	/// </summary>
	public const string PlaceholderClientId = "placeholder-client-id";

	/// <summary>
	///   The placeholder Auth0 client secret.
	/// </summary>
	public const string PlaceholderClientSecret = "placeholder-client-secret";

	/// <inheritdoc />
	protected override void ConfigureWebHost(IWebHostBuilder builder)
	{
		ArgumentNullException.ThrowIfNull(builder);

		// UseSetting feeds Program as a command-line argument, available while services are registered. Auth0's
		// SDK reads its options at registration time, so ConfigureAppConfiguration (applied only at Build()) would
		// be too late.
		builder.UseSetting("Auth0:Domain", PlaceholderDomain);
		builder.UseSetting("Auth0:ClientId", PlaceholderClientId);
		builder.UseSetting("Auth0:ClientSecret", PlaceholderClientSecret);

		builder.ConfigureTestServices(services =>
		{
			services.AddAuthentication()
				.AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, null);

			// A plain AddAuthentication(TestAuthHandler.SchemeName) loses to the Auth0 SDK's own
			// scheme-specific defaults, so the default scheme is forced here instead.
			services.Configure<AuthenticationOptions>(options =>
				options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName);

			// Configure (not PostConfigure) runs before OpenIdConnect's own post-configure turns Configuration
			// into a static configuration manager, so the handler never fetches the discovery document.
			services.Configure<OpenIdConnectOptions>("Auth0", options =>
				options.Configuration = new OpenIdConnectConfiguration
				{
					AuthorizationEndpoint = $"https://{PlaceholderDomain}/authorize",
					EndSessionEndpoint = $"https://{PlaceholderDomain}/v2/logout",
					Issuer = $"https://{PlaceholderDomain}/",
				});
		});
	}
}
