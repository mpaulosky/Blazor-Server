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

	[Fact]
	public void Render_ShowsStatusCodeEyebrow()
	{
		// Arrange

		// Act
		IRenderedComponent<NotFound> cut = Render<NotFound>();

		// Assert
		cut.FindAll("*").Should().Contain(element => element.TextContent.Trim() == "404");
	}

	[Fact]
	public void Render_ShowsLead()
	{
		// Arrange

		// Act
		IRenderedComponent<NotFound> cut = Render<NotFound>();

		// Assert
		cut.FindAll("p").Should()
			.Contain(element => element.TextContent.Trim() == "Sorry, the content you are looking for does not exist.");
	}

	[Fact]
	public void Render_ShowsBackToHomeLink()
	{
		// Arrange

		// Act
		IRenderedComponent<NotFound> cut = Render<NotFound>();

		// Assert
		IElement link = cut.Find("a");
		link.GetAttribute("href").Should().Be("");
		link.TextContent.Trim().Should().Be("Back to home");
	}
}
