// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AuthenticationEndpoints.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using Auth0.AspNetCore.Authentication;

using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http.HttpResults;

namespace UI.Components.Features.Authentication;

/// <summary>
///   Names the Authentication feature's endpoint paths, shared by its registration, its components and its cookie
///   scheme configuration.
/// </summary>
public static class AuthenticationEndpoints
{
	/// <summary>
	///   The path that challenges the Auth0 scheme to start sign-in.
	/// </summary>
	public const string LoginPath = "/authentication/login";

	/// <summary>
	///   The antiforgery-protected path that signs the caller out of both the cookie and Auth0 sessions.
	/// </summary>
	public const string LogoutPath = "/authentication/logout";

	/// <summary>
	///   The path shown to a caller Auth0 denies access to.
	/// </summary>
	public const string AccessDeniedPath = "/authentication/access-denied";

	/// <summary>
	///   Maps the GET login endpoint and the antiforgery-protected POST logout endpoint.
	/// </summary>
	/// <param name="endpoints">The endpoint route builder to map onto.</param>
	/// <returns>The same endpoint route builder, for chaining.</returns>
	public static IEndpointRouteBuilder MapAuthenticationEndpoints(this IEndpointRouteBuilder endpoints)
	{
		endpoints.MapGet(LoginPath, Login).AllowAnonymous();
		endpoints.MapPost(LogoutPath, LogoutAsync);

		// Logout changes state, so it's POST only. Routing would answer a GET with 405 itself, but in Development
		// MapStaticAssets adds a {**path:file} GET fallback that wins the method match and then 404s.
		endpoints.MapMethods(LogoutPath, [HttpMethods.Get, HttpMethods.Head], LogoutMethodNotAllowed);

		return endpoints;
	}

	private static ChallengeHttpResult Login(string? returnUrl)
	{
		AuthenticationProperties properties = new LoginAuthenticationPropertiesBuilder()
			.WithRedirectUri(LocalReturnUrl.OrRoot(returnUrl))
			.Build();

		return TypedResults.Challenge(properties, [Auth0Constants.AuthenticationScheme]);
	}

	private static StatusCodeHttpResult LogoutMethodNotAllowed(HttpResponse response)
	{
		response.Headers.Allow = HttpMethods.Post;

		return TypedResults.StatusCode(StatusCodes.Status405MethodNotAllowed);
	}

	// The endpoint binds no form, so minimal APIs don't validate the antiforgery token for it; it does so itself. Every
	// POST needs a valid token, so a stale tab whose session has ended gets 400 rather than a sign-out.
	private static async Task<Results<SignOutHttpResult, BadRequest>> LogoutAsync(HttpContext context,
		IAntiforgery antiforgery)
	{
		if (!await antiforgery.IsRequestValidAsync(context).ConfigureAwait(false))
		{
			return TypedResults.BadRequest();
		}

		// Signing out of the Auth0 scheme redirects to Auth0's logout endpoint, which ends the Auth0 session too and
		// then returns the browser to "/".
		AuthenticationProperties properties = new LogoutAuthenticationPropertiesBuilder()
			.WithRedirectUri("/")
			.Build();

		return TypedResults.SignOut(properties,
			[CookieAuthenticationDefaults.AuthenticationScheme, Auth0Constants.AuthenticationScheme]);
	}
}
