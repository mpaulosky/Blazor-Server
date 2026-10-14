// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     PageHeaderTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

using UI.Components.Shared;

namespace UI.Tests.Unit.Components.Shared;

public class PageHeaderTests : BunitContext
{
	[Fact]
	public void Render_Title_RendersHeading()
	{
		// Arrange

		// Act
		IRenderedComponent<PageHeader> cut = Render<PageHeader>(parameters => parameters
			.Add(c => c.Title, "Page title"));

		// Assert
		cut.Find("h1").TextContent.Should().Be("Page title");
	}

	[Fact]
	public void Render_EyebrowSet_RendersEyebrowPill()
	{
		// Arrange

		// Act
		IRenderedComponent<PageHeader> cut = Render<PageHeader>(parameters => parameters
			.Add(c => c.Title, "Page title")
			.Add(c => c.Eyebrow, "Eyebrow text"));

		// Assert
		cut.Find("header").TextContent.Should().Contain("Eyebrow text");
	}

	[Fact]
	public void Render_EyebrowUnset_RendersNoEyebrowPill()
	{
		// Arrange

		// Act
		IRenderedComponent<PageHeader> cut = Render<PageHeader>(parameters => parameters
			.Add(c => c.Title, "Page title"));

		// Assert
		cut.FindAll(".bg-accent-100").Should().BeEmpty();
	}

	[Theory]
	[InlineData(true)]
	[InlineData(false)]
	public void Render_Eyebrow_AddsTopMarginToHeadingOnlyAfterEyebrow(bool eyebrowSet)
	{
		// Arrange

		// Act
		IRenderedComponent<PageHeader> cut = Render<PageHeader>(parameters =>
		{
			parameters.Add(c => c.Title, "Page title");
			if (eyebrowSet)
			{
				parameters.Add(c => c.Eyebrow, "Eyebrow text");
			}
		});

		// Assert
		cut.Find("h1").ClassList.Contains("mt-4").Should().Be(eyebrowSet);
	}

	[Fact]
	public void Render_LeadSet_RendersLeadParagraph()
	{
		// Arrange

		// Act
		IRenderedComponent<PageHeader> cut = Render<PageHeader>(parameters => parameters
			.Add(c => c.Title, "Page title")
			.Add(c => c.Lead, "Lead text"));

		// Assert
		IElement lead = cut.FindAll("p").Single(p => p.TextContent == "Lead text");
		lead.ClassList.Should().Contain("text-lg");
	}

	[Fact]
	public void Render_LeadUnset_RendersNoLeadParagraph()
	{
		// Arrange

		// Act
		IRenderedComponent<PageHeader> cut = Render<PageHeader>(parameters => parameters
			.Add(c => c.Title, "Page title"));

		// Assert
		cut.FindAll("p").Should().BeEmpty();
	}

	[Fact]
	public void Render_ChildContentSet_RendersActionsRow()
	{
		// Arrange

		// Act
		IRenderedComponent<PageHeader> cut = Render<PageHeader>(parameters => parameters
			.Add(c => c.Title, "Page title")
			.Add(c => c.ChildContent, "<button>Action</button>"));

		// Assert
		cut.Find("header").TextContent.Should().Contain("Action");
	}

	[Fact]
	public void Render_ClassParameter_AppearsAfterComponentsOwnClasses()
	{
		// Arrange

		// Act
		IRenderedComponent<PageHeader> cut = Render<PageHeader>(parameters => parameters
			.Add(c => c.Title, "Page title")
			.Add(c => c.Class, "custom-class"));

		// Assert
		string classAttribute = cut.Find("header").GetAttribute("class") ?? string.Empty;
		classAttribute.Should().Contain("custom-class");
	}

	[Fact]
	public void Render_UnmatchedAttribute_ReachesRootElement()
	{
		// Arrange

		// Act
		IRenderedComponent<PageHeader> cut = Render<PageHeader>(parameters => parameters
			.Add(c => c.Title, "Page title")
			.AddUnmatched("data-test", "x"));

		// Assert
		cut.Find("header").GetAttribute("data-test").Should().Be("x");
	}
}
