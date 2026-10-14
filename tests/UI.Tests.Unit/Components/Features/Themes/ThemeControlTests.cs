// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ThemeControlTests.cs
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

using UI.Components.Features.Themes;

namespace UI.Tests.Unit.Components.Features.Themes;

public class ThemeControlTests : BunitContext
{
	public ThemeControlTests()
	{
		Services.AddSingleton<AntiforgeryStateProvider>(new FakeAntiforgeryStateProvider());
	}

	[Fact]
	public void Render_Default_RendersSingleFormWithPostMethodDataEnhanceAndBaseRelativeAction()
	{
		// Arrange

		// Act
		IRenderedComponent<ThemeControl> cut = Render<ThemeControl>();

		// Assert
		cut.FindAll("form").Should().HaveCount(1);
		IElement form = cut.Find("form");
		form.GetAttribute("method").Should().Be("post");
		form.GetAttribute("action").Should().Be("theme");
		form.HasAttribute("data-enhance").Should().BeTrue();
	}

	[Fact]
	public void Render_Default_IncludesAntiforgeryToken()
	{
		// Arrange

		// Act
		IRenderedComponent<ThemeControl> cut = Render<ThemeControl>();

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
		IRenderedComponent<ThemeControl> cut = Render<ThemeControl>();

		// Assert
		IElement hidden = cut.Find("form input[name='returnUrl']");
		hidden.GetAttribute("type").Should().Be("hidden");
		hidden.GetAttribute("value").Should().Be(expectedReturnUrl);
	}

	[Fact]
	public void Render_Default_FormHasGroupRoleAndThemeAriaLabel()
	{
		// Arrange

		// Act
		IRenderedComponent<ThemeControl> cut = Render<ThemeControl>();

		// Assert
		IElement form = cut.Find("form");
		form.GetAttribute("role").Should().Be("group");
		form.GetAttribute("aria-label").Should().Be("Theme");
	}

	[Fact]
	public void Render_Default_HasThreeSubmitButtonsNamedThemeWithValuesLightDarkSystemInOrder()
	{
		// Arrange

		// Act
		IRenderedComponent<ThemeControl> cut = Render<ThemeControl>();

		// Assert
		IElement[] buttons = [.. cut.FindAll("form button[type='submit']")];
		buttons.Should().HaveCount(3);
		buttons.Select(button => button.GetAttribute("name")).Should().AllBeEquivalentTo("theme");
		buttons.Select(button => button.GetAttribute("value")).Should().Equal("light", "dark", "system");
	}

	[Fact]
	public void Render_Default_ButtonAccessibleNamesAreLightDarkSystemInOrder()
	{
		// Arrange

		// Act
		IRenderedComponent<ThemeControl> cut = Render<ThemeControl>();

		// Assert
		IElement[] buttons = [.. cut.FindAll("form button[type='submit']")];
		buttons.Select(button => button.TextContent.Trim()).Should().Equal("Light", "Dark", "System");
	}

	[Theory]
	[InlineData(null, "system")]
	[InlineData("light", "light")]
	[InlineData("dark", "dark")]
	[InlineData("unknown-value", "system")]
	public void Render_WithThemeCookie_MarksMatchingButtonPressedAndAccentedAndOthersNot(string? cookieValue,
		string expectedCurrent)
	{
		// Arrange
		DefaultHttpContext httpContext = new();

		if (cookieValue is not null)
		{
			httpContext.Request.Headers.Append("Cookie", $"{ApplicationConstants.ThemeCookie}={cookieValue}");
		}

		// Act
		IRenderedComponent<ThemeControl> cut =
			Render<ThemeControl>(parameters => parameters.AddCascadingValue(httpContext));

		// Assert
		Dictionary<string, IElement> buttonsByValue = cut.FindAll("form button[type='submit']")
			.ToDictionary(button => button.GetAttribute("value") ?? string.Empty, button => button);

		IElement currentButton = buttonsByValue[expectedCurrent];
		currentButton.GetAttribute("aria-pressed").Should().Be("true");
		currentButton.ClassList.Should().Contain("bg-accent-600");

		foreach (IElement otherButton in buttonsByValue.Where(pair => pair.Key != expectedCurrent)
			.Select(pair => pair.Value))
		{
			otherButton.GetAttribute("aria-pressed").Should().Be("false");
			otherButton.ClassList.Should().NotContain("bg-accent-600");
		}
	}

	[Fact]
	public void Render_Desktop_ButtonNamesAreSrOnly()
	{
		// Arrange

		// Act
		IRenderedComponent<ThemeControl> cut = Render<ThemeControl>();

		// Assert
		IElement[] nameSpans = [.. cut.FindAll("form button span")];
		nameSpans.Should().HaveCount(3);

		foreach (IElement nameSpan in nameSpans)
		{
			nameSpan.ClassList.Should().Contain("sr-only");
		}
	}

	[Fact]
	public void Render_Mobile_ButtonNamesAreVisibleAndFormIsGridColumns3()
	{
		// Arrange

		// Act
		IRenderedComponent<ThemeControl> cut = Render<ThemeControl>(parameters => parameters.Add(p => p.Mobile, true));

		// Assert
		IElement form = cut.Find("form");
		form.ClassList.Should().Contain(["grid", "grid-cols-3"]);

		IElement[] nameSpans = [.. cut.FindAll("form button span")];
		nameSpans.Should().HaveCount(3);

		foreach (IElement nameSpan in nameSpans)
		{
			nameSpan.ClassList.Should().NotContain("sr-only");
		}
	}

	private sealed class FakeAntiforgeryStateProvider : AntiforgeryStateProvider
	{
		public override AntiforgeryRequestToken? GetAntiforgeryToken() =>
			new("fake-antiforgery-token", "__RequestVerificationToken");
	}
}
