// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     UiRestyleTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  Architecture.Tests
// =============================================

using System.Globalization;
using System.Text.RegularExpressions;

using Architecture.Tests.Rules;

namespace Architecture.Tests;

public partial class UiRestyleTests
{
	private static readonly string RepositoryRoot = ProjectReferenceRule.FindRepositoryRoot();

	public static TheoryData<string> RazorFiles => new(FindRazorFiles());

	// PaletteMenu.razor keeps slate on its panel, tiles and swatch ring, so each swatch reads true; PaletteMenuTests
	// holds its <summary> to the surface table instead.
	public static TheoryData<string> RazorFilesExceptThePaletteMenu =>
		new(FindRazorFiles().Where(path => !path.EndsWith("/PaletteMenu.razor", StringComparison.Ordinal)));

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
	[MemberData(nameof(RazorFilesExceptThePaletteMenu))]
	public void RazorFile_Markup_DoesNotUseSlateSurfaceClassesExceptThePaletteMenu(string repositoryRelativePath)
	{
		// Arrange
		string markup = ReadMarkup(repositoryRelativePath);

		// Act
		IReadOnlyList<string> matches =
			[.. SlateSurfaceClassPattern().Matches(markup).Select(match => match.Value)];

		// Assert
		matches.Should().BeEmpty(
			$"{repositoryRelativePath} should tint its surfaces, borders, dividers, rings and gradient stops " +
			"with accent-*, not slate-*, so the Palette reaches them (docs/plans/palette-tint.md); " +
			"PaletteMenu.razor is the only exception, for its panel, tiles and swatch ring");
	}

	[Theory]
	[MemberData(nameof(RazorFiles))]
	public void RazorFile_Markup_DoesNotUseSlateTextTooFaintForItsTheme(string repositoryRelativePath)
	{
		// Arrange
		string markup = ReadMarkup(repositoryRelativePath);

		// Act

		IReadOnlyList<string> tooFaint =
		[
			.. SlateTextClassPattern().Matches(markup)
				.Where(match => IsTooFaintForItsTheme(match.Groups["variants"].Value, int.Parse(match.Groups["shade"].Value, CultureInfo.InvariantCulture)))
				.Select(match => match.Value),
		];

		// Assert
		tooFaint.Should().BeEmpty(
			$"{repositoryRelativePath} should keep Light text at slate-600 or darker and Dark text at slate-300 or " +
			"lighter, which keeps WCAG AA on the tinted surfaces for every hue (docs/plans/palette-tint.md)");
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
		// The string literal around each ring, so a ternary nested inside a class attribute is checked on its own.
		List<string> classStringsWithLightOutline = [];
		for (int index = markup.IndexOf(lightOutline, StringComparison.Ordinal);
			index >= 0;
			index = markup.IndexOf(lightOutline, index + lightOutline.Length, StringComparison.Ordinal))
		{
			classStringsWithLightOutline.Add(EnclosingString(markup, index));
		}

		// Assert
		foreach (string classString in classStringsWithLightOutline)
		{
			classString.Should().Contain(darkOutline,
				$"{repositoryRelativePath}: every class string with {lightOutline} needs {darkOutline} beside it, " +
				"so the Dark focus ring keeps WCAG AA for every hue (docs/plans/palette-tint.md)");
		}
	}

	[Theory]
	[MemberData(nameof(RazorFiles))]
	public void RazorFile_ClassStringsWithLightSlateText_AlsoCarryADarkTextClass(string repositoryRelativePath)
	{
		// Arrange
		string markup = ReadMarkup(repositoryRelativePath);

		// Act
		// A bare text-slate-600 also applies in Dark unless the same string overrides it, and on accent-900 it fails AA.
		IReadOnlyList<string> unpairedClassStrings =
		[
			.. SlateTextClassPattern().Matches(markup)
				.Where(match => !match.Groups["variants"].Value.Contains("dark:", StringComparison.Ordinal))
				.Select(match => EnclosingString(markup, match.Index))
				.Where(classString => !DarkTextClassPattern().IsMatch(classString))
				.Distinct(StringComparer.Ordinal),
		];

		// Assert
		unpairedClassStrings.Should().BeEmpty(
			$"{repositoryRelativePath}: every class string with a Light text-slate-* class needs a dark:text-* class " +
			"beside it, or the Light shade shows on the Dark surfaces and fails WCAG AA (docs/plans/palette-tint.md)");
	}

	// The string literal around an index, bounded by the nearest quotes either side.
	private static string EnclosingString(string markup, int index)
	{
		int start = markup.LastIndexOf('"', index) + 1;
		int end = markup.IndexOf('"', index);
		return markup[start..(end < 0 ? markup.Length : end)];
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

	// Light text needs slate-600 or darker on accent-100; Dark text needs slate-300 or lighter on accent-900.
	private static bool IsTooFaintForItsTheme(string variants, int shade) =>
		variants.Contains("dark:", StringComparison.Ordinal) ? shade >= 400 : shade <= 500;

	// Matches bg-/border-/border-<side>-/divide-/ring-/outline-/from-/via-/to-slate-<n>, with or without a chain of
	// variant prefixes (dark:, hover:, even:, backdrop:, group-hover:). The lookbehind keeps it from matching
	// mid-word, such as "ring-offset-slate-900" on the Palette menu's swatch ring. Shadows aren't surfaces:
	// shadow-slate-900/5 stays on purpose.
	[GeneratedRegex(@"(?<![\w-])(?:[a-z-]+:)*(?:bg|border(?:-[trblxyse])?|divide|ring|outline|from|via|to)-slate-\d+")]
	private static partial Regex SlateSurfaceClassPattern();

	[GeneratedRegex(@"(?<![\w-])(?<variants>(?:[a-z-]+:)*)text-slate-(?<shade>\d+)")]
	private static partial Regex SlateTextClassPattern();

	[GeneratedRegex(@"(?<![\w-])dark:(?:[a-z-]+:)*text-")]
	private static partial Regex DarkTextClassPattern();
}
