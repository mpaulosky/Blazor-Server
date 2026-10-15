// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AppTailwindCssTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using System.Text.RegularExpressions;

namespace UI.Tests.Unit.Styles;

public partial class AppTailwindCssTests
{
	private static readonly string[] HuesWithAccent500AtStop600 = ["orange", "emerald", "teal", "cyan", "sky"];

	private static readonly string[] HuesWithAccent500AtStop700 = ["amber", "yellow", "lime", "green"];

	private static readonly int[] AccentStops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

	[GeneratedRegex(":root\\[data-palette=\"(?<hue>[a-z]+)\"\\]\\s*\\{(?<body>[^}]*)\\}")]
	private static partial Regex DataPaletteRulePattern();

	// The bare :root rule (not :root[data-palette=…]), whose body may hold one nested block such as @variant dark.
	[GeneratedRegex(@":root\s*\{(?<body>(?:[^{}]|\{[^{}]*\})*)\}")]
	private static partial Regex RootRulePattern();

	[GeneratedRegex(@"@variant dark\s*\{[^}]*scrollbar-color: var\(--color-accent-400\) var\(--color-accent-950\);[^}]*\}")]
	private static partial Regex DarkScrollbarColorBlockPattern();

	private static string ReadAppTailwindCss()
	{
		return RepositoryFiles.ReadAllText("src", "UI", "Styles", "app.tailwind.css");
	}

	// Red, indigo, violet, purple, fuchsia, pink and rose map every stop 1:1. The bright hues from the spec's table
	// shift only accent-500, accent-600 and accent-700, so white button text and the light-mode focus ring keep AA.
	private static int ExpectedSourceStop(string hue, int destStop)
	{
		if (HuesWithAccent500AtStop600.Contains(hue))
		{
			return destStop switch
			{
				500 => 600,
				600 => 700,
				700 => 800,
				_ => destStop,
			};
		}

		if (HuesWithAccent500AtStop700.Contains(hue))
		{
			return destStop switch
			{
				500 => 700,
				600 => 700,
				700 => 800,
				_ => destStop,
			};
		}

		return destStop;
	}

	private static string ExtractDataPaletteRuleBody(string css, string hue)
	{
		foreach (Match match in DataPaletteRulePattern().Matches(css))
		{
			if (string.Equals(match.Groups["hue"].Value, hue, StringComparison.Ordinal))
			{
				return match.Groups["body"].Value;
			}
		}

		return string.Empty;
	}

	[Fact]
	public void AppTailwindCss_ContainsAccentThemeBlockMappedToBlue()
	{
		// Arrange
		string css = ReadAppTailwindCss();

		// Act

		// Assert
		css.Should().Contain("--color-accent-50: var(--color-blue-50);");
		css.Should().Contain("--color-accent-100: var(--color-blue-100);");
		css.Should().Contain("--color-accent-200: var(--color-blue-200);");
		css.Should().Contain("--color-accent-300: var(--color-blue-300);");
		css.Should().Contain("--color-accent-400: var(--color-blue-400);");
		css.Should().Contain("--color-accent-500: var(--color-blue-500);");
		css.Should().Contain("--color-accent-600: var(--color-blue-600);");
		css.Should().Contain("--color-accent-700: var(--color-blue-700);");
		css.Should().Contain("--color-accent-800: var(--color-blue-800);");
		css.Should().Contain("--color-accent-900: var(--color-blue-900);");
		css.Should().Contain("--color-accent-950: var(--color-blue-950);");
	}

	[Fact]
	public void AppTailwindCss_ContainsCustomDarkVariantForDataThemeAndPrefersColorScheme()
	{
		// Arrange
		string css = ReadAppTailwindCss();

		// Act

		// Assert
		css.Should().Contain("@custom-variant dark");
		css.Should().Contain("[data-theme=dark]");
		css.Should().Contain("@media (prefers-color-scheme: dark)");
		css.Should().Contain(":not([data-theme=light], [data-theme=light] *)");
	}

	[Fact]
	public void AppTailwindCss_KeepsExistingH1FocusRule()
	{
		// Arrange
		string css = ReadAppTailwindCss();

		// Act

		// Assert
		css.Should().Contain("h1:focus");
	}

	[Theory]
	[InlineData("red")]
	[InlineData("orange")]
	[InlineData("amber")]
	[InlineData("yellow")]
	[InlineData("lime")]
	[InlineData("green")]
	[InlineData("emerald")]
	[InlineData("teal")]
	[InlineData("cyan")]
	[InlineData("sky")]
	[InlineData("indigo")]
	[InlineData("violet")]
	[InlineData("purple")]
	[InlineData("fuchsia")]
	[InlineData("pink")]
	[InlineData("rose")]
	public void AppTailwindCss_EachHueExceptBlue_HasDataPaletteRuleSettingAllElevenAccentStops(string hue)
	{
		// Arrange
		string css = ReadAppTailwindCss();
		string ruleBody = ExtractDataPaletteRuleBody(css, hue);

		// Act

		// Assert
		ruleBody.Should().NotBeEmpty($"app.tailwind.css should have a :root[data-palette=\"{hue}\"] rule");

		foreach (int stop in AccentStops)
		{
			int sourceStop = ExpectedSourceStop(hue, stop);
			ruleBody.Should().Contain($"--color-accent-{stop}: var(--color-{hue}-{sourceStop});");
		}
	}

	[Fact]
	public void AppTailwindCss_Blue_HasNoDataPaletteRule()
	{
		// Arrange
		string css = ReadAppTailwindCss();

		// Act

		// Assert
		css.Should().NotContain("data-palette=\"blue\"");
	}

	[Fact]
	public void AppTailwindCss_ContainsRootAccentColorAndLightScrollbarColor()
	{
		// Arrange
		string css = ReadAppTailwindCss();

		// Act
		Match rootRule = RootRulePattern().Match(css);

		// Assert
		rootRule.Success.Should().BeTrue("app.tailwind.css should have a bare :root rule for the browser chrome");
		string body = rootRule.Groups["body"].Value;
		body.Should().Contain("accent-color: var(--color-accent-600);");
		body.Should().Contain("scrollbar-color: var(--color-accent-500) var(--color-accent-100);");
	}

	[Fact]
	public void AppTailwindCss_ContainsDarkScrollbarColorUnderDarkVariant()
	{
		// Arrange
		string css = ReadAppTailwindCss();

		// Act
		string rootRuleBody = RootRulePattern().Match(css).Groups["body"].Value;

		// Assert
		rootRuleBody.Should().MatchRegex(DarkScrollbarColorBlockPattern(),
			"the Dark scrollbar-color should sit in an @variant dark block inside the :root rule");
	}

	[Fact]
	public void AppTailwindCss_RootAccentColorRule_AppearsAfterThePaletteRules()
	{
		// Arrange
		string css = ReadAppTailwindCss();
		int lastPaletteRuleIndex = css.IndexOf("data-palette=\"rose\"", StringComparison.Ordinal);
		int accentColorIndex = css.IndexOf("accent-color: var(--color-accent-600);", StringComparison.Ordinal);

		// Act

		// Assert
		lastPaletteRuleIndex.Should().BeGreaterThan(-1);
		accentColorIndex.Should().BeGreaterThan(lastPaletteRuleIndex);
	}
}
