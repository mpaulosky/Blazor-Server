// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ReleaseLabelTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using UI.Components.Layout;

namespace UI.Tests.Unit.Components.Layout;

public class ReleaseLabelTests
{
	private const string RepositoryUrl = "https://github.com/mpaulosky/Blazor-Server";

	// Refs #348: covers every row of the issue's Release label table, including a hyphenated tag
	// (v1.0.0-rc.1, parsed from the end so the tag's own hyphens aren't mistaken for the "-<count>-g<sha>" suffix)
	// and the empty "no release" case.
	[Theory]
	[InlineData("v0.0.152-0-g5cc1da2", "v0.0.152", "https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.152")]
	[InlineData("v0.0.152-1-g5cc1da2", "v0.0.152 +1",
		"https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.152")]
	[InlineData("v1.0.0-rc.1-3-gabc1234", "v1.0.0-rc.1 +3",
		"https://github.com/mpaulosky/Blazor-Server/releases/tag/v1.0.0-rc.1")]
	[InlineData("", "no release", "https://github.com/mpaulosky/Blazor-Server/releases")]
	public void FromDescribe_DescribeOutput_ReturnsExpectedLabelAndLink(string describeOutput, string expectedText,
		string expectedLink)
	{
		// Arrange

		// Act
		ReleaseLabel label = ReleaseLabel.FromDescribe(describeOutput, RepositoryUrl);

		// Assert
		label.Text.Should().Be(expectedText);
		label.Link.Should().Be(expectedLink);
	}

	// Refs #350: an empty RepositoryUrl (no git checkout) must not produce a same-origin link such as "/releases",
	// and a remote ending in ".git" (an SSH remote Source Link rewrote to https, or an explicit ".git" origin)
	// must not leave the suffix in the link.
	[Theory]
	[InlineData("v0.0.152-0-g5cc1da2", "", "v0.0.152", "")]
	[InlineData("", "", "no release", "")]
	[InlineData("v0.0.152-0-g5cc1da2", "https://github.com/mpaulosky/Blazor-Server.git", "v0.0.152",
		"https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.152")]
	[InlineData("", "https://github.com/mpaulosky/Blazor-Server.git", "no release",
		"https://github.com/mpaulosky/Blazor-Server/releases")]
	public void FromDescribe_EmptyOrGitSuffixedRepositoryUrl_ReturnsExpectedLink(string describeOutput,
		string repositoryUrl, string expectedText, string expectedLink)
	{
		// Arrange

		// Act
		ReleaseLabel label = ReleaseLabel.FromDescribe(describeOutput, repositoryUrl);

		// Assert
		label.Text.Should().Be(expectedText);
		label.Link.Should().Be(expectedLink);
	}
}
