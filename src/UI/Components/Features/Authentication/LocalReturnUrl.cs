// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     LocalReturnUrl.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using System.Diagnostics.CodeAnalysis;

namespace UI.Components.Features.Authentication;

/// <summary>
///   Resolves a visitor-supplied <c>returnUrl</c> to a path safe to redirect to, so the login endpoint can't be
///   made to redirect somewhere other than this app.
/// </summary>
public static class LocalReturnUrl
{
	/// <summary>
	///   Returns <paramref name="returnUrl" /> unchanged when it is a local path, otherwise <c>"/"</c>.
	/// </summary>
	/// <param name="returnUrl">The visitor-supplied return URL, or <see langword="null" />.</param>
	/// <returns>A path safe to redirect to.</returns>
	[SuppressMessage("Design", "CA1054:Uri parameters should not be strings",
		Justification = "A query-string returnUrl can be any visitor-supplied text, not only a well-formed URI; " +
			"that's exactly what this method must validate.")]
	public static string OrRoot(string? returnUrl)
	{
		return IsLocal(returnUrl) ? returnUrl : "/";
	}

	// Url.IsLocalUrl's rule, minus its "~/" form: nothing expands "~" in the redirect after the Auth0 callback, so
	// the browser would resolve it as a relative path. A second '/' or '\' makes a protocol-relative URL (browsers
	// read '\' as '/'), and a control character could split the Location header.
	private static bool IsLocal([NotNullWhen(true)] string? returnUrl)
	{
		if (string.IsNullOrEmpty(returnUrl) || returnUrl[0] != '/')
		{
			return false;
		}

		if ((returnUrl.Length > 1) && (returnUrl[1] is '/' or '\\'))
		{
			return false;
		}

		return !returnUrl.Any(char.IsControl);
	}
}
