// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     CommitLabelTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using UI.Components.Layout;

namespace UI.Tests.Unit.Components.Layout;

public class CommitLabelTests
{
	private const string Commit = "5cc1da2cdeecf595f8861398986c1adf86977759";

	// Refs #349: the Last Commit item shows the first 7 characters of the commit, linking to the full SHA's page,
	// with a trailing ".git" or "/" stripped from the repository URL first.
	[Theory]
	[InlineData("https://github.com/mpaulosky/Blazor-Server")]
	[InlineData("https://github.com/mpaulosky/Blazor-Server.git")]
	[InlineData("https://github.com/mpaulosky/Blazor-Server/")]
	public void FromCommit_HttpsRepositoryUrl_ReturnsShortShaLinkingToFullSha(string repositoryUrl)
	{
		// Arrange

		// Act
		CommitLabel label = CommitLabel.FromCommit(Commit, repositoryUrl);

		// Assert
		label.Text.Should().Be("5cc1da2");
		label.Link.Should().Be($"https://github.com/mpaulosky/Blazor-Server/commit/{Commit}");
	}

	// Refs #349: with no repository URL, or one that isn't https:// (such as an SSH remote), the commit renders as
	// plain text, so the link is empty.
	[Theory]
	[InlineData("")]
	[InlineData("http://github.com/mpaulosky/Blazor-Server")]
	[InlineData("git@github.com:mpaulosky/Blazor-Server.git")]
	public void FromCommit_NoOrNonHttpsRepositoryUrl_ReturnsShortShaWithNoLink(string repositoryUrl)
	{
		// Arrange

		// Act
		CommitLabel label = CommitLabel.FromCommit(Commit, repositoryUrl);

		// Assert
		label.Text.Should().Be("5cc1da2");
		label.Link.Should().BeEmpty();
	}

	// Refs #349: an empty commit (Source Link couldn't determine one) gives an empty label, which the footer hides,
	// and a commit shorter than 7 characters is shown whole rather than throwing.
	[Theory]
	[InlineData("", "", "")]
	[InlineData("abc", "abc", "https://github.com/mpaulosky/Blazor-Server/commit/abc")]
	public void FromCommit_EmptyOrShortCommit_ReturnsCommitAsIs(string commit, string expectedText,
		string expectedLink)
	{
		// Arrange

		// Act
		CommitLabel label = CommitLabel.FromCommit(commit, "https://github.com/mpaulosky/Blazor-Server");

		// Assert
		label.Text.Should().Be(expectedText);
		label.Link.Should().Be(expectedLink);
	}
}
