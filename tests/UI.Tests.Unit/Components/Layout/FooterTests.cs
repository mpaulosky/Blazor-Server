// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     FooterTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

using Domain.Constants;

using Microsoft.Extensions.DependencyInjection;

using UI.Components.Layout;

namespace UI.Tests.Unit.Components.Layout;

public class FooterTests : BunitContext
{
	private const string RepositoryUrl = "https://github.com/mpaulosky/Blazor-Server";

	private const string Commit = "5cc1da2cdeecf595f8861398986c1adf86977759";

	[Fact]
	public void Render_ShowsAppName()
	{
		// Arrange
		Services.AddSingleton<TimeProvider>(new FixedTimeProvider(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)));

		// Act
		IRenderedComponent<Footer> cut = Render<Footer>();

		// Assert
		IElement footer = cut.Find("footer");
		footer.TextContent.Should().Contain(ApplicationConstants.AppName);
	}

	[Theory]
	[InlineData(2024)]
	[InlineData(2031)]
	public void Render_ShowsCopyrightWithYearFromInjectedTimeProvider(int year)
	{
		// Arrange
		Services.AddSingleton<TimeProvider>(new FixedTimeProvider(new DateTimeOffset(year, 6, 15, 0, 0, 0, TimeSpan.Zero)));

		// Act
		IRenderedComponent<Footer> cut = Render<Footer>();

		// Assert
		IElement footer = cut.Find("footer");
		footer.TextContent.Should().Contain($"© {year} · Built with .NET, Blazor and Tailwind CSS");
	}

	// Refs #349: the Release item links to the tag page when a tag is known, and to the releases list with the
	// "no release" label when it isn't. Both links must open safely in a new tab.
	[Theory]
	[InlineData("v0.0.152-0-g5cc1da2", "v0.0.152", $"{RepositoryUrl}/releases/tag/v0.0.152")]
	[InlineData("", "no release", $"{RepositoryUrl}/releases")]
	public void Render_ReleaseValue_ShowsReleaseLabelLinkingToExpectedUrl(string release, string expectedText,
		string expectedLink)
	{
		// Arrange
		Services.AddSingleton<TimeProvider>(new FixedTimeProvider(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)));
		Services.AddSingleton(new BuildInfo(release, Commit, RepositoryUrl));

		// Act
		IRenderedComponent<Footer> cut = Render<Footer>();

		// Assert
		IElement link = cut.FindAll("a").Single(a => a.TextContent.Trim() == expectedText);
		link.GetAttribute("href").Should().Be(expectedLink);
		link.GetAttribute("target").Should().Be("_blank");
		link.GetAttribute("rel").Should().Be("noopener noreferrer");
	}

	// Refs #349: the Last Commit item shows the commit's first 7 characters, linking to the full SHA's commit page.
	[Fact]
	public void Render_CommitKnown_ShowsFirstSevenCharactersLinkingToFullSha()
	{
		// Arrange
		Services.AddSingleton<TimeProvider>(new FixedTimeProvider(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)));
		Services.AddSingleton(new BuildInfo("v0.0.152-0-g5cc1da2", Commit, RepositoryUrl));

		// Act
		IRenderedComponent<Footer> cut = Render<Footer>();

		// Assert
		IElement link = cut.FindAll("a").Single(a => a.TextContent.Trim() == Commit[..7]);
		link.GetAttribute("href").Should().Be($"{RepositoryUrl}/commit/{Commit}");
		link.GetAttribute("target").Should().Be("_blank");
		link.GetAttribute("rel").Should().Be("noopener noreferrer");
	}

	// Refs #349: when BuildInfo has no commit (couldn't be determined at build time), the Last Commit item is
	// hidden entirely rather than showing an empty link.
	[Fact]
	public void Render_CommitEmpty_HidesLastCommitItem()
	{
		// Arrange
		Services.AddSingleton<TimeProvider>(new FixedTimeProvider(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)));
		Services.AddSingleton(new BuildInfo("v0.0.152-0-g5cc1da2", string.Empty, RepositoryUrl));

		// Act
		IRenderedComponent<Footer> cut = Render<Footer>();

		// Assert
		cut.FindAll("a").Should().NotContain(a => (a.GetAttribute("href") ?? string.Empty)
			.Contains("/commit/", StringComparison.Ordinal));
		cut.Markup.Should().NotContain("Last Commit");
	}

	// Refs #349: with no repository URL, the Release and commit values still render as plain text, with no <a>
	// anywhere in the footer.
	[Fact]
	public void Render_NoRepositoryUrl_RendersValuesWithNoLinks()
	{
		// Arrange
		Services.AddSingleton<TimeProvider>(new FixedTimeProvider(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)));
		Services.AddSingleton(new BuildInfo("v0.0.152-0-g5cc1da2", Commit, string.Empty));

		// Act
		IRenderedComponent<Footer> cut = Render<Footer>();

		// Assert
		cut.FindAll("a").Should().BeEmpty();
		cut.Markup.Should().Contain("v0.0.152");
		cut.Markup.Should().Contain(Commit[..7]);
	}

	// Refs #349: a non-"https://" repository URL (an SSH remote, for example) must not produce links either.
	[Theory]
	[InlineData("http://github.com/mpaulosky/Blazor-Server")]
	[InlineData("git@github.com:mpaulosky/Blazor-Server.git")]
	public void Render_NonHttpsRepositoryUrl_RendersValuesWithNoLinks(string repositoryUrl)
	{
		// Arrange
		Services.AddSingleton<TimeProvider>(new FixedTimeProvider(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)));
		Services.AddSingleton(new BuildInfo("v0.0.152-0-g5cc1da2", Commit, repositoryUrl));

		// Act
		IRenderedComponent<Footer> cut = Render<Footer>();

		// Assert
		cut.FindAll("a").Should().BeEmpty();
	}

	// Refs #349: a repository URL ending in ".git" or "/" must produce links without that suffix in either the
	// Release link or the commit link.
	[Theory]
	[InlineData($"{RepositoryUrl}.git")]
	[InlineData($"{RepositoryUrl}/")]
	public void Render_RepositoryUrlWithTrailingGitOrSlash_ProducesLinksWithoutThem(string repositoryUrl)
	{
		// Arrange
		Services.AddSingleton<TimeProvider>(new FixedTimeProvider(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)));
		Services.AddSingleton(new BuildInfo("v0.0.152-0-g5cc1da2", Commit, repositoryUrl));

		// Act
		IRenderedComponent<Footer> cut = Render<Footer>();

		// Assert
		IElement releaseLink = cut.FindAll("a").Single(a => a.TextContent.Trim() == "v0.0.152");
		releaseLink.GetAttribute("href").Should().Be($"{RepositoryUrl}/releases/tag/v0.0.152");

		IElement commitLink = cut.FindAll("a").Single(a => a.TextContent.Trim() == Commit[..7]);
		commitLink.GetAttribute("href").Should().Be($"{RepositoryUrl}/commit/{Commit}");
	}

	private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
	{
		public override DateTimeOffset GetUtcNow() => now;
	}
}
