// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     RoleClaimsTransformation.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using System.Security.Claims;

using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace UI.Components.Features.Authentication;

/// <summary>
///   Maps the configured Auth0 role claim onto <see cref="ClaimTypes.Role" />, the one place in the app that does
///   so. A mapped value is either a single role or a JSON array of roles.
/// </summary>
public sealed class RoleClaimsTransformation : IClaimsTransformation
{
	/// <summary>
	///   Initializes a new instance of <see cref="RoleClaimsTransformation" />.
	/// </summary>
	/// <param name="options">The Auth0 options, read for <see cref="Auth0Options.RoleClaimType" />.</param>
	public RoleClaimsTransformation(IOptions<Auth0Options> options)
	{
		ArgumentNullException.ThrowIfNull(options);
	}

	/// <inheritdoc />
	public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
	{
		throw new NotImplementedException();
	}
}
