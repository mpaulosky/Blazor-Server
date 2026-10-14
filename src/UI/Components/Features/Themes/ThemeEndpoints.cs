// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ThemeEndpoints.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

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

		throw new NotImplementedException();
	}
}
