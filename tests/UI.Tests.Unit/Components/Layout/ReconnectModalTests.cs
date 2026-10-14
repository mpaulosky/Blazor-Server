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
	// The Card's Section classes from docs/plans/ui-restyle.md, which go on the <dialog> itself.
	private static readonly string[] CardSectionClasses =
	[
		"rounded-3xl",
		"border",
		"border-slate-200",
		"bg-white/80",
		"p-6",
		"shadow-sm",
		"dark:border-slate-800",
		"dark:bg-slate-900/70",
	];

	// The Button's Primary classes from docs/plans/ui-restyle.md, written inline on Retry and Resume.
	private static readonly string[] PrimaryButtonClasses =
	[
		"rounded-xl",
		"bg-accent-600",
		"px-4",
		"py-2",
		"text-sm",
		"font-semibold",
		"text-white",
		"shadow-sm",
		"hover:bg-accent-700",
		"focus-visible:outline-2",
		"focus-visible:outline-offset-2",
		"focus-visible:outline-accent-500",
		"motion-safe:transition",
	];

	private static string ReadReconnectModalCss()
	{
		return RepositoryFiles.ReadAllText("src", "UI", "Components", "Layout", "ReconnectModal.razor.css");
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
		dialog.ClassList.Should().Contain(CardSectionClasses);
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
		button.ClassList.Should().Contain(PrimaryButtonClasses);
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
		button.ClassList.Should().Contain(PrimaryButtonClasses);
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
