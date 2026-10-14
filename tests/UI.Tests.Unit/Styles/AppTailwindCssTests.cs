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
	private static readonly string[] s_shiftedTo600_700_800 = ["orange", "emerald", "teal", "cyan", "sky"];

	private static readonly string[] s_shiftedTo700_700_800 = ["amber", "yellow", "lime", "green"];

	private static readonly int[] s_accentStops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

	[GeneratedRegex(":root\\[data-palette=\"(?<hue>[a-z]+)\"\\]\\s*\\{(?<body>[^}]*)\\}")]
	private static partial Regex DataPaletteRulePattern();

	private static string ReadAppTailwindCss()
	{
		return RepositoryFiles.ReadAllText("src", "UI", "Styles", "app.tailwind.css");
	}

	// Red, indigo, violet, purple, fuchsia, pink and rose map every stop 1:1. The bright hues from the spec's table
	// shift only accent-500, accent-600 and accent-700, so white button text and the light-mode focus ring keep AA.
	private static int ExpectedSourceStop(string hue, int destStop)
	{
		if (s_shiftedTo600_700_800.Contains(hue))
		{
			return destStop switch
			{
				500 => 600,
				600 => 700,
				700 => 800,
				_ => destStop,
			};
		}

		if (s_shiftedTo700_700_800.Contains(hue))
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

		foreach (int stop in s_accentStops)
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
}
