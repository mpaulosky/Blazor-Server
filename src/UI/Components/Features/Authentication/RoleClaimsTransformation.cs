// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     RoleClaimsTransformation.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using System.Diagnostics.CodeAnalysis;
using System.Security.Claims;
using System.Text.Json;

using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace UI.Components.Features.Authentication;

/// <summary>
///   Maps the configured Auth0 role claim onto <see cref="ClaimTypes.Role" />, the one place in the app that does
///   so. A mapped value is either a single role or a JSON array of roles.
/// </summary>
public sealed class RoleClaimsTransformation : IClaimsTransformation
{
	private readonly string _roleClaimType;

	/// <summary>
	///   Initializes a new instance of <see cref="RoleClaimsTransformation" />.
	/// </summary>
	/// <param name="options">The Auth0 options, read for <see cref="Auth0Options.RoleClaimType" />.</param>
	public RoleClaimsTransformation(IOptions<Auth0Options> options)
	{
		ArgumentNullException.ThrowIfNull(options);

		_roleClaimType = options.Value.RoleClaimType;
	}

	/// <inheritdoc />
	public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
	{
		ArgumentNullException.ThrowIfNull(principal);

		if (principal.Identity is not ClaimsIdentity { IsAuthenticated: true })
		{
			return Task.FromResult(principal);
		}

		// AuthenticateAsync can run more than once per request, and each run transforms the principal again, so
		// roles the principal already has are skipped rather than added twice.
		string[] missingRoles =
		[
			.. principal.FindAll(_roleClaimType)
				.SelectMany(claim => ParseRoles(claim.Value))
				.Distinct(StringComparer.Ordinal)
				.Where(role => !principal.HasClaim(ClaimTypes.Role, role)),
		];

		if (missingRoles.Length == 0)
		{
			return Task.FromResult(principal);
		}

		// The caller's principal may be reused, so the roles go on a clone rather than the input. The clone keeps the
		// identities in order, so its primary identity is the authenticated ClaimsIdentity checked above, never null.
		// The SDK leaves that identity's RoleClaimType at ClaimTypes.Role, so these claims are what IsInRole reads.
		ClaimsPrincipal transformed = principal.Clone();
		ClaimsIdentity identity = (ClaimsIdentity)transformed.Identity!;
		identity.AddClaims(missingRoles.Select(role => new Claim(ClaimTypes.Role, role)));

		return Task.FromResult(transformed);
	}

	// Auth0 serializes an array-valued custom claim as one JSON array; the OIDC handler may also split it into one
	// claim per element. Both shapes, and a plain single role, end up as a list of roles.
	private static IEnumerable<string> ParseRoles(string value)
	{
		if (string.IsNullOrWhiteSpace(value))
		{
			return [];
		}

		if (value.StartsWith('[') && TryParseJsonArray(value, out string[]? roles))
		{
			return roles.Where(role => !string.IsNullOrEmpty(role));
		}

		return [value];
	}

	// A value that starts with '[' but isn't a JSON array of strings is taken as the role name itself.
	private static bool TryParseJsonArray(string value, [NotNullWhen(true)] out string[]? roles)
	{
		try
		{
			roles = JsonSerializer.Deserialize<string[]>(value) ?? [];
			return true;
		}
		catch (JsonException)
		{
			roles = null;
			return false;
		}
	}
}
