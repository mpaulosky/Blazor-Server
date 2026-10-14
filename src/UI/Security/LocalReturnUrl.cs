// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     LocalReturnUrl.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using System.Diagnostics.CodeAnalysis;

namespace UI.Security;

/// <summary>
///   Resolves a visitor-supplied <c>returnUrl</c> to a path safe to redirect to, so an endpoint can't be made to
///   redirect somewhere other than this app.
/// </summary>
public static class LocalReturnUrl
{
	/// <summary>
	///   Returns <paramref name="returnUrl" />, percent-encoded where it isn't plain ASCII, when it is a local path,
	///   otherwise <c>"/"</c>.
	/// </summary>
	/// <param name="returnUrl">The visitor-supplied return URL, or <see langword="null" />.</param>
	/// <returns>A path safe to redirect to.</returns>
	[SuppressMessage("Design", "CA1054:Uri parameters should not be strings",
		Justification = "A query-string returnUrl can be any visitor-supplied text, not only a well-formed URI; " +
			"that's exactly what this method must validate.")]
	public static string OrRoot(string? returnUrl)
	{
		throw new NotImplementedException();
	}
}
