// ============================================
// Copyright (c) 2026. All rights reserved.
// File Name :     ButtonTests.cs
// Company :       mpaulosky
// Author :        Teqslamer
// Solution Name : Blazor-Server
// Project Name :  UI.Tests.Unit
// =============================================

using UI.Components.Shared;

namespace UI.Tests.Unit.Components.Shared;

public class ButtonTests : BunitContext
{
	[Fact]
	public void Render_ChildContent_RendersText()
	{
		// Arrange

		// Act
		IRenderedComponent<Button> cut = Render<Button>(parameters => parameters
			.Add(c => c.ChildContent, "Click me"));

		// Assert
		cut.Find("button").TextContent.Should().Be("Click me");
	}

	[Fact]
	public void Render_HrefUnset_RendersButtonWithTypeButton()
	{
		// Arrange

		// Act
		IRenderedComponent<Button> cut = Render<Button>(parameters => parameters
			.Add(c => c.ChildContent, "Click me"));

		// Assert
		cut.FindAll("a").Should().BeEmpty();
		cut.Find("button").GetAttribute("type").Should().Be("button");
	}

	[Fact]
	public void Render_HrefSet_RendersAnchorWithHref()
	{
		// Arrange

		// Act
		IRenderedComponent<Button> cut = Render<Button>(parameters => parameters
			.Add(c => c.Href, "profile")
			.Add(c => c.ChildContent, "Your profile"));

		// Assert
		cut.FindAll("button").Should().BeEmpty();
		cut.Find("a").GetAttribute("href").Should().Be("profile");
	}

	[Fact]
	public void Render_TypeOverride_OverridesTheDefaultButtonType()
	{
		// Arrange

		// Act
		IRenderedComponent<Button> cut = Render<Button>(parameters => parameters
			.Add(c => c.Type, "submit")
			.Add(c => c.ChildContent, "Save"));

		// Assert
		cut.Find("button").GetAttribute("type").Should().Be("submit");
	}

	[Theory]
	[InlineData(ButtonKind.Primary, "bg-accent-600")]
	[InlineData(ButtonKind.Secondary, "border-slate-300")]
	public void Render_Kind_AppliesTheKindsDistinguishingClass(ButtonKind kind, string distinguishingClass)
	{
		// Arrange

		// Act
		IRenderedComponent<Button> cut = Render<Button>(parameters => parameters
			.Add(c => c.Kind, kind)
			.Add(c => c.ChildContent, "Click me"));

		// Assert
		cut.Find("button").ClassList.Should().Contain(distinguishingClass);
	}

	[Fact]
	public void Render_ClassParameter_AppearsAfterComponentsOwnClasses()
	{
		// Arrange

		// Act
		IRenderedComponent<Button> cut = Render<Button>(parameters => parameters
			.Add(c => c.ChildContent, "Click me")
			.Add(c => c.Class, "custom-class"));

		// Assert
		string classAttribute = cut.Find("button").GetAttribute("class") ?? string.Empty;
		classAttribute.Should().Contain("custom-class");
		classAttribute.IndexOf("rounded-xl", StringComparison.Ordinal).Should()
			.BeLessThan(classAttribute.IndexOf("custom-class", StringComparison.Ordinal));
	}

	[Fact]
	public void Render_UnmatchedAttribute_ReachesRootElement()
	{
		// Arrange

		// Act
		IRenderedComponent<Button> cut = Render<Button>(parameters => parameters
			.Add(c => c.ChildContent, "Click me")
			.AddUnmatched("data-enhance-nav", "false"));

		// Assert
		cut.Find("button").GetAttribute("data-enhance-nav").Should().Be("false");
	}
}
