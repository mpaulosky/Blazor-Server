// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     CardTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using AngleSharp.Dom;

using UI.Components.Shared;

namespace UI.Tests.Unit.Components.Shared;

public class CardTests : BunitContext
{
	[Fact]
	public void Render_ChildContent_RendersBody()
	{
		// Arrange

		// Act
		IRenderedComponent<Card> cut = Render<Card>(parameters => parameters
			.Add(c => c.ChildContent, "Body text"));

		// Assert
		cut.Find("section").TextContent.Should().Contain("Body text");
	}

	[Fact]
	public void Render_TitleAndActionsSet_RendersTitleRowBeforeBody()
	{
		// Arrange

		// Act
		IRenderedComponent<Card> cut = Render<Card>(parameters => parameters
			.Add(c => c.Title, "Card title")
			.Add(c => c.Actions, "<button>Action</button>")
			.Add(c => c.ChildContent, "Body text"));

		// Assert
		IElement heading = cut.Find("h2");
		heading.TextContent.Should().Be("Card title");
		cut.Find("section").TextContent.Should().Contain("Action").And.Contain("Body text");
	}

	[Fact]
	public void Render_TitleAndActionsUnset_RendersNoTitleRow()
	{
		// Arrange

		// Act
		IRenderedComponent<Card> cut = Render<Card>(parameters => parameters
			.Add(c => c.ChildContent, "Body text"));

		// Assert
		cut.FindAll("h2").Should().BeEmpty();
	}

	[Theory]
	[InlineData(CardSize.Hero, "rounded-[2rem]")]
	[InlineData(CardSize.Section, "rounded-3xl")]
	public void Render_Size_AppliesTheSizesDistinguishingClass(CardSize size, string distinguishingClass)
	{
		// Arrange

		// Act
		IRenderedComponent<Card> cut = Render<Card>(parameters => parameters
			.Add(c => c.Size, size)
			.Add(c => c.ChildContent, "Body text"));

		// Assert
		cut.Find("section").ClassList.Should().Contain(distinguishingClass);
	}

	[Fact]
	public void Render_ClassParameter_AppearsAfterComponentsOwnClasses()
	{
		// Arrange

		// Act
		IRenderedComponent<Card> cut = Render<Card>(parameters => parameters
			.Add(c => c.Size, CardSize.Section)
			.Add(c => c.Class, "custom-class")
			.Add(c => c.ChildContent, "Body text"));

		// Assert
		string classAttribute = cut.Find("section").GetAttribute("class") ?? string.Empty;
		classAttribute.Should().Contain("custom-class");
		classAttribute.IndexOf("rounded-3xl", StringComparison.Ordinal).Should()
			.BeLessThan(classAttribute.IndexOf("custom-class", StringComparison.Ordinal));
	}

	[Fact]
	public void Render_UnmatchedAttribute_ReachesRootElement()
	{
		// Arrange

		// Act
		IRenderedComponent<Card> cut = Render<Card>(parameters => parameters
			.AddUnmatched("data-test", "x")
			.Add(c => c.ChildContent, "Body text"));

		// Assert
		cut.Find("section").GetAttribute("data-test").Should().Be("x");
	}
}
