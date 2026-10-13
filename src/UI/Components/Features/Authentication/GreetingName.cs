// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     GreetingName.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using System.Security.Claims;

namespace UI.Components.Features.Authentication;

/// <summary>
///   Picks the name the nav bar greets a User by, from the OIDC profile claims Auth0's ID token carries.
/// </summary>
public static class GreetingName
{
	/// <summary>The OIDC standard <c>name</c> claim type: the User's full name.</summary>
	public const string NameClaimType = "name";

	/// <summary>The Auth0 <c>nickname</c> claim type, used when the User has no name.</summary>
	public const string NicknameClaimType = "nickname";

	/// <summary>The OIDC standard <c>email</c> claim type, used when the User has neither name nor nickname.</summary>
	public const string EmailClaimType = "email";

	// The OIDC handler's inbound claim mapping is on by default and renames the ID token's "email" claim to
	// ClaimTypes.Email, while "name" and "nickname" keep their literal types, so the email is looked up both ways.
	private static readonly string[] ClaimTypesInOrder =
		[NameClaimType, NicknameClaimType, EmailClaimType, ClaimTypes.Email];

	/// <summary>
	///   Returns the first non-empty, non-whitespace value of the <c>name</c>, <c>nickname</c> and <c>email</c>
	///   claims, in that order. The value is returned as given, so the caller must render it as text, not markup.
	/// </summary>
	/// <param name="user">The signed-in principal.</param>
	/// <returns>
	///   The name to greet by, or <see langword="null" /> for a Visitor or a User with none of those claims set.
	/// </returns>
	public static string? For(ClaimsPrincipal user)
	{
		ArgumentNullException.ThrowIfNull(user);

		if (user.Identity is not { IsAuthenticated: true })
		{
			return null;
		}

		return ClaimTypesInOrder
			.SelectMany(claimType => user.FindAll(claimType))
			.Select(claim => claim.Value)
			.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
	}
}
