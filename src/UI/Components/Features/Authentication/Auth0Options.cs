// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     Auth0Options.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using System.ComponentModel.DataAnnotations;

namespace UI.Components.Features.Authentication;

/// <summary>
///   Settings bound from the <c>Auth0</c> configuration section, validated on startup.
/// </summary>
public sealed class Auth0Options
{
	/// <summary>
	///   The configuration section these options bind from.
	/// </summary>
	public const string SectionName = "Auth0";

	/// <summary>
	///   The claim type Auth0's Post-Login Action adds roles under when <see cref="RoleClaimType" /> isn't set.
	/// </summary>
	public const string DefaultRoleClaimType = "https://blazor-server-template/roles";

	/// <summary>
	///   The Auth0 tenant's domain, as a host only (for example <c>my-tenant.us.auth0.com</c>), with no scheme.
	/// </summary>
	[Required(ErrorMessage = "Auth0:Domain is required. Set it in user secrets or the Auth0__Domain environment variable.")]
	[RegularExpression(@"^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$",
		ErrorMessage = "Auth0:Domain must be the tenant's host only, such as my-tenant.us.auth0.com, with no scheme, port or path.")]
	public string Domain { get; set; } = string.Empty;

	/// <summary>
	///   The Auth0 application's client ID.
	/// </summary>
	[Required(ErrorMessage = "Auth0:ClientId is required. Set it in user secrets or the Auth0__ClientId environment variable.")]
	public string ClientId { get; set; } = string.Empty;

	/// <summary>
	///   The Auth0 application's client secret.
	/// </summary>
	[Required(ErrorMessage = "Auth0:ClientSecret is required. Set it in user secrets or the Auth0__ClientSecret environment variable.")]
	public string ClientSecret { get; set; } = string.Empty;

	/// <summary>
	///   The claim type Auth0 uses for roles. Defaults to <see cref="DefaultRoleClaimType" />.
	/// </summary>
	[Required(ErrorMessage = "Auth0:RoleClaimType is required. Set it in user secrets or the Auth0__RoleClaimType environment variable.")]
	public string RoleClaimType { get; set; } = DefaultRoleClaimType;
}
