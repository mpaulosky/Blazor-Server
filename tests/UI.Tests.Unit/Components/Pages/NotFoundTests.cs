// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     NotFoundTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

using UI.Components.Pages;

namespace UI.Tests.Unit.Components.Pages;

public class NotFoundTests : BunitContext
{
	[Fact]
	public void Render_ShowsPageNotFoundHeading()
	{
		// Arrange

		// Act
		IRenderedComponent<NotFound> cut = Render<NotFound>();

		// Assert
		IElement heading = cut.Find("h1");
		heading.TextContent.Should().Be("Page not found");
	}
}
