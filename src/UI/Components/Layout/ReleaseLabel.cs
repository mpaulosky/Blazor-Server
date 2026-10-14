// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ReleaseLabel.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using System.Diagnostics.CodeAnalysis;

namespace UI.Components.Layout;

/// <summary>
///   The human-readable Release label and the link it points to, shown in the footer.
/// </summary>
/// <param name="Text">The Release label, such as <c>"v0.0.152 +1"</c> or <c>"no release"</c>.</param>
/// <param name="Link">The URL <see cref="Text" /> links to: a Release's tag page, or the releases list when there is no Release.</param>
public sealed record ReleaseLabel(string Text, string Link)
{
	/// <summary>
	///   Parses a <see cref="BuildInfo.Release" /> value into the Release label and link, parsed from the end so
	///   tags containing hyphens (<c>v1.0.0-rc.1</c>) still work.
	/// </summary>
	/// <param name="describeOutput">
	///   The raw <c>git describe --tags --long --match "v[0-9]*"</c> output, or empty when none is available.
	/// </param>
	/// <param name="repositoryUrl">The repository's HTTPS URL.</param>
	/// <returns>The Release label and link.</returns>
	[SuppressMessage("Design", "CA1054:Uri parameters should not be strings",
		Justification = "repositoryUrl is BuildInfo.RepositoryUrl verbatim, which is Source Link's " +
			"PrivateRepositoryUrl MSBuild property and empty outside a git checkout, which System.Uri can't represent.")]
	public static ReleaseLabel FromDescribe(string describeOutput, string repositoryUrl)
	{
		throw new NotImplementedException();
	}
}
