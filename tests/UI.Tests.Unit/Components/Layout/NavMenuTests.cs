// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     NavMenuTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

using UI.Components.Layout;

namespace UI.Tests.Unit.Components.Layout;

public class NavMenuTests : BunitContext
{
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
}
