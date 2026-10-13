// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AuthenticationEndpoints.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

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
}
