// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     PaletteEndpoints.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.HttpResults;

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
		throw new NotImplementedException();
	}

	private static Task<Results<RedirectHttpResult, ProblemHttpResult>> PostAsync(HttpContext context,
		IAntiforgery antiforgery, SetPaletteHandler handler)
	{
		throw new NotImplementedException();
	}
}
