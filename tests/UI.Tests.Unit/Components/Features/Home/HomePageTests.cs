// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     HomePageTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

using UI.Components.Features.Home;

namespace UI.Tests.Unit.Components.Features.Home;

public class HomePageTests : BunitContext
{
	[Fact]
	public void Render_ShowsHeadingWithTextBalanceUtility()
	{
		// Arrange

		// Act
		IRenderedComponent<HomePage> cut = Render<HomePage>();

		// Assert
		IElement heading = cut.Find("h1");
		heading.TextContent.Should().Be("Hello, world!");
		heading.ClassList.Should().Contain("text-balance");
	}
}
