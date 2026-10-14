// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     CommitLabel.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI
// =============================================

using System.Diagnostics.CodeAnalysis;

namespace UI.Components.Layout;

/// <summary>
///   The short commit SHA and the link it points to, shown in the footer's Last Commit item.
/// </summary>
/// <param name="Text">The commit's first 7 characters, or empty when the build has no commit.</param>
/// <param name="Link">The commit's page in the repository, or empty when there's no https repository URL.</param>
public sealed record CommitLabel(string Text, string Link)
{
	private const int ShortLength = 7;

	/// <summary>
	///   Builds the Last Commit label from a <see cref="BuildInfo.Commit" /> value.
	/// </summary>
	/// <param name="commit">The full commit SHA, or empty when none is available.</param>
	/// <param name="repositoryUrl">The repository's HTTPS URL.</param>
	/// <returns>The short commit and its link.</returns>
	[SuppressMessage("Design", "CA1054:Uri parameters should not be strings",
		Justification = "repositoryUrl is BuildInfo.RepositoryUrl verbatim, which is Source Link's " +
			"PrivateRepositoryUrl MSBuild property and empty outside a git checkout, which System.Uri can't represent.")]
	public static CommitLabel FromCommit(string commit, string repositoryUrl)
	{
		ArgumentNullException.ThrowIfNull(commit);
		ArgumentNullException.ThrowIfNull(repositoryUrl);

		string repository = RepositoryLink.BaseFrom(repositoryUrl);
		string text = commit.Length > ShortLength ? commit[..ShortLength] : commit;
		string link = (repository.Length == 0) || (commit.Length == 0) ? string.Empty : $"{repository}/commit/{commit}";

		return new CommitLabel(text, link);
	}
}
