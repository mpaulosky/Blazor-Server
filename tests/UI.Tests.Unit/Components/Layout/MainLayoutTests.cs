// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     MainLayoutTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

using Microsoft.Extensions.DependencyInjection;

using UI.Components.Layout;

namespace UI.Tests.Unit.Components.Layout;

public class MainLayoutTests : BunitContext
{
	private const string BodyMarkup = "<p>page content</p>";

	public MainLayoutTests()
	{
		AddAuthorization().SetNotAuthorized();
		Services.AddSingleton(TimeProvider.System);
	}

	[Fact]
	public void Render_RendersBodyContent()
	{
		// Arrange

		// Act
		IRenderedComponent<MainLayout> cut =
			Render<MainLayout>(parameters => parameters.Add(layout => layout.Body, BodyMarkup));

		// Assert
		cut.Markup.Should().Contain("page content");
	}

	[Fact]
	public void Render_IncludesNavMenuLinkToHome()
	{
		// Arrange

		// Act
		IRenderedComponent<MainLayout> cut =
			Render<MainLayout>(parameters => parameters.Add(layout => layout.Body, BodyMarkup));

		// Assert
		// The restyled NavMenu writes the link list once and renders it in both the desktop <nav> and the
		// <details> mobile menu (see NavMenuTests), so the Home link now appears twice, each base-relative.
		IReadOnlyList<IElement> homeLinks = cut.FindAll("a").Where(link => link.TextContent.Trim() == "Home").ToList();
		homeLinks.Should().HaveCount(2);
		homeLinks.Should().OnlyContain(link => link.GetAttribute("href") == string.Empty);
	}

	[Fact]
	public void Render_ErrorUiStartsHidden()
	{
		// Arrange

		// Act
		IRenderedComponent<MainLayout> cut =
			Render<MainLayout>(parameters => parameters.Add(layout => layout.Body, BodyMarkup));

		// Assert
		IElement errorUi = cut.Find("#blazor-error-ui");
		errorUi.ClassList.Should().Contain("hidden");
	}

	[Fact]
	public void Render_ErrorUi_KeepsDataNosnippetAndCarriesSpecAmberRootClassesWithNoFlexClass()
	{
		// Arrange

		// Act
		IRenderedComponent<MainLayout> cut =
			Render<MainLayout>(parameters => parameters.Add(layout => layout.Body, BodyMarkup));

		// Assert
		IElement errorUi = cut.Find("#blazor-error-ui");
		errorUi.GetAttribute("data-nosnippet").Should().NotBeNull();
		errorUi.ClassList.Should().Contain([
			"hidden", "fixed", "inset-x-4", "bottom-4", "z-50", "rounded-2xl", "border", "border-amber-200",
			"bg-amber-50", "px-5", "py-3", "text-sm", "text-amber-900", "shadow-lg", "dark:border-amber-500/30",
			"dark:bg-amber-950/80", "dark:text-amber-200"
		]);
		// Blazor shows the bar with style.display = 'block' on the root, which overrides any flex class there,
		// so the row that actually needs flex layout must sit on an inner element instead.
		errorUi.ClassList.Should().NotContain("flex");
	}

	[Fact]
	public void Render_ErrorUi_InnerRowHoldsMessageReloadLinkAndDismissButton()
	{
		// Arrange

		// Act
		IRenderedComponent<MainLayout> cut =
			Render<MainLayout>(parameters => parameters.Add(layout => layout.Body, BodyMarkup));

		// Assert
		IElement row = cut.Find("#blazor-error-ui div.flex.items-center.gap-4");
		row.TextContent.Should().Contain("An unhandled error has occurred.");
		row.QuerySelectorAll("a.reload").Should().ContainSingle();
		row.QuerySelectorAll("button.dismiss").Should().ContainSingle()
			.Which.GetAttribute("aria-label").Should().Be("Dismiss");
	}
}
