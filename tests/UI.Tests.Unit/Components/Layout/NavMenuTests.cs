// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     NavMenuTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

using Domain.Constants;

using UI.Components.Features.Themes;
using UI.Components.Layout;

namespace UI.Tests.Unit.Components.Layout;

public class NavMenuTests : BunitContext
{
	[Fact]
	public void Render_BrandLink_IsBaseRelativeAndShowsAriaHiddenLetterTileBeforeAppName()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		IElement letterTile = cut.Find("span[aria-hidden='true']");
		letterTile.TextContent.Trim().Should().Be(ApplicationConstants.AppName[..1]);

		IElement brand = letterTile.ParentElement.Should().BeAssignableTo<IElement>().Subject;
		brand.TagName.Should().Be("A");
		brand.GetAttribute("href").Should().BeEmpty();

		INode[] content =
			[.. brand.ChildNodes.Where(node => node is IElement || !string.IsNullOrWhiteSpace(node.TextContent))];
		content.Should().HaveCount(2);

		// cut.Find returns bUnit's wrapper around the tile while ChildNodes holds the raw node, so the two never compare
		// equal; the first child is checked by the tile's own attribute and text instead.
		content[0].Should().BeAssignableTo<IElement>()
			.Which.GetAttribute("aria-hidden").Should().Be("true");
		content[0].TextContent.Trim().Should().Be(ApplicationConstants.AppName[..1]);
		content[1].TextContent.Trim().Should().Be(ApplicationConstants.AppName);
	}

	[Theory]
	[InlineData("nav")]
	[InlineData("details")]
	public void Render_Visitor_MenuListsOnlyHomeBaseRelative(string menuSelector)
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		IElement menu = cut.Find(menuSelector);
		AssertLink(menu, "Home", "");
		AssertLinkAbsent(menu, "Profile");
		AssertLinkAbsent(menu, "Admin");
	}

	[Theory]
	[InlineData("nav")]
	[InlineData("details")]
	public void Render_User_MenuAddsProfileBaseRelativeButNotAdmin(string menuSelector)
	{
		// Arrange
		AddAuthorization().SetAuthorized("test-user");

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		IElement menu = cut.Find(menuSelector);
		AssertLink(menu, "Home", "");
		AssertLink(menu, "Profile", "profile");
		AssertLinkAbsent(menu, "Admin");
	}

	[Theory]
	[InlineData("nav")]
	[InlineData("details")]
	public void Render_Admin_MenuAddsAdminBaseRelative(string menuSelector)
	{
		// Arrange
		AddAuthorization().SetAuthorized("test-user").SetPolicies(ApplicationConstants.AdminPolicy);

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		IElement menu = cut.Find(menuSelector);
		AssertLink(menu, "Home", "");
		AssertLink(menu, "Profile", "profile");
		AssertLink(menu, "Admin", "admin");
	}

	[Fact]
	public void Render_DesktopNav_CarriesHiddenAndMdFlexClasses()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		IElement nav = cut.Find("nav");
		nav.ClassList.Should().Contain(["hidden", "md:flex"]);
	}

	[Fact]
	public void Render_MobileMenu_DetailsCarriesMdHiddenClass()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		IElement details = cut.Find("details");
		details.ClassList.Should().Contain("md:hidden");
	}

	[Fact]
	public void Render_OnHomePage_HomeLinkInDesktopNavIsActiveWithAccentClasses()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		// bUnit's default NavigationManager starts at the root ("/"), so the Home NavLink (Match.All, href="")
		// is active without an explicit navigation.
		IElement homeLink = cut.Find("nav").QuerySelectorAll("a").Single(link => link.TextContent.Trim() == "Home");
		homeLink.ClassList.Should().Contain(["bg-accent-50", "text-accent-700"]);
	}

	[Fact]
	public void Render_DesktopNav_RendersThemeControlNotInMobileLayout()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		IElement nav = cut.Find("nav");
		IRenderedComponent<ThemeControl> themeControl =
			cut.FindComponents<ThemeControl>().Single(control => nav.Contains(control.Nodes[0]));
		themeControl.Instance.Mobile.Should().BeFalse();
	}

	[Fact]
	public void Render_MobileMenu_RendersThemeControlInMobileLayout()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		IElement details = cut.Find("details");
		IRenderedComponent<ThemeControl> themeControl =
			cut.FindComponents<ThemeControl>().Single(control => details.Contains(control.Nodes[0]));
		themeControl.Instance.Mobile.Should().BeTrue();
	}

	private static void AssertLink(IElement container, string text, string expectedHref)
	{
		IElement link = container.QuerySelectorAll("a").Single(a => a.TextContent.Trim() == text);
		link.GetAttribute("href").Should().Be(expectedHref);
	}

	private static void AssertLinkAbsent(IElement container, string text)
	{
		container.QuerySelectorAll("a").Should().NotContain(a => a.TextContent.Trim() == text);
	}
}
