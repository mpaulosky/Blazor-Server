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

		IElement brand = (IElement)letterTile.ParentElement!;
		brand.TagName.Should().Be("A");
		brand.GetAttribute("href").Should().BeEmpty();

		INode[] content =
			[.. brand.ChildNodes.Where(node => node is IElement || !string.IsNullOrWhiteSpace(node.TextContent))];
		content.Should().HaveCount(2);

		// AngleSharp's INode declares a structural `bool Equals(INode)` rather than overriding
		// IEquatable<INode>, so FluentAssertions' Be() (which dispatches through
		// EqualityComparer<T>.Default) can't reach it and falls back to reference equality between
		// bUnit's wrapper and the raw node - always false even for the same tile. Assert the tile's
		// own attributes instead of comparing node identity.
		IElement firstChild = content[0].Should().BeAssignableTo<IElement>().Subject;
		firstChild.GetAttribute("aria-hidden").Should().Be("true");
		firstChild.TextContent.Trim().Should().Be(ApplicationConstants.AppName[..1]);
		content[1].TextContent.Trim().Should().Be(ApplicationConstants.AppName);
	}

	[Fact]
	public void Render_Visitor_DesktopNavAndMobileMenuEachListOnlyHomeBaseRelative()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		AssertLink(cut.Find("nav"), "Home", "");
		AssertLinkAbsent(cut.Find("nav"), "Profile");
		AssertLinkAbsent(cut.Find("nav"), "Admin");
		AssertLink(cut.Find("details"), "Home", "");
		AssertLinkAbsent(cut.Find("details"), "Profile");
		AssertLinkAbsent(cut.Find("details"), "Admin");
	}

	[Fact]
	public void Render_User_DesktopNavAndMobileMenuEachAddProfileBaseRelativeButNotAdmin()
	{
		// Arrange
		AddAuthorization().SetAuthorized("test-user");

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		AssertLink(cut.Find("nav"), "Home", "");
		AssertLink(cut.Find("nav"), "Profile", "profile");
		AssertLinkAbsent(cut.Find("nav"), "Admin");
		AssertLink(cut.Find("details"), "Home", "");
		AssertLink(cut.Find("details"), "Profile", "profile");
		AssertLinkAbsent(cut.Find("details"), "Admin");
	}

	[Fact]
	public void Render_Admin_DesktopNavAndMobileMenuEachAddAdminBaseRelative()
	{
		// Arrange
		AddAuthorization().SetAuthorized("test-user").SetPolicies(ApplicationConstants.AdminPolicy);

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		AssertLink(cut.Find("nav"), "Home", "");
		AssertLink(cut.Find("nav"), "Profile", "profile");
		AssertLink(cut.Find("nav"), "Admin", "admin");
		AssertLink(cut.Find("details"), "Home", "");
		AssertLink(cut.Find("details"), "Profile", "profile");
		AssertLink(cut.Find("details"), "Admin", "admin");
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
