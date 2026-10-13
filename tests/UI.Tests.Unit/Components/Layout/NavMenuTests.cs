// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     NavMenuTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;
using AngleSharp.Html.Dom;

using UI.Components.Features.Authentication;
using UI.Components.Layout;

namespace UI.Tests.Unit.Components.Layout;

public class NavMenuTests : BunitContext
{
	public NavMenuTests()
	{
		AddAuthorization().SetNotAuthorized();
	}

	[Fact]
	public void Render_HasLinkToHome()
	{
		// Arrange

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		IReadOnlyList<IElement> homeLinks = cut.FindAll("a[href='/']");
		homeLinks.Should().HaveCount(1);
	}

	[Fact]
	public void Render_BrandLink_ShowsFaviconBeforeName()
	{
		// Arrange

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		// Text nodes count here, unlike in CSS :first-child, so the order of the icon and the name is checked; the
		// whitespace-only text nodes from the markup's indentation are dropped.
		IElement brand = cut.Find("nav > a[href='']");
		INode[] content =
			[.. brand.ChildNodes.Where(node => node is IElement || !string.IsNullOrWhiteSpace(node.TextContent))];
		content.Should().HaveCount(2);
		content[0].Should().BeAssignableTo<IHtmlImageElement>()
			.Which.GetAttribute("src").Should().Be("favicon.png");
		content[1].TextContent.Trim().Should().Be("UI");
	}

	[Fact]
	public void Render_SignInOutComponent_IsPlacedAtTheNavBarsRight()
	{
		// Arrange

		// Act
		IRenderedComponent<NavMenu> cut = Render<NavMenu>();

		// Assert
		IElement nav = cut.Find("nav");
		IElement[] children = [.. nav.Children];
		children.Should().NotBeEmpty();
		IRenderedComponent<LoginDisplay> loginDisplay = cut.FindComponent<LoginDisplay>();
		IElement lastChild = children[^1];
		loginDisplay.Nodes.Should().NotBeEmpty();
		loginDisplay.Nodes.Should().AllSatisfy(node => lastChild.Contains(node).Should().BeTrue());
	}
}
