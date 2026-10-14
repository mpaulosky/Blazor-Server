// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ThemeEndpoints.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using Domain.Abstractions;
using Domain.Constants;

using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;

using UI.Security;

namespace UI.Components.Features.Themes;

/// <summary>
///   Names the Themes feature's endpoint path, shared by its registration and its control.
/// </summary>
public static class ThemeEndpoints
{
	/// <summary>
	///   The antiforgery-protected path that sets or deletes the <c>theme</c> cookie.
	/// </summary>
	public const string Path = "/theme";

	/// <summary>
	///   Maps the antiforgery-protected POST endpoint that sets or deletes the <c>theme</c> cookie, and the GET/HEAD
	///   endpoint that answers 405 for it.
	/// </summary>
	/// <param name="endpoints">The endpoint route builder to map onto.</param>
	/// <returns>The same endpoint route builder, for chaining.</returns>
	public static IEndpointRouteBuilder MapThemeEndpoints(this IEndpointRouteBuilder endpoints)
	{
		ArgumentNullException.ThrowIfNull(endpoints);

		endpoints.MapPost(Path, SetThemeAsync);

		// Setting the Theme changes state, so it's POST only. Routing would answer a GET with 405 itself, but in
		// Development MapStaticAssets adds a {**path:file} GET fallback that wins the method match and then 404s.
		endpoints.MapMethods(Path, [HttpMethods.Get, HttpMethods.Head], MethodNotAllowed);

		return endpoints;
	}

	private static StatusCodeHttpResult MethodNotAllowed(HttpResponse response)
	{
		response.Headers.Allow = HttpMethods.Post;

		return TypedResults.StatusCode(StatusCodes.Status405MethodNotAllowed);
	}

	// The endpoint binds no form, so minimal APIs don't validate the antiforgery token for it and paint a 400 over the
	// page; it does so itself. A token that fails, most often from a stale tab, returns the caller to the page they
	// were on and changes nothing.
	private static async Task<Results<RedirectHttpResult, ProblemHttpResult>> SetThemeAsync(HttpContext context,
		IAntiforgery antiforgery, SetThemeHandler handler)
	{
		bool tokenIsValid = await antiforgery.IsRequestValidAsync(context).ConfigureAwait(false);

		// ReadFormAsync throws on a body that isn't a form, and only a crafted post sends one; it then has no valid token
		// either, so an empty form sends it home like any other failed token instead of to the error page.
		IFormCollection form = context.Request.HasFormContentType
			? await context.Request.ReadFormAsync(context.RequestAborted).ConfigureAwait(false)
			: FormCollection.Empty;
		string returnUrl = LocalReturnUrl.OrRoot(form["returnUrl"]);

		if (!tokenIsValid)
		{
			return TypedResults.LocalRedirect(returnUrl);
		}

		Result<Theme> result = handler.Handle(new SetThemeCommand(form["theme"]));

		// Only a crafted post can send an unknown value, so it gets ProblemDetails rather than a friendly page.
		if (result.Failure)
		{
			return TypedResults.Problem(detail: result.Error, statusCode: StatusCodes.Status400BadRequest,
				extensions: [new KeyValuePair<string, object?>("code", result.Details)]);
		}

		// The cookie holds the same lowercase name as data-theme. No cookie means System, which has no name, so choosing
		// System deletes the cookie, with the same Path it was set on.
		string? cookieValue = result.Value.ToDataTheme();

		if (cookieValue is null)
		{
			context.Response.Cookies.Delete(ApplicationConstants.ThemeCookie, CreateCookieOptions());
		}
		else
		{
			context.Response.Cookies.Append(ApplicationConstants.ThemeCookie, cookieValue, CreateCookieOptions());
		}

		// A 302, never a 307, so the browser follows it with a GET to a Razor page, which an enhanced post needs.
		return TypedResults.LocalRedirect(returnUrl);
	}

	// The Theme is a display preference, so the cookie is essential and needs no consent. Each choice re-issues it, so
	// the year runs from the visitor's last choice. Built per call because CookieOptions is mutable.
	private static CookieOptions CreateCookieOptions()
	{
		return new CookieOptions
		{
			MaxAge = TimeSpan.FromDays(365),
			SameSite = SameSiteMode.Lax,
			Secure = true,
			HttpOnly = true,
			Path = "/",
			IsEssential = true,
		};
	}
}
