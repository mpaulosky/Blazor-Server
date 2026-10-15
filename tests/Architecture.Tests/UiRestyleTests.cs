// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     UiRestyleTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using System.Text.RegularExpressions;

using Architecture.Tests.Rules;

namespace Architecture.Tests;

public partial class UiRestyleTests
{
	private static readonly string RepositoryRoot = ProjectReferenceRule.FindRepositoryRoot();

	public static TheoryData<string> RazorFiles
	{
		get
		{
			TheoryData<string> data = new();

			foreach (string path in FindRazorFiles())
			{
				data.Add(path);
			}

			return data;
		}
	}

	[Theory]
	[MemberData(nameof(RazorFiles))]
	public void RazorFile_Markup_DoesNotUseGrayOrBlueUtilityClasses(string repositoryRelativePath)
	{
		// Arrange
		string markup = ReadMarkup(repositoryRelativePath);

		// Act

		// Assert
		markup.Should()
			.NotContain("gray-", $"{repositoryRelativePath} should use the slate surfaces, not a raw gray-* class");
		markup.Should()
			.NotContain("blue-", $"{repositoryRelativePath} should use accent-*, not a raw blue-* class");
	}

	[Theory]
	[MemberData(nameof(RazorFiles))]
	public void RazorFile_Markup_DoesNotUseSlateSurfaceClassesExceptThePaletteMenu(string repositoryRelativePath)
	{
		// Arrange
		string markup = ReadMarkup(repositoryRelativePath);
		bool isPaletteMenu = string.Equals(Path.GetFileName(repositoryRelativePath), "PaletteMenu.razor",
			StringComparison.Ordinal);

		// Act
		IReadOnlyList<string> matches =
			[.. SlateSurfaceClassPattern().Matches(markup).Select(match => match.Value)];

		// Assert
		if (!isPaletteMenu)
		{
			matches.Should().BeEmpty(
				$"{repositoryRelativePath} should tint its surfaces, borders, dividers, rings and gradient stops " +
				"with accent-*, not slate-*, so the Palette reaches them (docs/plans/palette-tint.md); " +
				"PaletteMenu.razor is the only exception, for its panel, tiles and swatch ring");
		}
	}

	[Theory]
	[MemberData(nameof(RazorFiles))]
	public void RazorFile_Markup_DoesNotUseTheDroppedSecondaryTextShades(string repositoryRelativePath)
	{
		// Arrange
		string markup = ReadMarkup(repositoryRelativePath);

		// Act

		// Assert
		markup.Should().NotContain("text-slate-500",
			$"{repositoryRelativePath} should use text-slate-600 for Light secondary text, which keeps WCAG AA on " +
			"the tinted surfaces for every hue (docs/plans/palette-tint.md)");
		markup.Should().NotContain("dark:text-slate-400",
			$"{repositoryRelativePath} should use dark:text-slate-300 for Dark secondary text, which keeps WCAG AA " +
			"on the tinted surfaces for every hue (docs/plans/palette-tint.md)");
	}

	[Theory]
	[MemberData(nameof(RazorFiles))]
	public void RazorFile_ClassStringsWithTheAccentFocusRing_AlsoCarryItsDarkCounterpart(string repositoryRelativePath)
	{
		// Arrange
		string markup = ReadMarkup(repositoryRelativePath);
		const string lightOutline = "focus-visible:outline-accent-500";
		const string darkOutline = "dark:focus-visible:outline-accent-300";

		// Act
		IReadOnlyList<string> classStringsWithLightOutline =
		[
			.. QuotedStringPattern().Matches(markup)
				.Select(match => match.Value)
				.Where(value => value.Contains(lightOutline, StringComparison.Ordinal)),
		];

		// Assert
		foreach (string classString in classStringsWithLightOutline)
		{
			classString.Should().Contain(darkOutline,
				$"{repositoryRelativePath}: every class string with {lightOutline} needs {darkOutline} beside it, " +
				"so the Dark focus ring keeps WCAG AA for every hue (docs/plans/palette-tint.md)");
		}
	}

	private static string ReadMarkup(string repositoryRelativePath) =>
		File.ReadAllText(Path.Combine(RepositoryRoot, repositoryRelativePath));

	private static IEnumerable<string> FindRazorFiles()
	{
		string uiDirectory = Path.Combine(RepositoryRoot, "src", "UI");

		return Directory.EnumerateFiles(uiDirectory, "*.razor", SearchOption.AllDirectories)
			.Select(path => Path.GetRelativePath(RepositoryRoot, path).Replace('\\', '/'))
			.OrderBy(path => path, StringComparer.Ordinal);
	}

	// Matches bg-/border-/divide-/ring-/from-/via-/to-slate-<n>, with or without one or more colon-separated variant
	// prefixes (dark:, hover:, even:, backdrop:, or a chain such as dark:hover:). The lookbehind keeps it from
	// matching mid-word, such as the unrelated "ring-offset-slate-900" the Palette menu's current swatch ring uses.
	[GeneratedRegex(@"(?<![\w-])(?:[a-z]+:)*(?:bg|border|divide|ring|from|via|to)-slate-\d+")]
	private static partial Regex SlateSurfaceClassPattern();

	[GeneratedRegex("\"[^\"]*\"")]
	private static partial Regex QuotedStringPattern();
}
