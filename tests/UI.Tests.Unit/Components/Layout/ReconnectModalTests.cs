// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ReconnectModalTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

using UI.Components.Layout;

namespace UI.Tests.Unit.Components.Layout;

public class ReconnectModalTests : BunitContext
{
	private static string ReadReconnectModalCss()
	{
		string path = Path.Combine(FindRepositoryRoot(), "src", "UI", "Components", "Layout", "ReconnectModal.razor.css");

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
	public void Render_Dialog_KeepsIdAndDataNosnippetAttribute()
	{
		// Arrange

		// Act
		IRenderedComponent<ReconnectModal> cut = Render<ReconnectModal>();

		// Assert
		IElement dialog = cut.Find("dialog");
		dialog.Id.Should().Be("components-reconnect-modal");
		dialog.HasAttribute("data-nosnippet").Should().BeTrue();
	}

	[Fact]
	public void Render_Dialog_HasCardSectionClasses()
	{
		// Arrange

		// Act
		IRenderedComponent<ReconnectModal> cut = Render<ReconnectModal>();

		// Assert
		IElement dialog = cut.Find("dialog");
		dialog.ClassList.Should().Contain("rounded-3xl");
		dialog.ClassList.Should().Contain("border");
		dialog.ClassList.Should().Contain("border-slate-200");
		dialog.ClassList.Should().Contain("bg-white/80");
		dialog.ClassList.Should().Contain("p-6");
		dialog.ClassList.Should().Contain("shadow-sm");
		dialog.ClassList.Should().Contain("dark:border-slate-800");
		dialog.ClassList.Should().Contain("dark:bg-slate-900/70");
	}

	[Fact]
	public void Render_Dialog_HasBackdropClass()
	{
		// Arrange

		// Act
		IRenderedComponent<ReconnectModal> cut = Render<ReconnectModal>();

		// Assert
		IElement dialog = cut.Find("dialog");
		dialog.ClassList.Should().Contain("backdrop:bg-slate-950/50");
	}

	[Fact]
	public void Render_RetryButton_IsPlainButtonWithPrimaryClassesIdAndVisibilityClass()
	{
		// Arrange

		// Act
		IRenderedComponent<ReconnectModal> cut = Render<ReconnectModal>();

		// Assert
		IElement button = cut.Find("#components-reconnect-button");
		button.TagName.Should().Be("BUTTON");
		button.TextContent.Trim().Should().Be("Retry");
		button.ClassList.Should().Contain("components-reconnect-failed-visible");
		button.ClassList.Should().Contain("rounded-xl");
		button.ClassList.Should().Contain("bg-accent-600");
		button.ClassList.Should().Contain("px-4");
		button.ClassList.Should().Contain("py-2");
		button.ClassList.Should().Contain("text-sm");
		button.ClassList.Should().Contain("font-semibold");
		button.ClassList.Should().Contain("text-white");
		button.ClassList.Should().Contain("shadow-sm");
		button.ClassList.Should().Contain("hover:bg-accent-700");
		button.ClassList.Should().Contain("focus-visible:outline-2");
		button.ClassList.Should().Contain("focus-visible:outline-offset-2");
		button.ClassList.Should().Contain("focus-visible:outline-accent-500");
		button.ClassList.Should().Contain("motion-safe:transition");
	}

	[Fact]
	public void Render_ResumeButton_IsPlainButtonWithPrimaryClassesIdAndVisibilityClasses()
	{
		// Arrange

		// Act
		IRenderedComponent<ReconnectModal> cut = Render<ReconnectModal>();

		// Assert
		IElement button = cut.Find("#components-resume-button");
		button.TagName.Should().Be("BUTTON");
		button.TextContent.Trim().Should().Be("Resume");
		button.ClassList.Should().Contain("components-pause-visible");
		button.ClassList.Should().Contain("components-resume-failed-visible");
		button.ClassList.Should().Contain("rounded-xl");
		button.ClassList.Should().Contain("bg-accent-600");
		button.ClassList.Should().Contain("px-4");
		button.ClassList.Should().Contain("py-2");
		button.ClassList.Should().Contain("text-sm");
		button.ClassList.Should().Contain("font-semibold");
		button.ClassList.Should().Contain("text-white");
		button.ClassList.Should().Contain("shadow-sm");
		button.ClassList.Should().Contain("hover:bg-accent-700");
		button.ClassList.Should().Contain("focus-visible:outline-2");
		button.ClassList.Should().Contain("focus-visible:outline-offset-2");
		button.ClassList.Should().Contain("focus-visible:outline-accent-500");
		button.ClassList.Should().Contain("motion-safe:transition");
	}

	[Theory]
	[InlineData("components-reconnect-first-attempt-visible", "Rejoining the server...")]
	[InlineData("components-reconnect-failed-visible", "Failed to rejoin.")]
	[InlineData("components-pause-visible", "The session has been paused by the server.")]
	[InlineData("components-resume-failed-visible", "Failed to resume the session.")]
	public void Render_MessageParagraph_KeepsVisibilityClassAndText(string visibleClass, string expectedText)
	{
		// Arrange

		// Act
		IRenderedComponent<ReconnectModal> cut = Render<ReconnectModal>();

		// Assert
		IElement paragraph = cut.Find($"p.{visibleClass}");
		paragraph.TextContent.Should().Contain(expectedText);
	}

	[Fact]
	public void Render_RepeatedAttemptParagraph_KeepsVisibilityClassTextAndSecondsSpan()
	{
		// Arrange

		// Act
		IRenderedComponent<ReconnectModal> cut = Render<ReconnectModal>();

		// Assert
		IElement paragraph = cut.Find("p.components-reconnect-repeated-attempt-visible");
		paragraph.TextContent.Should().Contain("Rejoin failed");
		paragraph.TextContent.Should().Contain("trying again in");
		paragraph.TextContent.Should().Contain("seconds.");
		paragraph.QuerySelector("#components-seconds-to-next-attempt").Should().NotBeNull();
	}

	[Fact]
	public void RazorCss_HoldsNoColourFontSpacingBorderOrShadowDeclaration()
	{
		// Arrange
		string css = ReadReconnectModalCss();

		// Act

		// Assert
		css.Should().NotContain("color:");
		css.Should().NotContain("background-color");
		css.Should().NotContain("background:");
		css.Should().NotContain("border:");
		css.Should().NotContain("border-radius");
		css.Should().NotContain("box-shadow");
		css.Should().NotContain("padding");
		css.Should().NotContain("margin");
		css.Should().NotContain("font-");
	}

	[Fact]
	public void Render_SpinnerRings_OnlyAnimateUnderMotionSafe()
	{
		// Arrange

		// Act
		IRenderedComponent<ReconnectModal> cut = Render<ReconnectModal>();

		// Assert
		IElement spinner = cut.Find(".components-rejoining-animation");
		IReadOnlyList<IElement> rings = [.. spinner.Children];
		rings.Should().NotBeEmpty();

		foreach (IElement ring in rings)
		{
			ring.ClassList.Any(className => className.StartsWith("motion-safe:", StringComparison.Ordinal))
				.Should().BeTrue();
		}
	}

	[Fact]
	public void Render_SpinnerRings_UseAccentBorderColour()
	{
		// Arrange

		// Act
		IRenderedComponent<ReconnectModal> cut = Render<ReconnectModal>();

		// Assert
		IElement spinner = cut.Find(".components-rejoining-animation");
		IReadOnlyList<IElement> rings = [.. spinner.Children];
		rings.Should().NotBeEmpty();

		foreach (IElement ring in rings)
		{
			ring.ClassList.Should().Contain("border-accent-500");
		}
	}
}
