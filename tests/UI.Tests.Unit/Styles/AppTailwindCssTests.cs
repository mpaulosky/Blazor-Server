// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     AppTailwindCssTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

namespace UI.Tests.Unit.Styles;

public class AppTailwindCssTests
{
	private static string ReadAppTailwindCss()
	{
		string path = Path.Combine(FindRepositoryRoot(), "src", "UI", "Styles", "app.tailwind.css");

		return File.ReadAllText(path);
	}

	private static string FindRepositoryRoot()
	{
		DirectoryInfo? directory = new(AppContext.BaseDirectory);

		while ((directory is not null) && !File.Exists(Path.Combine(directory.FullName, "Directory.Packages.props")))
		{
			directory = directory.Parent;
		}

		return directory?.FullName
			?? throw new InvalidOperationException(
				$"Could not find the repository root (Directory.Packages.props) above '{AppContext.BaseDirectory}'.");
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
}
