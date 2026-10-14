// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     PaletteEndpoints.cs
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

namespace UI.Components.Features.Palettes;

/// <summary>
///   Names the Palette feature's endpoint path and maps the antiforgery-protected POST endpoint that sets the
///   <c>palette</c> cookie.
/// </summary>
public static class PaletteEndpoints
{
	/// <summary>
	///   The path that sets the visitor's Palette.
	/// </summary>
	public const string Path = "/palette";

	/// <summary>
	///   Maps the antiforgery-protected POST endpoint and the GET/HEAD method-not-allowed response.
	/// </summary>
	/// <param name="endpoints">The endpoint route builder to map onto.</param>
	/// <returns>The same endpoint route builder, for chaining.</returns>
	public static IEndpointRouteBuilder MapPaletteEndpoints(this IEndpointRouteBuilder endpoints)
	{
		endpoints.MapPost(Path, PostAsync);

		// Routing would answer a GET with 405 itself, but in Development MapStaticAssets adds a {**path:file} GET
		// fallback that wins the method match and then 404s, the same reason Log out maps this explicitly.
		endpoints.MapMethods(Path, [HttpMethods.Get, HttpMethods.Head], MethodNotAllowed);

		return endpoints;
	}

	private static StatusCodeHttpResult MethodNotAllowed(HttpResponse response)
	{
		response.Headers.Allow = HttpMethods.Post;

		return TypedResults.StatusCode(StatusCodes.Status405MethodNotAllowed);
	}

	// The endpoint binds no form, so minimal APIs don't validate the antiforgery token for it and paint a 400 over the
	// page; it does so itself. A token that fails, most often from a stale tab, goes back without changing anything.
	private static async Task<Results<RedirectHttpResult, ProblemHttpResult>> PostAsync(HttpContext context,
		IAntiforgery antiforgery, SetPaletteHandler handler)
	{
		bool tokenIsValid = await antiforgery.IsRequestValidAsync(context).ConfigureAwait(false);
		IFormCollection form = context.Request.HasFormContentType
			? await context.Request.ReadFormAsync(context.RequestAborted).ConfigureAwait(false)
			: FormCollection.Empty;
		string returnUrl = LocalReturnUrl.OrRoot(form["returnUrl"]);

		if (!tokenIsValid)
		{
			return TypedResults.LocalRedirect(returnUrl);
		}

		// Only a crafted post can send an unknown value, so it gets a ProblemDetails rather than a friendly page.
		Result<Palette> result = handler.Handle(new SetPaletteCommand(form["palette"]));
		if (result.Failure)
		{
			return TypedResults.Problem(detail: result.Error, statusCode: StatusCodes.Status400BadRequest,
				extensions: new Dictionary<string, object?> { ["code"] = result.Details });
		}

		context.Response.Cookies.Append(ApplicationConstants.PaletteCookie, result.Value.ToCookieValue(),
			PaletteCookieOptions());

		return TypedResults.LocalRedirect(returnUrl);
	}

	// A display preference, so it's essential and needs no consent. Each choice re-issues the cookie, so the year runs
	// from the visitor's last choice.
	private static CookieOptions PaletteCookieOptions()
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
