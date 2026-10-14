// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     RepositoryLink.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

namespace UI.Components.Layout;

/// <summary>
///   Turns <see cref="BuildInfo.RepositoryUrl" /> into the base the footer's links are built on.
/// </summary>
internal static class RepositoryLink
{
	/// <summary>
	///   Returns <paramref name="repositoryUrl" /> without a trailing <c>/</c> or <c>.git</c>, or empty when it isn't
	///   an <c>https://</c> URL.
	/// </summary>
	/// <param name="repositoryUrl">The repository URL Source Link recorded at build time.</param>
	/// <returns>The base URL to append <c>/releases</c> or <c>/commit/{sha}</c> to, or empty for no link.</returns>
	public static string BaseFrom(string repositoryUrl)
	{
		// An empty URL (no git checkout) would otherwise give a same-origin path such as "/releases", and an http://
		// or SSH remote isn't a link to send a visitor to.
		if (!repositoryUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
		{
			return string.Empty;
		}

		// Source Link keeps a remote's ".git" suffix (an SSH remote rewritten to https, or an explicit ".git"
		// origin); trimming only the trailing slash would leave it in the link.
		string repository = repositoryUrl.TrimEnd('/');

		return repository.EndsWith(".git", StringComparison.Ordinal) ? repository[..^".git".Length] : repository;
	}
}
