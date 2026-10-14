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

using UI.Components.Layout;

namespace UI.Tests.Unit.Components.Layout;

public class NavMenuTests : BunitContext
{
	private const string ThemeFormSelector = "form[role='group'][aria-label='Theme']";

	// The desktop Palette menu adds its own nested <details>, so selectors for the mobile menu's <details> scope to
	// its direct parentage rather than matching whichever <details> comes first.
	private const string MobileMenuSelector = "header > div > details";

	private const string PaletteFormSelector = "form[action='palette']";

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
	[InlineData(MobileMenuSelector)]
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
	[InlineData(MobileMenuSelector)]
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
	[InlineData(MobileMenuSelector)]
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
		IElement details = cut.Find(MobileMenuSelector);
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
		// The form is found in the rendered nav rather than through FindComponents<ThemeControl>(), because bUnit parses
		// each found component's markup into a document of its own, which no element of the nav ever contains.
		IElement nav = cut.Find("nav");
		IElement themeForm = nav.QuerySelectorAll(ThemeFormSelector).Should().ContainSingle().Subject;
		themeForm.ClassList.Should().NotContain("grid-cols-3");
	}

	[Fact]
	public void Render_MobileMenu_RendersThemeControlInMobileLayout()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		IElement details = cut.Find(MobileMenuSelector);
		IElement themeForm = details.QuerySelectorAll(ThemeFormSelector).Should().ContainSingle().Subject;
		themeForm.ClassList.Should().Contain("grid-cols-3");
	}

	[Fact]
	public void Render_DesktopNav_RendersPaletteMenuAfterThemeControl()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		IElement nav = cut.Find("nav");
		IElement[] forms = [.. nav.QuerySelectorAll("form")];
		forms.Should().HaveCount(2);
		forms[0].Matches(ThemeFormSelector).Should().BeTrue();
		forms[1].Matches(PaletteFormSelector).Should().BeTrue();
	}

	[Fact]
	public void Render_MobileMenu_RendersPaletteMenuAfterThemeControl()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		IElement details = cut.Find(MobileMenuSelector);
		IElement[] forms = [.. details.QuerySelectorAll("form")];
		forms.Should().HaveCount(2);
		forms[0].Matches(ThemeFormSelector).Should().BeTrue();
		forms[1].Matches(PaletteFormSelector).Should().BeTrue();
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
