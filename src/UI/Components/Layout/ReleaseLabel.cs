// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ReleaseLabel.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using System.Diagnostics.CodeAnalysis;
using System.Globalization;

namespace UI.Components.Layout;

/// <summary>
///   The human-readable Release label and the link it points to, shown in the footer.
/// </summary>
/// <param name="Text">The Release label, such as <c>"v0.0.152 +1"</c> or <c>"no release"</c>.</param>
/// <param name="Link">The URL <see cref="Text" /> links to: a Release's tag page, or the releases list when there is no Release.</param>
public sealed record ReleaseLabel(string Text, string Link)
{
	private const string NoRelease = "no release";

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
		ArgumentNullException.ThrowIfNull(describeOutput);
		ArgumentNullException.ThrowIfNull(repositoryUrl);

		// Source Link keeps a remote's ".git" suffix (an SSH remote rewritten to https, or an explicit ".git"
		// origin); trimming only the trailing slash would leave it in the link. An empty repositoryUrl (no git
		// checkout) leaves releases empty too, so the label below renders with no link rather than a same-origin
		// path like "/releases".
		string repository = repositoryUrl.TrimEnd('/');
		repository = repository.EndsWith(".git", StringComparison.Ordinal) ? repository[..^".git".Length] : repository;
		string releases = repository.Length == 0 ? string.Empty : $"{repository}/releases";

		// "--long" always ends in "-<count>-g<sha>", so the tag is whatever comes before the last two hyphens.
		string describe = describeOutput.Trim();
		int shaHyphen = describe.LastIndexOf('-');
		int countHyphen = shaHyphen > 0 ? describe.LastIndexOf('-', shaHyphen - 1) : -1;

		if (countHyphen <= 0
			|| !int.TryParse(describe.AsSpan(countHyphen + 1, shaHyphen - countHyphen - 1), NumberStyles.None,
				CultureInfo.InvariantCulture, out int commitsSinceTag))
		{
			return new ReleaseLabel(NoRelease, releases);
		}

		string tag = describe[..countHyphen];
		string text = commitsSinceTag == 0 ? tag : $"{tag} +{commitsSinceTag.ToString(CultureInfo.InvariantCulture)}";

		return new ReleaseLabel(text, releases.Length == 0 ? string.Empty : $"{releases}/tag/{tag}");
	}
}
