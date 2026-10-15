// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     PaletteMenuTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

using Domain.Constants;

using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Forms;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

using UI.Components.Features.Palettes;

namespace UI.Tests.Unit.Components.Features.Palettes;

public class PaletteMenuTests : BunitContext
{
	private static readonly string[] HueNames =
	[
		"Red", "Orange", "Amber", "Yellow", "Lime", "Green", "Emerald", "Teal", "Cyan", "Sky", "Blue", "Indigo",
		"Violet", "Purple", "Fuchsia", "Pink", "Rose",
	];

	// Spelled out rather than lowercased from HueNames: CA1308 flags ToLowerInvariant as unsafe for identifiers that
	// might feed a security decision, which these names, used only to build test expectations, never do.
	private static readonly string[] HueValues =
	[
		"red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo",
		"violet", "purple", "fuchsia", "pink", "rose",
	];

	public PaletteMenuTests()
	{
		Services.AddSingleton<AntiforgeryStateProvider>(new FakeAntiforgeryStateProvider());
	}

	[Fact]
	public void Render_Default_RendersSingleFormWithPostMethodDataEnhanceAndBaseRelativeAction()
	{
		// Arrange

		// Act
		IRenderedComponent<PaletteMenu> cut = Render<PaletteMenu>();

		// Assert
		cut.FindAll("form").Should().HaveCount(1);
		IElement form = cut.Find("form");
		form.GetAttribute("method").Should().Be("post");
		form.GetAttribute("action").Should().Be("palette");
		form.HasAttribute("data-enhance").Should().BeTrue();
	}

	[Fact]
	public void Render_Default_IncludesAntiforgeryToken()
	{
		// Arrange

		// Act
		IRenderedComponent<PaletteMenu> cut = Render<PaletteMenu>();

		// Assert
		cut.Find("form input[name='__RequestVerificationToken']").GetAttribute("value")
			.Should().Be("fake-antiforgery-token");
	}

	[Theory]
	[InlineData("counter?page=2", "/counter?page=2")]
	[InlineData("profile", "/profile")]
	public void Render_OnPage_ReturnUrlHiddenFieldHoldsCurrentPathAndQuery(string relativeUri, string expectedReturnUrl)
	{
		// Arrange
		Services.GetRequiredService<NavigationManager>().NavigateTo(relativeUri);

		// Act
		IRenderedComponent<PaletteMenu> cut = Render<PaletteMenu>();

		// Assert
		IElement hidden = cut.Find("form input[name='returnUrl']");
		hidden.GetAttribute("type").Should().Be("hidden");
		hidden.GetAttribute("value").Should().Be(expectedReturnUrl);
	}

	[Fact]
	public void Render_Default_Has17SubmitButtonsNamedPaletteWithHueValuesInEnumOrder()
	{
		// Arrange

		// Act
		IRenderedComponent<PaletteMenu> cut = Render<PaletteMenu>();

		// Assert
		IElement[] buttons = [.. cut.FindAll("form button[type='submit']")];
		buttons.Should().HaveCount(17);
		buttons.Select(button => button.GetAttribute("name")).Should().AllBeEquivalentTo("palette");
		buttons.Select(button => button.GetAttribute("value")).Should().Equal(HueValues);
	}

	[Fact]
	public void Render_Default_ButtonAccessibleNamesAreHueNamesInEnumOrder()
	{
		// Arrange

		// Act
		IRenderedComponent<PaletteMenu> cut = Render<PaletteMenu>();

		// Assert
		IElement[] buttons = [.. cut.FindAll("form button[type='submit']")];
		buttons.Select(button => button.TextContent.Trim()).Should().Equal(HueNames);
	}

	[Fact]
	public void Render_Default_EachButtonHasAriaHiddenSwatchWithHueBackgroundClass()
	{
		// Arrange

		// Act
		IRenderedComponent<PaletteMenu> cut = Render<PaletteMenu>();

		// Assert
		IElement[] buttons = [.. cut.FindAll("form button[type='submit']")];

		foreach ((IElement button, string hueValue) in buttons.Zip(HueValues))
		{
			IElement? swatch = button.QuerySelector("span[aria-hidden='true']");
			swatch.Should().NotBeNull();
			swatch!.ClassList.Should().Contain($"bg-{hueValue}-500");
		}
	}

	[Theory]
	[InlineData(null, "blue")]
	[InlineData("rose", "rose")]
	[InlineData("unknown-value", "blue")]
	public void Render_WithPaletteCookie_MarksMatchingTilePressedAndOthersNot(string? cookieValue,
		string expectedCurrent)
	{
		// Arrange
		DefaultHttpContext httpContext = new();

		if (cookieValue is not null)
		{
			httpContext.Request.Headers.Append("Cookie", $"{ApplicationConstants.PaletteCookie}={cookieValue}");
		}

		// Act
		IRenderedComponent<PaletteMenu> cut =
			Render<PaletteMenu>(parameters => parameters.AddCascadingValue(httpContext));

		// Assert
		Dictionary<string, IElement> buttonsByValue = cut.FindAll("form button[type='submit']")
			.ToDictionary(button => button.GetAttribute("value") ?? string.Empty, button => button);

		IElement currentButton = buttonsByValue[expectedCurrent];
		currentButton.GetAttribute("aria-pressed").Should().Be("true");

		foreach (IElement otherButton in buttonsByValue.Where(pair => pair.Key != expectedCurrent)
			.Select(pair => pair.Value))
		{
			otherButton.GetAttribute("aria-pressed").Should().Be("false");
		}
	}

	[Fact]
	public void Render_NoCookie_BlueTileIsPressed()
	{
		// Arrange

		// Act
		IRenderedComponent<PaletteMenu> cut = Render<PaletteMenu>();

		// Assert
		IElement blueButton = cut.FindAll("form button[type='submit']")
			.Single(button => button.GetAttribute("value") == "blue");
		blueButton.GetAttribute("aria-pressed").Should().Be("true");
	}

	[Theory]
	[InlineData(null, "Blue", "blue")]
	[InlineData("rose", "Rose", "rose")]
	public void Render_Desktop_SummaryLabelledPaletteAndCurrentHueShowsItsSwatch(string? cookieValue,
		string expectedHueName, string expectedHueValue)
	{
		// Arrange
		DefaultHttpContext httpContext = new();

		if (cookieValue is not null)
		{
			httpContext.Request.Headers.Append("Cookie", $"{ApplicationConstants.PaletteCookie}={cookieValue}");
		}

		// Act
		IRenderedComponent<PaletteMenu> cut =
			Render<PaletteMenu>(parameters => parameters.AddCascadingValue(httpContext));

		// Assert
		IElement details = cut.Find("details");
		IElement? summary = details.QuerySelector("summary");
		summary.Should().NotBeNull();
		summary!.GetAttribute("aria-label").Should().Be($"Palette: {expectedHueName}");
		summary.GetAttribute("title").Should().Be($"Palette: {expectedHueName}");

		IElement? swatch = summary.QuerySelector("span[aria-hidden='true']");
		swatch.Should().NotBeNull();
		swatch!.ClassList.Should().Contain($"bg-{expectedHueValue}-500");
	}

	[Fact]
	public void Render_Desktop_PanelKeepsWhiteBackgroundAndDarkSlateBackground()
	{
		// Arrange

		// Act
		IRenderedComponent<PaletteMenu> cut = Render<PaletteMenu>();

		// Assert
		// The panel stays slate so each tile's own-hue swatch reads true (docs/plans/palette-tint.md).
		IElement details = cut.Find("details");
		IElement? panel = details.QuerySelector(":scope > div");
		panel.Should().NotBeNull();
		panel!.ClassList.Should().Contain("bg-white");
		panel.ClassList.Should().Contain("dark:bg-slate-900");
	}

	[Fact]
	public void Render_Mobile_FormSitsOnAWhiteAndDarkSlatePanel()
	{
		// Arrange

		// Act
		IRenderedComponent<PaletteMenu> cut = Render<PaletteMenu>(parameters => parameters.Add(p => p.Mobile, true));

		// Assert
		// The mobile menu around it is tinted, so the form keeps a slate surface of its own (docs/plans/palette-tint.md).
		IElement? panel = cut.Find("section").QuerySelector(":scope > div");
		panel.Should().NotBeNull();
		panel!.QuerySelector("form").Should().NotBeNull();
		panel.ClassList.Should().Contain("bg-white");
		panel.ClassList.Should().Contain("dark:bg-slate-900");
	}

	[Fact]
	public void Render_Desktop_SummaryUsesAccentBorderAndNoSlateBackgroundOrBorderClass()
	{
		// Arrange

		// Act
		IRenderedComponent<PaletteMenu> cut = Render<PaletteMenu>();

		// Assert
		// The <summary> is nav chrome, so it follows the surface table unlike the panel it discloses.
		IElement details = cut.Find("details");
		IElement? summary = details.QuerySelector("summary");
		summary.Should().NotBeNull();
		summary!.ClassList.Should().Contain("border-accent-200");
		summary.ClassList.Should().Contain("dark:border-accent-700");
		summary.ClassList.Should()
			.NotContain(className => className.Contains("slate-", StringComparison.Ordinal));
	}

	[Fact]
	public void Render_Desktop_WrapsFormInDetails()
	{
		// Arrange

		// Act
		IRenderedComponent<PaletteMenu> cut = Render<PaletteMenu>();

		// Assert
		cut.FindAll("details").Should().HaveCount(1);
	}

	[Fact]
	public void Render_Mobile_NoDetailsAndHeadingReadsPalette()
	{
		// Arrange

		// Act
		IRenderedComponent<PaletteMenu> cut = Render<PaletteMenu>(parameters => parameters.Add(p => p.Mobile, true));

		// Assert
		cut.FindAll("details").Should().BeEmpty();
		IElement heading = cut.Find("h2");
		heading.TextContent.Trim().Should().Be("Palette");
	}

	private sealed class FakeAntiforgeryStateProvider : AntiforgeryStateProvider
	{
		public override AntiforgeryRequestToken? GetAntiforgeryToken() =>
			new("fake-antiforgery-token", "__RequestVerificationToken");
	}
}
