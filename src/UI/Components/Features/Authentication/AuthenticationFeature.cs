// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AuthenticationFeature.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using Auth0.AspNetCore.Authentication;

using Domain.Constants;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace UI.Components.Features.Authentication;

/// <summary>
///   Registers the Authentication feature: Auth0 sign-in with a cookie session, the role claim mapping and the
///   Admin policy.
/// </summary>
public static class AuthenticationFeature
{
	/// <summary>
	///   Adds the Authentication feature's options, schemes, claims transformation and authorization policies.
	/// </summary>
	/// <param name="services">The service collection to add to.</param>
	/// <param name="configuration">The app's configuration, read for the <c>Auth0</c> section.</param>
	/// <returns>The same service collection, for chaining.</returns>
	public static IServiceCollection AddAuthenticationFeature(this IServiceCollection services,
		IConfiguration configuration)
	{
		ArgumentNullException.ThrowIfNull(configuration);

		services.AddOptions<Auth0Options>()
			.BindConfiguration(Auth0Options.SectionName)
			.ValidateDataAnnotations()
			.ValidateOnStart();

		// The SDK runs this lambda straight away, while services are still being registered, so it reads
		// configuration directly. It mustn't throw on a missing value: ValidateOnStart reports those, naming the
		// setting.
		IConfigurationSection auth0Section = configuration.GetSection(Auth0Options.SectionName);
		services.AddAuth0WebAppAuthentication(options =>
		{
			string? clientSecret = auth0Section[nameof(Auth0Options.ClientSecret)];
			options.Domain = auth0Section[nameof(Auth0Options.Domain)] ?? string.Empty;
			options.ClientId = auth0Section[nameof(Auth0Options.ClientId)] ?? string.Empty;
			options.ClientSecret = clientSecret;
			options.AccessDeniedPath = AuthenticationEndpoints.AccessDeniedPath;

			// Sign-in uses the authorization-code flow, so the client secret only ever goes from the server to Auth0's
			// token endpoint. The SDK throws at once for the code flow without a secret, so a missing one keeps the
			// SDK's default flow here and lets ValidateOnStart stop the app, naming the setting, before anyone signs in.
			if (!string.IsNullOrEmpty(clientSecret))
			{
				options.ResponseType = OpenIdConnectResponseType.Code;
			}
		});

		services.Configure<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme, options =>
		{
			options.LoginPath = AuthenticationEndpoints.LoginPath;
			options.AccessDeniedPath = AuthenticationEndpoints.AccessDeniedPath;
			options.ReturnUrlParameter = "returnUrl";
		});

		// ASP.NET Core runs only the last IClaimsTransformation registered, so a later slice that needs its own
		// must compose with this one rather than register beside it.
		services.AddTransient<IClaimsTransformation, RoleClaimsTransformation>();

		services.AddAuthorizationBuilder()
			.AddPolicy(ApplicationConstants.AdminPolicy, policy => policy
				.RequireAuthenticatedUser()
				.RequireRole(ApplicationConstants.AdminRole));

		return services;
	}
}
