// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ApplicationConstants.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Domain
// =============================================

namespace Domain.Constants;

/// <summary>
///     Names the Template itself relies on, shared by every project in a Generated App.
/// </summary>
/// <remarks>
///     Keep this list to names the Template needs. A Generated App adds its own when it adds persistence or caching.
///     Split the class by concern if it grows past about a dozen members.
/// </remarks>
public static class ApplicationConstants
{
	/// <summary>
	///     The authorization policy that protects the Admin page.
	/// </summary>
	public const string AdminPolicy = "AdminOnly";

	/// <summary>
	///     The role that makes a User an Admin. Must match the Auth0 role claim.
	/// </summary>
	public const string AdminRole = "Admin";

	/// <summary>
	///     The cookie that holds the visitor's Theme, read during server-side prerender.
	/// </summary>
	public const string ThemeCookie = "theme";

	/// <summary>
	///     The cookie that holds the visitor's Palette.
	/// </summary>
	public const string PaletteCookie = "palette";

	/// <summary>
	///     The Aspire resource name of the UI project, used by the AppHost and the E2E tests.
	/// </summary>
	public const string Website = "WebApp";
}
