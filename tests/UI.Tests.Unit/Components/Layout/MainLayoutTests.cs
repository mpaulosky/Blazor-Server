// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     MainLayoutTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

using UI.Components.Layout;

namespace UI.Tests.Unit.Components.Layout;

public class MainLayoutTests : BunitContext
{
	private const string BodyMarkup = "<p>page content</p>";

	[Fact]
	public void Render_RendersBodyContent()
	{
		// Arrange

		// Act
		IRenderedComponent<MainLayout> cut = Render<MainLayout>(parameters => parameters.Add(layout => layout.Body, BodyMarkup));

		// Assert
		cut.Markup.Should().Contain("page content");
	}

	[Fact]
	public void Render_IncludesNavMenuLinkToHome()
	{
		// Arrange

		// Act
		IRenderedComponent<MainLayout> cut = Render<MainLayout>(parameters => parameters.Add(layout => layout.Body, BodyMarkup));

		// Assert
		IReadOnlyList<IElement> homeLinks = cut.FindAll("a[href='/']");
		homeLinks.Should().HaveCount(1);
	}

	[Fact]
	public void Render_ErrorUiStartsHidden()
	{
		// Arrange

		// Act
		IRenderedComponent<MainLayout> cut = Render<MainLayout>(parameters => parameters.Add(layout => layout.Body, BodyMarkup));

		// Assert
		IElement errorUi = cut.Find("#blazor-error-ui");
		errorUi.ClassList.Should().Contain("hidden");
	}
}
