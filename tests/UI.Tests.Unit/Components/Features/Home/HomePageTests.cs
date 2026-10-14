// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     HomePageTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

using Domain.Constants;

using UI.Components.Features.Home;

namespace UI.Tests.Unit.Components.Features.Home;

public class HomePageTests : BunitContext
{
	[Fact]
	public void Render_ShowsAppNameHeadingUnderTemplateEyebrowWithTheSpecsLead()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<HomePage> cut = Render<HomePage>();

		// Assert
		IElement heading = cut.Find("h1");
		heading.TextContent.Should().Be(ApplicationConstants.AppName);
		string? eyebrowText = heading.PreviousElementSibling?.TextContent.Trim();
		eyebrowText.Should().Be("Template");
		IElement header = heading.Closest("header") ?? throw new InvalidOperationException("No <header> ancestor.");
		string? leadText = header.QuerySelector("p")?.TextContent.Trim();
		leadText.Should().Be(
			"A server-rendered Blazor Web App with Tailwind CSS theming and Auth0 sign-in, ready to become your app.");
	}

	[Fact]
	public void Render_Visitor_ShowsPrimaryLogInLinkToProfileWithEnhancedNavDisabled()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<HomePage> cut = Render<HomePage>();

		// Assert
		IElement link = cut.Find("a[href='profile']");
		link.TextContent.Trim().Should().Be("Log in");
		link.GetAttribute("data-enhance-nav").Should().Be("false");
	}

	[Fact]
	public void Render_User_ShowsPrimaryYourProfileLinkToProfileWithEnhancedNavDisabled()
	{
		// Arrange
		AddAuthorization().SetAuthorized("test-user");

		// Act
		IRenderedComponent<HomePage> cut = Render<HomePage>();

		// Assert
		IElement link = cut.Find("a[href='profile']");
		link.TextContent.Trim().Should().Be("Your profile");
		link.GetAttribute("data-enhance-nav").Should().Be("false");
	}

	[Fact]
	public void Render_ShowsSecondaryViewOnGitHubLinkToTheRepository()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<HomePage> cut = Render<HomePage>();

		// Assert
		IElement link = cut.Find("a[href='https://github.com/mpaulosky/Blazor-Server']");
		link.TextContent.Trim().Should().Be("View on GitHub");
	}

	[Fact]
	public void Render_ShowsStatTilesForStackUiAndAuth()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<HomePage> cut = Render<HomePage>();

		// Assert
		IElement dl = cut.Find("dl");
		IElement[] labels = [.. dl.QuerySelectorAll("dt")];
		IElement[] values = [.. dl.QuerySelectorAll("dd")];
		labels.Select(label => label.TextContent.Trim()).Should().Equal("Stack", "UI", "Auth");
		values.Select(value => value.TextContent.Trim()).Should().Equal(".NET 10", "Tailwind", "Auth0");
	}

	[Theory]
	[InlineData("Domain: the Shared Kernel")]
	[InlineData("UI: feature slices with pages, handlers and validators")]
	[InlineData("AppHost: Aspire runs it locally with a dashboard")]
	[InlineData("ServiceDefaults: OpenTelemetry and health checks")]
	[InlineData("Tests: unit, bUnit, integration and Playwright E2E")]
	public void Render_WhatsInsideCard_ListsEachProjectWithTheSpecsText(string expectedItemText)
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<HomePage> cut = Render<HomePage>();

		// Assert
		IElement card = CardWithHeading(cut, "What's inside");
		IElement[] items = [.. card.QuerySelectorAll("li")];
		items.Select(item => item.TextContent.Trim()).Should().Contain(expectedItemText);
	}

	[Fact]
	public void Render_WhatsInsideCard_CarriesANeutralTemplateBadge()
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<HomePage> cut = Render<HomePage>();

		// Assert
		IElement card = CardWithHeading(cut, "What's inside");
		IElement badge = card.QuerySelectorAll("span").Single(span => span.TextContent.Trim() == "Template");
		badge.ClassList.Should().Contain("border-slate-200");
	}

	[Theory]
	[InlineData("Aspire", "bg-sky-100")]
	[InlineData("Blazor", "bg-violet-100")]
	[InlineData("Tailwind CSS v4", "bg-emerald-100")]
	[InlineData("Auth0", "bg-amber-100")]
	[InlineData("xUnit v3", "bg-sky-100")]
	[InlineData("Playwright", "bg-violet-100")]
	public void Render_HighlightsCard_ShowsEachBadgeWithTheSpecsTone(string label, string expectedToneClass)
	{
		// Arrange
		AddAuthorization().SetNotAuthorized();

		// Act
		IRenderedComponent<HomePage> cut = Render<HomePage>();

		// Assert
		IElement card = CardWithHeading(cut, "Highlights");
		IElement badge = card.QuerySelectorAll("span").Single(span => span.TextContent.Trim() == label);
		badge.ClassList.Should().Contain(expectedToneClass);
	}

	private static IElement CardWithHeading(IRenderedComponent<HomePage> cut, string heading)
	{
		IElement h2 = cut.FindAll("h2").Single(element => element.TextContent.Trim() == heading);

		return h2.Closest("section") ?? throw new InvalidOperationException($"No <section> ancestor for '{heading}'.");
	}
}
